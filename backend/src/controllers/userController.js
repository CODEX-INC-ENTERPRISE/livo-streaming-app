const User = require('../models/User');
const Report = require('../models/Report');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');
const cacheService = require('../services/cacheService');

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

const getProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Use cache service to get user profile with 5 minute TTL
    const publicProfile = await cacheService.getUserProfile(userId, async () => {
      const user = await User.findById(userId).select('-passwordHash');

      if (!user) {
        throw new NotFoundError('User not found');
      }

      if (user.isBlocked) {
        throw new ValidationError('User account is blocked');
      }

      return {
        id: user._id,
        displayName: user.displayName,
        bio: user.bio,
        profilePictureUrl: user.profilePictureUrl,
        isHost: user.isHost,
        followerCount: user.followerIds.length,
        followingCount: user.followingIds.length,
        registeredAt: user.registeredAt,
      };
    });

    res.json({ user: publicProfile });
  } catch (error) {
    logger.error('Get profile error', {
      error: error.message,
      userId: req.params.userId,
    });
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { displayName, bio, profilePictureUrl } = req.body;

    if (req.userId !== userId) {
      return res.status(403).json({
        error: 'You can only update your own profile',
        code: 'FORBIDDEN',
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (displayName !== undefined) {
      if (displayName.length < 3 || displayName.length > 30) {
        throw new ValidationError('Display name must be between 3 and 30 characters');
      }

      if (displayName !== user.displayName) {
        const existingUser = await User.findOne({ displayName });
        if (existingUser) {
          throw new ValidationError('Display name is already taken');
        }
        user.displayName = displayName;
      }
    }

    if (bio !== undefined) {
      if (bio.length > 500) {
        throw new ValidationError('Bio must not exceed 500 characters');
      }
      user.bio = bio;
    }

    if (profilePictureUrl !== undefined) {
      user.profilePictureUrl = profilePictureUrl;
    }

    await user.save();

    // Invalidate user profile cache after update
    await cacheService.invalidateUserProfile(userId);

    res.json({ user });
  } catch (error) {
    logger.error('Update profile error', {
      error: error.message,
      userId: req.params.userId,
    });
    next(error);
  }
};

const followUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { targetUserId } = req.body;

    if (req.userId !== userId) {
      return res.status(403).json({
        error: 'You can only follow users from your own account',
        code: 'FORBIDDEN',
      });
    }

    if (userId === targetUserId) {
      throw new ValidationError('You cannot follow yourself');
    }

    const [user, targetUser] = await Promise.all([
      User.findById(userId),
      User.findById(targetUserId),
    ]);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!targetUser) {
      throw new NotFoundError('Target user not found');
    }

    if (targetUser.isBlocked) {
      throw new ValidationError('Cannot follow a blocked user');
    }

    if (user.followingIds.includes(targetUserId)) {
      throw new ValidationError('You are already following this user');
    }

    user.followingIds.push(targetUserId);
    targetUser.followerIds.push(userId);

    await Promise.all([user.save(), targetUser.save()]);

    await notificationService.sendNotification(targetUserId, {
      type: 'new_follower',
      title: 'New Follower',
      message: `${user.displayName} started following you`,
      data: { userId: userId },
    });

    res.json({ success: true, message: 'Successfully followed user' });
  } catch (error) {
    logger.error('Follow user error', {
      error: error.message,
      userId: req.params.userId,
      targetUserId: req.body.targetUserId,
    });
    next(error);
  }
};

const unfollowUser = async (req, res, next) => {
  try {
    const { userId, targetUserId } = req.params;

    if (req.userId !== userId) {
      return res.status(403).json({
        error: 'You can only unfollow users from your own account',
        code: 'FORBIDDEN',
      });
    }

    const [user, targetUser] = await Promise.all([
      User.findById(userId),
      User.findById(targetUserId),
    ]);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!targetUser) {
      throw new NotFoundError('Target user not found');
    }

    if (!user.followingIds.includes(targetUserId)) {
      throw new ValidationError('You are not following this user');
    }

    user.followingIds = user.followingIds.filter(id => id.toString() !== targetUserId);
    targetUser.followerIds = targetUser.followerIds.filter(id => id.toString() !== userId);

    await Promise.all([user.save(), targetUser.save()]);

    res.json({ success: true, message: 'Successfully unfollowed user' });
  } catch (error) {
    logger.error('Unfollow user error', {
      error: error.message,
      userId: req.params.userId,
      targetUserId: req.params.targetUserId,
    });
    next(error);
  }
};

const getFollowers = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const total = user.followerIds.length;
    const followerIds = user.followerIds.slice(skip, skip + limit);

    const followers = await User.find({ _id: { $in: followerIds } })
      .select('displayName profilePictureUrl bio isHost')
      .lean();

    res.json({
      followers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get followers error', {
      error: error.message,
      userId: req.params.userId,
    });
    next(error);
  }
};

