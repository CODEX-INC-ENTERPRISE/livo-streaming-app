const StripeGateway = require('./gateways/StripeGateway');
const PayPalGateway = require('./gateways/PayPalGateway');
const BaseGateway = require('./gateways/BaseGateway');
const PaymentIntent = require('../models/PaymentIntent');
const Wallet = require('../models/Wallet');
const transactionService = require('./transactionService');
const logger = require('../utils/logger');
const { createRetryable } = require('../utils/retry');

/**
 * Payment Service
 * Handles coin purchase flow, payment session creation, webhook processing, and fraud detection
 */
class PaymentService {
  constructor() {
    this.gateways = {};
    this.initializeGateways();
    this.coinPackages = this.getDefaultCoinPackages();
  }

  /**
   * Initialize payment gateways
   */
  initializeGateways() {
    try {
      this.gateways.stripe = new StripeGateway();
      this.gateways.paypal = new PayPalGateway();
      
      // Placeholder gateways for Mada and stc pay
      this.gateways.mada = this.createPlaceholderGateway('mada');
      this.gateways.stcpay = this.createPlaceholderGateway('stcpay');
      
      logger.info('Payment gateways initialized', {
        availableGateways: Object.keys(this.gateways),
      });
    } catch (error) {
      logger.error('Failed to initialize payment gateways', { error: error.message });
    }
  }

  /**
   * Create placeholder gateway for unsupported payment methods
   */
  createPlaceholderGateway(name) {
    return {
      createSession: async () => {
        throw new Error(`${name} gateway not implemented`);
      },
      verifyWebhook: async () => {
        throw new Error(`${name} gateway not implemented`);
      },
      getPaymentDetails: async () => {
        throw new Error(`${name} gateway not implemented`);
      },
      refundPayment: async () => {
        throw new Error(`${name} gateway not implemented`);
      },
    };
  }

  /**
   * Get default coin packages configuration
   */
  getDefaultCoinPackages() {
    return [
      {
        id: 'package_basic',
        name: 'Basic Package',
        coins: 100,
        price: 4.99,
        currency: 'USD',
        description: '100 coins for basic gifts',
        popular: false,
      },
      {
        id: 'package_standard',
        name: 'Standard Package',
        coins: 500,
        price: 19.99,
        currency: 'USD',
        description: '500 coins for regular gifts',
        popular: true,
      },
      {
        id: 'package_premium',
        name: 'Premium Package',
        coins: 1200,
        price: 39.99,
        currency: 'USD',
        description: '1200 coins for premium gifts',
        popular: false,
      },
      {
        id: 'package_mega',
        name: 'Mega Package',
        coins: 2500,
        price: 79.99,
        currency: 'USD',
        description: '2500 coins for mega gifts',
        popular: false,
      },
      {
        id: 'package_ultimate',
        name: 'Ultimate Package',
        coins: 5000,
        price: 149.99,
        currency: 'USD',
        description: '5000 coins for ultimate gifts',
        popular: false,
      },
    ];
  }

  /**
   * Get available coin packages
   * @returns {Array} Coin packages
   */
  getCoinPackages() {
    return this.coinPackages;
  }

  /**
   * Get coin package by ID
   * @param {String} packageId - Package ID
   * @returns {Object} Coin package
   */
  getCoinPackage(packageId) {
    const packageObj = this.coinPackages.find(pkg => pkg.id === packageId);
    if (!packageObj) {
      throw new Error(`Coin package not found: ${packageId}`);
    }
    return packageObj;
  }

