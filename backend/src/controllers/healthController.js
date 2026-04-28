const mongoose = require('mongoose');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');
const circuitBreakerService = require('../services/circuitBreakerService');
const featureFlags = require('../utils/featureFlags');
const { getResilienceHealthStatus } = require('../utils/resilience');

const checkDatabase = async () => {
  try {
    const state = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    if (state === 1) {
      await mongoose.connection.db.admin().ping();
      return {
        status: 'up',
        state: states[state],
        poolSize: mongoose.connection.client?.s?.options?.maxPoolSize,
      };
    }

    return {
      status: 'down',
      state: states[state],
    };
  } catch (error) {
    logger.error('Database health check failed', { error: error.message });
    return {
      status: 'down',
      error: error.message,
    };
  }
};

const checkRedis = async () => {
  try {
    const redisClient = getRedisClient();
    await redisClient.ping();
    return {
      status: 'up',
      connected: redisClient.isOpen,
    };
  } catch (error) {
    logger.error('Redis health check failed', { error: error.message });
    return {
      status: 'down',
      error: error.message,
    };
  }
};

const healthCheck = async (req, res) => {
  try {
    const [database, redis] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);

    // Get circuit breaker health status
    const circuitBreakers = circuitBreakerService.getHealthStatus();
    
    // Get feature flags health status
    const featureFlagsHealth = featureFlags.getHealthStatus();
    
    // Get resilience health status
    const resilienceHealth = getResilienceHealthStatus();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database,
        redis,
        circuitBreakers,
        featureFlags: featureFlagsHealth,
        resilience: resilienceHealth,
      },
    };

    const isHealthy = database.status === 'up' && 
                     redis.status === 'up' && 
                     circuitBreakers.healthy &&
                     featureFlagsHealth.criticalFeaturesEnabled;
    
    if (!isHealthy) {
      health.status = 'unhealthy';
    }

    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check failed', { error: error.message, stack: error.stack });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
};

module.exports = {
  healthCheck,
};
