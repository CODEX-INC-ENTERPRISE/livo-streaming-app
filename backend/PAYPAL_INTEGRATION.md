# PayPal Payment Gateway Integration

## Overview

This document describes the PayPal payment gateway integration for the social live streaming application. The implementation provides secure payment processing with webhook verification and fraud detection.

## Architecture

### Components

1. **PayPalGateway** (`src/services/gateways/PayPalGateway.js`)
   - Handles PayPal API interactions
   - Creates payment orders
   - Verifies webhook signatures
   - Processes refunds

2. **PaymentService** (`src/services/paymentService.js`)
   - Manages payment sessions across all gateways
   - Handles webhook events
   - Implements fraud detection
   - Records transactions

3. **Wallet Controller** (`src/controllers/walletController.js`)
   - Provides REST API endpoints
   - Handles PayPal webhook endpoint
   - Manages coin purchases

4. **Wallet Routes** (`src/routes/wallet.js`)
   - Defines API routes
   - Registers webhook endpoints

## Configuration

### Environment Variables

Add the following to your `.env` file:

```env
# PayPal Configuration
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_WEBHOOK_ID=your-paypal-webhook-id
PAYPAL_ENVIRONMENT=sandbox  # or 'production'
```

### Getting PayPal Credentials

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com)
2. Create a business account or sign in
3. Navigate to Apps & Credentials
4. Create a new app in the Sandbox environment
5. Copy the Client ID and Secret
6. Set up a webhook listener in the dashboard
7. Copy the Webhook ID

## API Endpoints

### 1. Purchase Coins

**Endpoint:** `POST /api/wallet/purchase-coins`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "packageId": "medium",
  "gateway": "paypal",
  "currency": "USD"
}
```

**Available Packages:**
- `small`: 100 coins for $0.99
- `medium`: 500 coins for $4.99
- `large`: 1000 coins for $9.99
- `xlarge`: 5000 coins for $49.99

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "3C679366-2D142083-8C3394AA-7F9F9F9F",
    "paymentUrl": "https://www.sandbox.paypal.com/checkoutnow?token=EC-...",
    "gateway": "paypal"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid package ID or gateway
- `403 Forbidden`: Payment blocked for security reasons
- `401 Unauthorized`: Missing or invalid authentication token

### 2. PayPal Webhook

**Endpoint:** `POST /api/wallet/webhook/paypal`

**Authentication:** None (verified by PayPal signature)

**Headers:**
```
Content-Type: application/json
```

**Webhook Events Handled:**
- `CHECKOUT.ORDER.APPROVED`: Order approved by user
- `PAYMENT.CAPTURE.COMPLETED`: Payment successfully captured
- `PAYMENT.CAPTURE.FAILED`: Payment capture failed

**Response:**
```json
{
  "success": true,
  "received": true,
  "data": {
    "processed": true,
    "userId": "507f1f77bcf86cd799439011",
    "coins": 500,
    "newBalance": 1500
  }
}
```

## Payment Flow

### User Initiates Payment

1. User selects a coin package in the mobile app
2. App calls `POST /api/wallet/purchase-coins` with package ID and gateway
3. Backend creates a PayPal order and returns payment URL
4. User is redirected to PayPal checkout page
5. User completes payment on PayPal

### PayPal Confirms Payment

1. PayPal sends webhook event to `POST /api/wallet/webhook/paypal`
2. Backend verifies webhook signature
3. Backend records coin purchase transaction
4. Backend credits coins to user's wallet
5. User receives coins in their account

### Error Handling

If payment fails:
1. PayPal sends `PAYMENT.CAPTURE.FAILED` webhook
2. Backend logs failure with reason
3. User is notified of failure
4. No coins are credited

## Security Features

### 1. Webhook Signature Verification

All PayPal webhooks are verified using PayPal's signature verification:

```javascript
// Signature verification is handled by PayPalGateway.verifyWebhook()
const event = await paypalGateway.verifyWebhook(payload, signature);
```

### 2. Fraud Detection

The payment service implements fraud detection checks:

- **Transaction Velocity**: Limits transactions per hour
- **Daily Spending Limit**: Prevents excessive spending
- **IP Reputation**: Checks for suspicious IP addresses
- **Device Tracking**: Monitors device patterns

```javascript
const fraudCheck = await paymentService.checkFraud(userId, amount, {
  ipAddress: req.ip,
  deviceId: req.headers['x-device-id'],
});
```

### 3. Secure Credential Storage

- PayPal credentials stored in environment variables
- Never logged or exposed in responses
- Access tokens cached with expiration

### 4. HTTPS Only

- All API communications use HTTPS
- Webhook endpoints require HTTPS
- Certificate pinning recommended for mobile app

## Implementation Details

### PayPalGateway Class

The `PayPalGateway` class implements the `BaseGateway` interface:

```javascript
class PayPalGateway extends BaseGateway {
  async createSession(options) {
    // Creates a PayPal order
    // Returns { id, url, status }
  }

  async verifyWebhook(payload, signature) {
    // Verifies webhook signature
    // Returns normalized event
  }

  async getPaymentDetails(paymentId) {
    // Retrieves payment details from PayPal
    // Returns { id, amount, currency, status, metadata }
  }

