const mongoose = require('mongoose');

const hostStatisticsSchema = new mongoose.Schema({
  totalStreams: { type: Number, default: 0 },
  totalViewers: { type: Number, default: 0 },
  totalGiftsReceived: { type: Number, default: 0 },
  totalDiamondsEarned: { type: Number, default: 0 },
}, { _id: false });

const hostSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    index: true,
  },
  isApproved: {
    type: Boolean,
    default: false,
    index: true,
  },
  approvedAt: {
    type: Date,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  statistics: {
    type: hostStatisticsSchema,
    default: () => ({}),
  },
}, {
  timestamps: true,
});

const Host = mongoose.model('Host', hostSchema);

module.exports = Host;
