const VoiceRoom = require('../models/VoiceRoom');
const User = require('../models/User');
const ChatMessage = require('../models/ChatMessage');
const agoraService = require('../services/agoraService');
const logger = require('../utils/logger');

/**
 * Create a new voice room
 * POST /api/voice-rooms/create
 * Validates: Requirements 11.1, 11.2, 11.3
 */
exports.createVoiceRoom = async (req, res, next) => {
  try {
    const { name, participantLimit } = req.body;
    const hostId = req.userId;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    // Validate name length
    if (name.length > 100) {
      return res.status(400).json({ error: 'Room name must not exceed 100 characters' });
    }

    // Validate participant limit
    const limit = participantLimit || 50;
    if (limit < 2 || limit > 100) {
      return res.status(400).json({ error: 'Participant limit must be between 2 and 100' });
    }

    // Check if user exists
    const user = await User.findById(hostId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate unique Agora channel ID
    const agoraChannelId = `voice_${hostId}_${Date.now()}`;

    // Generate Agora audio token for host (publisher role)
    const agoraToken = agoraService.generateHostToken(agoraChannelId, 0);

    // Create voice room document
    const voiceRoom = new VoiceRoom({
      hostId,
      name,
      participantLimit: limit,
      agoraChannelId,
      status: 'active',
      participants: [{
        userId: hostId,
        role: 'host', // Host has special permissions
        isHandRaised: false,
        joinedAt: new Date(),
      }],
    });

    await voiceRoom.save();

    logger.info('Voice room created', {
      roomId: voiceRoom._id,
      hostId,
      name,
      agoraChannelId,
    });

    res.status(201).json({
      roomId: voiceRoom._id,
      agoraChannelId,
      agoraToken,
      appId: agoraService.appId,
      name: voiceRoom.name,
      participantLimit: voiceRoom.participantLimit,
      createdAt: voiceRoom.createdAt,
    });
  } catch (error) {
    logger.error('Error creating voice room', { error: error.message });
    next(error);
  }
};

/**
 * Join a voice room
 * POST /api/voice-rooms/:roomId/join
 * Validates: Requirements 11.4, 11.5, 12.3
 */
exports.joinVoiceRoom = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const userId = req.userId;

    const voiceRoom = await VoiceRoom.findById(roomId);
    if (!voiceRoom) {
      return res.status(404).json({ error: 'Voice room not found' });
    }

    if (voiceRoom.status !== 'active') {
      return res.status(400).json({ error: 'Voice room is not active' });
    }

    // Check participant limit
    if (voiceRoom.participants.length >= voiceRoom.participantLimit) {
      return res.status(400).json({ error: 'Voice room is full' });
    }

    // Check if user is already in the room
    const existingParticipant = voiceRoom.participants.find(
      (p) => p.userId.toString() === userId.toString()
    );

    if (existingParticipant) {
      // User is already in the room, return current info
      return res.json({
        roomId: voiceRoom._id,
        agoraChannelId: voiceRoom.agoraChannelId,
        agoraToken: agoraService.generateViewerToken(voiceRoom.agoraChannelId, 0),
        appId: agoraService.appId,
        participants: voiceRoom.participants,
        participantCount: voiceRoom.participants.length,
        isAlreadyJoined: true,
      });
    }

    // Add user as listener by default
    voiceRoom.participants.push({
      userId,
      role: 'listener',
      isHandRaised: false,
      joinedAt: new Date(),
    });

    await voiceRoom.save();

    // Generate Agora audio token for listener (subscriber role)
    const agoraToken = agoraService.generateViewerToken(voiceRoom.agoraChannelId, 0);

    // Broadcast participant joined event via WebSocket
    const io = req.app.get('io');
    if (io) {
      const user = await User.findById(userId).select('displayName profilePictureUrl');
      io.to(`voice:${roomId}`).emit('voice:participant-joined', {
        userId,
        displayName: user?.displayName,
        profilePictureUrl: user?.profilePictureUrl,
        role: 'listener',
        participantCount: voiceRoom.participants.length,
      });
    }

    logger.info('User joined voice room', {
      roomId,
      userId,
      participantCount: voiceRoom.participants.length,
    });

    res.json({
      roomId: voiceRoom._id,
      agoraChannelId: voiceRoom.agoraChannelId,
      agoraToken,
      appId: agoraService.appId,
      participants: voiceRoom.participants,
      participantCount: voiceRoom.participants.length,
    });
  } catch (error) {
    logger.error('Error joining voice room', { error: error.message });
    next(error);
  }
};

/**
 * Leave a voice room
 * POST /api/voice-rooms/:roomId/leave
 * Validates: Requirements 11.4, 11.5, 12.3
 */