const getFollowing = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const total = user.followingIds.length;
    const followingIds = user.followingIds.slice(skip, skip + limit);

    const following = await User.find({ _id: { $in: followingIds } })
      .select('displayName profilePictureUrl bio isHost')
      .lean();

    res.json({
      following,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get following error', {
      error: error.message,
      userId: req.params.userId,
    });
    next(error);
  }
};

const blockUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { targetUserId } = req.body;

    if (req.userId !== userId) {
      return res.status(403).json({
        error: 'You can only block users from your own account',
        code: 'FORBIDDEN',
      });
    }

    if (userId === targetUserId) {
      throw new ValidationError('You cannot block yourself');
    }

    const [user, targetUser] = await Promise.all([
      User.findById(userId),
      User.findById(targetUserId),
    ]);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!targetUser) {
      throw new NotFoundError('Target user not found');
    }

    if (user.blockedUserIds.includes(targetUserId)) {
      throw new ValidationError('User is already blocked');
    }

    user.blockedUserIds.push(targetUserId);

    user.followingIds = user.followingIds.filter(id => id.toString() !== targetUserId);
    user.followerIds = user.followerIds.filter(id => id.toString() !== targetUserId);
    targetUser.followingIds = targetUser.followingIds.filter(id => id.toString() !== userId);
    targetUser.followerIds = targetUser.followerIds.filter(id => id.toString() !== userId);

    await Promise.all([user.save(), targetUser.save()]);

    res.json({ success: true, message: 'Successfully blocked user' });
  } catch (error) {
    logger.error('Block user error', {
      error: error.message,
      userId: req.params.userId,
      targetUserId: req.body.targetUserId,
    });
    next(error);
  }
};

const reportUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { reportedUserId, reason, description, reportedStreamId } = req.body;

    if (req.userId !== userId) {
      return res.status(403).json({
        error: 'You can only submit reports from your own account',
        code: 'FORBIDDEN',
      });
    }

    if (userId === reportedUserId) {
      throw new ValidationError('You cannot report yourself');
    }

    if (!reason || !description) {
      throw new ValidationError('Reason and description are required');
    }

    const validReasons = [
      'spam',
      'harassment',
      'inappropriate_content',
      'hate_speech',
      'violence',
      'impersonation',
      'other',
    ];

    if (!validReasons.includes(reason)) {
      throw new ValidationError('Invalid report reason');
    }

    const reportedUser = await User.findById(reportedUserId);

    if (!reportedUser) {
      throw new NotFoundError('Reported user not found');
    }

    const report = new Report({
      reporterId: userId,
      reportedUserId,
      reportedStreamId: reportedStreamId || undefined,
      reason,
      description,
    });

    await report.save();

    logger.info('User report created', {
      reportId: report._id,
      reporterId: userId,
      reportedUserId,
      reason,
    });

    res.json({
      reportId: report._id,
      message: 'Report submitted successfully',
    });
  } catch (error) {
    logger.error('Report user error', {
      error: error.message,
      userId: req.params.userId,
      reportedUserId: req.body.reportedUserId,
    });
    next(error);
  }
};

const getFeaturedHosts = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const hosts = await User.find({ isHost: true, isBlocked: false })
      .select('displayName profilePictureUrl bio followerIds')
      .sort({ 'followerIds.length': -1 })
      .limit(limit)
      .lean();

    res.json({
      hosts: hosts.map(h => ({
        id: h._id,
        displayName: h.displayName,
        profilePictureUrl: h.profilePictureUrl,
        bio: h.bio,
        isHost: true,
        followerCount: h.followerIds?.length ?? 0,
        followingCount: 0,
        followerIds: h.followerIds ?? [],
        followingIds: [],
        blockedUserIds: [],
        isBlocked: false,
        registeredAt: new Date().toISOString(),
      })),
    });
  } catch (error) {
    logger.error('Get featured hosts error', { error: error.message });
    next(error);
  }
};

const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) {
      return res.json({ users: [] });
    }

    const users = await User.find({
      isBlocked: false,
      displayName: { $regex: q.trim(), $options: 'i' },
    })
      .select('displayName profilePictureUrl bio isHost followerIds')
      .limit(20)
      .lean();

    res.json({
      users: users.map(u => ({
        id: u._id,
        displayName: u.displayName,
        profilePictureUrl: u.profilePictureUrl,
        bio: u.bio,
        isHost: u.isHost ?? false,
        followerCount: u.followerIds?.length ?? 0,
        followingCount: 0,
        followerIds: u.followerIds ?? [],
        followingIds: [],
        blockedUserIds: [],
        isBlocked: false,
        registeredAt: new Date().toISOString(),
      })),
    });
  } catch (error) {
    logger.error('Search users error', { error: error.message });
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  blockUser,
  reportUser,
  getFeaturedHosts,
  searchUsers,
};
