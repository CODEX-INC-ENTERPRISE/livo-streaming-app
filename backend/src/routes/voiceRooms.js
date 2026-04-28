const express = require('express');
const router = express.Router();
const voiceRoomController = require('../controllers/voiceRoomController');
const { authenticate } = require('../middleware/auth');
const { validateRequest, validateQuery } = require('../middleware/validation');
const { 
  createVoiceRoomSchema, 
  promoteDemoteSchema, 
  voiceRoomChatSchema,
  paginationSchema 
} = require('../middleware/validationSchemas');

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @swagger
 * /api/voice-rooms/create:
 *   post:
 *     summary: Create a new voice room
 *     description: Creates a voice room with the current user as host
 *     tags: [Voice Rooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the voice room
 *                 maxLength: 100
 *               participantLimit:
 *                 type: integer
 *                 description: Maximum number of participants (2-100)
 *                 default: 50
 *                 minimum: 2
 *                 maximum: 100
 *     responses:
 *       201:
 *         description: Voice room created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 roomId:
 *                   type: string
 *                   description: ID of the created voice room
 *                 agoraChannelId:
 *                   type: string
 *                   description: Agora channel ID for audio streaming
 *                 agoraToken:
 *                   type: string
 *                   description: Agora token for the host
 *                 appId:
 *                   type: string
 *                   description: Agora app ID
 *                 name:
 *                   type: string
 *                   description: Room name
 *                 participantLimit:
 *                   type: integer
 *                   description: Maximum participants
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/create', validateRequest(createVoiceRoomSchema), voiceRoomController.createVoiceRoom);

/**
 * @swagger
 * /api/voice-rooms/{roomId}/join:
 *   post:
 *     summary: Join a voice room
 *     description: Join an existing voice room as a listener
 *     tags: [Voice Rooms]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the voice room to join
 *     responses:
 *       200:
 *         description: Successfully joined voice room
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 roomId:
 *                   type: string
 *                 agoraChannelId:
 *                   type: string
 *                 agoraToken:
 *                   type: string
 *                 appId:
 *                   type: string
 *                 participants:
 *                   type: array
 *                   items:
 *                     type: object
 *                 participantCount:
 *                   type: integer
 *       400:
 *         description: Room is full or not active
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Voice room not found
 */
router.post('/:roomId/join', voiceRoomController.joinVoiceRoom);

/**
 * @swagger
 * /api/voice-rooms/{roomId}/leave:
 *   post:
 *     summary: Leave a voice room
 *     description: Leave a voice room you're currently in
 *     tags: [Voice Rooms]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the voice room to leave
 *     responses:
 *       200:
 *         description: Successfully left voice room
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 participantCount:
 *                   type: integer
 *       400:
 *         description: Not in the voice room
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Voice room not found
 */
router.post('/:roomId/leave', voiceRoomController.leaveVoiceRoom);

/**
 * @swagger
 * /api/voice-rooms/{roomId}/raise-hand:
 *   post:
 *     summary: Raise hand in voice room
 *     description: Raise hand to request speaking permissions
 *     tags: [Voice Rooms]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the voice room
 *     responses:
 *       200:
 *         description: Hand raised successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Already a speaker or not in room
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Voice room not found
 */
router.post('/:roomId/raise-hand', voiceRoomController.raiseHand);

/**
 * @swagger
 * /api/voice-rooms/{roomId}/promote:
 *   post:
 *     summary: Promote listener to speaker
 *     description: Host promotes a listener to speaker role
 *     tags: [Voice Rooms]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the voice room
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetUserId
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 description: ID of the user to promote
 *     responses:
 *       200:
 *         description: User promoted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 newRole:
 *                   type: string
 *                   enum: [speaker]
 *       400:
 *         description: User already a speaker or not in room
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not the host
 *       404:
 *         description: Voice room or user not found
 */
router.post('/:roomId/promote', validateRequest(promoteDemoteSchema), voiceRoomController.promoteToSpeaker);

/**
 * @swagger
 * /api/voice-rooms/{roomId}/demote:
 *   post:
 *     summary: Demote speaker to listener
 *     description: Host demotes a speaker to listener role
 *     tags: [Voice Rooms]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the voice room
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetUserId
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 description: ID of the user to demote
 *     responses:
 *       200:
 *         description: User demoted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 newRole:
 *                   type: string
 *                   enum: [listener]
 *       400:
 *         description: User already a listener or is host
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not the host
 *       404:
 *         description: Voice room or user not found
 */
router.post('/:roomId/demote', validateRequest(promoteDemoteSchema), voiceRoomController.demoteToListener);

/**
 * @swagger
 * /api/voice-rooms/{roomId}/chat:
 *   post:
 *     summary: Send chat message in voice room
 *     description: Send a text message in voice room chat
 *     tags: [Voice Rooms]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the voice room
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: Chat message (max 500 characters)
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messageId:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Message too long or room not active
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not in the voice room
 *       404:
 *         description: Voice room not found
 *       429:
 *         description: Rate limit exceeded
 */
const { getChatRateLimiter } = require('../middleware/rateLimit');
const chatRateLimiter = getChatRateLimiter();
router.post('/:roomId/chat', chatRateLimiter, validateRequest(voiceRoomChatSchema), voiceRoomController.sendVoiceRoomChat);

/**
 * @swagger
 * /api/voice-rooms/{roomId}:
 *   get:
 *     summary: Get voice room details
 *     description: Get detailed information about a voice room
 *     tags: [Voice Rooms]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the voice room
 *     responses:
 *       200:
 *         description: Voice room details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 roomId:
 *                   type: string
 *                 hostId:
 *                   type: object
 *                 name:
 *                   type: string
 *                 participantLimit:
 *                   type: integer
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 status:
 *                   type: string
 *                   enum: [active, ended]
 *                 agoraChannelId:
 *                   type: string
 *                 participants:
 *                   type: array
 *                   items:
 *                     type: object
 *                 participantCount:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Voice room not found
 */
router.get('/:roomId', voiceRoomController.getVoiceRoom);

/**
 * @swagger
 * /api/voice-rooms/active:
 *   get:
 *     summary: Get active voice rooms
 *     description: Get paginated list of active voice rooms
 *     tags: [Voice Rooms]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of active voice rooms
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 voiceRooms:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 */
router.get('/active', validateQuery(paginationSchema), voiceRoomController.getActiveVoiceRooms);

module.exports = router;