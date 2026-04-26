const BaseGateway = require('./BaseGateway');
const logger = require('../../utils/logger');

/**
 * stc pay Payment Gateway Implementation
 * Placeholder implementation - would need to be implemented with actual stc pay API
 */
class StcPayGateway extends BaseGateway {
  constructor() {
    super();
    
    this.clientId = process.env.STCPAY_CLIENT_ID;
    this.clientSecret = process.env.STCPAY_CLIENT_SECRET;
    
    if (!this.clientId || !this.clientSecret) {
      logger.warn('stc pay not configured (missing STCPAY_CLIENT_ID or STCPAY_CLIENT_SECRET)');
      this.isConfigured = false;
      return;
    }

    this.isConfigured = true;
    
    logger.info('stc pay gateway initialized');
  }

  /**
   * Create a stc pay checkout session
   * @param {Object} options - Payment options
   * @returns {Promise<Object>} Session with id and url
   */
  async createSession(options) {
    try {
      if (!this.isConfigured) {
        throw new Error('stc pay not configured');
      }

      // In a real implementation, this would call the stc pay API
      // For now, return a mock session
      const sessionId = `stcpay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      logger.info('stc pay session created (mock)', { sessionId, userId: options.userId });

      return {
        id: sessionId,
        url: `${process.env.APP_URL || 'http://localhost:3000'}/payment/mock-stcpay?session=${sessionId}`,
      };
    } catch (error) {
      logger.error('Failed to create stc pay session', { error: error.message, userId: options.userId });
      throw error;
    }
  }

  /**
   * Verify stc pay webhook signature and parse event
   * @param {Object|String} payload - Webhook payload
   * @param {String} signature - Webhook signature
   * @returns {Promise<Object>} Parsed event
   */
  async verifyWebhook(payload, signature) {
    try {
      if (!this.isConfigured) {
        throw new Error('stc pay not configured');
      }

      // Parse payload
      const event = typeof payload === 'string' ? JSON.parse(payload) : payload;

      // In a real implementation, verify the signature
      // For now, just parse the event
      logger.info('stc pay webhook verified (mock)', { eventType: event.type, eventId: event.id });

      return this.normalizeEvent(event);
    } catch (error) {
      logger.error('stc pay webhook verification failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Normalize stc pay event to common format
   * @param {Object} event - stc pay webhook event
   * @returns {Object} Normalized event
   */
  normalizeEvent(event) {
    const eventTypeMap = {
      'payment.completed': 'payment.succeeded',
      'payment.failed': 'payment.failed',
      'payment.cancelled': 'payment.failed',
    };

    const normalizedType = eventTypeMap[event.type] || event.type;

    let data = {};
    if (event.type === 'payment.completed') {
      data = {
        id: event.transactionId || event.id,
        amount: event.amount,
        currency: event.currency || 'SAR',
        status: 'success',
        metadata: event.metadata || {},
        userId: event.metadata?.userId,
      };
    } else if (event.type === 'payment.failed') {
      data = {
        id: event.transactionId || event.id,
        amount: event.amount,
        currency: event.currency || 'SAR',
        status: 'failed',
        failureReason: event.reason,
        metadata: event.metadata || {},
        userId: event.metadata?.userId,
      };
    }

    return {
      id: event.id || event.transactionId,
      type: normalizedType,
      data,
      raw: event,
    };
  }

  /**
   * Get payment details from stc pay
   * @param {String} paymentId - Payment ID
   * @returns {Promise<Object>} Payment details
   */
  async getPaymentDetails(paymentId) {
    try {
      if (!this.isConfigured) {
        throw new Error('stc pay not configured');
      }

      // In a real implementation, call stc pay API
      // For now, return mock data
      return {
        id: paymentId,
        amount: 100.00, // Mock amount
        currency: 'SAR',
        status: 'success',
        metadata: {},
      };
    } catch (error) {
      logger.error('Failed to get stc pay payment details', { paymentId, error: error.message });
      throw error;
    }
  }

  /**
   * Refund a stc pay payment
   * @param {String} paymentId - Payment ID
   * @param {Number} amount - Amount to refund (optional)
   * @returns {Promise<Object>} Refund details
   */
  async refundPayment(paymentId, amount) {
    try {
      if (!this.isConfigured) {
        throw new Error('stc pay not configured');
      }

      // In a real implementation, call stc pay refund API
      // For now, return mock refund
      const refundId = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      logger.info('stc pay refund created (mock)', { refundId, paymentId, amount });

      return {
        id: refundId,
        amount: amount || 100.00,
        currency: 'SAR',
        status: 'success',
      };
    } catch (error) {
      logger.error('Failed to create stc pay refund', { paymentId, error: error.message });
      throw error;
    }
  }
}

module.exports = StcPayGateway;