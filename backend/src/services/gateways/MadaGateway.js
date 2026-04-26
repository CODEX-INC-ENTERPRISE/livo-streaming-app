const BaseGateway = require('./BaseGateway');
const logger = require('../../utils/logger');

/**
 * Mada Payment Gateway Implementation
 * Placeholder implementation - would need to be implemented with actual Mada API
 */
class MadaGateway extends BaseGateway {
  constructor() {
    super();
    
    this.apiKey = process.env.MADA_API_KEY;
    this.merchantId = process.env.MADA_MERCHANT_ID;
    
    if (!this.apiKey || !this.merchantId) {
      logger.warn('Mada not configured (missing MADA_API_KEY or MADA_MERCHANT_ID)');
      this.isConfigured = false;
      return;
    }

    this.isConfigured = true;
    
    logger.info('Mada gateway initialized');
  }

  /**
   * Create a Mada checkout session
   * @param {Object} options - Payment options
   * @returns {Promise<Object>} Session with id and url
   */
  async createSession(options) {
    try {
      if (!this.isConfigured) {
        throw new Error('Mada not configured');
      }

      // In a real implementation, this would call the Mada API
      // For now, return a mock session
      const sessionId = `mada_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      logger.info('Mada session created (mock)', { sessionId, userId: options.userId });

      return {
        id: sessionId,
        url: `${process.env.APP_URL || 'http://localhost:3000'}/payment/mock-mada?session=${sessionId}`,
      };
    } catch (error) {
      logger.error('Failed to create Mada session', { error: error.message, userId: options.userId });
      throw error;
    }
  }

  /**
   * Verify Mada webhook signature and parse event
   * @param {Object|String} payload - Webhook payload
   * @param {String} signature - Webhook signature
   * @returns {Promise<Object>} Parsed event
   */
  async verifyWebhook(payload, signature) {
    try {
      if (!this.isConfigured) {
        throw new Error('Mada not configured');
      }

      // Parse payload
      const event = typeof payload === 'string' ? JSON.parse(payload) : payload;

      // In a real implementation, verify the signature
      // For now, just parse the event
      logger.info('Mada webhook verified (mock)', { eventType: event.type, eventId: event.id });

      return this.normalizeEvent(event);
    } catch (error) {
      logger.error('Mada webhook verification failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Normalize Mada event to common format
   * @param {Object} event - Mada webhook event
   * @returns {Object} Normalized event
   */
  normalizeEvent(event) {
    const eventTypeMap = {
      'payment.success': 'payment.succeeded',
      'payment.failed': 'payment.failed',
      'payment.cancelled': 'payment.failed',
    };

    const normalizedType = eventTypeMap[event.type] || event.type;

    let data = {};
    if (event.type === 'payment.success') {
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
   * Get payment details from Mada
   * @param {String} paymentId - Payment ID
   * @returns {Promise<Object>} Payment details
   */
  async getPaymentDetails(paymentId) {
    try {
      if (!this.isConfigured) {
        throw new Error('Mada not configured');
      }

      // In a real implementation, call Mada API
      // For now, return mock data
      return {
        id: paymentId,
        amount: 100.00, // Mock amount
        currency: 'SAR',
        status: 'success',
        metadata: {},
      };
    } catch (error) {
      logger.error('Failed to get Mada payment details', { paymentId, error: error.message });
      throw error;
    }
  }

  /**
   * Refund a Mada payment
   * @param {String} paymentId - Payment ID
   * @param {Number} amount - Amount to refund (optional)
   * @returns {Promise<Object>} Refund details
   */
  async refundPayment(paymentId, amount) {
    try {
      if (!this.isConfigured) {
        throw new Error('Mada not configured');
      }

      // In a real implementation, call Mada refund API
      // For now, return mock refund
      const refundId = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      logger.info('Mada refund created (mock)', { refundId, paymentId, amount });

      return {
        id: refundId,
        amount: amount || 100.00,
        currency: 'SAR',
        status: 'success',
      };
    } catch (error) {
      logger.error('Failed to create Mada refund', { paymentId, error: error.message });
      throw error;
    }
  }
}

module.exports = MadaGateway;