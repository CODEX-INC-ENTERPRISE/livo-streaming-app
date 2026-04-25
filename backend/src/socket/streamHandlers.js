const logger = require('../utils/logger');
const Stream = require('../models/Stream');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const VirtualGift = require('../models/VirtualGift');
const mongoose = require('mongoose');

const registerStreamHandlers = (io, socket) => {
  // Join stream room
  socket.on('stream:join', async (data) => {
    try {
      const { streamId } = data;

      if (!streamId) {
        socket.emit('error', { message: 'Stream ID required' });
        return;
      }

      const stream = await Stream.findById(streamId);
      if (!stream || stream.status !== 'active') {
        socket.emit('error', { message: 'Stream not found or not active' });
        return;
      }

      // Join the stream room
      socket.join(`stream:${streamId}`);

      // Add viewer to stream
      if (!stream.currentViewerIds.includes(socket.userId)) {
        stream.currentViewerIds.push(socket.userId);
        await stream.save();
      }

      // Get user info
      const user = await User.findById(socket.userId).select('displayName profilePictureUrl');

      // Notify other viewers
      socket.to(`stream:${streamId}`).emit('stream:viewer-joined', {
        userId: socket.userId,
        displayName: user?.displayName,
        profilePictureUrl: user?.profilePictureUrl,
        viewerCount: stream.currentViewerIds.length,
      });

      // Send confirmation to joining user
      socket.emit('stream:joined', {
        streamId,
        viewerCount: stream.currentViewerIds.length,
      });

      logger.info('User joined stream', {
        userId: socket.userId,
        streamId,
        viewerCount: stream.currentViewerIds.length,
      });
    } catch (error) {
      logger.error('Error joining stream', {
        error: error.message,
        userId: socket.userId,
        data,
      });
      socket.emit('error', { message: 'Failed to join stream' });
    }
  });

  // Leave stream room
  socket.on('stream:leave', async (data) => {
    try {
      const { streamId } = data;

      if (!streamId) {
        return;
      }

      const stream = await Stream.findById(streamId);
      if (stream) {
        // Remove viewer from stream
        stream.currentViewerIds = stream.currentViewerIds.filter(
          (id) => id.toString() !== socket.userId.toString()
        );
        await stream.save();

        // Notify other viewers
        socket.to(`stream:${streamId}`).emit('stream:viewer-left', {
          userId: socket.userId,
          viewerCount: stream.currentViewerIds.length,
        });
      }

      // Leave the room
      socket.leave(`stream:${streamId}`);

      logger.info('User left stream', {
        userId: socket.userId,
        streamId,
      });
    } catch (error) {
      logger.error('Error leaving stream', {
        error: error.message,
        userId: socket.userId,
        data,
      });
    }
  });

  // Send chat message
  socket.on('stream:chat', async (data) => {
    try {
      const { streamId, message } = data;

      if (!streamId || !message) {
        socket.emit('error', { message: 'Stream ID and message required' });
        return;
      }

      if (message.length > 500) {
        socket.emit('error', { message: 'Message too long (max 500 characters)' });
        return;
      }

      const stream = await Stream.findById(streamId);
      if (!stream || stream.status !== 'active') {
        socket.emit('error', { message: 'Stream not found or not active' });
        return;
      }

      // Check if user is muted
      if (stream.mutedUserIds.includes(socket.userId)) {
        socket.emit('error', { message: 'You are muted in this stream' });
        return;
      }

      // Get user info
      const user = await User.findById(socket.userId).select('displayName profilePictureUrl');

      // Save chat message
      const chatMessage = new ChatMessage({
        streamId,
        senderId: socket.userId,
        message,
        timestamp: new Date(),
      });
      await chatMessage.save();

      // Broadcast message to all viewers (within 500ms requirement)
      const messageData = {
        messageId: chatMessage._id,
        streamId,
        senderId: socket.userId,
        senderName: user?.displayName,
        senderAvatar: user?.profilePictureUrl,
        message,
        timestamp: chatMessage.timestamp,
      };

      io.to(`stream:${streamId}`).emit('stream:chat-message', messageData);

      logger.info('Chat message sent', {
        userId: socket.userId,
        streamId,
        messageId: chatMessage._id,
      });
    } catch (error) {
      logger.error('Error sending chat message', {
        error: error.message,
        userId: socket.userId,
        data,
      });
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Send virtual gift
  socket.on('stream:gift', async (data) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { streamId, giftId } = data;

      if (!streamId || !giftId) {
        socket.emit('error', { message: 'Stream ID and gift ID required' });
        await session.abortTransaction();
        session.endSession();
        return;
      }

      const stream = await Stream.findById(streamId).session(session);
      if (!stream || stream.status !== 'active') {
        socket.emit('error', { message: 'Stream not found or not active' });
        await session.abortTransaction();
        session.endSession();
        return;
      }

      const senderId = socket.userId;
      const hostId = stream.hostId;

      // Prevent sending gifts to yourself
      if (senderId.toString() === hostId.toString()) {
        socket.emit('error', { message: 'Cannot send gifts to yourself' });
        await session.abortTransaction();
        session.endSession();
        return;
      }

      // Find gift
      const gift = await VirtualGift.findById(giftId).session(session);
      if (!gift || !gift.isActive) {
        socket.emit('error', { message: 'Gift not found or not available' });
        await session.abortTransaction();
        session.endSession();
        return;
      }

      // Get sender's wallet
      const senderWallet = await Wallet.findOne({ userId: senderId }).session(session);
      if (!senderWallet) {
        socket.emit('error', { message: 'Wallet not found' });
        await session.abortTransaction();
        session.endSession();
        return;
      }

      // Validate sufficient coins
      if (senderWallet.coinBalance < gift.coinPrice) {
        socket.emit('error', {
          message: 'Insufficient coins',
          required: gift.coinPrice,
          available: senderWallet.coinBalance,
        });
        await session.abortTransaction();
        session.endSession();
        return;
      }

      // Get host's wallet
      let hostWallet = await Wallet.findOne({ userId: hostId }).session(session);
      if (!hostWallet) {
        hostWallet = new Wallet({ userId: hostId });
        await hostWallet.save({ session });
      }

      // Deduct coins from sender atomically
      senderWallet.coinBalance -= gift.coinPrice;
      senderWallet.updatedAt = new Date();
      await senderWallet.save({ session });

      // Credit diamonds to host atomically
      hostWallet.diamondBalance += gift.diamondValue;
      hostWallet.updatedAt = new Date();
      await hostWallet.save({ session });

      // Update stream statistics
      stream.totalGiftsReceived += 1;
      await stream.save({ session });

      // Create transaction records
      const senderTransaction = new Transaction({
        userId: senderId,
        type: 'giftSent',
        amount: gift.coinPrice,
        currency: 'coins',
        description: `Sent ${gift.name} to host`,
        metadata: {
          giftId: gift._id,
          streamId: stream._id,
          recipientId: hostId,
        },
      });
      await senderTransaction.save({ session });

      const hostTransaction = new Transaction({
        userId: hostId,
        type: 'giftReceived',
        amount: gift.diamondValue,
        currency: 'diamonds',
        description: `Received ${gift.name} from viewer`,
        metadata: {
          giftId: gift._id,
          streamId: stream._id,
          recipientId: senderId,
        },
      });
      await hostTransaction.save({ session });

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      // Get user info
      const user = await User.findById(senderId).select('displayName profilePictureUrl');

      const giftData = {
        streamId,
        senderId,
        senderName: user?.displayName,
        senderAvatar: user?.profilePictureUrl,
        hostId,
        giftId: gift._id,
        giftName: gift.name,
        giftAnimationUrl: gift.animationAssetUrl,
        giftThumbnailUrl: gift.thumbnailUrl,
        coinPrice: gift.coinPrice,
        diamondValue: gift.diamondValue,
        timestamp: new Date(),
      };

      // Broadcast gift animation to all viewers
      io.to(`stream:${streamId}`).emit('stream:gift-sent', giftData);

      // Send notification to host
      io.to(`user:${hostId}`).emit('notification:new', {
        type: 'gift_received',
        title: 'Gift Received!',
        message: `${user?.displayName} sent you ${gift.name}`,
        data: {
          streamId,
          senderId,
          giftId: gift._id,
          giftName: gift.name,
          diamondValue: gift.diamondValue,
        },
        timestamp: new Date(),
      });

      // Confirm to sender
      socket.emit('stream:gift-confirmed', {
        success: true,
        newBalance: senderWallet.coinBalance,
        transactionId: senderTransaction._id,
      });

      logger.info('Gift sent via WebSocket', {
        userId: senderId,
        streamId,
        giftId: gift._id,
        giftName: gift.name,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error('Error sending gift via WebSocket', {
        error: error.message,
        userId: socket.userId,
        data,
      });
      socket.emit('error', { message: 'Failed to send gift' });
    }
  });

  // Handle disconnect - clean up stream rooms
  socket.on('disconnect', async () => {
    try {
      // Find all streams this user was viewing
      const streams = await Stream.find({
        currentViewerIds: socket.userId,
        status: 'active',
      });

      for (const stream of streams) {
        stream.currentViewerIds = stream.currentViewerIds.filter(
          (id) => id.toString() !== socket.userId.toString()
        );
        await stream.save();

        // Notify other viewers
        socket.to(`stream:${stream._id}`).emit('stream:viewer-left', {
          userId: socket.userId,
          viewerCount: stream.currentViewerIds.length,
        });
      }
    } catch (error) {
      logger.error('Error cleaning up stream on disconnect', {
        error: error.message,
        userId: socket.userId,
      });
    }
  });
};

// Helper function to emit stream ended event (called from API)
const emitStreamEnded = (io, streamId, reason = 'Host ended stream') => {
  io.to(`stream:${streamId}`).emit('stream:ended', {
    streamId,
    reason,
    timestamp: new Date(),
  });

  logger.info('Stream ended event emitted', { streamId, reason });
};

// Helper function to emit moderation action (called from API)
const emitModerationAction = (io, streamId, action, targetUserId, moderatorId) => {
  io.to(`stream:${streamId}`).emit('stream:moderation', {
    streamId,
    action, // 'mute', 'kick', 'block'
    targetUserId,
    moderatorId,
    timestamp: new Date(),
  });

  // If kicked, force disconnect the user from the stream
  if (action === 'kick') {
    const sockets = io.sockets.sockets;
    for (const [socketId, socket] of sockets) {
      if (socket.userId === targetUserId) {
        socket.leave(`stream:${streamId}`);
        socket.emit('stream:kicked', {
          streamId,
          reason: 'You were kicked from the stream',
        });
      }
    }
  }

  logger.info('Moderation action emitted', {
    streamId,
    action,
    targetUserId,
    moderatorId,
  });
};

module.exports = {
  registerStreamHandlers,
  emitStreamEnded,
  emitModerationAction,
};
