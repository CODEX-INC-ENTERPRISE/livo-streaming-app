const metricsService = require('../services/metricsService');
const logger = require('../utils/logger');

/**
 * Middleware to track API requests and response times
 */
const requestTrackingMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const originalEnd = res.end;

  // Extract route path (remove query parameters)
  const route = req.route?.path || req.path;

  // Override res.end to capture response time
  res.end = function (...args) {
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    const method = req.method;
    const status = res.statusCode;

    // Track metrics
    metricsService.trackRequestDuration(method, route, status, duration);
    metricsService.incrementRequestCounter(method, route, status);

    // Log error if status >= 400
    if (status >= 400) {
      metricsService.incrementErrorCounter(method, route, status);
      logger.warn('API request error', {
        method,
        route,
        status,
        duration,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    }

    // Log all API requests
    logger.info('API request completed', {
      method,
      route,
      status,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Call original end method
    return originalEnd.apply(this, args);
  };

  next();
};

/**
 * Middleware to expose /metrics endpoint for Prometheus
 */
const metricsEndpointMiddleware = async (req, res) => {
  if (req.path === '/metrics') {
    try {
      res.set('Content-Type', metricsService.getRegistry().contentType);
      const metrics = await metricsService.getMetrics();
      res.end(metrics);
    } catch (error) {
      logger.error('Failed to get metrics', { error: error.message });
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  } else {
    res.status(404).json({ error: 'Not found' });
  }
};

module.exports = {
  requestTrackingMiddleware,
  metricsEndpointMiddleware,
};