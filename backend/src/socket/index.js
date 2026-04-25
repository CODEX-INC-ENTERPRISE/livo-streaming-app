const { registerStreamHandlers } = require('./streamHandlers');
const { registerVoiceRoomHandlers } = require('./voiceRoomHandlers');
const { registerNotificationHandlers } = require('./notificationHandlers');
const logger = require('../utils/logger');

const registerSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    logger.info('Socket connection established', {
      socketId: socket.id,
      userId: socket.userId,
    });

    // Register all event handlers
    registerStreamHandlers(io, socket);
    registerVoiceRoomHandlers(io, socket);
    registerNotificationHandlers(io, socket);

    // Global error handler
    socket.on('error', (error) => {
      logger.error('Socket error', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message,
      });
    });
  });
};

module.exports = {
  registerSocketHandlers,
};
