const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedisClient } = require('../config/redis');
const config = require('../config');
const logger = require('../utils/logger');

let rateLimiters = {};

const createRedisStore = () => {
  try {
    const redisClient = getRedisClient();
    
    return new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
    });
  } catch (error) {
    logger.error('Failed to create Redis store for rate limiting', {
      error: error.message,
    });
    return null;
  }
};

const createRateLimiter = (windowMs, max, keyGenerator = null) => {
  return (req, res, next) => {
    try {
      const store = createRedisStore();
      
      if (!store) {
        return next();
      }
      
      const limiter = rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        store,
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
      });
      
      return limiter(req, res, next);
    } catch (error) {
      logger.error('Rate limiting middleware error', {
        error: error.message,
        stack: error.stack,
      });
      return next();
    }
  };
};

const getAuthRateLimiter = () => {
  if (!rateLimiters.auth) {
    rateLimiters.auth = createRateLimiter(
      config.rateLimit.auth.windowMs,
      config.rateLimit.auth.max
    );
  }
  return rateLimiters.auth;
};

const getApiRateLimiter = () => {
  if (!rateLimiters.api) {
    rateLimiters.api = createRateLimiter(
      config.rateLimit.api.windowMs,
      config.rateLimit.api.max
    );
  }
  return rateLimiters.api;
};

const getChatRateLimiter = () => {
  if (!rateLimiters.chat) {
    rateLimiters.chat = createRateLimiter(
      config.rateLimit.chat.windowMs,
      config.rateLimit.chat.max
    );
  }
  return rateLimiters.chat;
};

const getPaymentRateLimiter = () => {
  if (!rateLimiters.payment) {
    rateLimiters.payment = createRateLimiter(
      config.rateLimit.payment.windowMs,
      config.rateLimit.payment.max
    );
  }
  return rateLimiters.payment;
};

const getUserSpecificRateLimiter = (windowMs, max) => {
  const key = `user_${windowMs}_${max}`;
  if (!rateLimiters[key]) {
    rateLimiters[key] = createRateLimiter(windowMs, max, (req) => {
      if (req.userId) {
        return `user:${req.userId}`;
      }
      return req.ip;
    });
  }
  return rateLimiters[key];
};

module.exports = {
  getAuthRateLimiter,
  getApiRateLimiter,
  getChatRateLimiter,
  getPaymentRateLimiter,
  getUserSpecificRateLimiter,
  createRateLimiter,
};