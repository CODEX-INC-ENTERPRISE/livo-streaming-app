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
