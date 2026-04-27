const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

// Apply authentication middleware to all notification routes
router.use(authenticate);

/**
 * @route GET /api/notifications/:userId
 * @desc Get notifications for a user with pagination
 * @access Private
 */
router.get('/:userId', notificationController.getNotifications);

/**
 * @route PUT /api/notifications/:notificationId/read
 * @desc Mark a notification as read
 * @access Private
 */
router.put('/:notificationId/read', notificationController.markAsRead);

/**
 * @route PUT /api/notifications/:userId/read-all
 * @desc Mark all notifications as read for a user
 * @access Private
 */
router.put('/:userId/read-all', notificationController.markAllAsRead);

/**
 * @route GET /api/users/:userId/notification-preferences
 * @desc Get notification preferences for a user
 * @access Private
 */
router.get('/users/:userId/notification-preferences', notificationController.getNotificationPreferences);

/**
 * @route PUT /api/users/:userId/notification-preferences
 * @desc Update notification preferences for a user
 * @access Private
 */
router.put('/users/:userId/notification-preferences', notificationController.updateNotificationPreferences);

/**
 * @route POST /api/users/:userId/fcm-token
 * @desc Register FCM token for push notifications
 * @access Private
 */
router.post('/users/:userId/fcm-token', notificationController.registerFCMToken);

/**
 * @route DELETE /api/users/:userId/fcm-token
 * @desc Unregister FCM token
 * @access Private
 */
router.delete('/users/:userId/fcm-token', notificationController.unregisterFCMToken);

module.exports = router;