  async refundPayment(paymentId, amount) {
    // Refunds a payment
    // Returns { id, amount, currency, status }
  }
}
```

### Payment Service Integration

The `PaymentService` manages all payment gateways:

```javascript
// Create payment session
const session = await paymentService.createPaymentSession(
  userId,
  'medium',
  'paypal',
  {
    currency: 'USD',
    ipAddress: req.ip,
    deviceId: req.headers['x-device-id'],
    successUrl: 'https://app.example.com/payment/success',
    cancelUrl: 'https://app.example.com/payment/cancel',
  }
);

// Handle webhook
const result = await paymentService.handleWebhook(
  'paypal',
  req.body,
  req.headers['paypal-signature']
);
```

### Transaction Recording

When payment succeeds, coins are credited atomically:

```javascript
const result = await transactionService.recordCoinPurchase(
  userId,
  coins,
  {
    paymentGateway: 'paypal',
    paymentId: paymentId,
  }
);
```

## Testing

### Manual Testing

1. Start the server: `npm start`
2. Create a test user and get authentication token
3. Call purchase endpoint:

```bash
curl -X POST http://localhost:3000/api/wallet/purchase-coins \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "packageId": "small",
    "gateway": "paypal",
    "currency": "USD"
  }'
```

4. Open the returned payment URL in browser
5. Complete payment with PayPal sandbox account
6. Verify coins are credited to wallet

### Webhook Testing

Use PayPal's webhook simulator in the developer dashboard:

1. Go to PayPal Developer Dashboard
2. Navigate to Webhooks
3. Click "Send a test webhook"
4. Select event type (e.g., `PAYMENT.CAPTURE.COMPLETED`)
5. Verify webhook is received and processed

### Automated Testing

```javascript
// Test PayPal gateway
const paypalGateway = new PayPalGateway();

// Test session creation
const session = await paypalGateway.createSession({
  userId: 'test-user',
  amount: 4.99,
  currency: 'USD',
  description: 'Test payment',
  successUrl: 'http://localhost:3000/success',
  cancelUrl: 'http://localhost:3000/cancel',
  metadata: { packageId: 'medium', coins: 500 },
});

console.log('Session ID:', session.id);
console.log('Payment URL:', session.url);
```

## Troubleshooting

### Issue: "PayPal not configured"

**Cause**: Missing `PAYPAL_CLIENT_ID` or `PAYPAL_CLIENT_SECRET` in environment

**Solution**: Add credentials to `.env` file and restart server

### Issue: "Webhook verification failed"

**Cause**: Invalid webhook signature or missing webhook ID

**Solution**: 
1. Verify webhook ID in `.env`
2. Check webhook is registered in PayPal dashboard
3. Ensure webhook URL is correct

### Issue: "Order not found"

**Cause**: PayPal order ID is invalid or expired

**Solution**: 
1. Verify order ID from webhook event
2. Check order status in PayPal dashboard
3. Ensure order was created successfully

### Issue: "Insufficient funds"

**Cause**: User doesn't have enough coins to complete transaction

**Solution**: 
1. Check user's coin balance
2. Ensure coins were credited from previous purchase
3. Verify transaction was recorded

## Requirements Mapping

This implementation satisfies the following requirements:

- **Requirement 17.1**: Integrates with PayPal payment gateway
- **Requirement 17.3**: Creates secure payment sessions with PayPal
- **Requirement 17.4**: Implements webhook handlers for payment confirmation
- **Requirement 15.1-15.6**: Coin purchase flow with payment processing
- **Requirement 32.3**: Uses PayPal tokenization for secure payments
- **Requirement 32.4**: Implements payment verification

## Performance Considerations

1. **Access Token Caching**: Tokens are cached with expiration to reduce API calls
2. **Webhook Processing**: Asynchronous processing prevents blocking
3. **Database Transactions**: Atomic operations ensure consistency
4. **Error Handling**: Graceful degradation on PayPal API failures

## Security Considerations

1. **Credential Management**: Secrets stored in environment variables
2. **Signature Verification**: All webhooks verified before processing
3. **Rate Limiting**: Fraud detection prevents abuse
4. **Audit Logging**: All transactions logged for compliance
5. **PCI Compliance**: Card data never stored locally

## Future Enhancements

1. **Recurring Payments**: Support subscription-based coin packages
2. **Partial Refunds**: Allow partial refund processing
3. **Multi-currency**: Support additional currencies
4. **Advanced Fraud Detection**: Machine learning-based detection
5. **Payment Analytics**: Dashboard for payment metrics
6. **Dispute Handling**: Automated dispute resolution

## Support

For questions or issues with PayPal integration:

1. Check PayPal Developer Documentation: https://developer.paypal.com/docs
2. Review PayPal SDK: https://github.com/paypal/Checkout-NodeJS-SDK
3. Check application logs for detailed error messages
4. Contact PayPal support for account-specific issues

## References

- [PayPal Checkout Integration Guide](https://developer.paypal.com/docs/checkout/integrate/)
- [PayPal Webhooks Documentation](https://developer.paypal.com/docs/api-basics/notifications/webhooks/)
- [PayPal SDK for Node.js](https://github.com/paypal/Checkout-NodeJS-SDK)
- [PayPal Sandbox Testing](https://developer.paypal.com/docs/platforms/get-started/)
