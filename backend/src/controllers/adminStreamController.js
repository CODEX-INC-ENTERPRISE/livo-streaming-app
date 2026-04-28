const Stream = require('../models/Stream');
const User = require('../models/User');
const ChatMessage = require('../models/ChatMessage');
const agoraService = require('../services/agoraService');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

/**
 * Get all streams with status filter
 * GET /api/admin/streams
 * Validates: Requirements 22.1, 22.4
 */
const getStreams = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status; // 'active', 'ended', 'terminated', or undefined for all
    const search = req.query.search || '';

    const query = {};

    // Status filter
    if (status) {
      if (!['active', 'ended', 'terminated'].includes(status)) {
        throw new ValidationError('Invalid status. Must be one of: active, ended, terminated');
      }
      query.status = status;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
      ];
    }

    // Get total count
    const total = await Stream.countDocuments(query);

    // Get streams with pagination and populate host information
    const streams = await Stream.find(query)
      .populate('hostId', 'displayName profilePictureUrl')
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Format response with additional information
    const formattedStreams = streams.map(stream => {
      const host = stream.hostId;
      const duration = stream.endedAt 
        ? Math.floor((stream.endedAt - stream.startedAt) / 1000) // in seconds
        : Math.floor((new Date() - stream.startedAt) / 1000);

      return {
        id: stream._id,
        title: stream.title,
        hostId: host?._id,
        hostName: host?.displayName,
        hostProfilePicture: host?.profilePictureUrl,
        status: stream.status,
        startedAt: stream.startedAt,
        endedAt: stream.endedAt,
        duration,
        peakViewerCount: stream.peakViewerCount,
        currentViewerCount: stream.currentViewerIds?.length || 0,
        totalGiftsReceived: stream.totalGiftsReceived,
        mutedUserCount: stream.mutedUserIds?.length || 0,
        kickedUserCount: stream.kickedUserIds?.length || 0,
        moderatorCount: stream.moderatorIds?.length || 0,
        agoraChannelId: stream.agoraChannelId,
      };
    });

    res.json({
      streams: formattedStreams,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get admin streams error', {
      error: error.message,
      query: req.query,
    });
    next(error);
  }
};

/**
 * Get stream details
 * GET /api/admin/streams/:streamId
 * Validates: Requirements 22.2
 */
const getStreamDetails = async (req, res, next) => {
  try {
    const { streamId } = req.params;

    const stream = await Stream.findById(streamId)
      .populate('hostId', 'displayName email phoneNumber profilePictureUrl')
      .populate('currentViewerIds', 'displayName profilePictureUrl')
      .populate('mutedUserIds', 'displayName')
      .populate('kickedUserIds', 'displayName')
      .populate('moderatorIds', 'displayName')
      .lean();

    if (!stream) {
      throw new NotFoundError('Stream not found');
    }

    // Get chat messages count
    const chatMessageCount = await ChatMessage.countDocuments({ streamId });

    // Calculate duration
    const duration = stream.endedAt 
      ? Math.floor((stream.endedAt - stream.startedAt) / 1000)
      : Math.floor((new Date() - stream.startedAt) / 1000);

    // Format response
    const streamDetails = {
      id: stream._id,
      title: stream.title,
      host: {
        id: stream.hostId?._id,
        displayName: stream.hostId?.displayName,
        email: stream.hostId?.email,
        phoneNumber: stream.hostId?.phoneNumber,
        profilePictureUrl: stream.hostId?.profilePictureUrl,
      },
      status: stream.status,
      startedAt: stream.startedAt,
      endedAt: stream.endedAt,
      duration,
      peakViewerCount: stream.peakViewerCount,
      totalGiftsReceived: stream.totalGiftsReceived,
      agoraChannelId: stream.agoraChannelId,
      statistics: {
        currentViewerCount: stream.currentViewerIds?.length || 0,
        mutedUserCount: stream.mutedUserIds?.length || 0,
        kickedUserCount: stream.kickedUserIds?.length || 0,
        moderatorCount: stream.moderatorIds?.length || 0,
        chatMessageCount,
      },
      viewers: stream.currentViewerIds?.map(viewer => ({
        id: viewer._id,
        displayName: viewer.displayName,
        profilePictureUrl: viewer.profilePictureUrl,
      })) || [],
      mutedUsers: stream.mutedUserIds?.map(user => ({
        id: user._id,
        displayName: user.displayName,
      })) || [],
      kickedUsers: stream.kickedUserIds?.map(user => ({
        id: user._id,
        displayName: user.displayName,
      })) || [],
      moderators: stream.moderatorIds?.map(moderator => ({
        id: moderator._id,
        displayName: moderator.displayName,
      })) || [],
    };

    res.json({ stream: streamDetails });
  } catch (error) {
    logger.error('Get admin stream details error', {
      error: error.message,
      streamId: req.params.streamId,
    });
    next(error);
  }
};

/**
 * Terminate a stream immediately
 * POST /api/admin/streams/:streamId/terminate
 * Validates: Requirements 22.3
 */
