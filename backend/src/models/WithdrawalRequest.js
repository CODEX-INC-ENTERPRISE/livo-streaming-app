const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  diamondAmount: {
    type: Number,
    required: true,
    min: 1,
  },
  creditAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'processing', 'completed'],
    default: 'pending',
    index: true,
  },
  requestedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  processedAt: {
    type: Date,
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  notes: {
    type: String,
    maxlength: 1000,
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'paypal', 'stripe'],
  },
  paymentDetails: {
    type: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
});

const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);

module.exports = WithdrawalRequest;
