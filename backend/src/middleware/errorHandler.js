const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  const error = {
    message: err.message || 'Internal server error',
    statusCode: err.statusCode || 500,
    code: err.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
  };

  logger.error('Error occurred', {
    error: error.message,
    code: error.code,
    statusCode: error.statusCode,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: req.userId,
    ip: req.ip,
  });

  if (err.isOperational) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      timestamp: error.timestamp,
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: err.details || err.message,
      timestamp: error.timestamp,
    });
  }

  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    return res.status(500).json({
      error: 'Database error',
      code: 'DATABASE_ERROR',
      timestamp: error.timestamp,
    });
  }

  return res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    timestamp: error.timestamp,
  });
};

const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Resource not found',
    code: 'NOT_FOUND',
    path: req.url,
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
};
