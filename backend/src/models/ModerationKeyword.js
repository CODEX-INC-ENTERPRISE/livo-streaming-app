const mongoose = require('mongoose');

const moderationKeywordSchema = new mongoose.Schema({
  keyword: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  action: {
    type: String,
    required: true,
    enum: ['block', 'warn', 'flag'],
    default: 'block',
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  category: {
    type: String,
    enum: [
      'hate_speech',
      'harassment',
      'spam',
      'inappropriate_content',
      'violence',
      'self_harm',
      'adult_content',
      'scam',
      'impersonation',
      'other',
    ],
    default: 'other',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index for efficient keyword matching
moderationKeywordSchema.index({ keyword: 1, isActive: 1 });
moderationKeywordSchema.index({ category: 1, isActive: 1 });
moderationKeywordSchema.index({ action: 1, isActive: 1 });

const ModerationKeyword = mongoose.model('ModerationKeyword', moderationKeywordSchema);

module.exports = ModerationKeyword;