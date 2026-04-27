const logger = require('../utils/logger');
const { sendNotificationToUser, sendNotificationToUsers } = require('../socket/helpers');
const Notification = require('../models/Notification');
const User = require('../models/User');
const admin = require('firebase-admin');

class NotificationService {
  constructor() {
    // Initialize Firebase Admin SDK for FCM
    try {
      if (!admin.apps.length) {
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (serviceAccount) {
          admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccount)),
          });
        } else {
          logger.warn('FIREBASE_SERVICE_ACCOUNT environment variable not set. FCM notifications will be disabled.');
        }
      }
    } catch (error) {
      logger.error('Failed to initialize Firebase Admin SDK', { error: error.message });
    }
  }

  async sendNotification(userId, notification) {
    try {
      // Check user notification preferences
      const user = await User.findById(userId).select('notificationPrefs fcmToken');
      if (!user) {
        logger.warn('User not found for notification', { userId });
        return false;
      }

      // Check if notification type is enabled in user preferences
      const notificationType = notification.type;
      const preferenceKey = this.getPreferenceKey(notificationType);
      if (preferenceKey && user.notificationPrefs && user.notificationPrefs[preferenceKey] === false) {
        logger.info('Notification skipped due to user preference', {
          userId,
          type: notificationType,
          preferenceKey,
        });
        return false;
      }

      const notificationData = {
        userId,
        ...notification,
        createdAt: new Date(),
        isRead: false,
      };

      // Store notification in database
      const savedNotification = await Notification.create(notificationData);

      // Send real-time notification via Socket.io (within 2 seconds requirement)
      try {
        sendNotificationToUser(userId, savedNotification.toObject());
      } catch (socketError) {
        logger.warn('Failed to send real-time notification', {
          error: socketError.message,
          userId,
        });
        // Continue even if socket notification fails
      }

      // Send push notification via FCM if user has FCM token
      if (user.fcmToken && admin.apps.length > 0) {
        try {
          await this.sendFCMNotification(user.fcmToken, notification);
        } catch (fcmError) {
          logger.warn('Failed to send FCM notification', {
            error: fcmError.message,
            userId,
            fcmToken: user.fcmToken ? 'present' : 'missing',
          });
          // Continue even if FCM notification fails
        }
      }

      logger.info('Notification sent', {
        userId,
        type: notification.type,
        title: notification.title,
        notificationId: savedNotification._id,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send notification', {
        error: error.message,
        userId,
        notificationType: notification.type,
      });
      return false;
    }
  }

  async sendBulkNotification(userIds, notification) {
    try {
      const notificationData = {
        ...notification,
        createdAt: new Date(),
        isRead: false,
      };

      // Get users with their notification preferences and FCM tokens
      const users = await User.find({ _id: { $in: userIds } })
        .select('notificationPrefs fcmToken')
        .lean();

      const usersToNotify = [];
      const fcmTokens = [];

      users.forEach(user => {
        // Check notification preference
        const notificationType = notification.type;
        const preferenceKey = this.getPreferenceKey(notificationType);
        if (preferenceKey && user.notificationPrefs && user.notificationPrefs[preferenceKey] === false) {
          logger.debug('Notification skipped for user due to preference', {
            userId: user._id,
            type: notificationType,
          });
          return;
        }

        usersToNotify.push(user._id);
        if (user.fcmToken) {
          fcmTokens.push(user.fcmToken);
        }
      });

      if (usersToNotify.length === 0) {
        logger.info('No users to notify after preference filtering', {
          originalCount: userIds.length,
        });
        return true;
      }

      // Store notifications in database
      const notificationsToSave = usersToNotify.map(userId => ({
        userId,
        ...notificationData,
      }));

      const savedNotifications = await Notification.insertMany(notificationsToSave);

      // Send real-time notifications via Socket.io
      try {
        sendNotificationToUsers(usersToNotify, notificationData);
      } catch (socketError) {
        logger.warn('Failed to send bulk real-time notifications', {
          error: socketError.message,
          userCount: usersToNotify.length,
        });
        // Continue even if socket notification fails
      }

      // Send bulk FCM notifications
      if (fcmTokens.length > 0 && admin.apps.length > 0) {
        try {
          await this.sendBulkFCMNotification(fcmTokens, notification);
        } catch (fcmError) {
          logger.warn('Failed to send bulk FCM notifications', {
            error: fcmError.message,
            tokenCount: fcmTokens.length,
          });
          // Continue even if FCM notification fails
        }
      }

      logger.info('Bulk notification sent', {
        userCount: usersToNotify.length,
        type: notification.type,
        notificationCount: savedNotifications.length,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send bulk notification', {
        error: error.message,
        userCount: userIds.length,
      });
      return false;
    }
  }

  async sendFCMNotification(fcmToken, notification) {
    if (!admin.apps.length) {
      throw new Error('Firebase Admin SDK not initialized');
    }

    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.message,
      },
      data: {
        type: notification.type,
        ...notification.data,
        notificationId: notification._id || notification.id,
        timestamp: new Date().toISOString(),
      },
      android: {
        priority: 'high',
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    logger.debug('FCM notification sent', {
      messageId: response,
      fcmToken: fcmToken.substring(0, 10) + '...',
      type: notification.type,
    });

    return response;
  }

  async sendBulkFCMNotification(fcmTokens, notification) {
    if (!admin.apps.length) {
      throw new Error('Firebase Admin SDK not initialized');
    }

    if (fcmTokens.length === 0) {
      return;
    }

    // Firebase supports up to 500 tokens per multicast message
    const batchSize = 500;
    for (let i = 0; i < fcmTokens.length; i += batchSize) {
      const batchTokens = fcmTokens.slice(i, i + batchSize);
      
      const message = {
        notification: {
          title: notification.title,
          body: notification.message,
        },
        data: {
          type: notification.type,
          ...notification.data,
          timestamp: new Date().toISOString(),
        },
        android: {
          priority: 'high',
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
        tokens: batchTokens,
      };

      try {
        const response = await admin.messaging().sendEachForMulticast(message);
        logger.debug('Bulk FCM notifications sent', {
          successCount: response.successCount,
          failureCount: response.failureCount,
          batchIndex: i / batchSize,
          type: notification.type,
        });

        // Log failures
        if (response.failureCount > 0) {
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              logger.warn('FCM notification failed', {
                error: resp.error?.message,
                tokenIndex: idx + i,
                type: notification.type,
              });
            }
          });
        }
      } catch (error) {
        logger.error('Failed to send batch FCM notifications', {
          error: error.message,
          batchIndex: i / batchSize,
          tokenCount: batchTokens.length,
        });
        // Continue with next batch
      }
    }
  }

  async registerFCMToken(userId, fcmToken) {
    try {
      await User.findByIdAndUpdate(userId, { fcmToken });
      logger.info('FCM token registered', { userId });
      return true;
    } catch (error) {
      logger.error('Failed to register FCM token', {
        error: error.message,
        userId,
      });
      return false;
    }
  }

  async unregisterFCMToken(userId) {
    try {
      await User.findByIdAndUpdate(userId, { $unset: { fcmToken: 1 } });
      logger.info('FCM token unregistered', { userId });
      return true;
    } catch (error) {
      logger.error('Failed to unregister FCM token', {
        error: error.message,
        userId,
      });
      return false;
    }
  }

  getPreferenceKey(notificationType) {
    const preferenceMap = {
      'stream_start': 'streamStart',
      'gift_received': 'gifts',
      'new_follower': 'followers',
      'new_message': 'messages',
    };
    return preferenceMap[notificationType];
  }
}

const notificationService = new NotificationService();

module.exports = notificationService;
