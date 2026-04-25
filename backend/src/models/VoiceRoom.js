const mongoose = require('mongoose');

const voiceParticipantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  role: {
    type: String,
    enum: ['host', 'speaker', 'listener'],
    default: 'listener',
  },
  isHandRaised: {
    type: Boolean,
    default: false,
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const voiceRoomSchema = new mongoose.Schema({
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    maxlength: 100,
  },
  participantLimit: {
    type: Number,
    default: 50,
    min: 2,
    max: 100,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  status: {
    type: String,
    enum: ['active', 'ended'],
    default: 'active',
    index: true,
  },
  participants: [voiceParticipantSchema],
  agoraChannelId: {
    type: String,
  },
}, {
  timestamps: true,
});

const VoiceRoom = mongoose.model('VoiceRoom', voiceRoomSchema);

module.exports = VoiceRoom;
