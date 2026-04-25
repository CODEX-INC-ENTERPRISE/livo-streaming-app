const mongoose = require('mongoose');

const virtualGiftSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    maxlength: 50,
  },
  coinPrice: {
    type: Number,
    required: true,
    min: 1,
    index: true,
  },
  diamondValue: {
    type: Number,
    required: true,
    min: 1,
  },
  animationAssetUrl: {
    type: String,
    required: true,
  },
  thumbnailUrl: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['basic', 'premium', 'luxury', 'special'],
    index: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

const VirtualGift = mongoose.model('VirtualGift', virtualGiftSchema);

module.exports = VirtualGift;
