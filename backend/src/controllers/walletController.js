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

const paymentService = require('../services/paymentService');

/**
 * Get available coin packages
 * GET /api/wallet/packages
 */
exports.getCoinPackages = async (req, res, next) => {
  try {
    const packages = paymentService.getCoinPackages();

    res.json({
      success: true,
      data: {
        packages,
      },
    });
  } catch (error) {
    logger.error('Failed to get coin packages', { error: error.message });
    next(error);
  }
};

/**
 * Purchase coins
 * POST /api/wallet/purchase-coins
 * Body: { packageId, gateway, currency }
 */
exports.purchaseCoins = async (req, res, next) => {
  try {
    const { packageId, gateway = 'stripe', currency = 'USD' } = req.body;
    const userId = req.userId;

    // Validate required fields
    if (!packageId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Package ID is required',
      });
    }

    // Validate gateway
    const validGateways = ['stripe', 'paypal', 'mada', 'stcpay'];
    if (!validGateways.includes(gateway)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid payment gateway',
      });
    }

    // Get IP address and device info for fraud detection
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const deviceId = req.headers['x-device-id'] || null;

    // Create payment session
    const session = await paymentService.createPaymentSession(userId, packageId, gateway, {
      currency,
      ipAddress,
      deviceId,
      successUrl: `${process.env.APP_URL || 'http://localhost:3000'}/payment/success`,
      cancelUrl: `${process.env.APP_URL || 'http://localhost:3000'}/payment/cancel`,
    });

    logger.info('Coin purchase initiated', { userId, packageId, gateway, sessionId: session.sessionId });

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        paymentUrl: session.paymentUrl,
        gateway: session.gateway,
      },
    });
  } catch (error) {
    logger.error('Failed to purchase coins', { userId: req.userId, error: error.message });
    
    if (error.message.includes('security reasons')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Payment blocked for security reasons. Please contact support.',
      });
    }

    next(error);
  }
};

/**
 * Handle Stripe webhook
 * POST /api/wallet/webhook/stripe
 */
exports.handleStripeWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['stripe-signature'];
    
    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Missing stripe-signature header',
      });
    }

    // Process webhook
    const result = await paymentService.handleWebhook('stripe', req.body, signature);

    logger.info('Stripe webhook processed', { result });

    res.json({
      success: true,
      received: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to handle Stripe webhook', { error: error.message });
    
    // Return 400 for webhook verification failures
    if (error.message.includes('verification') || error.message.includes('signature')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Webhook verification failed',
      });
    }

    // Return 200 for other errors to prevent retries
    res.status(200).json({
      success: false,
      received: true,
      error: error.message,
    });
  }
};

/**
 * Handle PayPal webhook
 * POST /api/wallet/webhook/paypal
 */
exports.handlePayPalWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['paypal-signature'];
    
    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Missing paypal-signature header',
      });
    }

    // Process webhook
    const result = await paymentService.handleWebhook('paypal', req.body, signature);

    logger.info('PayPal webhook processed', { result });

    res.json({
      success: true,
      received: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to handle PayPal webhook', { error: error.message });
    
    // Return 400 for webhook verification failures
    if (error.message.includes('verification') || error.message.includes('signature')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Webhook verification failed',
      });
    }

    // Return 200 for other errors to prevent retries
    res.status(200).json({
      success: false,
      received: true,
      error: error.message,
    });
  }
};

/**
 * Handle Mada webhook
 * POST /api/wallet/webhook/mada
 */
exports.handleMadaWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['mada-signature'];
    
    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Missing mada-signature header',
      });
    }

    // Process webhook
    const result = await paymentService.handleWebhook('mada', req.body, signature);

    logger.info('Mada webhook processed', { result });

    res.json({
      success: true,
      received: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to handle Mada webhook', { error: error.message });
    
    // Return 400 for webhook verification failures
    if (error.message.includes('verification') || error.message.includes('signature')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Webhook verification failed',
      });
    }

    // Return 200 for other errors to prevent retries
    res.status(200).json({
      success: false,
      received: true,
      error: error.message,
    });
  }
};

/**
 * Handle stc pay webhook
 * POST /api/wallet/webhook/stcpay
 */
exports.handleStcPayWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['stcpay-signature'];
    
    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Missing stcpay-signature header',
      });
    }

    // Process webhook
    const result = await paymentService.handleWebhook('stcpay', req.body, signature);

    logger.info('stc pay webhook processed', { result });

    res.json({
      success: true,
      received: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to handle stc pay webhook', { error: error.message });
    
    // Return 400 for webhook verification failures
    if (error.message.includes('verification') || error.message.includes('signature')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Webhook verification failed',
      });
    }

    // Return 200 for other errors to prevent retries
    res.status(200).json({
      success: false,
      received: true,
      error: error.message,
    });
  }
};

