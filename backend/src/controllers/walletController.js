const Wallet = require('../models/Wallet');
const transactionService = require('../services/transactionService');
const logger = require('../utils/logger');

/**
 * Get wallet information for a user
 * GET /api/wallet/:userId
 */
exports.getWallet = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Authorization check - users can only view their own wallet
    if (req.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only view your own wallet',
      });
    }

    // Get wallet
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Wallet not found',
      });
    }

    // Get recent transactions (last 10)
    const { transactions } = await transactionService.getTransactionHistory(userId, {
      page: 1,
      limit: 10,
    });

    res.json({
      success: true,
      data: {
        userId: wallet.userId,
        coinBalance: wallet.coinBalance,
        diamondBalance: wallet.diamondBalance,
        updatedAt: wallet.updatedAt,
        recentTransactions: transactions,
      },
    });
  } catch (error) {
    logger.error('Failed to get wallet', { userId: req.params.userId, error: error.message });
    next(error);
  }
};

/**
 * Get transaction history for a user
 * GET /api/wallet/transactions/:userId
 * Query params: page, limit, type
 */
exports.getTransactions = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, type } = req.query;

    // Authorization check - users can only view their own transactions
    if (req.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only view your own transactions',
      });
    }

    // Validate pagination parameters
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid pagination parameters',
      });
    }

    // Validate transaction type if provided
    const validTypes = ['coinPurchase', 'giftSent', 'giftReceived', 'diamondEarned', 'withdrawal', 'commission'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid transaction type',
      });
    }

    // Get transaction history
    const result = await transactionService.getTransactionHistory(userId, {
      page: pageNum,
      limit: limitNum,
      type,
    });

    res.json({
      success: true,
      data: {
        transactions: result.transactions,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    logger.error('Failed to get transactions', { userId: req.params.userId, error: error.message });
    next(error);
  }
};

/**
 * Get wallet balance only (lightweight endpoint)
 * GET /api/wallet/:userId/balance
 */
exports.getBalance = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Authorization check
    if (req.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only view your own balance',
      });
    }

    // Get wallet
    const wallet = await Wallet.findOne({ userId }).select('coinBalance diamondBalance updatedAt');
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Wallet not found',
      });
    }

    res.json({
      success: true,
      data: {
        coinBalance: wallet.coinBalance,
        diamondBalance: wallet.diamondBalance,
        updatedAt: wallet.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Failed to get balance', { userId: req.params.userId, error: error.message });
    next(error);
  }
};

module.exports = exports;
