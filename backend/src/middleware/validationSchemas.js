const Joi = require('joi');

// Common validation patterns
const phoneNumberPattern = /^\+[1-9]\d{1,14}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const objectIdPattern = /^[0-9a-fA-F]{24}$/;

// Common validation schemas
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// Authentication schemas
const sendOTPSchema = Joi.object({
  phoneNumber: Joi.string().min(7).max(16).optional(),
  email: Joi.string().pattern(emailPattern).optional(),
}).xor('phoneNumber', 'email');

const registerSchema = Joi.object({
  phoneNumber: Joi.string().min(7).max(16).optional(),
  email: Joi.string().pattern(emailPattern).optional(),
  password: Joi.string().min(8).max(100).optional(),
  displayName: Joi.string().min(3).max(30).required(),
  otp: Joi.string().length(6).optional(),
  socialProvider: Joi.string().valid('google', 'facebook', 'apple').optional(),
  firebaseToken: Joi.string().optional(),
}).custom((value, helpers) => {
  const { phoneNumber, email, socialProvider, firebaseToken, otp } = value;
  if (socialProvider && firebaseToken) {
    // Social registration — no OTP needed
  } else if (phoneNumber || email) {
    if (!otp) {
      return helpers.error('any.required', { message: 'OTP is required for phone/email registration' });
    }
    // Password is optional — OTP-only registration is supported
  } else {
    return helpers.error('any.required', { message: 'Registration method not provided' });
  }
  return value;
});

const loginSchema = Joi.object({
  phoneNumber: Joi.string().min(7).max(16).optional(),
  email: Joi.string().pattern(emailPattern).optional(),
  password: Joi.string().min(8).max(100).optional(),
  otp: Joi.string().length(6).optional(),
  firebaseToken: Joi.string().optional(),
}).custom((value, helpers) => {
  const { phoneNumber, email, password, otp, firebaseToken } = value;
  if (!firebaseToken && !phoneNumber && !email) {
    return helpers.error('any.required', { message: 'Login method not provided' });
  }
  if ((phoneNumber || email) && !password && !otp) {
    return helpers.error('any.required', { message: 'Either password or OTP is required' });
  }
  return value;
});

// User schemas
const updateProfileSchema = Joi.object({
  displayName: Joi.string().min(3).max(30).optional(),
  bio: Joi.string().max(500).optional(),
  profilePictureUrl: Joi.string().uri().max(500).optional(),
});

const followUserSchema = Joi.object({
  targetUserId: Joi.string().pattern(objectIdPattern).required(),
});

const blockUserSchema = Joi.object({
  targetUserId: Joi.string().pattern(objectIdPattern).required(),
});

const reportUserSchema = Joi.object({
  reportedUserId: Joi.string().pattern(objectIdPattern).required(),
  reason: Joi.string().valid(
    'spam',
    'harassment',
    'inappropriate_content',
    'hate_speech',
    'violence',
    'impersonation',
    'other'
  ).required(),
  description: Joi.string().min(10).max(1000).required(),
  reportedStreamId: Joi.string().pattern(objectIdPattern).optional(),
});

// Stream schemas
const startStreamSchema = Joi.object({
  title: Joi.string().required().max(200).trim(),
});

const chatMessageSchema = Joi.object({
  message: Joi.string().required().max(500).trim(),
});

const pinMessageSchema = Joi.object({
  messageId: Joi.string().pattern(objectIdPattern).required(),
});

const moderateSchema = Joi.object({
  action: Joi.string().valid('mute', 'kick', 'block', 'assign_moderator').required(),
  targetUserId: Joi.string().pattern(objectIdPattern).required(),
});

const sendGiftSchema = Joi.object({
  giftId: Joi.string().pattern(objectIdPattern).required(),
});

// Voice room schemas
const createVoiceRoomSchema = Joi.object({
  name: Joi.string().required().max(100).trim(),
  participantLimit: Joi.number().integer().min(2).max(100).default(50),
});

const promoteDemoteSchema = Joi.object({
  targetUserId: Joi.string().pattern(objectIdPattern).required(),
});

const voiceRoomChatSchema = Joi.object({
  message: Joi.string().required().max(500).trim(),
});

