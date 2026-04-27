const Stream = require('../models/Stream');
const User = require('../models/User');
const ChatMessage = require('../models/ChatMessage');
const agoraService = require('../services/agoraService');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Start a new live stream
 * POST /api/streams/start
 */
exports.startStream = async (req, res, next) => {
  try {
    const { title } = req.body;
    const hostId = req.userId;

    // Validate host permissions
    const user = await User.findById(hostId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.isHost) {
      return res.status(403).json({ error: 'Host permissions required' });
    }

    // Check if host already has an active stream
    const existingStream = await Stream.findOne({
      hostId,
      status: 'active',
    });

    if (existingStream) {
      return res.status(400).json({ error: 'Host already has an active stream' });
    }

    // Check system capacity (max 5000 concurrent viewers)
    const activeStreams = await Stream.find({ status: 'active' });
    const totalViewers = activeStreams.reduce(
      (sum, stream) => sum + stream.currentViewerIds.length,
      0
    );

    if (totalViewers >= 5000) {
      return res.status(503).json({
        error: 'System capacity reached. Please try again later.',
      });
    }

    // Generate Agora channel ID and token
    const agoraChannelId = agoraService.generateChannelId(hostId);
    const agoraToken = agoraService.generateHostToken(agoraChannelId, 0);

    // Create stream document
    const stream = new Stream({
      hostId,
      title,
      agoraChannelId,
      status: 'active',
      startedAt: new Date(),
    });

    await stream.save();

    logger.info('Stream started', {
      streamId: stream._id,
      hostId,
      agoraChannelId,
    });

    // Trigger notification to all followers (within 2 seconds requirement)
    try {
      const host = await User.findById(hostId).select('followerIds displayName');
      if (host && host.followerIds.length > 0) {
        const notification = {
          type: 'stream_start',
          title: `${host.displayName} started streaming`,
          message: `Watch ${host.displayName}'s live stream: ${title}`,
          data: {
            streamId: stream._id,
            hostId: host._id,
            hostName: host.displayName,
            title,
          },
        };
        
        // Send notification to all followers
        await notificationService.sendBulkNotification(host.followerIds, notification);
        
        logger.info('Stream start notification sent to followers', {
          streamId: stream._id,
          hostId,
          followerCount: host.followerIds.length,
        });
      }
    } catch (notificationError) {
      logger.warn('Failed to send stream start notification', {
        error: notificationError.message,
        streamId: stream._id,
        hostId,
      });
      // Continue even if notification fails
    }

    res.status(201).json({
      streamId: stream._id,
      agoraChannelId,
      agoraToken,
      appId: agoraService.appId,
    });
  } catch (error) {
    logger.error('Error starting stream', { error: error.message });
    next(error);
  }
};

/**
 * End a live stream
 * POST /api/streams/:streamId/end
 */
exports.endStream = async (req, res, next) => {
  try {
    const { streamId } = req.params;
    const hostId = req.userId;

    const stream = await Stream.findById(streamId);
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    // Validate host ownership
    if (stream.hostId.toString() !== hostId) {
      return res.status(403).json({ error: 'Only the host can end this stream' });
    }

    if (stream.status !== 'active') {
      return res.status(400).json({ error: 'Stream is not active' });
    }

    // Update stream with end time and statistics
    stream.status = 'ended';
    stream.endedAt = new Date();
    await stream.save();

    // Broadcast 'stream:ended' event to all viewers via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to(`stream:${streamId}`).emit('stream:ended', {
        streamId: stream._id,
        endedAt: stream.endedAt,
      });
    }

    const statistics = {
      streamId: stream._id,
      duration: Math.floor((stream.endedAt - stream.startedAt) / 1000), // in seconds
      peakViewerCount: stream.peakViewerCount,
      totalGiftsReceived: stream.totalGiftsReceived,
    };

    logger.info('Stream ended', { streamId, hostId, statistics });

    res.json({ success: true, statistics });
  } catch (error) {
    logger.error('Error ending stream', { error: error.message });
    next(error);
  }
};

/**
 * Get active streams with pagination
 * GET /api/streams/active
 */
exports.getActiveStreams = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const streams = await Stream.find({ status: 'active' })
      .populate('hostId', 'displayName profilePictureUrl')
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Stream.countDocuments({ status: 'active' });

    // Add viewer count to each stream
    const streamsWithViewerCount = streams.map((stream) => ({
      ...stream,
      viewerCount: stream.currentViewerIds.length,
    }));

    res.json({
      streams: streamsWithViewerCount,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error('Error fetching active streams', { error: error.message });
    next(error);
  }
};

/**
 * Join a stream as viewer
 * POST /api/streams/:streamId/join
 */
