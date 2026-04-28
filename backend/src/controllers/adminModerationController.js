const ModerationKeyword = require('../models/ModerationKeyword');
const ModerationLog = require('../models/ModerationLog');
const User = require('../models/User');
const logger = require('../utils/logger');

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

/**
 * Get all moderation keywords with filtering
 * GET /api/admin/moderation/keywords
 */
const getModerationKeywords = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      action, 
      severity, 
      isActive,
      search 
    } = req.query;
    
    const skip = (page - 1) * limit;
    
    // Build query
    const query = {};
    
    if (category) {
      query.category = category;
    }
    
    if (action) {
      query.action = action;
    }
    
    if (severity) {
      query.severity = severity;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    // Search functionality
    if (search) {
      query.keyword = { $regex: search, $options: 'i' };
    }
    
    // Get total count
    const total = await ModerationKeyword.countDocuments(query);
    
    // Get keywords with pagination
    const keywords = await ModerationKeyword.find(query)
      .populate('createdBy', 'displayName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Format response
    const formattedKeywords = keywords.map(keyword => ({
      id: keyword._id,
      keyword: keyword.keyword,
      action: keyword.action,
      severity: keyword.severity,
      category: keyword.category,
      isActive: keyword.isActive,
      createdBy: keyword.createdBy ? {
        id: keyword.createdBy._id,
        displayName: keyword.createdBy.displayName
      } : null,
      createdAt: keyword.createdAt,
      updatedAt: keyword.updatedAt,
    }));
    
    res.json({
      keywords: formattedKeywords,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get moderation keywords error', {
      error: error.message,
      query: req.query,
    });
    next(error);
  }
};

/**
 * Create a new moderation keyword
 * POST /api/admin/moderation/keywords
 */
