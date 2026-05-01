const { Server } = require('socket.io');
const { verifyJWT } = require('../middleware/auth');
const { registerSocketHandlers } = require('../socket');
const config = require('./index');
const logger = require('../utils/logger');

let io = null;

const initializeSocket = async (server) => {
  try {
    io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Redis adapter for horizontal scaling (optional)
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { createClient } = require('redis');

      const pubClient = createClient({
        socket: {
          host: config.redis.host,
          port: config.redis.port,
          reconnectStrategy: false,
        },
        password: config.redis.password || undefined,
      });

      const subClient = pubClient.duplicate();

      pubClient.on('error', () => {});
      subClient.on('error', () => {});

      await Promise.all([pubClient.connect(), subClient.connect()]);

      io.adapter(createAdapter(pubClient, subClient));

      logger.info('Socket.io Redis adapter configured', {
        host: config.redis.host,
        port: config.redis.port,
      });
    } catch (redisError) {
      logger.warn('Socket.io Redis adapter unavailable, using in-memory adapter');
    }

    // Authentication middleware
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = verifyJWT(token);
        socket.userId = decoded.userId;
        socket.user = decoded;

        logger.info('Socket authenticated', {
          socketId: socket.id,
          userId: socket.userId,
        });

        next();
      } catch (error) {
        logger.error('Socket authentication failed', {
          error: error.message,
          socketId: socket.id,
        });
        next(new Error('Authentication failed'));
      }
    });

    // Register all socket event handlers
    registerSocketHandlers(io);

    // Heartbeat mechanism
    io.on('connection', (socket) => {
      socket.on('ping', () => {
        socket.emit('pong');
      });

      socket.on('disconnect', (reason) => {
        logger.info('Client disconnected', {
          socketId: socket.id,
          userId: socket.userId,
          reason,
        });
      });
    });

    logger.info('Socket.io server initialized successfully');

    return io;
  } catch (error) {
    logger.error('Failed to initialize Socket.io', {
      error: error.message,
      stack: error.stack,
    });
    // Don't throw — server should still run without Socket.io
    return null;
  }
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initializeSocket() first.');
  }
  return io;
};

module.exports = {
  initializeSocket,
  getIO,
};
