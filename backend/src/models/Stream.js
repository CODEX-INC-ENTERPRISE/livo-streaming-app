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
}, {
  timestamps: true,
});

streamSchema.index({ hostId: 1, startedAt: -1 });
streamSchema.index({ status: 1, startedAt: -1 });

const Stream = mongoose.model('Stream', streamSchema);

module.exports = Stream;
