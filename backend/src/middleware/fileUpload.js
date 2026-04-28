const { validateFileUpload } = require('./validation');
const logger = require('../utils/logger');

/**
 * Middleware to handle file uploads with validation
 * @param {Object} options - File upload options
 * @returns {Function} - Express middleware function
 */
const fileUploadMiddleware = (options = {}) => {
  return async (req, res, next) => {
    try {
      // Check if there's a file in the request
      if (!req.files || Object.keys(req.files).length === 0) {
        if (options.required !== false) {
          return res.status(400).json({
            error: 'No files were uploaded',
            code: 'NO_FILE_UPLOADED',
          });
        }
        return next();
      }

      const fileField = options.fieldName || 'file';
      const file = req.files[fileField];

      if (!file) {
        if (options.required !== false) {
          return res.status(400).json({
            error: `No file uploaded in field: ${fileField}`,
            code: 'FILE_FIELD_MISSING',
          });
        }
        return next();
      }

      // Handle single file or array of files
      const files = Array.isArray(file) ? file : [file];
      const validatedFiles = [];

      for (const file of files) {
        const validation = validateFileUpload(file, options);
        
        if (!validation.valid) {
          logger.warn('File upload validation failed', {
            filename: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            error: validation.error,
          });

          return res.status(400).json({
            error: validation.error,
            code: 'FILE_VALIDATION_FAILED',
            filename: file.originalname,
          });
        }

        validatedFiles.push(validation.file);
      }

      // Store validated files in request
      req.validatedFiles = validatedFiles;
      
      // For backward compatibility, also store single file
      if (!Array.isArray(file) && validatedFiles.length === 1) {
        req.file = validatedFiles[0];
      }

      logger.info('File upload validated', {
        count: validatedFiles.length,
        filenames: validatedFiles.map(f => f.originalname),
        mimetypes: validatedFiles.map(f => f.mimetype),
        sizes: validatedFiles.map(f => f.size),
      });

      next();
    } catch (error) {
      logger.error('File upload middleware error', {
        error: error.message,
        stack: error.stack,
      });

      return res.status(500).json({
        error: 'File upload processing failed',
        code: 'FILE_UPLOAD_ERROR',
      });
    }
  };
};

/**
 * Process uploaded file and save to storage
 * @param {Object} file - Validated file object
 * @param {string} destinationPath - Destination path
 * @returns {Promise<Object>} - File metadata
 */
const processUploadedFile = async (file, destinationPath) => {
  try {
    // In a real implementation, this would save to cloud storage (S3, Cloudinary, etc.)
    // For now, we'll just return the file metadata
    
    const fileMetadata = {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      destination: destinationPath,
      filename: `${Date.now()}-${file.originalname}`,
      path: `${destinationPath}/${Date.now()}-${file.originalname}`,
      buffer: file.buffer,
    };

    logger.info('File processed for upload', {
      filename: fileMetadata.filename,
      destination: fileMetadata.destination,
      size: fileMetadata.size,
    });

    return fileMetadata;
  } catch (error) {
    logger.error('File processing error', {
      error: error.message,
      filename: file.originalname,
    });
    throw error;
  }
};

/**
 * Generate secure filename
 * @param {string} originalname - Original filename
 * @returns {string} - Secure filename
 */
const generateSecureFilename = (originalname) => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = originalname.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
  const basename = originalname.replace(extension, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  
  return `${timestamp}-${randomString}-${basename}${extension}`;
};

/**
 * Validate image dimensions
 * @param {Buffer} buffer - Image buffer
 * @param {Object} options - Dimension options
 * @returns {Promise<Object>} - Validation result
 */
const validateImageDimensions = async (buffer, options = {}) => {
  // This is a placeholder implementation
  // In a real implementation, you would use a library like sharp or jimp
  // to check image dimensions
  
  const defaultOptions = {
    minWidth: 50,
    maxWidth: 5000,
    minHeight: 50,
    maxHeight: 5000,
    maxAspectRatio: 5,
  };
  
  const config = { ...defaultOptions, ...options };
  
  // For now, we'll assume the image passes dimension validation
  // In production, implement actual dimension checking
  
  return {
    valid: true,
    dimensions: { width: 0, height: 0 }, // Placeholder
  };
};

module.exports = {
  fileUploadMiddleware,
  processUploadedFile,
  generateSecureFilename,
  validateImageDimensions,
};