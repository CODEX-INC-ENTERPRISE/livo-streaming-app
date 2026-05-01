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
        reconnectStrategy: false, // disable auto-reconnect
      },
    };

    if (config.redis.password) {
      clientConfig.password = config.redis.password;
    }

    redisClient = redis.createClient(clientConfig);

    redisClient.on('error', (err) => {
      // suppress errors after initial connection — they're expected when Redis is down
    });

    redisClient.on('ready', () => {
      logger.info('Redis connected successfully', {
        host: config.redis.host,
        port: config.redis.port,
      });
    });

    await redisClient.connect();

    return redisClient;
  } catch (error) {
    logger.warn('Redis unavailable, caching disabled', { error: error.message });
    if (redisClient) {
      redisClient.destroy?.();
      redisClient = null;
    }
    return null;
  }
};

const getRedisClient = () => {
  return redisClient; // may be null if Redis is unavailable
};

const isRedisAvailable = () => redisClient !== null;

module.exports = {
  connectRedis,
  getRedisClient,
  isRedisAvailable,
};
