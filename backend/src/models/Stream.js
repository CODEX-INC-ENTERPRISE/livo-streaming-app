const mongoose = require('mongoose');

const streamSchema = new mongoose.Schema({
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    maxlength: 200,
  },
  startedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  endedAt: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['active', 'ended', 'terminated'],
    default: 'active',
    index: true,
  },
  peakViewerCount: {
    type: Number,
    default: 0,
  },
  totalGiftsReceived: {
    type: Number,
    default: 0,
  },
  currentViewerIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  mutedUserIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  kickedUserIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  moderatorIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  agoraChannelId: {
    type: String,
  },
  // Flagging fields for admin review
  flagged: {
    type: Boolean,
    default: false,
    index: true,
  },
  flaggedAt: {
    type: Date,
  },
  flaggedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  flagReason: {
    type: String,
    maxlength: 500,
  },
  flagNotes: {
    type: String,
    maxlength: 1000,
  },
  flagStatus: {
    type: String,
    enum: ['pending_review', 'reviewed', 'action_taken'],
    default: 'pending_review',
  },
  streamStatusAtFlag: {
    type: String,
    enum: ['active', 'ended', 'terminated'],
  },
  viewerCountAtFlag: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

streamSchema.index({ hostId: 1, startedAt: -1 });
streamSchema.index({ status: 1, startedAt: -1 });
streamSchema.index({ flagged: 1, flaggedAt: -1 });
streamSchema.index({ flagStatus: 1, flaggedAt: -1 });

const Stream = mongoose.model('Stream', streamSchema);

module.exports = Stream;
