const logger = require('../utils/logger');
const { sendNotificationToUser, sendNotificationToUsers } = require('../socket/helpers');

class NotificationService {
  constructor() {
    this.notifications = [];
  }

  async sendNotification(userId, notification) {
    try {
      const notificationData = {
        userId,
        ...notification,
        createdAt: new Date(),
        isRead: false,
      };

      // Store notification
      this.notifications.push(notificationData);

      // Send real-time notification via Socket.io (within 2 seconds requirement)
      try {
        sendNotificationToUser(userId, notificationData);
      } catch (socketError) {
        logger.warn('Failed to send real-time notification', {
          error: socketError.message,
          userId,
        });
        // Continue even if socket notification fails
      }

      logger.info('Notification sent', {
        userId,
        type: notification.type,
        title: notification.title,
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

      // Store notifications
      userIds.forEach(userId => {
        this.notifications.push({
          userId,
          ...notificationData,
        });
      });

      // Send real-time notifications via Socket.io
      try {
        sendNotificationToUsers(userIds, notificationData);
      } catch (socketError) {
        logger.warn('Failed to send bulk real-time notifications', {
          error: socketError.message,
          userCount: userIds.length,
        });
        // Continue even if socket notification fails
      }

      logger.info('Bulk notification sent', {
        userCount: userIds.length,
        type: notification.type,
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
}

const notificationService = new NotificationService();

module.exports = notificationService;