// Wallet schemas
const purchaseCoinsSchema = Joi.object({
  packageId: Joi.string().required(),
  gateway: Joi.string().valid('stripe', 'paypal', 'mada', 'stcpay').default('stripe'),
  currency: Joi.string().valid('USD', 'SAR', 'EUR', 'GBP').default('USD'),
});

const createWithdrawalSchema = Joi.object({
  userId: Joi.string().pattern(objectIdPattern).required(),
  diamondAmount: Joi.number().min(1000).required(),
  paymentMethod: Joi.string().valid('bank_transfer', 'paypal', 'stripe').required(),
  paymentDetails: Joi.object().optional(),
});

// Gift schemas
const createGiftSchema = Joi.object({
  name: Joi.string().required().max(100),
  coinPrice: Joi.number().integer().min(1).required(),
  diamondValue: Joi.number().integer().min(1).required(),
  animationAssetUrl: Joi.string().uri().required(),
  thumbnailUrl: Joi.string().uri().required(),
  category: Joi.string().valid('common', 'rare', 'epic', 'legendary').default('common'),
});

// Host schemas
const registerHostSchema = Joi.object({
  additionalInfo: Joi.object({
    bio: Joi.string().max(1000),
    socialLinks: Joi.object(),
    bankDetails: Joi.object(),
  }).optional(),
});

// Admin schemas
const updateUserSchema = Joi.object({
  displayName: Joi.string().min(3).max(30).optional(),
  email: Joi.string().pattern(emailPattern).optional(),
  phoneNumber: Joi.string().pattern(phoneNumberPattern).optional(),
  isBlocked: Joi.boolean().optional(),
  isHost: Joi.boolean().optional(),
  isAdmin: Joi.boolean().optional(),
});

const resolveReportSchema = Joi.object({
  status: Joi.string().valid('resolved', 'dismissed').required(),
  action: Joi.string().valid('warning', 'suspension', 'ban', 'none').optional(),
  notes: Joi.string().max(1000).optional(),
});

const updateWithdrawalSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected', 'completed').required(),
  notes: Joi.string().max(500).optional(),
});

const registerAgentSchema = Joi.object({
  name: Joi.string().required().max(100),
  email: Joi.string().pattern(emailPattern).required(),
  commissionRate: Joi.number().min(0).max(100).required(),
});

const assignAgentSchema = Joi.object({
  agentId: Joi.string().pattern(objectIdPattern).required(),
});

// File upload validation
const fileUploadSchema = Joi.object({
  fieldname: Joi.string().required(),
  originalname: Joi.string().required(),
  encoding: Joi.string().required(),
  mimetype: Joi.string().required(),
  size: Joi.number().max(5 * 1024 * 1024).required(), // 5MB max
  buffer: Joi.binary().required(),
});

// Notification schemas
const notificationPreferencesSchema = Joi.object({
  streamStart: Joi.boolean().default(true),
  gifts: Joi.boolean().default(true),
  followers: Joi.boolean().default(true),
  messages: Joi.boolean().default(true),
});

const fcmTokenSchema = Joi.object({
  fcmToken: Joi.string().required(),
});

module.exports = {
  // Common
  paginationSchema,
  
  // Authentication
  sendOTPSchema,
  registerSchema,
  loginSchema,
  
  // User
  updateProfileSchema,
  followUserSchema,
  blockUserSchema,
  reportUserSchema,
  
  // Stream
  startStreamSchema,
  chatMessageSchema,
  pinMessageSchema,
  moderateSchema,
  sendGiftSchema,
  
  // Voice room
  createVoiceRoomSchema,
  promoteDemoteSchema,
  voiceRoomChatSchema,
  
  // Wallet
  purchaseCoinsSchema,
  createWithdrawalSchema,
  
  // Gift
  createGiftSchema,
  
  // Host
  registerHostSchema,
  
  // Admin
  updateUserSchema,
  resolveReportSchema,
  updateWithdrawalSchema,
  registerAgentSchema,
  assignAgentSchema,
  
  // Notification
  notificationPreferencesSchema,
  fcmTokenSchema,
  
  // File upload
  fileUploadSchema,
  
  // Patterns
  phoneNumberPattern,
  emailPattern,
  objectIdPattern,
};