exports.joinStream = async (req, res, next) => {
  try {
    const { streamId } = req.params;
    const viewerId = req.userId;

    const stream = await Stream.findById(streamId);
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    if (stream.status !== 'active') {
      return res.status(400).json({ error: 'Stream is not active' });
    }

    // Check if viewer is kicked
    if (stream.kickedUserIds.includes(viewerId)) {
      return res.status(403).json({ error: 'You have been removed from this stream' });
    }

    // Check if viewer is blocked by host
    const host = await User.findById(stream.hostId);
    if (host && host.blockedUserIds.includes(viewerId)) {
      return res.status(403).json({ error: 'You are blocked by the host' });
    }

    // Add viewer to currentViewerIds if not already present
    if (!stream.currentViewerIds.includes(viewerId)) {
      stream.currentViewerIds.push(viewerId);

      // Update peak viewer count
      if (stream.currentViewerIds.length > stream.peakViewerCount) {
        stream.peakViewerCount = stream.currentViewerIds.length;
      }

      await stream.save();
    }

    // Generate Agora viewer token
    const agoraToken = agoraService.generateViewerToken(stream.agoraChannelId, 0);

    // Broadcast viewer joined event
    const io = req.app.get('io');
    if (io) {
      io.to(`stream:${streamId}`).emit('stream:viewer-joined', {
        viewerId,
        viewerCount: stream.currentViewerIds.length,
      });
    }

    logger.info('Viewer joined stream', { streamId, viewerId });

    res.json({
      streamId: stream._id,
      agoraChannelId: stream.agoraChannelId,
      agoraToken,
      appId: agoraService.appId,
      playbackUrl: stream.agoraChannelId, // Channel ID serves as playback identifier
    });
  } catch (error) {
    logger.error('Error joining stream', { error: error.message });
    next(error);
  }
};

/**
 * Leave a stream
 * POST /api/streams/:streamId/leave
 */
exports.leaveStream = async (req, res, next) => {
  try {
    const { streamId } = req.params;
    const viewerId = req.userId;

    const stream = await Stream.findById(streamId);
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    // Remove viewer from currentViewerIds
    stream.currentViewerIds = stream.currentViewerIds.filter(
      (id) => id.toString() !== viewerId
    );

    await stream.save();

    // Broadcast viewer left event
    const io = req.app.get('io');
    if (io) {
      io.to(`stream:${streamId}`).emit('stream:viewer-left', {
        viewerId,
        viewerCount: stream.currentViewerIds.length,
      });
    }

    logger.info('Viewer left stream', { streamId, viewerId });

    res.json({ success: true, viewerCount: stream.currentViewerIds.length });
  } catch (error) {
    logger.error('Error leaving stream', { error: error.message });
    next(error);
  }
};

/**
 * Send a chat message in a stream
 * POST /api/streams/:streamId/chat
 */
