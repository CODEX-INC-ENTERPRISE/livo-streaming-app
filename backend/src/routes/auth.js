const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

const otpLimiter = rateLimit({
  windowMs: config.otp.rateLimitWindow * 1000,
  max: config.otp.rateLimitMax,
  message: {
    error: 'Too many OTP requests from this IP, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many authentication attempts from this IP, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/send-otp', otpLimiter, authController.sendOTP);

router.post('/register', authLimiter, authController.register);

router.post('/login', authLimiter, authController.login);

router.post('/logout', authenticate, authController.logout);

module.exports = router;
