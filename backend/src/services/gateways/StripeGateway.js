const BaseGateway = require('./BaseGateway');
const logger = require('../../utils/logger');

/**
 * Stripe Payment Gateway Implementation
 * Handles Stripe checkout sessions and webhook verification
 */
class StripeGateway extends BaseGateway {
  constructor() {
    super();
    
    if (!process.env.STRIPE_SECRET_KEY) {
      logger.warn('STRIPE_SECRET_KEY not configured');
      this.stripe = null;
      return;
    }

    this.stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    logger.info('Stripe gateway initialized');
  }

  /**
   * Create a Stripe checkout session
   * @param {Object} options - Payment options
   * @returns {Promise<Object>} Session with id and url
   */
  async createSession(options) {
    try {
      if (!this.stripe) {
        throw new Error('Stripe not configured');
      }

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: options.currency.toLowerCase(),
              product_data: {
                name: options.description || 'Coin Package',
                description: `Purchase ${options.metadata?.coins || 0} coins`,
              },
              unit_amount: Math.round(options.amount * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: options.successUrl,
        cancel_url: options.cancelUrl,
        metadata: {
          userId: options.userId,
          packageId: options.metadata?.packageId || '',
          coins: options.metadata?.coins?.toString() || '0',
        },
        customer_email: options.customerEmail,
      });

      logger.info('Stripe session created', { sessionId: session.id, userId: options.userId });

      return {
        id: session.id,
        url: session.url,
      };
    } catch (error) {
      logger.error('Failed to create Stripe session', { error: error.message, userId: options.userId });
      throw error;
    }
  }

  /**
   * Verify Stripe webhook signature and parse event
   * @param {String|Buffer} payload - Webhook payload
   * @param {String} signature - Stripe signature header
   * @returns {Promise<Object>} Parsed event
   */
  async verifyWebhook(payload, signature) {
    try {
      if (!this.stripe) {
        throw new Error('Stripe not configured');
      }

      if (!this.webhookSecret) {
        logger.warn('Stripe webhook secret not configured, skipping signature verification');
        // In development, parse without verification
        const event = JSON.parse(payload.toString());
        return this.normalizeEvent(event);
      }

      // Verify signature
      const event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
      
      logger.info('Stripe webhook verified', { eventType: event.type, eventId: event.id });

      return this.normalizeEvent(event);
    } catch (error) {
      logger.error('Stripe webhook verification failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Normalize Stripe event to common format
   * @param {Object} event - Stripe event
   * @returns {Object} Normalized event
   */
  normalizeEvent(event) {
    const eventTypeMap = {
      'checkout.session.completed': 'payment.succeeded',
      'payment_intent.succeeded': 'payment.succeeded',
      'payment_intent.payment_failed': 'payment.failed',
      'charge.succeeded': 'payment.succeeded',
      'charge.failed': 'payment.failed',
    };

    const normalizedType = eventTypeMap[event.type] || event.type;

    let data = {};
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      data = {
        id: session.id,
        sessionId: session.id,
        amount: session.amount_total,
        amountTotal: session.amount_total,
        currency: session.currency,
        status: session.payment_status,
        metadata: session.metadata,
        userId: session.metadata?.userId,
      };
    } else if (event.type.startsWith('payment_intent')) {
      const paymentIntent = event.data.object;
      data = {
        id: paymentIntent.id,
        sessionId: paymentIntent.id,
        amount: paymentIntent.amount,
        amountTotal: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        metadata: paymentIntent.metadata,
        userId: paymentIntent.metadata?.userId,
        failureReason: paymentIntent.last_payment_error?.message,
      };
    } else if (event.type.startsWith('charge')) {
      const charge = event.data.object;
      data = {
        id: charge.id,
        sessionId: charge.payment_intent || charge.id,
        amount: charge.amount,
        amountTotal: charge.amount,
        currency: charge.currency,
        status: charge.status,
        metadata: charge.metadata,
        userId: charge.metadata?.userId,
        failureReason: charge.failure_message,
      };
    }

    return {
      id: event.id,
      type: normalizedType,
      data,
      raw: event,
    };
  }

  /**
   * Get payment details from Stripe
   * @param {String} paymentId - Payment ID (session ID or payment intent ID)
   * @returns {Promise<Object>} Payment details
   */
  async getPaymentDetails(paymentId) {
    try {
      if (!this.stripe) {
        throw new Error('Stripe not configured');
      }

      // Try to retrieve as checkout session first
      try {
        const session = await this.stripe.checkout.sessions.retrieve(paymentId);
        return {
          id: session.id,
          amount: session.amount_total,
          currency: session.currency,
          status: session.payment_status,
          metadata: session.metadata,
        };
      } catch (error) {
        // If not a session, try as payment intent
        const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);
        return {
          id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          metadata: paymentIntent.metadata,
        };
      }
    } catch (error) {
      logger.error('Failed to get Stripe payment details', { paymentId, error: error.message });
      throw error;
    }
  }

  /**
   * Refund a Stripe payment
   * @param {String} paymentId - Payment intent ID
   * @param {Number} amount - Amount to refund in cents (optional)
   * @returns {Promise<Object>} Refund details
   */
  async refundPayment(paymentId, amount) {
    try {
      if (!this.stripe) {
        throw new Error('Stripe not configured');
      }

      const refundData = {
        payment_intent: paymentId,
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to cents
      }

      const refund = await this.stripe.refunds.create(refundData);

      logger.info('Stripe refund created', { refundId: refund.id, paymentId, amount: refund.amount });

      return {
        id: refund.id,
        amount: refund.amount / 100,
        currency: refund.currency,
        status: refund.status,
      };
    } catch (error) {
      logger.error('Failed to create Stripe refund', { paymentId, error: error.message });
      throw error;
    }
  }
}

module.exports = StripeGateway;
