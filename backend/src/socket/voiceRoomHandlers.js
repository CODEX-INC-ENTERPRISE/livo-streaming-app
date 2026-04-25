const logger = require('../utils/logger');
const VoiceRoom = require('../models/VoiceRoom');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');

const registerVoiceRoomHandlers = (io, socket) => {
  // Join voice room
  socket.on('voice:join', async (data) => {
    try {
      const { roomId } = data;

      if (!roomId) {
        socket.emit('error', { message: 'Room ID required' });
        return;
      }

      const room = await VoiceRoom.findById(roomId);
      if (!room || room.status !== 'active') {
        socket.emit('error', { message: 'Voice room not found or not active' });
        return;
      }

      // Check participant limit
      if (room.participants.length >= room.participantLimit) {
        socket.emit('error', { message: 'Voice room is full' });
        return;
      }

      // Check if user is already in the room
      const existingParticipant = room.participants.find(
        (p) => p.userId.toString() === socket.userId.toString()
      );

      if (!existingParticipant) {
        // Add user as listener by default
        room.participants.push({
          userId: socket.userId,
          role: 'listener',
          isHandRaised: false,
          joinedAt: new Date(),
        });
        await room.save();
      }

      // Join the voice room
      socket.join(`voice:${roomId}`);

      // Get user info
      const user = await User.findById(socket.userId).select('displayName profilePictureUrl');

      // Notify other participants
      socket.to(`voice:${roomId}`).emit('voice:participant-joined', {
        userId: socket.userId,
        displayName: user?.displayName,
        profilePictureUrl: user?.profilePictureUrl,
        role: existingParticipant?.role || 'listener',
        participantCount: room.participants.length,
      });

      // Send confirmation to joining user with current participants
      socket.emit('voice:joined', {
        roomId,
        participants: room.participants,
        participantCount: room.participants.length,
      });

      logger.info('User joined voice room', {
        userId: socket.userId,
        roomId,
        participantCount: room.participants.length,
      });
    } catch (error) {
      logger.error('Error joining voice room', {
        error: error.message,
        userId: socket.userId,
        data,
      });
      socket.emit('error', { message: 'Failed to join voice room' });
    }
  });

  // Leave voice room
  socket.on('voice:leave', async (data) => {
    try {
      const { roomId } = data;

      if (!roomId) {
        return;
      }

      const room = await VoiceRoom.findById(roomId);
      if (room) {
        // Remove participant from room
        room.participants = room.participants.filter(
          (p) => p.userId.toString() !== socket.userId.toString()
        );
        await room.save();

        // Notify other participants
        socket.to(`voice:${roomId}`).emit('voice:participant-left', {
          userId: socket.userId,
          participantCount: room.participants.length,
        });
      }

      // Leave the room
      socket.leave(`voice:${roomId}`);

      logger.info('User left voice room', {
        userId: socket.userId,
        roomId,
      });
    } catch (error) {
      logger.error('Error leaving voice room', {
        error: error.message,
        userId: socket.userId,
        data,
      });
    }
  });

  // Raise hand
  socket.on('voice:raise-hand', async (data) => {
    try {
      const { roomId } = data;

      if (!roomId) {
        socket.emit('error', { message: 'Room ID required' });
        return;
      }

      const room = await VoiceRoom.findById(roomId);
      if (!room || room.status !== 'active') {
        socket.emit('error', { message: 'Voice room not found or not active' });
        return;
      }

      // Find participant
      const participant = room.participants.find(
        (p) => p.userId.toString() === socket.userId.toString()
      );

      if (!participant) {
        socket.emit('error', { message: 'You are not in this voice room' });
        return;
      }

      if (participant.role === 'speaker') {
        socket.emit('error', { message: 'You are already a speaker' });
        return;
      }

      // Set hand raised
      participant.isHandRaised = true;
      await room.save();

      // Get user info
      const user = await User.findById(socket.userId).select('displayName profilePictureUrl');

      // Notify host (emit to all, but UI should show only to host)
      io.to(`voice:${roomId}`).emit('voice:hand-raised', {
        userId: socket.userId,
        displayName: user?.displayName,
        profilePictureUrl: user?.profilePictureUrl,
        roomId,
        timestamp: new Date(),
      });

      logger.info('User raised hand', {
        userId: socket.userId,
        roomId,
      });
    } catch (error) {
      logger.error('Error raising hand', {
        error: error.message,
        userId: socket.userId,
        data,
      });
      socket.emit('error', { message: 'Failed to raise hand' });
    }
  });

  // Send chat message in voice room
  socket.on('voice:chat', async (data) => {
    try {
      const { roomId, message } = data;

      if (!roomId || !message) {
        socket.emit('error', { message: 'Room ID and message required' });
        return;
      }

      if (message.length > 500) {
        socket.emit('error', { message: 'Message too long (max 500 characters)' });
        return;
      }

      const room = await VoiceRoom.findById(roomId);
      if (!room || room.status !== 'active') {
        socket.emit('error', { message: 'Voice room not found or not active' });
        return;
      }

      // Check if user is in the room
      const participant = room.participants.find(
        (p) => p.userId.toString() === socket.userId.toString()
      );

      if (!participant) {
        socket.emit('error', { message: 'You are not in this voice room' });
        return;
      }

      // Get user info
      const user = await User.findById(socket.userId).select('displayName profilePictureUrl');

      // Save chat message
      const chatMessage = new ChatMessage({
        voiceRoomId: roomId,
        senderId: socket.userId,
        message,
        timestamp: new Date(),
      });
      await chatMessage.save();

      // Broadcast message to all participants (within 500ms requirement)
      const messageData = {
        messageId: chatMessage._id,
        roomId,
        senderId: socket.userId,
        senderName: user?.displayName,
        senderAvatar: user?.profilePictureUrl,
        message,
        timestamp: chatMessage.timestamp,
      };

      io.to(`voice:${roomId}`).emit('voice:chat-message', messageData);

      logger.info('Voice room chat message sent', {
        userId: socket.userId,
        roomId,
        messageId: chatMessage._id,
      });
    } catch (error) {
      logger.error('Error sending voice room chat message', {
        error: error.message,
        userId: socket.userId,
        data,
      });
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle disconnect - clean up voice rooms
  socket.on('disconnect', async () => {
    try {
      // Find all voice rooms this user was in
      const rooms = await VoiceRoom.find({
        'participants.userId': socket.userId,
        status: 'active',
      });

      for (const room of rooms) {
        room.participants = room.participants.filter(
          (p) => p.userId.toString() !== socket.userId.toString()
        );
        await room.save();

        // Notify other participants
        socket.to(`voice:${room._id}`).emit('voice:participant-left', {
          userId: socket.userId,
          participantCount: room.participants.length,
        });
      }
    } catch (error) {
      logger.error('Error cleaning up voice room on disconnect', {
        error: error.message,
        userId: socket.userId,
      });
    }
  });
};

// Helper function to emit role change (called from API)
const emitRoleChanged = (io, roomId, userId, newRole) => {
  io.to(`voice:${roomId}`).emit('voice:role-changed', {
    roomId,
    userId,
    newRole, // 'speaker' or 'listener'
    timestamp: new Date(),
  });

  logger.info('Role change emitted', {
    roomId,
    userId,
    newRole,
  });
};

module.exports = {
  registerVoiceRoomHandlers,
  emitRoleChanged,
};