exports.leaveVoiceRoom = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const userId = req.userId;

    const voiceRoom = await VoiceRoom.findById(roomId);
    if (!voiceRoom) {
      return res.status(404).json({ error: 'Voice room not found' });
    }

    // Check if user is in the room
    const participantIndex = voiceRoom.participants.findIndex(
      (p) => p.userId.toString() === userId.toString()
    );

    if (participantIndex === -1) {
      return res.status(400).json({ error: 'You are not in this voice room' });
    }

    // Remove user from participants array
    voiceRoom.participants.splice(participantIndex, 1);
    await voiceRoom.save();

    // Broadcast participant left event via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to(`voice:${roomId}`).emit('voice:participant-left', {
        userId,
        participantCount: voiceRoom.participants.length,
      });
    }

    logger.info('User left voice room', {
      roomId,
      userId,
      participantCount: voiceRoom.participants.length,
    });

    res.json({
      success: true,
      participantCount: voiceRoom.participants.length,
    });
  } catch (error) {
    logger.error('Error leaving voice room', { error: error.message });
    next(error);
  }
};

/**
 * Raise hand in voice room
 * POST /api/voice-rooms/:roomId/raise-hand
 * Validates: Requirements 12.4
 */
exports.raiseHand = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const userId = req.userId;

    const voiceRoom = await VoiceRoom.findById(roomId);
    if (!voiceRoom) {
      return res.status(404).json({ error: 'Voice room not found' });
    }

    if (voiceRoom.status !== 'active') {
      return res.status(400).json({ error: 'Voice room is not active' });
    }

    // Find participant
    const participant = voiceRoom.participants.find(
      (p) => p.userId.toString() === userId.toString()
    );

    if (!participant) {
      return res.status(400).json({ error: 'You are not in this voice room' });
    }

    if (participant.role === 'speaker' || participant.role === 'host') {
      return res.status(400).json({ error: 'You are already a speaker' });
    }

    // Update participant isHandRaised flag
    participant.isHandRaised = true;
    await voiceRoom.save();

    // Broadcast hand raise event to host via WebSocket
    const io = req.app.get('io');
    if (io) {
      const user = await User.findById(userId).select('displayName profilePictureUrl');
      io.to(`voice:${roomId}`).emit('voice:hand-raised', {
        userId,
        displayName: user?.displayName,
        profilePictureUrl: user?.profilePictureUrl,
        roomId,
        timestamp: new Date(),
      });
    }

    logger.info('User raised hand', {
      roomId,
      userId,
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error raising hand', { error: error.message });
    next(error);
  }
};

/**
 * Promote a listener to speaker
 * POST /api/voice-rooms/:roomId/promote
 * Validates: Requirements 12.5
 */
exports.promoteToSpeaker = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { targetUserId } = req.body;
    const userId = req.userId;

    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required' });
    }

    const voiceRoom = await VoiceRoom.findById(roomId);
    if (!voiceRoom) {
      return res.status(404).json({ error: 'Voice room not found' });
    }

    // Validate host permissions
    const hostParticipant = voiceRoom.participants.find(
      (p) => p.userId.toString() === userId.toString() && p.role === 'host'
    );

    if (!hostParticipant) {
      return res.status(403).json({ error: 'Only the host can promote users' });
    }

    // Find target participant
    const targetParticipant = voiceRoom.participants.find(
      (p) => p.userId.toString() === targetUserId.toString()
    );

    if (!targetParticipant) {
      return res.status(404).json({ error: 'Target user is not in this voice room' });
    }

    if (targetParticipant.role === 'speaker' || targetParticipant.role === 'host') {
      return res.status(400).json({ error: 'User is already a speaker' });
    }

    // Change participant role to speaker
    targetParticipant.role = 'speaker';
    targetParticipant.isHandRaised = false; // Reset hand raise
    await voiceRoom.save();

    // Broadcast role change event via WebSocket
    const io = req.app.get('io');
    if (io) {
      const { emitRoleChanged } = require('../socket/voiceRoomHandlers');
      emitRoleChanged(io, roomId, targetUserId, 'speaker');
    }

    logger.info('User promoted to speaker', {
      roomId,
      targetUserId,
      promotedBy: userId,
    });

    res.json({ success: true, newRole: 'speaker' });
  } catch (error) {
    logger.error('Error promoting user', { error: error.message });
    next(error);
  }
};

/**
 * Demote a speaker to listener
 * POST /api/voice-rooms/:roomId/demote
 * Validates: Requirements 12.6
 */
