const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: [
      'coinPurchase',
      'giftSent',
      'giftReceived',
      'diamondEarned',
      'withdrawal',
      'commission',
    ],
    index: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    required: true,
    enum: ['coins', 'diamonds', 'USD', 'SAR'],
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  description: {
    type: String,
    maxlength: 500,
  },
  metadata: {
    giftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VirtualGift',
    },
    streamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stream',
    },
    paymentGateway: {
      type: String,
      enum: ['stripe', 'paypal', 'mada', 'stcpay'],
    },
    paymentId: {
      type: String,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
}, {
  timestamps: true,
});

transactionSchema.index({ userId: 1, timestamp: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
