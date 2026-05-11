const User = require('../models/User');
const { generateJWT } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * POST /api/admin/auth/login
 * Admin-specific login — requires email + password and isAdmin flag on the user.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required.',
        code: 'VALIDATION_ERROR',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password.',
        code: 'AUTH_ERROR',
      });
    }

    if (!user.isAdmin) {
      return res.status(403).json({
        error: 'Access denied. Admin privileges required.',
        code: 'AUTHORIZATION_ERROR',
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        error: 'This account has been blocked. Please contact support.',
        code: 'ACCOUNT_BLOCKED',
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid email or password.',
        code: 'AUTH_ERROR',
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateJWT({
      userId: user._id.toString(),
      isHost: user.isHost,
      isAdmin: user.isAdmin,
    });

    logger.info('Admin logged in', { userId: user._id, email: user.email });

    return res.status(200).json({
      token,
      admin: {
        id: user._id,
        name: user.displayName,
        email: user.email,
      },
    });
  } catch (error) {
    logger.error('Admin login error', { error: error.message, stack: error.stack });
    next(error);
  }
};

/**
 * POST /api/admin/auth/logout
 * Invalidates the admin session (stateless JWT — client discards token).
 */
const logout = async (req, res) => {
  logger.info('Admin logged out', { userId: req.userId });
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

module.exports = { login, logout };
