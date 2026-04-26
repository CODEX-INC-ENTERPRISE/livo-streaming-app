const mongoose = require('mongoose');

const paymentIntentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  gateway: {
    type: String,
    required: true,
    enum: ['stripe', 'paypal', 'mada', 'stcpay'],
    index: true,
  },
  packageId: {
    type: String,
    required: true,
  },
  coinAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    required: true,
    default: 'USD',
    enum: ['USD', 'SAR', 'EUR', 'GBP'],
  },
  status: {
    type: String,
    required: true,
    default: 'pending',
    enum: ['pending', 'processing', 'succeeded', 'failed', 'canceled'],
    index: true,
  },
  ipAddress: {
    type: String,
  },
  deviceId: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 30 * 24 * 60 * 60, // 30 days in seconds (TTL index)
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  succeededAt: {
    type: Date,
  },
  failedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// TTL index for automatic cleanup of old payment intents
paymentIntentSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Index for querying by user and status
paymentIntentSchema.index({ userId: 1, status: 1 });

// Index for querying by session ID (unique)
paymentIntentSchema.index({ sessionId: 1 }, { unique: true });

const PaymentIntent = mongoose.model('PaymentIntent', paymentIntentSchema);

module.exports = PaymentIntent;