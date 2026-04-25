const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const config = require('../config');

const notificationPreferencesSchema = new mongoose.Schema({
  streamStart: { type: Boolean, default: true },
  gifts: { type: Boolean, default: true },
  followers: { type: Boolean, default: true },
  messages: { type: Boolean, default: true },
}, { _id: false });

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    index: true,
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  passwordHash: {
    type: String,
  },
  displayName: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    index: true,
  },
  bio: {
    type: String,
    maxlength: 500,
    default: '',
  },
  profilePictureUrl: {
    type: String,
    default: '',
  },
  registeredAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  lastLoginAt: {
    type: Date,
    default: Date.now,
  },
  isBlocked: {
    type: Boolean,
    default: false,
    index: true,
  },
  isHost: {
    type: Boolean,
    default: false,
    index: true,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  followerIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  followingIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  blockedUserIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  notificationPrefs: {
    type: notificationPreferencesSchema,
    default: () => ({}),
  },
  fcmToken: {
    type: String,
  },
  socialProvider: {
    type: String,
    enum: ['google', 'facebook', 'apple', null],
  },
  socialProviderId: {
    type: String,
  },
}, {
  timestamps: true,
});

userSchema.index({ displayName: 1, isBlocked: 1 });

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.passwordHash) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

userSchema.statics.hashPassword = async function(password) {
  return bcrypt.hash(password, config.security.bcryptRounds);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
