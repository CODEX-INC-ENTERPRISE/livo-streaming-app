const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    this.notifications = [];
  }

  async sendNotification(userId, notification) {
    try {
      logger.info('Notification sent', {
        userId,
        type: notification.type,
        title: notification.title,
      });

      this.notifications.push({
        userId,
        ...notification,
        createdAt: new Date(),
        isRead: false,
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
      const promises = userIds.map(userId => 
        this.sendNotification(userId, notification)
      );
      await Promise.all(promises);
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