const createModerationKeyword = async (req, res, next) => {
  try {
    const { keyword, action, severity, category } = req.body;
    const createdBy = req.userId;
    
    // Validate required fields
    if (!keyword || !keyword.trim()) {
      throw new ValidationError('Keyword is required');
    }
    
    if (!action) {
      throw new ValidationError('Action is required');
    }
    
    if (!['block', 'warn', 'flag'].includes(action)) {
      throw new ValidationError('Action must be one of: block, warn, flag');
    }
    
    // Check if keyword already exists
    const existingKeyword = await ModerationKeyword.findOne({
      keyword: keyword.toLowerCase().trim(),
    });
    
    if (existingKeyword) {
      throw new ValidationError('Keyword already exists');
    }
    
    // Create new keyword
    const moderationKeyword = new ModerationKeyword({
      keyword: keyword.toLowerCase().trim(),
      action,
      severity: severity || 'medium',
      category: category || 'other',
      isActive: true,
      createdBy,
    });
    
    await moderationKeyword.save();
    
    // Populate createdBy field
    await moderationKeyword.populate('createdBy', 'displayName');
    
    res.status(201).json({
      message: 'Moderation keyword created successfully',
      keyword: {
        id: moderationKeyword._id,
        keyword: moderationKeyword.keyword,
        action: moderationKeyword.action,
        severity: moderationKeyword.severity,
        category: moderationKeyword.category,
        isActive: moderationKeyword.isActive,
        createdBy: moderationKeyword.createdBy ? {
          id: moderationKeyword.createdBy._id,
          displayName: moderationKeyword.createdBy.displayName
        } : null,
        createdAt: moderationKeyword.createdAt,
        updatedAt: moderationKeyword.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Create moderation keyword error', {
      error: error.message,
      body: req.body,
      userId: req.userId,
    });
    next(error);
  }
};

/**
 * Update a moderation keyword
 * PUT /api/admin/moderation/keywords/:keywordId
 */
const updateModerationKeyword = async (req, res, next) => {
  try {
    const { keywordId } = req.params;
    const { action, severity, category, isActive } = req.body;
    
    // Find keyword
    const moderationKeyword = await ModerationKeyword.findById(keywordId);
    
    if (!moderationKeyword) {
      throw new NotFoundError('Moderation keyword not found');
    }
    
    // Update fields
    if (action !== undefined) {
      if (!['block', 'warn', 'flag'].includes(action)) {
        throw new ValidationError('Action must be one of: block, warn, flag');
      }
      moderationKeyword.action = action;
    }
    
    if (severity !== undefined) {
      if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
        throw new ValidationError('Severity must be one of: low, medium, high, critical');
      }
      moderationKeyword.severity = severity;
    }
    
    if (category !== undefined) {
      moderationKeyword.category = category;
    }
    
    if (isActive !== undefined) {
      moderationKeyword.isActive = isActive;
    }
    
    moderationKeyword.updatedAt = new Date();
    await moderationKeyword.save();
    
    // Populate createdBy field
    await moderationKeyword.populate('createdBy', 'displayName');
    
    res.json({
      message: 'Moderation keyword updated successfully',
      keyword: {
        id: moderationKeyword._id,
        keyword: moderationKeyword.keyword,
        action: moderationKeyword.action,
        severity: moderationKeyword.severity,
        category: moderationKeyword.category,
        isActive: moderationKeyword.isActive,
        createdBy: moderationKeyword.createdBy ? {
          id: moderationKeyword.createdBy._id,
          displayName: moderationKeyword.createdBy.displayName
        } : null,
        createdAt: moderationKeyword.createdAt,
        updatedAt: moderationKeyword.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Update moderation keyword error', {
      error: error.message,
      keywordId: req.params.keywordId,
      body: req.body,
      userId: req.userId,
    });
    next(error);
  }
};

/**
 * Delete a moderation keyword
 * DELETE /api/admin/moderation/keywords/:keywordId
 */
const deleteModerationKeyword = async (req, res, next) => {
  try {
    const { keywordId } = req.params;
    
    // Find and delete keyword
    const moderationKeyword = await ModerationKeyword.findByIdAndDelete(keywordId);
    
    if (!moderationKeyword) {
      throw new NotFoundError('Moderation keyword not found');
    }
    
    res.json({
      message: 'Moderation keyword deleted successfully',
      keyword: {
        id: moderationKeyword._id,
        keyword: moderationKeyword.keyword,
      },
    });
  } catch (error) {
    logger.error('Delete moderation keyword error', {
      error: error.message,
      keywordId: req.params.keywordId,
      userId: req.userId,
    });
    next(error);
  }
};

/**
 * Get moderation logs with filtering
 * GET /api/admin/moderation/logs
 */
const getModerationLogs = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      userId, 
      streamId, 
      voiceRoomId,
      violationType,
      actionTaken,
      automated,
      severity,
      startDate,
      endDate
    } = req.query;
    
    const skip = (page - 1) * limit;
    
    // Build query
    const query = {};
    
    if (userId) {
      query.userId = userId;
    }
    
    if (streamId) {
      query.streamId = streamId;
    }
    
    if (voiceRoomId) {
      query.voiceRoomId = voiceRoomId;
    }
    
    if (violationType) {
      query.violationType = violationType;
    }
    
    if (actionTaken) {
      query.actionTaken = actionTaken;
    }
    
    if (automated !== undefined) {
      query.automated = automated === 'true';
    }
    
    if (severity) {
      query.severity = severity;
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }
    
    // Get total count
    const total = await ModerationLog.countDocuments(query);
    
    // Get logs with pagination
    const logs = await ModerationLog.find(query)
      .populate('userId', 'displayName')
      .populate('streamId', 'title')
      .populate('voiceRoomId', 'name')
      .populate('moderatorId', 'displayName')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Format response
    const formattedLogs = logs.map(log => ({
      id: log._id,
      userId: log.userId ? {
        id: log.userId._id,
        displayName: log.userId.displayName
      } : null,
      streamId: log.streamId ? {
        id: log.streamId._id,
        title: log.streamId.title
      } : null,
      voiceRoomId: log.voiceRoomId ? {
        id: log.voiceRoomId._id,
        name: log.voiceRoomId.name
      } : null,
      violationType: log.violationType,
      matchedKeyword: log.matchedKeyword,
      originalContent: log.originalContent,
      actionTaken: log.actionTaken,
      severity: log.severity,
      automated: log.automated,
      moderatorId: log.moderatorId ? {
        id: log.moderatorId._id,
        displayName: log.moderatorId.displayName
      } : null,
      notes: log.notes,
      timestamp: log.timestamp,
      createdAt: log.createdAt,
    }));
    
    // Get statistics
    const stats = await ModerationLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          automatedCount: { $sum: { $cond: [{ $eq: ['$automated', true] }, 1, 0] } },
          manualCount: { $sum: { $cond: [{ $eq: ['$automated', false] }, 1, 0] } },
          uniqueUsers: { $addToSet: '$userId' },
        }
      },
      {
        $project: {
          totalLogs: 1,
          automatedCount: 1,
          manualCount: 1,
          uniqueUserCount: { $size: '$uniqueUsers' },
        }
      }
    ]);
    
    // Get breakdown by violation type
    const violationBreakdown = await ModerationLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$violationType',
          count: { $sum: 1 },
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Get breakdown by action taken
    const actionBreakdown = await ModerationLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$actionTaken',
          count: { $sum: 1 },
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      logs: formattedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
      statistics: stats[0] || {
        totalLogs: 0,
        automatedCount: 0,
        manualCount: 0,
        uniqueUserCount: 0,
      },
      breakdown: {
        byViolationType: violationBreakdown,
        byActionTaken: actionBreakdown,
      },
    });
  } catch (error) {
    logger.error('Get moderation logs error', {
      error: error.message,
      query: req.query,
    });
    next(error);
  }
};