const terminateStream = async (req, res, next) => {
  try {
    const { streamId } = req.params;
    const adminId = req.userId;

    const stream = await Stream.findById(streamId)
      .populate('hostId', 'displayName fcmToken notificationPrefs');

    if (!stream) {
      throw new NotFoundError('Stream not found');
    }

    if (stream.status !== 'active') {
      throw new ValidationError('Stream is not active');
    }

    // Update stream status to terminated
    stream.status = 'terminated';
    stream.endedAt = new Date();
    await stream.save();

    // Broadcast 'stream:ended' event to all viewers via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to(`stream:${streamId}`).emit('stream:ended', {
        streamId: stream._id,
        endedAt: stream.endedAt,
        terminatedByAdmin: true,
      });
    }

    // Notify host about termination
    try {
      const notification = {
        type: 'stream_terminated',
        title: 'Stream Terminated by Admin',
        message: `Your stream "${stream.title}" has been terminated by an administrator.`,
        data: {
          streamId: stream._id,
          title: stream.title,
          terminatedAt: stream.endedAt,
          adminId,
        },
      };

      await notificationService.sendNotification(stream.hostId._id, notification);

      logger.info('Stream termination notification sent to host', {
        streamId,
        hostId: stream.hostId._id,
        adminId,
      });
    } catch (notificationError) {
      logger.warn('Failed to send stream termination notification', {
        error: notificationError.message,
        streamId,
        hostId: stream.hostId._id,
      });
      // Continue even if notification fails
    }

    const statistics = {
      streamId: stream._id,
      duration: Math.floor((stream.endedAt - stream.startedAt) / 1000),
      peakViewerCount: stream.peakViewerCount,
      totalGiftsReceived: stream.totalGiftsReceived,
      viewerCountAtTermination: stream.currentViewerIds?.length || 0,
    };

    logger.info('Stream terminated by admin', {
      streamId,
      adminId,
      statistics,
    });

    res.json({
      success: true,
      message: 'Stream terminated successfully',
      statistics,
    });
  } catch (error) {
    logger.error('Error terminating stream', {
      error: error.message,
      streamId: req.params.streamId,
      adminId: req.userId,
    });
    next(error);
  }
};

/**
 * Flag a stream for review
 * POST /api/admin/streams/:streamId/flag
 * Validates: Requirements 22.5
 */
const flagStream = async (req, res, next) => {
  try {
    const { streamId } = req.params;
    const adminId = req.userId;
    const { reason, notes } = req.body;

    if (!reason || reason.trim().length === 0) {
      throw new ValidationError('Reason is required for flagging a stream');
    }

    const stream = await Stream.findById(streamId)
      .populate('hostId', 'displayName');

    if (!stream) {
      throw new NotFoundError('Stream not found');
    }

    // Add flag information to stream
    stream.flagged = true;
    stream.flaggedAt = new Date();
    stream.flaggedBy = adminId;
    stream.flagReason = reason;
    stream.flagNotes = notes || '';
    stream.flagStatus = 'pending_review';

    await stream.save();

    // Create a flag record (could be stored in a separate collection for better tracking)
    const flagRecord = {
      streamId: stream._id,
      streamTitle: stream.title,
      hostId: stream.hostId._id,
      hostName: stream.hostId.displayName,
      flaggedBy: adminId,
      reason,
      notes: notes || '',
      flaggedAt: stream.flaggedAt,
      status: 'pending_review',
      streamStatusAtFlag: stream.status,
      viewerCountAtFlag: stream.currentViewerIds?.length || 0,
    };

    // Log the flag action
    logger.info('Stream flagged for review', flagRecord);

    res.json({
      success: true,
      message: 'Stream flagged successfully for review',
      flagRecord: {
        streamId: stream._id,
        streamTitle: stream.title,
        hostId: stream.hostId._id,
        hostName: stream.hostId.displayName,
        reason,
        flaggedAt: stream.flaggedAt,
        status: 'pending_review',
      },
    });
  } catch (error) {
    logger.error('Error flagging stream', {
      error: error.message,
      streamId: req.params.streamId,
      adminId: req.userId,
      reason: req.body?.reason,
    });
    next(error);
  }
};

/**
 * Get flagged streams
 * GET /api/admin/streams/flagged
 */
const getFlaggedStreams = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status; // 'pending_review', 'reviewed', 'action_taken', or undefined for all

    const query = { flagged: true };

    // Status filter
    if (status) {
      query.flagStatus = status;
    }

    // Get total count
    const total = await Stream.countDocuments(query);

    // Get flagged streams with pagination
    const streams = await Stream.find(query)
      .populate('hostId', 'displayName profilePictureUrl')
      .populate('flaggedBy', 'displayName')
      .sort({ flaggedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Format response
    const formattedStreams = streams.map(stream => ({
      id: stream._id,
      title: stream.title,
      hostId: stream.hostId?._id,
      hostName: stream.hostId?.displayName,
      status: stream.status,
      flaggedAt: stream.flaggedAt,
      flaggedBy: stream.flaggedBy?.displayName,
      flagReason: stream.flagReason,
      flagNotes: stream.flagNotes,
      flagStatus: stream.flagStatus,
      streamStatusAtFlag: stream.streamStatusAtFlag,
      viewerCountAtFlag: stream.viewerCountAtFlag,
    }));

    res.json({
      streams: formattedStreams,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get flagged streams error', {
      error: error.message,
      query: req.query,
    });
    next(error);
  }
};

module.exports = {
  getStreams,
  getStreamDetails,
  terminateStream,
  flagStream,
  getFlaggedStreams,
};