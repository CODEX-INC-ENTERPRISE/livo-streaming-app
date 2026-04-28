const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Report = require('../models/Report');
const Stream = require('../models/Stream');
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

const getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status; // 'active', 'blocked', or undefined
    const isHost = req.query.isHost; // 'true', 'false', or undefined

    const query = {};

    // Search functionality
    if (search) {
      query.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
      ];
    }

    // Status filter
    if (status === 'blocked') {
      query.isBlocked = true;
    } else if (status === 'active') {
      query.isBlocked = false;
    }

    // Host filter
    if (isHost === 'true') {
      query.isHost = true;
    } else if (isHost === 'false') {
      query.isHost = false;
    }

    // Get total count
    const total = await User.countDocuments(query);

    // Get users with pagination
    const users = await User.find(query)
      .select('-passwordHash -__v')
      .sort({ registeredAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Format response
    const formattedUsers = users.map(user => ({
      id: user._id,
      displayName: user.displayName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      isBlocked: user.isBlocked,
      isHost: user.isHost,
      isAdmin: user.isAdmin,
      registeredAt: user.registeredAt,
      lastLoginAt: user.lastLoginAt,
      followerCount: user.followerIds?.length || 0,
      followingCount: user.followingIds?.length || 0,
      profilePictureUrl: user.profilePictureUrl,
    }));

    res.json({
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get admin users error', {
      error: error.message,
      query: req.query,
    });
    next(error);
  }
};

const getUserDetails = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-passwordHash -__v');

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Get user statistics
    const [transactionCount, reportCount, streamCount] = await Promise.all([
      Transaction.countDocuments({ userId }),
      Report.countDocuments({ $or: [{ reporterId: userId }, { reportedUserId: userId }] }),
      Stream.countDocuments({ hostId: userId }),
    ]);

    const userDetails = {
      id: user._id,
      displayName: user.displayName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      bio: user.bio,
      profilePictureUrl: user.profilePictureUrl,
      isBlocked: user.isBlocked,
      isHost: user.isHost,
      isAdmin: user.isAdmin,
      registeredAt: user.registeredAt,
      lastLoginAt: user.lastLoginAt,
      socialProvider: user.socialProvider,
      notificationPrefs: user.notificationPrefs,
      statistics: {
        followerCount: user.followerIds?.length || 0,
        followingCount: user.followingIds?.length || 0,
        transactionCount,
        reportCount,
        streamCount,
      },
    };

    res.json({ user: userDetails });
  } catch (error) {
    logger.error('Get admin user details error', {
      error: error.message,
      userId: req.params.userId,
    });
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { displayName, email, phoneNumber, bio, profilePictureUrl, isBlocked, isHost, isAdmin } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Update display name with uniqueness check
    if (displayName !== undefined && displayName !== user.displayName) {
      if (displayName.length < 3 || displayName.length > 30) {
        throw new ValidationError('Display name must be between 3 and 30 characters');
      }

      const existingUser = await User.findOne({ displayName });
      if (existingUser && existingUser._id.toString() !== userId) {
        throw new ValidationError('Display name is already taken');
      }
      user.displayName = displayName;
    }

    // Update email with uniqueness check
    if (email !== undefined && email !== user.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new ValidationError('Invalid email format');
      }

      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== userId) {
        throw new ValidationError('Email is already registered');
      }
      user.email = email.toLowerCase();
    }

    // Update phone number with uniqueness check
    if (phoneNumber !== undefined && phoneNumber !== user.phoneNumber) {
      const existingUser = await User.findOne({ phoneNumber });
      if (existingUser && existingUser._id.toString() !== userId) {
        throw new ValidationError('Phone number is already registered');
      }
      user.phoneNumber = phoneNumber;
    }

    // Update bio
    if (bio !== undefined) {
      if (bio.length > 500) {
        throw new ValidationError('Bio must not exceed 500 characters');
      }
      user.bio = bio;
    }

    // Update profile picture
    if (profilePictureUrl !== undefined) {
      user.profilePictureUrl = profilePictureUrl;
    }

    // Update blocked status
    if (isBlocked !== undefined) {
      user.isBlocked = isBlocked;
    }

    // Update host status
    if (isHost !== undefined) {
      user.isHost = isHost;
    }

    // Update admin status (only super admins should be able to do this)
    if (isAdmin !== undefined) {
      user.isAdmin = isAdmin;
    }

    await user.save();

    // Return updated user without sensitive data
    const updatedUser = user.toObject();
    delete updatedUser.passwordHash;
    delete updatedUser.__v;

    res.json({ user: updatedUser });
  } catch (error) {
    logger.error('Update admin user error', {
      error: error.message,
      userId: req.params.userId,
      updates: req.body,
    });
    next(error);
  }
};

