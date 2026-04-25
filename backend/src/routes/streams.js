const express = require('express');
const streamController = require('../controllers/streamController');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const startStreamSchema = Joi.object({
  title: Joi.string().required().max(200).trim(),
});

const chatMessageSchema = Joi.object({
  message: Joi.string().required().max(500).trim(),
});

const pinMessageSchema = Joi.object({
  messageId: Joi.string().required(),
});

const moderateSchema = Joi.object({
  action: Joi.string().valid('mute', 'kick', 'block', 'assign_moderator').required(),
  targetUserId: Joi.string().required(),
});

// Stream management endpoints
router.post(
  '/start',
  authenticate,
  validateRequest(startStreamSchema),
  streamController.startStream
);

router.post(
  '/:streamId/end',
  authenticate,
  streamController.endStream
);

// Stream viewing endpoints
router.get(
  '/active',
  authenticate,
  streamController.getActiveStreams
);

router.post(
  '/:streamId/join',
  authenticate,
  streamController.joinStream
);

router.post(
  '/:streamId/leave',
  authenticate,
  streamController.leaveStream
);

// Stream chat endpoints
router.post(
  '/:streamId/chat',
  authenticate,
  validateRequest(chatMessageSchema),
  streamController.sendChatMessage
);

router.post(
  '/:streamId/pin-message',
  authenticate,
  validateRequest(pinMessageSchema),
  streamController.pinMessage
);

// Stream moderation endpoints
router.post(
  '/:streamId/moderate',
  authenticate,
  validateRequest(moderateSchema),
  streamController.moderateStream
);

module.exports = router;
