const mongoose = require('mongoose');

/**
 * OTP document stored in MongoDB with automatic TTL expiry.
 * The `expiresAt` field drives a TTL index so MongoDB auto-deletes expired OTPs.
 */
const otpSchema = new mongoose.Schema({
  identifier: { type: String, required: true, index: true }, // phone or email
  otp: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  createdAt: { type: Date, default: Date.now },
});

// Compound index for fast lookup + uniqueness per identifier
otpSchema.index({ identifier: 1, expiresAt: 1 });

module.exports = mongoose.model('OTP', otpSchema);
