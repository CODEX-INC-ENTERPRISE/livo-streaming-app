/**
 * Base Payment Gateway Interface
 * All payment gateways must implement these methods
 */
class BaseGateway {
  /**
   * Create a payment session
   * @param {Object} options - Payment options
   * @param {String} options.userId - User ID
   * @param {Number} options.amount - Amount in currency
   * @param {String} options.currency - Currency code (USD, SAR, etc.)
   * @param {String} options.description - Payment description
   * @param {String} options.successUrl - Success redirect URL
   * @param {String} options.cancelUrl - Cancel redirect URL
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} Session with id and url
   */
  async createSession(options) {
    throw new Error('createSession must be implemented by gateway');
  }

  /**
   * Verify webhook signature and parse event
   * @param {Object|String} payload - Webhook payload
   * @param {String} signature - Webhook signature
   * @returns {Promise<Object>} Parsed event with type and data
   */
  async verifyWebhook(payload, signature) {
    throw new Error('verifyWebhook must be implemented by gateway');
  }

  /**
   * Get payment details
   * @param {String} paymentId - Payment ID
   * @returns {Promise<Object>} Payment details
   */
  async getPaymentDetails(paymentId) {
    throw new Error('getPaymentDetails must be implemented by gateway');
  }

  /**
   * Refund a payment
   * @param {String} paymentId - Payment ID
   * @param {Number} amount - Amount to refund (optional, full refund if not specified)
   * @returns {Promise<Object>} Refund details
   */
  async refundPayment(paymentId, amount) {
    throw new Error('refundPayment must be implemented by gateway');
  }
}

module.exports = BaseGateway;
