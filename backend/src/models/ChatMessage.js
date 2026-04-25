const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
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
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  message: {
    type: String,
    required: true,
    maxlength: 500,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  isPinned: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = ChatMessage;
