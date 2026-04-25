const app = require('./app');
const config = require('./config');
const connectDatabase = require('./config/database');
const { connectRedis } = require('./config/redis');
const { initializeFirebase } = require('./config/firebase');
const logger = require('./utils/logger');

const startServer = async () => {
  try {
    logger.info('Starting server...', {
      environment: config.env,
      port: config.port,
    });

    await connectDatabase();
    logger.info('Database connection established');

    await connectRedis();
    logger.info('Redis connection established');

    try {
      initializeFirebase();
    } catch (error) {
      logger.warn('Firebase initialization skipped', {
        error: error.message,
      });
    }

    const server = app.listen(config.port, () => {
      logger.info('Server started successfully', {
        port: config.port,
        environment: config.env,
        timestamp: new Date().toISOString(),
      });
    });

    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received, starting graceful shutdown`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          const mongoose = require('mongoose');
          await mongoose.connection.close();
          logger.info('MongoDB connection closed');
          
          const { getRedisClient } = require('./config/redis');
          const redisClient = getRedisClient();
          await redisClient.quit();
          logger.info('Redis connection closed');
          
          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', {
            error: error.message,
            stack: error.stack,
          });
          process.exit(1);
        }
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', {
        reason: reason,
        promise: promise,
      });
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

startServer();
