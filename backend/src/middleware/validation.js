const logger = require('../utils/logger');
const Joi = require('joi');

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
const sanitizeHTML = (text) => {
  if (typeof text !== 'string') return text;
  
  // Basic HTML entity encoding
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Validate file upload
 * @param {Object} file - File object from multer or similar
 * @param {Object} options - Validation options
 * @returns {Object} - Validation result
 */
const validateFileUpload = (file, options = {}) => {
  const defaultOptions = {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  };
  
  const config = { ...defaultOptions, ...options };
  
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }
  
  // Check file size
  if (file.size > config.maxSize) {
    return { 
      valid: false, 
      error: `File size exceeds maximum allowed size of ${config.maxSize / (1024 * 1024)}MB` 
    };
  }
  
  // Check MIME type
  if (!config.allowedTypes.includes(file.mimetype)) {
    return { 
      valid: false, 
      error: `File type ${file.mimetype} is not allowed. Allowed types: ${config.allowedTypes.join(', ')}` 
    };
  }
  
  // Check file extension
  const extension = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
  if (!config.allowedExtensions.includes(extension)) {
    return { 
      valid: false, 
      error: `File extension ${extension} is not allowed. Allowed extensions: ${config.allowedExtensions.join(', ')}` 
    };
  }
  
  // Check for malicious content in images (basic check)
  if (file.mimetype.startsWith('image/')) {
    // Check for common image file signatures
    const signatures = {
      'image/jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
      'image/png': Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      'image/gif': Buffer.from([0x47, 0x49, 0x46, 0x38]),
      'image/webp': Buffer.from([0x52, 0x49, 0x46, 0x46]),
    };
    
    const expectedSignature = signatures[file.mimetype];
    if (expectedSignature && file.buffer) {
      const fileSignature = file.buffer.slice(0, expectedSignature.length);
      if (!fileSignature.equals(expectedSignature)) {
        return { 
          valid: false, 
          error: 'File content does not match its declared type' 
        };
      }
    }
  }
  
  return { valid: true, file };
};

/**
 * Middleware to validate request body against Joi schema with HTML sanitization
 * @param {Object} schema - Joi validation schema
 * @param {Object} options - Validation options
 * @returns {Function} - Express middleware function
 */
const validateRequest = (schema, options = {}) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      ...options,
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

    // Sanitize HTML content in string fields
    const sanitizedValue = sanitizeObject(value);
    
    // Replace req.body with validated and sanitized value
    req.body = sanitizedValue;
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

/**
 * Middleware to validate file uploads
 * @param {Object} options - File validation options
 * @returns {Function} - Express middleware function
 */
const validateFile = (options = {}) => {
  return (req, res, next) => {
    const file = req.file || req.files?.[0];
    
    if (!file && options.required !== false) {
      return res.status(400).json({
        error: 'No file uploaded',
        code: 'FILE_REQUIRED',
      });
    }
    
    if (file) {
      const validation = validateFileUpload(file, options);
      
      if (!validation.valid) {
        logger.warn('File upload validation failed', {
          url: req.url,
          method: req.method,
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          error: validation.error,
        });

        return res.status(400).json({
          error: validation.error,
          code: 'FILE_VALIDATION_FAILED',
        });
      }
      
      logger.info('File upload validated', {
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      });
    }
    
    next();
  };
};

/**
 * Recursively sanitize object properties
 * @param {any} obj - Object to sanitize
 * @returns {any} - Sanitized object
 */
const sanitizeObject = (obj) => {
  if (typeof obj === 'string') {
    return sanitizeHTML(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
};

/**
 * Create a custom Joi extension for HTML sanitization
 */
const sanitizeJoiExtension = Joi.extend((joi) => ({
  type: 'string',
  base: joi.string(),
  messages: {
    'string.sanitize': '{{#label}} contains potentially unsafe content',
  },
  rules: {
    sanitize: {
      validate(value, helpers) {
        const sanitized = sanitizeHTML(value);
        if (sanitized !== value) {
          return helpers.error('string.sanitize');
        }
        return value;
      },
    },
  },
}));

module.exports = {
  validateRequest,
  validateQuery,
  validateFile,
  sanitizeHTML,
  validateFileUpload,
  sanitizeJoiExtension,
};