exports.demoteToListener = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { targetUserId } = req.body;
    const userId = req.userId;

    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required' });
    }

    const voiceRoom = await VoiceRoom.findById(roomId);
    if (!voiceRoom) {
      return res.status(404).json({ error: 'Voice room not found' });
    }

    // Validate host permissions
    const hostParticipant = voiceRoom.participants.find(
      (p) => p.userId.toString() === userId.toString() && p.role === 'host'
    );

    if (!hostParticipant) {
      return res.status(403).json({ error: 'Only the host can demote users' });
    }

    // Find target participant
    const targetParticipant = voiceRoom.participants.find(
      (p) => p.userId.toString() === targetUserId.toString()
    );

    if (!targetParticipant) {
      return res.status(404).json({ error: 'Target user is not in this voice room' });
    }

    if (targetParticipant.role === 'host') {
      return res.status(400).json({ error: 'Cannot demote the host' });
    }

    if (targetParticipant.role === 'listener') {
      return res.status(400).json({ error: 'User is already a listener' });
    }

    // Change participant role to listener
    targetParticipant.role = 'listener';
    await voiceRoom.save();

    // Broadcast role change event via WebSocket
    const io = req.app.get('io');
    if (io) {
      const { emitRoleChanged } = require('../socket/voiceRoomHandlers');
      emitRoleChanged(io, roomId, targetUserId, 'listener');
    }

    logger.info('User demoted to listener', {
      roomId,
      targetUserId,
      demotedBy: userId,
    });

    res.json({ success: true, newRole: 'listener' });
  } catch (error) {
    logger.error('Error demoting user', { error: error.message });
    next(error);
  }
};

/**
 * Send chat message in voice room
 * POST /api/voice-rooms/:roomId/chat
 * Validates: Requirements 13.1, 13.2, 13.3
 */
exports.sendVoiceRoomChat = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { message } = req.body;
    const senderId = req.userId;

    // Validate message length
    if (!message || message.length > 500) {
      return res.status(400).json({
        error: 'Message is required and must not exceed 500 characters',
      });
    }

    const voiceRoom = await VoiceRoom.findById(roomId);
    if (!voiceRoom) {
      return res.status(404).json({ error: 'Voice room not found' });
    }

    if (voiceRoom.status !== 'active') {
      return res.status(400).json({ error: 'Voice room is not active' });
    }

    // Check if user is in the room
    const participant = voiceRoom.participants.find(
      (p) => p.userId.toString() === senderId.toString()
    );

    if (!participant) {
      return res.status(403).json({ error: 'You are not in this voice room' });
    }

    // Get sender info
    const sender = await User.findById(senderId).select('displayName profilePictureUrl');

    // Create chat message
    const chatMessage = new ChatMessage({
      voiceRoomId: roomId,
      senderId,
      message,
      timestamp: new Date(),
    });

    await chatMessage.save();

    // Broadcast message via WebSocket within 500ms
    const io = req.app.get('io');
    if (io) {
      io.to(`voice:${roomId}`).emit('voice:chat-message', {
        messageId: chatMessage._id,
        roomId,
        senderId,
        senderName: sender.displayName,
        senderAvatar: sender.profilePictureUrl,
        message,
        timestamp: chatMessage.timestamp,
      });
    }

    logger.info('Voice room chat message sent', {
      roomId,
      senderId,
      messageId: chatMessage._id,
    });

    res.status(201).json({
      messageId: chatMessage._id,
      timestamp: chatMessage.timestamp,
    });
  } catch (error) {
    logger.error('Error sending voice room chat message', { error: error.message });
    next(error);
  }
};

/**
 * Get voice room details
 * GET /api/voice-rooms/:roomId
 */
exports.getVoiceRoom = async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const voiceRoom = await VoiceRoom.findById(roomId)
      .populate('participants.userId', 'displayName profilePictureUrl')
      .populate('hostId', 'displayName profilePictureUrl');

    if (!voiceRoom) {
      return res.status(404).json({ error: 'Voice room not found' });
    }

    res.json({
      roomId: voiceRoom._id,
      hostId: voiceRoom.hostId,
      name: voiceRoom.name,
      participantLimit: voiceRoom.participantLimit,
      createdAt: voiceRoom.createdAt,
      status: voiceRoom.status,
      agoraChannelId: voiceRoom.agoraChannelId,
      participants: voiceRoom.participants,
      participantCount: voiceRoom.participants.length,
    });
  } catch (error) {
    logger.error('Error getting voice room', { error: error.message });
    next(error);
  }
};

/**
 * Get active voice rooms with pagination
 * GET /api/voice-rooms/active
 */
exports.getActiveVoiceRooms = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const voiceRooms = await VoiceRoom.find({ status: 'active' })
      .populate('hostId', 'displayName profilePictureUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await VoiceRoom.countDocuments({ status: 'active' });

    const roomsWithParticipantCount = voiceRooms.map((room) => ({
      ...room,
      id: room._id,
      participantCount: room.participants ? room.participants.length : 0,
      chatHistory: [], // omit chat history from list view
    }));

    res.json({
      voiceRooms: roomsWithParticipantCount,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error('Error fetching active voice rooms', { error: error.message });
    next(error);
  }
};