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

class AuthorizationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
  }
}

/**
 * Register as a host
 * POST /api/hosts/register
 */
const registerHost = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const { additionalInfo } = req.body;

    // Authorization check - users can only register themselves as hosts
    if (req.userId !== userId) {
      return res.status(403).json({
        error: 'You can only register yourself as a host',
        code: 'FORBIDDEN',
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if user is already a host
    if (user.isHost) {
      throw new ValidationError('User is already a host');
    }

    // Check if host registration already exists
    const existingHost = await Host.findOne({ userId });
    if (existingHost) {
      if (existingHost.isApproved) {
        throw new ValidationError('Host registration already approved');
      } else {
        throw new ValidationError('Host registration already pending');
      }
    }

    // Create host registration
    const host = new Host({
      userId,
      isApproved: false,
      statistics: {
        totalStreams: 0,
        totalViewers: 0,
        totalGiftsReceived: 0,
        totalDiamondsEarned: 0,
      },
    });

    await host.save();

    logger.info('Host registration created', {
      hostId: host._id,
      userId,
    });

    res.status(201).json({
      hostId: host._id,
      status: 'pending',
      message: 'Host registration submitted for approval',
    });
  } catch (error) {
    logger.error('Host registration error', {
      error: error.message,
      userId: req.body.userId,
    });
    next(error);
  }
};

/**
 * Get pending host registrations (admin only)
 * GET /api/admin/hosts/pending
 */
const getPendingHosts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get pending hosts with user information
    const hosts = await Host.find({ isApproved: false })
      .populate('userId', 'displayName email profilePictureUrl registeredAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Host.countDocuments({ isApproved: false });

    res.json({
      hosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get pending hosts error', {
      error: error.message,
    });
    next(error);
  }
};

/**
 * Approve host registration (admin only)
 * PUT /api/admin/hosts/:hostId/approve
 */
const approveHost = async (req, res, next) => {
  try {
    const { hostId } = req.params;
    const { notes } = req.body;

    // Find host
    const host = await Host.findById(hostId);
    if (!host) {
      throw new NotFoundError('Host registration not found');
    }

    if (host.isApproved) {
      throw new ValidationError('Host is already approved');
    }

    // Update host status
    host.isApproved = true;
    host.approvedAt = new Date();
    host.approvedBy = req.userId;

    // Update user isHost flag
    const user = await User.findById(host.userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    user.isHost = true;
    
    // Save both updates
    await Promise.all([host.save(), user.save()]);

    logger.info('Host approved', {
      hostId,
      approvedBy: req.userId,
      userId: host.userId,
    });

    res.json({
      success: true,
      message: 'Host approved successfully',
      host: {
        id: host._id,
        userId: host.userId,
        isApproved: host.isApproved,
        approvedAt: host.approvedAt,
        approvedBy: host.approvedBy,
      },
    });
  } catch (error) {
    logger.error('Approve host error', {
      error: error.message,
      hostId: req.params.hostId,
    });
    next(error);
  }
};

/**
 * Get host earnings dashboard
 * GET /api/hosts/:userId/earnings
 */
const getHostEarnings = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Authorization check - users can only view their own earnings
    if (req.userId !== userId) {
      return res.status(403).json({
        error: 'You can only view your own earnings',
        code: 'FORBIDDEN',
      });
    }

    // Check if user is a host
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!user.isHost) {
      throw new ValidationError('User is not a host');
    }

    // Get host record
    const host = await Host.findOne({ userId });
    if (!host) {
      throw new NotFoundError('Host record not found');
    }

    // Calculate total diamonds earned from transactions
    const diamondTransactions = await Transaction.aggregate([
      {
        $match: {
          userId: user._id,
          type: 'diamondEarned',
          currency: 'diamonds',
        },
      },
      {
        $group: {
          _id: null,
          totalDiamonds: { $sum: '$amount' },
        },
      },
    ]);

    const totalDiamonds = diamondTransactions.length > 0 ? diamondTransactions[0].totalDiamonds : 0;

    // Calculate pending withdrawal amounts
    const pendingWithdrawals = await Transaction.aggregate([
      {
        $match: {
          userId: user._id,
          type: 'withdrawal',
          currency: 'diamonds',
          'metadata.status': 'pending',
        },
      },
      {
        $group: {
          _id: null,
          totalPending: { $sum: '$amount' },
        },
      },
    ]);

    const pendingWithdrawalAmount = pendingWithdrawals.length > 0 ? pendingWithdrawals[0].totalPending : 0;

    // Calculate completed withdrawal amounts
    const completedWithdrawals = await Transaction.aggregate([
      {
        $match: {
          userId: user._id,
          type: 'withdrawal',
          currency: 'diamonds',
          'metadata.status': 'completed',
        },
      },
      {
        $group: {
          _id: null,
          totalCompleted: { $sum: '$amount' },
        },
      },
    ]);

    const completedWithdrawalAmount = completedWithdrawals.length > 0 ? completedWithdrawals[0].totalCompleted : 0;

    // Get wallet balance
    const wallet = await Wallet.findOne({ userId });
    const currentDiamondBalance = wallet ? wallet.diamondBalance : 0;

    res.json({
      earnings: {
        totalDiamondsEarned: totalDiamonds,
        currentDiamondBalance,
        pendingWithdrawals: pendingWithdrawalAmount,
        completedWithdrawals: completedWithdrawalAmount,
        availableForWithdrawal: currentDiamondBalance - pendingWithdrawalAmount,
      },
      statistics: host.statistics,
    });
  } catch (error) {
    logger.error('Get host earnings error', {
      error: error.message,
      userId: req.params.userId,
    });
    next(error);
  }
};

module.exports = {
  registerHost,
  getPendingHosts,
  approveHost,
  getHostEarnings,
};