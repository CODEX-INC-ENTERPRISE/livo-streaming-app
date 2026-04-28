const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { validateFile } = require('../middleware/validation');
const { fileUploadMiddleware } = require('../middleware/fileUpload');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

/**
 * @route POST /api/uploads/profile-picture
 * @desc Upload profile picture
 * @access Private
 */
router.post(
  '/profile-picture',
  authenticate,
  upload.single('profilePicture'),
  validateFile({
    maxSize: 5 * 1024 * 1024,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  }),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          code: 'NO_FILE_UPLOADED',
        });
      }

      // Process the uploaded file
      // In a real implementation, you would upload to cloud storage (S3, Cloudinary, etc.)
      const fileMetadata = {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        filename: `${Date.now()}-${req.file.originalname}`,
        url: `https://cdn.example.com/profile-pictures/${Date.now()}-${req.file.originalname}`,
      };

      logger.info('Profile picture uploaded', {
        userId: req.userId,
        filename: fileMetadata.filename,
        size: fileMetadata.size,
      });

      res.status(200).json({
        success: true,
        message: 'Profile picture uploaded successfully',
        file: fileMetadata,
      });
    } catch (error) {
      logger.error('Profile picture upload error', {
        error: error.message,
        userId: req.userId,
      });

      res.status(500).json({
        error: 'Failed to upload profile picture',
        code: 'UPLOAD_FAILED',
      });
    }
  }
);

/**
 * @route POST /api/uploads/gift-animation
 * @desc Upload gift animation (admin only)
 * @access Private, Admin
 */
router.post(
  '/gift-animation',
  authenticate,
  upload.single('animation'),
  validateFile({
    maxSize: 10 * 1024 * 1024, // 10MB for animations
    allowedTypes: ['image/gif', 'video/mp4', 'video/webm', 'application/json'],
    allowedExtensions: ['.gif', '.mp4', '.webm', '.json'],
  }),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          code: 'NO_FILE_UPLOADED',
        });
      }

      // Process the uploaded animation file
      const fileMetadata = {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        filename: `${Date.now()}-${req.file.originalname}`,
        url: `https://cdn.example.com/gift-animations/${Date.now()}-${req.file.originalname}`,
      };

      logger.info('Gift animation uploaded', {
        userId: req.userId,
        filename: fileMetadata.filename,
        size: fileMetadata.size,
        mimetype: fileMetadata.mimetype,
      });

      res.status(200).json({
        success: true,
        message: 'Gift animation uploaded successfully',
        file: fileMetadata,
      });
    } catch (error) {
      logger.error('Gift animation upload error', {
        error: error.message,
        userId: req.userId,
      });

      res.status(500).json({
        error: 'Failed to upload gift animation',
        code: 'UPLOAD_FAILED',
      });
    }
  }
);

/**
 * @route POST /api/uploads/bulk
 * @desc Upload multiple files
 * @access Private
 */
router.post(
  '/bulk',
  authenticate,
  upload.array('files', 5), // Max 5 files
  fileUploadMiddleware({
    maxSize: 5 * 1024 * 1024,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif'],
  }),
  async (req, res) => {
    try {
      if (!req.validatedFiles || req.validatedFiles.length === 0) {
        return res.status(400).json({
          error: 'No files uploaded',
          code: 'NO_FILES_UPLOADED',
        });
      }

      const uploadedFiles = req.validatedFiles.map(file => ({
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        filename: `${Date.now()}-${file.originalname}`,
        url: `https://cdn.example.com/uploads/${Date.now()}-${file.originalname}`,
      }));

      logger.info('Bulk files uploaded', {
        userId: req.userId,
        fileCount: uploadedFiles.length,
        totalSize: uploadedFiles.reduce((sum, file) => sum + file.size, 0),
      });

      res.status(200).json({
        success: true,
        message: `${uploadedFiles.length} file(s) uploaded successfully`,
        files: uploadedFiles,
      });
    } catch (error) {
      logger.error('Bulk upload error', {
        error: error.message,
        userId: req.userId,
      });

      res.status(500).json({
        error: 'Failed to upload files',
        code: 'UPLOAD_FAILED',
      });
    }
  }
);

module.exports = router;