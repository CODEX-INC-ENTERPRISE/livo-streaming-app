const mongoose = require('mongoose');

const moderationLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  streamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stream',
    index: true,
  },
  voiceRoomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VoiceRoom',
    index: true,
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatMessage',
  },
  violationType: {
    type: String,
    required: true,
    enum: [
      'keyword_filter',
      'manual_moderation',
      'spam_detection',
      'hate_speech',
      'harassment',
      'inappropriate_content',
      'violence',
      'self_harm',
      'adult_content',
      'scam',
      'impersonation',
    ],
  },
  matchedKeyword: {
    type: String,
    trim: true,
    lowercase: true,
  },
  originalContent: {
    type: String,
    required: true,
    maxlength: 1000,
  },
  actionTaken: {
    type: String,
    required: true,
    enum: ['blocked', 'warned', 'flagged', 'muted', 'kicked', 'banned'],
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  automated: {
    type: Boolean,
    default: true,
  },
  moderatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  notes: {
    type: String,
    maxlength: 1000,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient querying
moderationLogSchema.index({ userId: 1, timestamp: -1 });
moderationLogSchema.index({ streamId: 1, timestamp: -1 });
moderationLogSchema.index({ violationType: 1, timestamp: -1 });
moderationLogSchema.index({ actionTaken: 1, timestamp: -1 });
moderationLogSchema.index({ automated: 1, timestamp: -1 });

const ModerationLog = mongoose.model('ModerationLog', moderationLogSchema);

module.exports = ModerationLog;