  /**
   * Create payment session for coin purchase
   * @param {String} userId - User ID
   * @param {String} packageId - Coin package ID
   * @param {String} gateway - Payment gateway (stripe, paypal, mada, stcpay)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Payment session with id and url
   */
  async createPaymentSession(userId, packageId, gateway, options = {}) {
    try {
      // Get coin package
      const coinPackage = this.getCoinPackage(packageId);
      
      // Get gateway instance
      const gatewayInstance = this.gateways[gateway];
      if (!gatewayInstance) {
        throw new Error(`Payment gateway not supported: ${gateway}`);
      }

      // Check for fraud patterns
      await this.performFraudChecks(userId, {
        ipAddress: options.ipAddress,
        deviceId: options.deviceId,
        amount: coinPackage.price,
        currency: options.currency || coinPackage.currency,
      });

      // Create payment intent record
      const paymentIntent = await PaymentIntent.create({
        userId,
        sessionId: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        gateway,
        packageId,
        coinAmount: coinPackage.coins,
        amount: coinPackage.price,
        currency: options.currency || coinPackage.currency,
        status: 'pending',
        ipAddress: options.ipAddress,
        deviceId: options.deviceId,
        userAgent: options.userAgent,
        metadata: {
          packageName: coinPackage.name,
          description: coinPackage.description,
          ...options.metadata,
        },
      });

      // Create payment session with gateway
      const sessionOptions = {
        userId,
        amount: coinPackage.price,
        currency: options.currency || coinPackage.currency,
        description: `Purchase ${coinPackage.coins} coins - ${coinPackage.name}`,
        successUrl: options.successUrl,
        cancelUrl: options.cancelUrl,
        metadata: {
          packageId,
          coins: coinPackage.coins,
          paymentIntentId: paymentIntent._id.toString(),
        },
        customerEmail: options.customerEmail,
      };

      const session = await gatewayInstance.createSession(sessionOptions);

      // Update payment intent with actual session ID
      paymentIntent.sessionId = session.id;
      await paymentIntent.save();

      logger.info('Payment session created', {
        userId,
        packageId,
        gateway,
        sessionId: session.id,
        paymentIntentId: paymentIntent._id,
      });

      return {
        sessionId: session.id,
        paymentUrl: session.url,
        gateway,
        paymentIntentId: paymentIntent._id,
      };
    } catch (error) {
      logger.error('Failed to create payment session', {
        userId,
        packageId,
        gateway,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Perform fraud detection checks
   * @param {String} userId - User ID
   * @param {Object} paymentData - Payment data
   */
  async performFraudChecks(userId, paymentData) {
    const checks = [];

    // Check 1: Velocity check - too many payments in short time
    const recentPayments = await PaymentIntent.countDocuments({
      userId,
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
      status: { $in: ['pending', 'processing', 'succeeded'] },
    });

    if (recentPayments >= 5) {
      checks.push({
        type: 'velocity',
        message: `Too many payment attempts (${recentPayments}) in the last hour`,
        risk: 'high',
      });
    }

    // Check 2: Amount check - unusually large amount for user
    const userPayments = await PaymentIntent.find({
      userId,
      status: 'succeeded',
    }).sort({ amount: -1 }).limit(5);

    const avgAmount = userPayments.length > 0
      ? userPayments.reduce((sum, p) => sum + p.amount, 0) / userPayments.length
      : 0;

    if (avgAmount > 0 && paymentData.amount > avgAmount * 3) {
      checks.push({
        type: 'amount',
        message: `Payment amount (${paymentData.amount}) is significantly higher than average (${avgAmount.toFixed(2)})`,
        risk: 'medium',
      });
    }

    // Check 3: IP address check - multiple users from same IP
    if (paymentData.ipAddress) {
      const ipUsers = await PaymentIntent.distinct('userId', {
        ipAddress: paymentData.ipAddress,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
      });

      if (ipUsers.length > 3) {
        checks.push({
          type: 'ip',
          message: `Multiple users (${ipUsers.length}) from same IP in last 24 hours`,
          risk: 'medium',
        });
      }
    }

    // Log fraud checks
    if (checks.length > 0) {
      logger.warn('Fraud checks triggered', {
        userId,
        ipAddress: paymentData.ipAddress,
        checks,
      });

      // Block payment if high risk
      const highRiskChecks = checks.filter(c => c.risk === 'high');
      if (highRiskChecks.length > 0) {
        throw new Error('Payment blocked for security reasons');
      }
    }

    return checks;
  }

  /**
   * Handle payment webhook from gateway
   * @param {String} gateway - Payment gateway
   * @param {Object|String} payload - Webhook payload
   * @param {String} signature - Webhook signature
   * @returns {Promise<Object>} Processing result
   */
  async handleWebhook(gateway, payload, signature) {
    try {
      const gatewayInstance = this.gateways[gateway];
      if (!gatewayInstance) {
        throw new Error(`Payment gateway not supported: ${gateway}`);
      }

      // Verify webhook signature and parse event
      const event = await gatewayInstance.verifyWebhook(payload, signature);

      // Process based on event type
      switch (event.type) {
        case 'payment.succeeded':
          return await this.handlePaymentSuccess(event.data, gateway);
        case 'payment.failed':
          return await this.handlePaymentFailure(event.data, gateway);
        case 'payment.refunded':
          return await this.handlePaymentRefund(event.data, gateway);
        default:
          logger.info(`Unhandled webhook event type: ${event.type}`, {
            gateway,
            eventId: event.id,
          });
          return { processed: false, eventType: event.type };
      }
    } catch (error) {
      logger.error('Failed to handle webhook', {
        gateway,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Handle successful payment
   * @param {Object} paymentData - Payment data from gateway
   * @param {String} gateway - Payment gateway
   * @returns {Promise<Object>} Processing result
   */
  async handlePaymentSuccess(paymentData, gateway) {
    const sessionId = paymentData.sessionId || paymentData.id;
    
    try {
      // Find payment intent
      const paymentIntent = await PaymentIntent.findOne({ sessionId, gateway });
      if (!paymentIntent) {
        throw new Error(`Payment intent not found for session: ${sessionId}`);
      }

      // Verify payment hasn't already been processed
      if (paymentIntent.status === 'succeeded') {
        logger.warn('Payment already processed', {
          sessionId,
          paymentIntentId: paymentIntent._id,
        });
        return { processed: false, reason: 'already_processed' };
      }

      // Verify payment amount matches
      const expectedAmount = paymentIntent.amount;
      const actualAmount = paymentData.amount / 100; // Convert from cents if needed
      
      if (Math.abs(expectedAmount - actualAmount) > 0.01) {
        logger.error('Payment amount mismatch', {
          sessionId,
          expectedAmount,
          actualAmount,
          paymentIntentId: paymentIntent._id,
        });
        throw new Error(`Payment amount mismatch: expected ${expectedAmount}, got ${actualAmount}`);
      }

      // Update payment intent status
      paymentIntent.status = 'succeeded';
      paymentIntent.succeededAt = new Date();
      paymentIntent.updatedAt = new Date();
      await paymentIntent.save();

      // Credit coins to user's wallet
      const wallet = await Wallet.findOne({ userId: paymentIntent.userId });
      if (!wallet) {
        throw new Error(`Wallet not found for user: ${paymentIntent.userId}`);
      }

      // Update wallet balance atomically
      wallet.coinBalance += paymentIntent.coinAmount;
      wallet.updatedAt = new Date();
      await wallet.save();

      // Record transaction
      await transactionService.recordCoinPurchase(
        paymentIntent.userId,
        paymentIntent.coinAmount,
        {
          paymentGateway: paymentIntent.gateway,
          paymentId: paymentIntent.sessionId,
          paymentIntentId: paymentIntent._id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          ipAddress: paymentIntent.ipAddress,
          deviceId: paymentIntent.deviceId,
        }
      );

      logger.info('Payment processed successfully', {
        userId: paymentIntent.userId,
        sessionId,
        coinAmount: paymentIntent.coinAmount,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        paymentIntentId: paymentIntent._id,
      });

      return {
        processed: true,
        userId: paymentIntent.userId,
        coinAmount: paymentIntent.coinAmount,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        paymentIntentId: paymentIntent._id,
      };
    } catch (error) {
      logger.error('Failed to process payment success', {
        sessionId,
        gateway,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Handle failed payment
   * @param {Object} paymentData - Payment data from gateway
   * @param {String} gateway - Payment gateway
   * @returns {Promise<Object>} Processing result
   */
  async handlePaymentFailure(paymentData, gateway) {
    const sessionId = paymentData.sessionId || paymentData.id;
    
    try {
      // Find payment intent
      const paymentIntent = await PaymentIntent.findOne({ sessionId, gateway });
      if (!paymentIntent) {
        throw new Error(`Payment intent not found for session: ${sessionId}`);
      }

      // Update payment intent status
      paymentIntent.status = 'failed';
      paymentIntent.failedAt = new Date();
      paymentIntent.updatedAt = new Date();
      paymentIntent.metadata.failureReason = paymentData.failureReason || 'Payment failed';
      await paymentIntent.save();

      logger.info('Payment marked as failed', {
        sessionId,
        paymentIntentId: paymentIntent._id,
        failureReason: paymentData.failureReason,
      });

      return {
        processed: true,
        status: 'failed',
        sessionId,
        paymentIntentId: paymentIntent._id,
        failureReason: paymentData.failureReason,
      };
    } catch (error) {
      logger.error('Failed to process payment failure', {
        sessionId,
        gateway,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Handle payment refund
   * @param {Object} paymentData - Payment data from gateway
   * @param {String} gateway - Payment gateway
   * @returns {Promise<Object>} Processing result
   */
  async handlePaymentRefund(paymentData, gateway) {
    // Implementation for refund handling
    logger.info('Payment refund received', {
      gateway,
      paymentData,
    });

    return {
      processed: true,
      status: 'refunded',
      gateway,
    };
  }

  /**
   * Get payment intent by ID
   * @param {String} paymentIntentId - Payment intent ID
   * @returns {Promise<Object>} Payment intent
   */
  async getPaymentIntent(paymentIntentId) {
    return await PaymentIntent.findById(paymentIntentId);
  }

  /**
   * Get payment intents for user
   * @param {String} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Payment intents
   */
  async getUserPaymentIntents(userId, options = {}) {
    const query = { userId };
    
    if (options.status) {
      query.status = options.status;
    }
    
    if (options.gateway) {
      query.gateway = options.gateway;
    }
    
    const limit = options.limit || 20;
    const page = options.page || 1;
    const skip = (page - 1) * limit;
    
    const paymentIntents = await PaymentIntent.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await PaymentIntent.countDocuments(query);
    
    return {
      paymentIntents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Cancel payment intent
   * @param {String} paymentIntentId - Payment intent ID
   * @returns {Promise<Object>} Updated payment intent
   */
  async cancelPaymentIntent(paymentIntentId) {
    const paymentIntent = await PaymentIntent.findById(paymentIntentId);
    if (!paymentIntent) {
      throw new Error(`Payment intent not found: ${paymentIntentId}`);
    }

    if (paymentIntent.status !== 'pending') {
      throw new Error(`Cannot cancel payment intent with status: ${paymentIntent.status}`);
    }

    paymentIntent.status = 'canceled';
    paymentIntent.updatedAt = new Date();
    await paymentIntent.save();

    logger.info('Payment intent canceled', {
      paymentIntentId: paymentIntent._id,
      sessionId: paymentIntent.sessionId,
      userId: paymentIntent.userId,
    });

    return paymentIntent;
  }
}

module.exports = new PaymentService();