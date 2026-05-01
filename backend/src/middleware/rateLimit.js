const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedisClient, isRedisAvailable } = require('../config/redis');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Build a rate limiter instance at startup time.
 * Uses RedisStore when Redis is available, falls back to memory store.
 */
const buildLimiter = (windowMs, max, keyGenerator = null) => {
  const options = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyGenerator || ((req) => req.ip),
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        url: req.url,
        method: req.method,
        userId: req.userId || 'anonymous',
      });
      return res.status(429).json({
        error: 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
      });
    },
    skip: (req, res) => false,
  };

  if (isRedisAvailable()) {
    try {
      const redisClient = getRedisClient();
      options.store = new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
      });
    } catch (err) {
      logger.warn('Rate limit falling back to memory store', { error: err.message });
    }
  }

  return rateLimit(options);
};

// Limiters are created once at module load time (after Redis has been connected)
// We use a lazy-init pattern so they're built on first use, which is after startup.
let limiters = {};

const getLimiter = (key, windowMs, max, keyGenerator = null) => {
  if (!limiters[key]) {
    limiters[key] = buildLimiter(windowMs, max, keyGenerator);
  }
  return limiters[key];
};

const getAuthRateLimiter = () =>
  getLimiter('auth', config.rateLimit.auth.windowMs, config.rateLimit.auth.max);

const getApiRateLimiter = () =>
  getLimiter('api', config.rateLimit.api.windowMs, config.rateLimit.api.max);

const getChatRateLimiter = () =>
  getLimiter('chat', config.rateLimit.chat.windowMs, config.rateLimit.chat.max);

const getPaymentRateLimiter = () =>
  getLimiter('payment', config.rateLimit.payment.windowMs, config.rateLimit.payment.max);

const getUserSpecificRateLimiter = (windowMs, max) =>
  getLimiter(`user_${windowMs}_${max}`, windowMs, max, (req) =>
    req.userId ? `user:${req.userId}` : req.ip
  );

const createRateLimiter = (windowMs, max, keyGenerator = null) =>
  buildLimiter(windowMs, max, keyGenerator);

module.exports = {
  getAuthRateLimiter,
  getApiRateLimiter,
  getChatRateLimiter,
  getPaymentRateLimiter,
  getUserSpecificRateLimiter,
  createRateLimiter,
};
