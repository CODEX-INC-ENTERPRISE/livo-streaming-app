const logger = require('../utils/logger');

/**
 * Middleware to validate request body against Joi schema
 * @param {Object} schema - Joi validation schema
 * @returns {Function} - Express middleware function
 */
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      logger.warn('Request validation failed', {
        url: req.url,
        method: req.method,
        errors,
      });

      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
      });
    }

    // Replace req.body with validated and sanitized value
    req.body = value;
    next();
  };
};

/**
 * Middleware to validate query parameters against Joi schema
 * @param {Object} schema - Joi validation schema
 * @returns {Function} - Express middleware function
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      logger.warn('Query validation failed', {
        url: req.url,
        method: req.method,
        errors,
      });

      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
      });
    }

    req.query = value;
    next();
  };
};

module.exports = {
  validateRequest,
  validateQuery,
};
