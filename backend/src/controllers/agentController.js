const Agent = require('../models/Agent');
const Host = require('../models/Host');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const logger = require('../utils/logger');

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

/**
 * Register an agent (admin only)
 * POST /api/admin/agents/register
 */
const registerAgent = async (req, res, next) => {
  try {
    const { name, email, commissionRate } = req.body;

    // Validate commission rate
    if (commissionRate < 0 || commissionRate > 100) {
      throw new ValidationError('Commission rate must be between 0 and 100');
    }

    // Check if agent with email already exists
    const existingAgent = await Agent.findOne({ email });
    if (existingAgent) {
      throw new ValidationError('Agent with this email already exists');
    }

    // Create agent
    const agent = new Agent({
      name,
      email,
      commissionRate,
      isActive: true,
    });

    await agent.save();

    logger.info('Agent registered', {
      agentId: agent._id,
      name,
      email,
      commissionRate,
    });

    res.status(201).json({
      agentId: agent._id,
      name: agent.name,
      email: agent.email,
      commissionRate: agent.commissionRate,
      isActive: agent.isActive,
      createdAt: agent.createdAt,
    });
  } catch (error) {
    logger.error('Agent registration error', {
      error: error.message,
      email: req.body.email,
    });
    next(error);
  }
};

/**
 * Assign host to agent (admin only)
 * PUT /api/admin/hosts/:hostId/assign-agent
 */
const assignHostToAgent = async (req, res, next) => {
  try {
    const { hostId } = req.params;
    const { agentId } = req.body;

    // Find host
    const host = await Host.findById(hostId);
    if (!host) {
      throw new NotFoundError('Host not found');
    }

    // Find agent
    const agent = await Agent.findById(agentId);
    if (!agent) {
      throw new NotFoundError('Agent not found');
    }

    if (!agent.isActive) {
      throw new ValidationError('Agent is not active');
    }

    // Update host with agent assignment
    host.agentId = agentId;
    await host.save();

    logger.info('Host assigned to agent', {
      hostId,
      agentId,
      userId: host.userId,
    });

    res.json({
      success: true,
      message: 'Host successfully assigned to agent',
      host: {
        id: host._id,
        userId: host.userId,
        agentId: host.agentId,
        agentName: agent.name,
      },
    });
  } catch (error) {
    logger.error('Assign host to agent error', {
      error: error.message,
      hostId: req.params.hostId,
      agentId: req.body.agentId,
    });
    next(error);
  }
};

/**
 * Calculate commission for agent
 * This should be called when a host earns diamonds
 */
const calculateCommission = async (hostId, diamondAmount, session = null) => {
  try {
    const host = await Host.findById(hostId).populate('agentId').session(session || null);
    if (!host || !host.agentId) {
      return null; // No agent assigned, no commission
    }

    const agent = host.agentId;
    if (!agent.isActive) {
      return null; // Agent not active, no commission
    }

    const commissionAmount = (diamondAmount * agent.commissionRate) / 100;
    
    if (commissionAmount <= 0) {
      return null; // No commission if amount is 0 or negative
    }

    return {
      agentId: agent._id,
      hostId: host._id,
      hostUserId: host.userId,
      diamondAmount,
      commissionRate: agent.commissionRate,
      commissionAmount,
    };
  } catch (error) {
    logger.error('Commission calculation error', {
      error: error.message,
      hostId,
      diamondAmount,
    });
    return null;
  }
};

/**
 * Credit commission to agent wallet
 */
const creditCommissionToAgent = async (commissionData, session = null) => {
  try {
    const { agentId, hostId, hostUserId, diamondAmount, commissionRate, commissionAmount } = commissionData;

    // Get agent's wallet
    let agentWallet = await Wallet.findOne({ userId: agentId }).session(session || null);
    if (!agentWallet) {
      // Create wallet if it doesn't exist
      agentWallet = new Wallet({
        userId: agentId,
        coinBalance: 0,
        diamondBalance: 0,
      });
    }

    // Credit commission as diamonds to agent's wallet
    agentWallet.diamondBalance += commissionAmount;
    agentWallet.updatedAt = new Date();
    
    if (session) {
      await agentWallet.save({ session });
    } else {
      await agentWallet.save();
    }

    // Create commission transaction record
    const commissionTransaction = new Transaction({
      userId: agentId,
      type: 'commission',
      amount: commissionAmount,
      currency: 'diamonds',
      description: `Commission from host earnings (${commissionRate}% of ${diamondAmount} diamonds)`,
      metadata: {
        hostId,
        hostUserId,
        diamondAmount,
        commissionRate,
      },
    });

    if (session) {
      await commissionTransaction.save({ session });
    } else {
      await commissionTransaction.save();
    }

    logger.info('Commission credited to agent', {
      agentId,
      hostId,
      commissionAmount,
      commissionRate,
      newDiamondBalance: agentWallet.diamondBalance,
    });

    return {
      success: true,
      agentId,
      commissionAmount,
      newBalance: agentWallet.diamondBalance,
    };
  } catch (error) {
    logger.error('Commission credit error', {
      error: error.message,
      commissionData,
    });
    throw error;
  }
};

/**
 * Get agent commission reports
 * GET /api/admin/agents/:agentId/commissions
 */
const getAgentCommissions = async (req, res, next) => {
  try {
    const { agentId } = req.params;
    const { startDate, endDate, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Find agent
    const agent = await Agent.findById(agentId);
    if (!agent) {
      throw new NotFoundError('Agent not found');
    }

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.timestamp = { $gte: new Date(startDate) };
    }
    if (endDate) {
      dateFilter.timestamp = dateFilter.timestamp || {};
      dateFilter.timestamp.$lte = new Date(endDate);
    }

    // Get commission transactions
    const transactions = await Transaction.find({
      userId: agentId,
      type: 'commission',
      ...dateFilter,
    })
      .populate('metadata.hostId', 'userId')
      .populate('metadata.hostUserId', 'displayName')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await Transaction.countDocuments({
      userId: agentId,
      type: 'commission',
      ...dateFilter,
    });

    // Calculate total commissions
    const totalCommissions = await Transaction.aggregate([
      {
        $match: {
          userId: agentId,
          type: 'commission',
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    // Get per-host breakdown
    const perHostBreakdown = await Transaction.aggregate([
      {
        $match: {
          userId: agentId,
          type: 'commission',
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: '$metadata.hostId',
          totalCommission: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'hosts',
          localField: '_id',
          foreignField: '_id',
          as: 'host',
        },
      },
      {
        $unwind: '$host',
      },
      {
        $lookup: {
          from: 'users',
          localField: 'host.userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $project: {
          hostId: '$_id',
          hostName: '$user.displayName',
          totalCommission: 1,
          transactionCount: 1,
        },
      },
      {
        $sort: { totalCommission: -1 },
      },
    ]);

    res.json({
      agent: {
        id: agent._id,
        name: agent.name,
        email: agent.email,
        commissionRate: agent.commissionRate,
        isActive: agent.isActive,
      },
      commissions: {
        transactions,
        totalAmount: totalCommissions.length > 0 ? totalCommissions[0].totalAmount : 0,
        perHostBreakdown,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Get agent commissions error', {
      error: error.message,
      agentId: req.params.agentId,
    });
    next(error);
  }
};

module.exports = {
  registerAgent,
  assignHostToAgent,
  calculateCommission,
  creditCommissionToAgent,
  getAgentCommissions,
};