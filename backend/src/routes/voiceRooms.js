const express = require('express');
const router = express.Router();
const voiceRoomController = require('../controllers/voiceRoomController');
const { authenticate } = require('../middleware/auth');
const { validateRequest, validateQuery } = require('../middleware/validation');
const {
  createVoiceRoomSchema,
  promoteDemoteSchema,
  voiceRoomChatSchema,
  paginationSchema,
} = require('../middleware/validationSchemas');

// Public — no auth required
router.get('/active', validateQuery(paginationSchema), voiceRoomController.getActiveVoiceRooms);

// All routes below require authentication
router.use(authenticate);

router.post('/create', validateRequest(createVoiceRoomSchema), voiceRoomController.createVoiceRoom);
router.post('/:roomId/join', voiceRoomController.joinVoiceRoom);
router.post('/:roomId/leave', voiceRoomController.leaveVoiceRoom);
router.post('/:roomId/raise-hand', voiceRoomController.raiseHand);
router.post('/:roomId/promote', validateRequest(promoteDemoteSchema), voiceRoomController.promoteToSpeaker);
router.post('/:roomId/demote', validateRequest(promoteDemoteSchema), voiceRoomController.demoteToListener);

const { getChatRateLimiter } = require('../middleware/rateLimit');
const chatRateLimiter = getChatRateLimiter();
router.post('/:roomId/chat', chatRateLimiter, validateRequest(voiceRoomChatSchema), voiceRoomController.sendVoiceRoomChat);

router.get('/:roomId', voiceRoomController.getVoiceRoom);

module.exports = router;
