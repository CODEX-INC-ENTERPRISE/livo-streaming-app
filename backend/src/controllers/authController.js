const User = require('../models/User');
const Wallet = require('../models/Wallet');
const otpService = require('../services/otpService');
const { generateJWT, verifyFirebaseToken } = require('../middleware/auth');
const logger = require('../utils/logger');

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

const sendOTP = async (req, res, next) => {
  try {
    const { phoneNumber, email } = req.body;

    if (!phoneNumber && !email) {
      throw new ValidationError('Either phoneNumber or email is required');
    }

    if (phoneNumber && email) {
      throw new ValidationError('Provide either phoneNumber or email, not both');
    }

    const type = phoneNumber ? 'phone' : 'email';
    const identifier = phoneNumber || email;

    const result = await otpService.sendOTP(type, identifier);

    logger.info('OTP sent', {
      type,
      identifier,
    });

    return res.status(200).json({
      success: true,
      expiresIn: result.expiresIn,
      message: 'OTP sent successfully',
    });
  } catch (error) {
    logger.error('Send OTP error', {
      error: error.message,
      stack: error.stack,
    });

    if (error.message.includes('Too many OTP requests')) {
      return res.status(429).json({
        error: error.message,
        code: 'RATE_LIMIT_EXCEEDED',
      });
    }

    next(error);
  }
};

const register = async (req, res, next) => {
  try {
    const {
      phoneNumber,
      email,
      password,
      displayName,
      otp,
      socialProvider,
      firebaseToken,
    } = req.body;

    if (!displayName) {
      throw new ValidationError('Display name is required');
    }

    let verifiedIdentifier = null;

    if (socialProvider && firebaseToken) {
      const decodedToken = await verifyFirebaseToken(firebaseToken);
      verifiedIdentifier = decodedToken.email || decodedToken.phone_number;
      
      const existingUser = await User.findOne({
        $or: [
          { email: decodedToken.email },
          { phoneNumber: decodedToken.phone_number },
          { socialProviderId: decodedToken.uid },
        ],
      });

      if (existingUser) {
        throw new ValidationError('User already registered with this social account');
      }
    } else if (phoneNumber || email) {
      const identifier = phoneNumber || email;
      
      if (!otp) {
        throw new ValidationError('OTP is required for phone/email registration');
      }

      const otpVerification = await otpService.verifyOTP(identifier, otp);
      
      if (!otpVerification.valid) {
        throw new ValidationError(otpVerification.error);
      }

      verifiedIdentifier = identifier;

      const existingUser = await User.findOne({
        $or: [
          { phoneNumber: phoneNumber },
          { email: email },
        ],
      });

      if (existingUser) {
        throw new ValidationError('User already registered with this phone number or email');
      }

      // Password is optional for OTP-only registration
    } else {
      throw new ValidationError('Registration method not provided');
    }

    const existingDisplayName = await User.findOne({ displayName });
    if (existingDisplayName) {
      throw new ValidationError('Display name already taken');
    }

    const userData = {
      displayName,
      phoneNumber: phoneNumber || null,
      email: email || null,
    };

    if (password) {
      userData.passwordHash = await User.hashPassword(password);
    }

    if (socialProvider && firebaseToken) {
      const decodedToken = await verifyFirebaseToken(firebaseToken);
      userData.socialProvider = socialProvider;
      userData.socialProviderId = decodedToken.uid;
      userData.email = userData.email || decodedToken.email;
      userData.phoneNumber = userData.phoneNumber || decodedToken.phone_number;
    }

    const user = new User(userData);
    await user.save();

    const wallet = new Wallet({
      userId: user._id,
    });
    await wallet.save();

    const token = generateJWT({
      userId: user._id.toString(),
      isHost: user.isHost,
      isAdmin: user.isAdmin,
    });

    logger.info('User registered successfully', {
      userId: user._id,
      method: socialProvider || (phoneNumber ? 'phone' : 'email'),
    });

    return res.status(201).json({
      userId: user._id,
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error('Registration error', {
      error: error.message,
      stack: error.stack,
    });

    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: 'VALIDATION_ERROR',
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        error: 'User with this phone number, email, or display name already exists',
        code: 'DUPLICATE_USER',
      });
    }

    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { phoneNumber, email, password, firebaseToken } = req.body;

    let user = null;

    if (firebaseToken) {
      const decodedToken = await verifyFirebaseToken(firebaseToken);
      
      user = await User.findOne({
        $or: [
          { socialProviderId: decodedToken.uid },
          { email: decodedToken.email },
          { phoneNumber: decodedToken.phone_number },
        ],
      });

      if (!user) {
        throw new ValidationError('User not found. Please register first.');
      }
    } else if ((phoneNumber || email) && req.body.otp) {
      // OTP-based login (passwordless)
      const identifier = phoneNumber || email;
      const otpVerification = await otpService.verifyOTP(identifier, req.body.otp);
      if (!otpVerification.valid) {
        throw new ValidationError(otpVerification.error || 'Invalid OTP');
      }
      user = await User.findOne({
        $or: [{ phoneNumber: phoneNumber }, { email: email }],
      });
      if (!user) {
        throw new ValidationError('User not found. Please register first.');
      }
    } else if (phoneNumber || email) {
      if (!password) {
        throw new ValidationError('Password is required');
      }

      user = await User.findOne({
        $or: [
          { phoneNumber: phoneNumber },
          { email: email },
        ],
      });

      if (!user) {
        throw new ValidationError('Invalid credentials');
      }

      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        throw new ValidationError('Invalid credentials');
      }
    } else {
      throw new ValidationError('Login method not provided');
    }

    if (user.isBlocked) {
      throw new ValidationError('Account is blocked. Please contact support.');
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateJWT({
      userId: user._id.toString(),
      isHost: user.isHost,
      isAdmin: user.isAdmin,
    });

    logger.info('User logged in successfully', {
      userId: user._id,
    });

    return res.status(200).json({
      userId: user._id,
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error('Login error', {
      error: error.message,
      stack: error.stack,
    });

    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: 'AUTH_ERROR',
      });
    }

    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    logger.info('User logged out', {
      userId: req.userId,
    });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout error', {
      error: error.message,
      stack: error.stack,
    });

    next(error);
  }
};

module.exports = {
  sendOTP,
  register,
  login,
  logout,
};
