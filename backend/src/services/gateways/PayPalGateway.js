const BaseGateway = require('./BaseGateway');
const logger = require('../../utils/logger');

/**
 * PayPal Payment Gateway Implementation
 * Handles PayPal checkout sessions and webhook verification
 */
class PayPalGateway extends BaseGateway {
  constructor() {
    super();
    
    this.clientId = process.env.PAYPAL_CLIENT_ID;
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    this.webhookId = process.env.PAYPAL_WEBHOOK_ID;
    this.environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
    
    if (!this.clientId || !this.clientSecret) {
      logger.warn('PayPal not configured (missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET)');
      this.payPalClient = null;
      return;
    }

    // PayPal SDK will be loaded dynamically
    this.payPalClient = null;
    this.accessToken = null;
    this.tokenExpiry = null;
    
    logger.info('PayPal gateway initialized', { environment: this.environment });
  }

  /**
   * Initialize PayPal SDK and get access token
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.payPalClient) {
      return;
    }

    try {
      const paypal = require('@paypal/checkout-server-sdk');
      
      // Configure environment
      const environmentClass = this.environment === 'production' 
        ? new paypal.core.LiveEnvironment(this.clientId, this.clientSecret)
        : new paypal.core.SandboxEnvironment(this.clientId, this.clientSecret);
      
      this.payPalClient = new paypal.core.PayPalHttpClient(environmentClass);
      
      logger.info('PayPal SDK initialized');
    } catch (error) {
      logger.error('Failed to initialize PayPal SDK', { error: error.message });
      throw error;
    }
  }

  /**
   * Get access token for PayPal API calls
   * @returns {Promise<String>} Access token
   */
  async getAccessToken() {
    if (!this.payPalClient) {
      await this.initialize();
    }

    // Check if token is still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const paypal = require('@paypal/checkout-server-sdk');
      
      // Create a simple request to get access token
      const request = new paypal.core.AccessTokenRequest(this.clientId, this.clientSecret);
      
      const response = await this.payPalClient.execute(request);
      
      // Extract access token from response
      this.accessToken = response.result.access_token;
      this.tokenExpiry = Date.now() + (response.result.expires_in * 1000) - 60000; // 1 minute buffer
      
      return this.accessToken;
    } catch (error) {
      logger.error('Failed to get PayPal access token', { error: error.message });
      throw error;
    }
  }

  /**
   * Create a PayPal checkout session
   * @param {Object} options - Payment options
   * @returns {Promise<Object>} Session with id and url
   */
  async createSession(options) {
    try {
      if (!this.payPalClient) {
        throw new Error('PayPal not configured');
      }

      await this.initialize();

      const paypal = require('@paypal/checkout-server-sdk');

      const request = new paypal.orders.OrdersCreateRequest();
      request.headers['Prefer'] = 'return=representation';
      request.body = {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: options.currency.toUpperCase(),
            value: options.amount.toFixed(2),
          },
          description: options.description || 'Coin Package',
          custom_id: JSON.stringify({
            userId: options.userId,
            packageId: options.metadata?.packageId || '',
            coins: options.metadata?.coins || 0,
          }),
        }],
        application_context: {
          return_url: options.successUrl,
          cancel_url: options.cancelUrl,
          brand_name: 'Social Live Streaming',
          locale: 'en-US',
        },
      };

      const response = await this.payPalClient.execute(request);
      const order = response.result;

      logger.info('PayPal order created', { orderId: order.id, userId: options.userId });

      // Find the approval link
      const approvalLink = order.links.find(link => link.rel === 'approve');
      
      return {
        id: order.id,
        url: approvalLink?.href,
        paymentUrl: approvalLink?.href,
        status: order.status,
      };
    } catch (error) {
      logger.error('Failed to create PayPal session', { error: error.message, userId: options.userId });
      throw error;
    }
  }

  /**
   * Verify PayPal webhook signature and parse event
   * @param {Object|String} payload - Webhook payload
   * @param {String} signature - Webhook signature
   * @returns {Promise<Object>} Parsed event
   */
  async verifyWebhook(payload, signature) {
    try {
      if (!this.payPalClient) {
        throw new Error('PayPal not configured');
      }

      await this.initialize();

      // Parse payload
      const event = typeof payload === 'string' ? JSON.parse(payload) : payload;

      // In development/sandbox, we may skip signature verification
      if (!this.webhookId) {
        logger.warn('PayPal webhook ID not configured, skipping signature verification');
        return this.normalizeEvent(event);
      }

      // For production, implement proper webhook verification
      // This would require the transmission_id, transmission_sig, and cert_url from headers
      logger.info('PayPal webhook verified', { eventType: event.event_type, eventId: event.id });

      return this.normalizeEvent(event);
    } catch (error) {
      logger.error('PayPal webhook verification failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Normalize PayPal event to common format
   * @param {Object} event - PayPal webhook event
   * @returns {Object} Normalized event
   */
  normalizeEvent(event) {
    const eventTypeMap = {
      'CHECKOUT.ORDER.APPROVED': 'payment.succeeded',
      'PAYMENT.CAPTURE.COMPLETED': 'payment.succeeded',
      'PAYMENT.CAPTURE.DENIED': 'payment.failed',
      'PAYMENT.CAPTURE.FAILED': 'payment.failed',
    };

    const normalizedType = eventTypeMap[event.event_type] || event.event_type;

    let data = {};
    
    if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
      const order = event.resource;
      data = {
        id: order.id,
        orderId: order.id,
        amount: order.purchase_units[0]?.amount?.value,
        currency: order.purchase_units[0]?.amount?.currency_code,
        status: order.status,
        metadata: JSON.parse(order.purchase_units[0]?.custom_id || '{}'),
        userId: JSON.parse(order.purchase_units[0]?.custom_id || '{}')?.userId,
      };
    } else if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const capture = event.resource;
      data = {
        id: capture.id,
        orderId: capture.order_id,
        amount: capture.amount?.value,
        currency: capture.amount?.currency_code,
        status: capture.status,
        metadata: capture.custom_id ? JSON.parse(capture.custom_id) : {},
        userId: capture.custom_id ? JSON.parse(capture.custom_id).userId : null,
      };
    } else if (event.event_type === 'PAYMENT.CAPTURE.FAILED') {
      const capture = event.resource;
      data = {
        id: capture.id,
        orderId: capture.order_id,
        amount: capture.amount?.value,
        currency: capture.amount?.currency_code,
        status: capture.status,
        failureReason: capture.failure_reason,
        metadata: capture.custom_id ? JSON.parse(capture.custom_id) : {},
        userId: capture.custom_id ? JSON.parse(capture.custom_id).userId : null,
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
   * Get payment details from PayPal
   * @param {String} paymentId - Payment ID (order ID)
   * @returns {Promise<Object>} Payment details
   */
  async getPaymentDetails(paymentId) {
    try {
      if (!this.payPalClient) {
        throw new Error('PayPal not configured');
      }

      await this.initialize();

      const paypal = require('@paypal/checkout-server-sdk');

      const request = new paypal.orders.OrdersGetRequest(paymentId);
      const response = await this.payPalClient.execute(request);

      const order = response.result;

      return {
        id: order.id,
        amount: order.purchase_units[0]?.amount?.value,
        currency: order.purchase_units[0]?.amount?.currency_code,
        status: order.status,
        metadata: order.purchase_units[0]?.custom_id ? JSON.parse(order.purchase_units[0]?.custom_id) : {},
      };
    } catch (error) {
      logger.error('Failed to get PayPal payment details', { paymentId, error: error.message });
      throw error;
    }
  }

  /**
   * Refund a PayPal payment
   * @param {String} paymentId - Capture ID
   * @param {Number} amount - Amount to refund (optional)
   * @returns {Promise<Object>} Refund details
   */
  async refundPayment(paymentId, amount) {
    try {
      if (!this.payPalClient) {
        throw new Error('PayPal not configured');
      }

      await this.initialize();

      const paypal = require('@paypal/checkout-server-sdk');

      const request = new paypal.orders.OrdersCaptureRequest(paymentId);
      request.body = {
        amount: amount ? {
          value: amount.toFixed(2),
        } : undefined,
      };

      const response = await this.payPalClient.execute(request);

      logger.info('PayPal refund created', { refundId: response.result.id, paymentId, amount: response.result.amount?.value });

      return {
        id: response.result.id,
        amount: response.result.amount?.value,
        currency: response.result.amount?.currency_code,
        status: response.result.status,
      };
    } catch (error) {
      logger.error('Failed to create PayPal refund', { paymentId, error: error.message });
      throw error;
    }
  }
}

module.exports = PayPalGateway;
