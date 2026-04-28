const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { getAuthRateLimiter } = require('../middleware/rateLimit');
const { validateRequest } = require('../middleware/validation');
const { sendOTPSchema, registerSchema, loginSchema } = require('../middleware/validationSchemas');
const authRateLimiter = getAuthRateLimiter();
const config = require('../config');

const router = express.Router();

const otpLimiter = require('express-rate-limit')({
  windowMs: config.otp.rateLimitWindow * 1000,
  max: config.otp.rateLimitMax,
  message: {
    error: 'Too many OTP requests from this IP, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/send-otp', otpLimiter, validateRequest(sendOTPSchema), authController.sendOTP);

router.post('/register', authRateLimiter, validateRequest(registerSchema), authController.register);

router.post('/login', authRateLimiter, validateRequest(loginSchema), authController.login);

router.post('/logout', authenticate, authController.logout);

module.exports = router;
