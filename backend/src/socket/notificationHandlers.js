const logger = require('../utils/logger');

const registerNotificationHandlers = (io, socket) => {
  // Join user's personal notification room
  socket.join(`user:${socket.userId}`);

  logger.info('User joined notification room', {
    userId: socket.userId,
    socketId: socket.id,
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    socket.leave(`user:${socket.userId}`);
  });
};

// Helper function to emit notification to a specific user (called from services)
const emitNotification = (io, userId, notification) => {
  const notificationData = {
    notificationId: notification._id || notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    data: notification.data || {},
    timestamp: notification.createdAt || new Date(),
    isRead: notification.isRead || false,
  };

  // Emit to user's personal room (within 2 seconds requirement)
  io.to(`user:${userId}`).emit('notification:new', notificationData);

  logger.info('Notification emitted', {
    userId,
    notificationId: notificationData.notificationId,
    type: notification.type,
  });
};

// Helper function to emit notification to multiple users
const emitBulkNotification = (io, userIds, notification) => {
  userIds.forEach((userId) => {
    emitNotification(io, userId, notification);
  });

  logger.info('Bulk notification emitted', {
    userCount: userIds.length,
    type: notification.type,
  });
};

module.exports = {
  registerNotificationHandlers,
  emitNotification,
  emitBulkNotification,
};