/**
 * Check if a message contains filtered keywords
 * This is a utility function to be used in chat middleware
 */
const checkMessageForKeywords = async (message) => {
  try {
    if (!message || typeof message !== 'string') {
      return { hasViolation: false };
    }
    
    const lowercaseMessage = message.toLowerCase();
    
    // Get all active keywords
    const keywords = await ModerationKeyword.find({ isActive: true }).lean();
    
    // Check for keyword matches
    const matchedKeywords = [];
    
    for (const keyword of keywords) {
      // Simple substring matching for now
      // In production, you might want more sophisticated matching
      if (lowercaseMessage.includes(keyword.keyword)) {
        matchedKeywords.push({
          keyword: keyword.keyword,
          action: keyword.action,
          severity: keyword.severity,
          category: keyword.category,
        });
        
        // If action is 'block', we can stop checking
        if (keyword.action === 'block') {
          break;
        }
      }
    }
    
    if (matchedKeywords.length === 0) {
      return { hasViolation: false };
    }
    
    // Find the most severe violation
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const mostSevereViolation = matchedKeywords.reduce((mostSevere, current) => {
      if (!mostSevere || severityOrder[current.severity] > severityOrder[mostSevere.severity]) {
        return current;
      }
      return mostSevere;
    }, null);
    
    return {
      hasViolation: true,
      matchedKeywords,
      mostSevereViolation,
    };
  } catch (error) {
    logger.error('Check message for keywords error', {
      error: error.message,
      message: message.substring(0, 100), // Log first 100 chars
    });
    return { hasViolation: false, error: 'Failed to check message' };
  }
};

/**
 * Log a moderation violation
 * This is a utility function to be used in chat middleware
 */
const logModerationViolation = async (data) => {
  try {
    const {
      userId,
      streamId,
      voiceRoomId,
      messageId,
      violationType,
      matchedKeyword,
      originalContent,
      actionTaken,
      severity,
      automated = true,
      moderatorId,
      notes,
    } = data;
    
    const moderationLog = new ModerationLog({
      userId,
      streamId,
      voiceRoomId,
      messageId,
      violationType,
      matchedKeyword,
      originalContent,
      actionTaken,
      severity,
      automated,
      moderatorId,
      notes,
    });
    
    await moderationLog.save();
    
    logger.info('Moderation violation logged', {
      userId,
      streamId,
      violationType,
      actionTaken,
      severity,
      automated,
    });
    
    return moderationLog;
  } catch (error) {
    logger.error('Log moderation violation error', {
      error: error.message,
      data: {
        userId: data.userId,
        violationType: data.violationType,
        actionTaken: data.actionTaken,
      },
    });
    return null;
  }
};

module.exports = {
  getModerationKeywords,
  createModerationKeyword,
  updateModerationKeyword,
  deleteModerationKeyword,
  getModerationLogs,
  checkMessageForKeywords,
  logModerationViolation,
  ValidationError,
  NotFoundError,
};