const { getIO } = require('../config/socket');
const { emitStreamEnded, emitModerationAction } = require('./streamHandlers');
const { emitRoleChanged } = require('./voiceRoomHandlers');
const { emitNotification, emitBulkNotification } = require('./notificationHandlers');

/**
 * Helper functions to emit socket events from other parts of the application
 * These functions can be called from controllers, services, etc.
 */

// Stream helpers
const notifyStreamEnded = (streamId, reason) => {
  const io = getIO();
  emitStreamEnded(io, streamId, reason);
};

const notifyModerationAction = (streamId, action, targetUserId, moderatorId) => {
  const io = getIO();
  emitModerationAction(io, streamId, action, targetUserId, moderatorId);
};

// Voice room helpers
const notifyRoleChanged = (roomId, userId, newRole) => {
  const io = getIO();
  emitRoleChanged(io, roomId, userId, newRole);
};

// Notification helpers
const sendNotificationToUser = (userId, notification) => {
  const io = getIO();
  emitNotification(io, userId, notification);
};

const sendNotificationToUsers = (userIds, notification) => {
  const io = getIO();
  emitBulkNotification(io, userIds, notification);
};

module.exports = {
  notifyStreamEnded,
  notifyModerationAction,
  notifyRoleChanged,
  sendNotificationToUser,
  sendNotificationToUsers,
};