const WithdrawalRequest = require('../models/WithdrawalRequest');
const Host = require('../models/Host');

/**
 * Create withdrawal request
 * POST /api/wallet/withdraw
 */
exports.createWithdrawal = async (req, res, next) => {
  try {
    const { userId, diamondAmount, paymentMethod, paymentDetails } = req.body;

    // Authorization check - users can only create withdrawals for themselves
    if (req.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only create withdrawals for your own account',
      });
    }

    // Check if user is a host
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'User not found',
      });
    }

    if (!user.isHost) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only hosts can create withdrawal requests',
      });
    }

    // Validate minimum diamond balance (1000 diamonds)
    if (diamondAmount < 1000) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Minimum withdrawal amount is 1000 diamonds',
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

    // Check if user has sufficient diamond balance
    if (wallet.diamondBalance < diamondAmount) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Insufficient diamond balance',
      });
    }

    // Calculate real credit amount using conversion rate
    // Default conversion rate: 100 diamonds = 1 USD
    const conversionRate = process.env.DIAMOND_TO_USD_RATE || 0.01; // 1 diamond = $0.01
    const creditAmount = diamondAmount * conversionRate;

    // Deduct diamonds from wallet
    await wallet.deductDiamonds(diamondAmount);

    // Create withdrawal request
    const withdrawalRequest = new WithdrawalRequest({
      userId,
      diamondAmount,
      creditAmount,
      status: 'pending',
      paymentMethod,
      paymentDetails,
    });

    await withdrawalRequest.save();

    // Create transaction record
    const transaction = new Transaction({
      userId,
      type: 'withdrawal',
      amount: diamondAmount,
      currency: 'diamonds',
      description: `Withdrawal request for ${diamondAmount} diamonds`,
      metadata: {
        withdrawalRequestId: withdrawalRequest._id,
        status: 'pending',
        creditAmount,
        paymentMethod,
      },
    });

    await transaction.save();

    logger.info('Withdrawal request created', {
      withdrawalRequestId: withdrawalRequest._id,
      userId,
      diamondAmount,
      creditAmount,
      paymentMethod,
      newDiamondBalance: wallet.diamondBalance,
    });

    res.status(201).json({
      success: true,
      data: {
        withdrawalRequestId: withdrawalRequest._id,
        diamondAmount,
        creditAmount,
        status: withdrawalRequest.status,
        requestedAt: withdrawalRequest.requestedAt,
        newDiamondBalance: wallet.diamondBalance,
      },
    });
  } catch (error) {
    logger.error('Failed to create withdrawal request', {
      userId: req.body.userId,
      error: error.message,
    });
    next(error);
  }
};

/**
 * Get withdrawal requests for a user
 * GET /api/wallet/withdrawals/:userId
 */
exports.getWithdrawals = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    // Authorization check - users can only view their own withdrawals
    if (req.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only view your own withdrawal requests',
      });
    }

    // Build query
    const query = { userId };
    if (status) {
      query.status = status;
    }

    // Validate pagination parameters
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid pagination parameters',
      });
    }

    // Get withdrawal requests
    const withdrawals = await WithdrawalRequest.find(query)
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await WithdrawalRequest.countDocuments(query);

    res.json({
      success: true,
      data: {
        withdrawals,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get withdrawal requests', {
      userId: req.params.userId,
      error: error.message,
    });
    next(error);
  }
};

/**
 * Get withdrawal request by ID
 * GET /api/wallet/withdrawals/:userId/:withdrawalId
 */
exports.getWithdrawalById = async (req, res, next) => {
  try {
    const { userId, withdrawalId } = req.params;

    // Authorization check - users can only view their own withdrawals
    if (req.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only view your own withdrawal requests',
      });
    }

    const withdrawal = await WithdrawalRequest.findOne({
      _id: withdrawalId,
      userId,
    });

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Withdrawal request not found',
      });
    }

    res.json({
      success: true,
      data: {
        withdrawal,
      },
    });
  } catch (error) {
    logger.error('Failed to get withdrawal request', {
      userId: req.params.userId,
      withdrawalId: req.params.withdrawalId,
      error: error.message,
    });
    next(error);
  }
};

// Need to import User model
const User = require('../models/User');