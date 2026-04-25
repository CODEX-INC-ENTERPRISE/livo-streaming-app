const { getRedisClient } = require('../config/redis');
const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../utils/logger');

class OTPService {
  constructor() {
    this.redisClient = null;
    this.emailTransporter = null;
    this.initializeEmailTransporter();
  }

  initializeEmailTransporter() {
    if (config.email.host && config.email.user && config.email.password) {
      this.emailTransporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.port === 465,
        auth: {
          user: config.email.user,
          pass: config.email.password,
        },
      });
      logger.info('Email transporter initialized');
    } else {
      logger.warn('Email configuration not complete, email OTP will be disabled');
    }
  }

  getRedis() {
    if (!this.redisClient) {
      this.redisClient = getRedisClient();
    }
    return this.redisClient;
  }

  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async checkRateLimit(identifier) {
    const redis = this.getRedis();
    const rateLimitKey = `otp:ratelimit:${identifier}`;
    
    const count = await redis.get(rateLimitKey);
    
    if (count && parseInt(count) >= config.otp.rateLimitMax) {
      const ttl = await redis.ttl(rateLimitKey);
      throw new Error(`Too many OTP requests. Please try again in ${Math.ceil(ttl / 60)} minutes`);
    }
    
    const newCount = count ? parseInt(count) + 1 : 1;
    await redis.setEx(rateLimitKey, config.otp.rateLimitWindow, newCount.toString());
    
    return true;
  }

  async storeOTP(identifier, otp) {
    const redis = this.getRedis();
    const otpKey = `otp:${identifier}`;
    
    await redis.setEx(otpKey, config.otp.expirationSeconds, otp);
    
    logger.info('OTP stored', {
      identifier,
      expiresIn: config.otp.expirationSeconds,
    });
  }

  async verifyOTP(identifier, otp) {
    const redis = this.getRedis();
    const otpKey = `otp:${identifier}`;
    
    const storedOTP = await redis.get(otpKey);
    
    if (!storedOTP) {
      return { valid: false, error: 'OTP expired or not found' };
    }
    
    if (storedOTP !== otp) {
      return { valid: false, error: 'Invalid OTP' };
    }
    
    await redis.del(otpKey);
    
    logger.info('OTP verified successfully', { identifier });
    
    return { valid: true };
  }

  async sendEmailOTP(email, otp) {
    if (!this.emailTransporter) {
      logger.error('Email transporter not configured');
      throw new Error('Email service not available');
    }

    try {
      const mailOptions = {
        from: config.email.from,
        to: email,
        subject: 'Your OTP Code',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Your OTP Code</h2>
            <p>Your one-time password is:</p>
            <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
            <p>This code will expire in ${config.otp.expirationSeconds / 60} minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
        `,
      };

      await this.emailTransporter.sendMail(mailOptions);
      
      logger.info('Email OTP sent', { email });
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to send email OTP', {
        error: error.message,
        email,
      });
      throw new Error('Failed to send email OTP');
    }
  }

  async sendSMSOTP(phoneNumber, otp) {
    if (!config.sms.gatewayUrl || !config.sms.apiKey) {
      logger.warn('SMS gateway not configured, logging OTP instead');
      logger.info('SMS OTP (dev mode)', { phoneNumber, otp });
      return { success: true, devMode: true };
    }

    try {
      const response = await fetch(config.sms.gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.sms.apiKey}`,
        },
        body: JSON.stringify({
          to: phoneNumber,
          message: `Your OTP code is: ${otp}. Valid for ${config.otp.expirationSeconds / 60} minutes.`,
        }),
      });

      if (!response.ok) {
        throw new Error(`SMS gateway returned ${response.status}`);
      }

      logger.info('SMS OTP sent', { phoneNumber });
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to send SMS OTP', {
        error: error.message,
        phoneNumber,
      });
      throw new Error('Failed to send SMS OTP');
    }
  }

  async sendOTP(type, identifier) {
    await this.checkRateLimit(identifier);
    
    const otp = this.generateOTP();
    
    await this.storeOTP(identifier, otp);
    
    if (type === 'email') {
      await this.sendEmailOTP(identifier, otp);
    } else if (type === 'phone') {
      await this.sendSMSOTP(identifier, otp);
    } else {
      throw new Error('Invalid OTP type');
    }
    
    return {
      success: true,
      expiresIn: config.otp.expirationSeconds,
    };
  }
}

module.exports = new OTPService();
