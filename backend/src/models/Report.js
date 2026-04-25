const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  reportedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  reportedStreamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stream',
  },
  reason: {
    type: String,
    required: true,
    enum: [
      'spam',
      'harassment',
      'inappropriate_content',
      'hate_speech',
      'violence',
      'impersonation',
      'other',
    ],
    index: true,
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'under_review', 'resolved', 'dismissed'],
    default: 'pending',
    index: true,
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  resolvedAt: {
    type: Date,
  },
  resolutionNotes: {
    type: String,
    maxlength: 1000,
  },
}, {
  timestamps: true,
});

reportSchema.index({ status: 1, submittedAt: -1 });

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
