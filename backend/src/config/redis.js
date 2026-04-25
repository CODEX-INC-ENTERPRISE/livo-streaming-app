const redis = require('redis');
const config = require('./index');
const logger = require('../utils/logger');

let redisClient = null;

const connectRedis = async () => {
  try {
    const clientConfig = {
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
    };

    if (config.redis.password) {
      clientConfig.password = config.redis.password;
    }

    redisClient = redis.createClient(clientConfig);

    redisClient.on('error', (err) => {
      logger.error('Redis connection error', { error: err.message, stack: err.stack });
    });

    redisClient.on('connect', () => {
      logger.info('Redis connecting...');
    });

    redisClient.on('ready', () => {
      logger.info('Redis connected successfully', {
        host: config.redis.host,
        port: config.redis.port,
      });
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });

    redisClient.on('end', () => {
      logger.warn('Redis connection closed');
    });

    await redisClient.connect();

    return redisClient;
  } catch (error) {
    logger.error('Failed to connect to Redis', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

module.exports = {
  connectRedis,
  getRedisClient,
};