exports.sendChatMessage = async (req, res, next) => {
  try {
    const { streamId } = req.params;
    const { message } = req.body;
    const senderId = req.userId;

    // Validate message length
    if (!message || message.length > 500) {
      return res.status(400).json({
        error: 'Message is required and must not exceed 500 characters',
      });
    }

    const stream = await Stream.findById(streamId);
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    if (stream.status !== 'active') {
      return res.status(400).json({ error: 'Stream is not active' });
    }

    // Check if user is muted
    if (stream.mutedUserIds.includes(senderId)) {
      return res.status(403).json({ error: 'You are muted in this stream' });
    }

    // Get sender info
    const sender = await User.findById(senderId).select('displayName profilePictureUrl');

    // Create chat message
    const chatMessage = new ChatMessage({
      streamId,
      senderId,
      message,
      timestamp: new Date(),
    });

    await chatMessage.save();

    // Broadcast message via WebSocket within 500ms
    const io = req.app.get('io');
    if (io) {
      io.to(`stream:${streamId}`).emit('stream:chat-message', {
        messageId: chatMessage._id,
        streamId,
        senderId,
        senderName: sender.displayName,
        senderAvatar: sender.profilePictureUrl,
        message,
        timestamp: chatMessage.timestamp,
        isPinned: false,
      });
    }

    // Send notification to host about new message (if sender is not host)
    if (senderId !== stream.hostId.toString()) {
      try {
        const notification = {
          type: 'new_message',
          title: 'New Message',
          message: `${sender.displayName}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
          data: {
            streamId,
            senderId,
            senderName: sender.displayName,
            messageId: chatMessage._id,
          },
        };
        
        await notificationService.sendNotification(stream.hostId, notification);
        
        logger.info('Message notification sent to host', {
          streamId,
          senderId,
          hostId: stream.hostId,
          messageId: chatMessage._id,
        });
      } catch (notificationError) {
        logger.warn('Failed to send message notification', {
          error: notificationError.message,
          streamId,
          hostId: stream.hostId,
        });
        // Continue even if notification fails
      }
    }

    logger.info('Chat message sent', { streamId, senderId, messageId: chatMessage._id });

    res.status(201).json({
      messageId: chatMessage._id,
      timestamp: chatMessage.timestamp,
    });
  } catch (error) {
    logger.error('Error sending chat message', { error: error.message });
    next(error);
  }
};

/**
 * Pin a chat message
 * POST /api/streams/:streamId/pin-message
 */
exports.pinMessage = async (req, res, next) => {
  try {
    const { streamId } = req.params;
    const { messageId } = req.body;
    const userId = req.userId;

    const stream = await Stream.findById(streamId);
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    // Validate host or moderator permissions
    const isHost = stream.hostId.toString() === userId;
    const isModerator = stream.moderatorIds.includes(userId);

    if (!isHost && !isModerator) {
      return res.status(403).json({
        error: 'Only host or moderators can pin messages',
      });
    }

    // Update message isPinned flag
    const chatMessage = await ChatMessage.findById(messageId);
    if (!chatMessage) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (chatMessage.streamId.toString() !== streamId) {
      return res.status(400).json({ error: 'Message does not belong to this stream' });
    }

    // Unpin all other messages first
    await ChatMessage.updateMany(
      { streamId, isPinned: true },
      { isPinned: false }
    );

    chatMessage.isPinned = true;
    await chatMessage.save();

    // Broadcast pinned message to all viewers
    const io = req.app.get('io');
    if (io) {
      const sender = await User.findById(chatMessage.senderId).select('displayName profilePictureUrl');
      io.to(`stream:${streamId}`).emit('stream:message-pinned', {
        messageId: chatMessage._id,
        senderId: chatMessage.senderId,
        senderName: sender.displayName,
        message: chatMessage.message,
        timestamp: chatMessage.timestamp,
      });
    }

    logger.info('Message pinned', { streamId, messageId, pinnedBy: userId });

    res.json({ success: true, messageId: chatMessage._id });
  } catch (error) {
    logger.error('Error pinning message', { error: error.message });
    next(error);
  }
};

/**
 * Moderate stream (mute, kick, block, assign moderator)
 * POST /api/streams/:streamId/moderate
 */
exports.moderateStream = async (req, res, next) => {
  try {
    const { streamId } = req.params;
    const { action, targetUserId } = req.body;
    const userId = req.userId;

    // Validate action
    const validActions = ['mute', 'kick', 'block', 'assign_moderator'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
      });
    }

    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required' });
    }

    const stream = await Stream.findById(streamId);
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    // Validate host or moderator permissions
    const isHost = stream.hostId.toString() === userId;
    const isModerator = stream.moderatorIds.includes(userId);

    if (!isHost && !isModerator) {
      return res.status(403).json({
        error: 'Only host or moderators can perform moderation actions',
      });
    }

    // Only host can assign moderators or block users
    if ((action === 'assign_moderator' || action === 'block') && !isHost) {
      return res.status(403).json({
        error: 'Only the host can perform this action',
      });
    }

    let updateResult;

    switch (action) {
      case 'mute':
        // Add to mutedUserIds
        if (!stream.mutedUserIds.includes(targetUserId)) {
          stream.mutedUserIds.push(targetUserId);
          await stream.save();
        }
        updateResult = { action: 'muted', targetUserId };
        break;

      case 'kick':
        // Add to kickedUserIds and remove from viewers
        if (!stream.kickedUserIds.includes(targetUserId)) {
          stream.kickedUserIds.push(targetUserId);
        }
        stream.currentViewerIds = stream.currentViewerIds.filter(
          (id) => id.toString() !== targetUserId
        );
        await stream.save();
        updateResult = { action: 'kicked', targetUserId };
        break;

      case 'block':
        // Add to host's blockedUserIds
        const host = await User.findById(stream.hostId);
        if (!host.blockedUserIds.includes(targetUserId)) {
          host.blockedUserIds.push(targetUserId);
          await host.save();
        }
        // Also kick from current stream
        stream.currentViewerIds = stream.currentViewerIds.filter(
          (id) => id.toString() !== targetUserId
        );
        await stream.save();
        updateResult = { action: 'blocked', targetUserId };
        break;

      case 'assign_moderator':
        // Add to moderatorIds
        if (!stream.moderatorIds.includes(targetUserId)) {
          stream.moderatorIds.push(targetUserId);
          await stream.save();
        }
        updateResult = { action: 'moderator_assigned', targetUserId };
        break;
    }

    // Broadcast moderation action via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to(`stream:${streamId}`).emit('stream:moderation', {
        streamId,
        action,
        targetUserId,
        moderatorId: userId,
      });

      // Notify the target user specifically
      io.to(`user:${targetUserId}`).emit('stream:moderation-action', {
        streamId,
        action,
        message: `You have been ${action === 'assign_moderator' ? 'assigned as moderator' : action}`,
      });
    }

    logger.info('Moderation action performed', {
      streamId,
      action,
      targetUserId,
      moderatorId: userId,
    });

    res.json({ success: true, ...updateResult });
  } catch (error) {
    logger.error('Error performing moderation action', { error: error.message });
    next(error);
  }
};
