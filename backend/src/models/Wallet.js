const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  coinBalance: {
    type: Number,
    default: 0,
    min: 0,
  },
  diamondBalance: {
    type: Number,
    default: 0,
    min: 0,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

walletSchema.methods.addCoins = async function(amount) {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }
  this.coinBalance += amount;
  this.updatedAt = new Date();
  return this.save();
};

walletSchema.methods.deductCoins = async function(amount) {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }
  if (this.coinBalance < amount) {
    throw new Error('Insufficient coin balance');
  }
  this.coinBalance -= amount;
  this.updatedAt = new Date();
  return this.save();
};

walletSchema.methods.addDiamonds = async function(amount) {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }
  this.diamondBalance += amount;
  this.updatedAt = new Date();
  return this.save();
};

walletSchema.methods.deductDiamonds = async function(amount) {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }
  if (this.diamondBalance < amount) {
    throw new Error('Insufficient diamond balance');
  }
  this.diamondBalance -= amount;
  this.updatedAt = new Date();
  return this.save();
};

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;
