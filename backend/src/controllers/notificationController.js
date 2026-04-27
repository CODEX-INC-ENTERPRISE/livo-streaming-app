const Notification = require('../models/Notification');
const User = require('../models/User');
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
 * Get notifications for a user with pagination
 * GET /api/notifications/:userId
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { isRead } = req.query;

    // Validate user can only access their own notifications
    if (req.userId !== userId) {
      return res.status(403).json({
        error: 'You can only access your own notifications',
        code: 'FORBIDDEN',
      });
    }

    // Build query
    const query = { userId };
    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    // Get notifications with pagination
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Notification.countDocuments(query);

    // Calculate unread count
    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    res.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    });
  } catch (error) {
    logger.error('Error fetching notifications', {
      error: error.message,
      userId: req.params.userId,
    });
    next(error);
  }
};

/**
 * Mark a notification as read
 * PUT /api/notifications/:notificationId/read
 */
exports.markAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const userId = req.userId;

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    // Validate user can only mark their own notifications as read
    if (notification.userId.toString() !== userId) {
      return res.status(403).json({
        error: 'You can only mark your own notifications as read',
        code: 'FORBIDDEN',
      });
    }

    if (notification.isRead) {
      return res.json({
        success: true,
        message: 'Notification is already marked as read',
        notification,
      });
    }

    notification.isRead = true;
    await notification.save();

    logger.info('Notification marked as read', {
      notificationId,
      userId,
      type: notification.type,
    });

    res.json({
      success: true,
      message: 'Notification marked as read',
      notification,
    });
  } catch (error) {
    logger.error('Error marking notification as read', {
      error: error.message,
      notificationId: req.params.notificationId,
    });
    next(error);
  }
};

/**
 * Mark all notifications as read for a user
 * PUT /api/notifications/:userId/read-all
 */
exports.markAllAsRead = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Validate user can only mark their own notifications as read
    if (req.userId !== userId) {
      return res.status(403).json({
        error: 'You can only mark your own notifications as read',
        code: 'FORBIDDEN',
      });
    }

    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );

    logger.info('All notifications marked as read', {
      userId,
      modifiedCount: result.modifiedCount,
    });

    res.json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    logger.error('Error marking all notifications as read', {
      error: error.message,
      userId: req.params.userId,
    });
    next(error);
  }
};

/**
 * Get notification preferences for a user
 * GET /api/users/:userId/notification-preferences
 */
exports.getNotificationPreferences = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Validate user can only access their own preferences
    if (req.userId !== userId) {
      return res.status(403).json({
        error: 'You can only access your own notification preferences',
        code: 'FORBIDDEN',
      });
    }

    const user = await User.findById(userId).select('notificationPrefs');
    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json({
      preferences: user.notificationPrefs || {
        streamStart: true,
        gifts: true,
        followers: true,
        messages: true,
      },
    });
  } catch (error) {
    logger.error('Error fetching notification preferences', {
      error: error.message,
      userId: req.params.userId,
    });
    next(error);
  }
};

/**
 * Update notification preferences for a user
 * PUT /api/users/:userId/notification-preferences
 */
exports.updateNotificationPreferences = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { streamStart, gifts, followers, messages } = req.body;

    // Validate user can only update their own preferences
    if (req.userId !== userId) {
      return res.status(403).json({
        error: 'You can only update your own notification preferences',
        code: 'FORBIDDEN',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Update preferences
    user.notificationPrefs = {
      streamStart: streamStart !== undefined ? streamStart : (user.notificationPrefs?.streamStart ?? true),
      gifts: gifts !== undefined ? gifts : (user.notificationPrefs?.gifts ?? true),
      followers: followers !== undefined ? followers : (user.notificationPrefs?.followers ?? true),
      messages: messages !== undefined ? messages : (user.notificationPrefs?.messages ?? true),
    };

    await user.save();

    logger.info('Notification preferences updated', {
      userId,
      preferences: user.notificationPrefs,
    });

    res.json({
      success: true,
      message: 'Notification preferences updated',
      preferences: user.notificationPrefs,
    });
  } catch (error) {
    logger.error('Error updating notification preferences', {
      error: error.message,
      userId: req.params.userId,
    });
    next(error);
  }
};

/**
 * Register FCM token for push notifications
 * POST /api/users/:userId/fcm-token
 */
exports.registerFCMToken = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { fcmToken } = req.body;

    if (!fcmToken) {
      throw new ValidationError('FCM token is required');
    }

    // Validate user can only register their own FCM token
    if (req.userId !== userId) {
      return res.status(403).json({
        error: 'You can only register your own FCM token',
        code: 'FORBIDDEN',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    user.fcmToken = fcmToken;
    await user.save();

    logger.info('FCM token registered', {
      userId,
      fcmToken: fcmToken.substring(0, 10) + '...',
    });

    res.json({
      success: true,
      message: 'FCM token registered successfully',
    });
  } catch (error) {
    logger.error('Error registering FCM token', {
      error: error.message,
      userId: req.params.userId,
    });
    next(error);
  }
};

/**
 * Unregister FCM token
 * DELETE /api/users/:userId/fcm-token
 */
exports.unregisterFCMToken = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Validate user can only unregister their own FCM token
    if (req.userId !== userId) {
      return res.status(403).json({
        error: 'You can only unregister your own FCM token',
        code: 'FORBIDDEN',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    user.fcmToken = undefined;
    await user.save();

    logger.info('FCM token unregistered', { userId });

    res.json({
      success: true,
      message: 'FCM token unregistered successfully',
    });
  } catch (error) {
    logger.error('Error unregistering FCM token', {
      error: error.message,
      userId: req.params.userId,
    });
    next(error);
  }
};

module.exports = exports;