const getUserActivity = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const activityType = req.query.type; // 'all', 'login', 'transaction', 'stream', 'report'

    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Get login history (we'll use lastLoginAt and registeredAt)
    const loginActivity = {
      lastLoginAt: user.lastLoginAt,
      registeredAt: user.registeredAt,
    };

    // Get transactions
    const transactionQuery = { userId };
    const transactionTotal = await Transaction.countDocuments(transactionQuery);
    const transactions = await Transaction.find(transactionQuery)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get reports
    const reportQuery = { $or: [{ reporterId: userId }, { reportedUserId: userId }] };
    const reportTotal = await Report.countDocuments(reportQuery);
    const reports = await Report.find(reportQuery)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get streams
    const streamQuery = { hostId: userId };
    const streamTotal = await Stream.countDocuments(streamQuery);
    const streams = await Stream.find(streamQuery)
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Format activity logs
    const activityLogs = [];

    // Add login activity
    activityLogs.push({
      type: 'login',
      timestamp: user.lastLoginAt,
      description: 'Last login',
      data: {},
    });

    // Add registration activity
    activityLogs.push({
      type: 'registration',
      timestamp: user.registeredAt,
      description: 'Account registered',
      data: {},
    });

    // Add transactions
    transactions.forEach(transaction => {
      activityLogs.push({
        type: 'transaction',
        timestamp: transaction.timestamp,
        description: `${transaction.type}: ${transaction.amount} ${transaction.currency}`,
        data: {
          transactionId: transaction._id,
          type: transaction.type,
          amount: transaction.amount,
          currency: transaction.currency,
          description: transaction.description,
        },
      });
    });

    // Add reports
    reports.forEach(report => {
      const isReporter = report.reporterId.toString() === userId;
      activityLogs.push({
        type: 'report',
        timestamp: report.submittedAt,
        description: isReporter ? 'Submitted report' : 'Was reported',
        data: {
          reportId: report._id,
          isReporter,
          reason: report.reason,
          status: report.status,
        },
      });
    });

    // Add streams
    streams.forEach(stream => {
      activityLogs.push({
        type: 'stream',
        timestamp: stream.startedAt,
        description: `Stream: ${stream.title}`,
        data: {
          streamId: stream._id,
          title: stream.title,
          status: stream.status,
          peakViewerCount: stream.peakViewerCount,
          totalGiftsReceived: stream.totalGiftsReceived,
        },
      });
    });

    // Sort all activities by timestamp descending
    activityLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    const paginatedLogs = activityLogs.slice(skip, skip + limit);

    res.json({
      activityLogs: paginatedLogs,
      pagination: {
        page,
        limit,
        total: activityLogs.length,
        totalPages: Math.ceil(activityLogs.length / limit),
      },
      summary: {
        loginActivity,
        transactionCount: transactionTotal,
        reportCount: reportTotal,
        streamCount: streamTotal,
      },
    });
  } catch (error) {
    logger.error('Get user activity error', {
      error: error.message,
      userId: req.params.userId,
    });
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserDetails,
  updateUser,
  getUserActivity,
};