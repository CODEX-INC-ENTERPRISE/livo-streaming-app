const { Resend } = require('resend');
const twilio = require('twilio');
const OTP = require('../models/OTP');
const config = require('../config');
const logger = require('../utils/logger');

class OTPService {
  constructor() {
    // Resend (email)
    this.resend = config.resend.apiKey ? new Resend(config.resend.apiKey) : null;
    if (!this.resend) {
      logger.warn('RESEND_API_KEY not set — email OTP will be logged to console only');
    }

    // Twilio (SMS)
    this.twilioClient =
      config.twilio.accountSid && config.twilio.authToken
        ? twilio(config.twilio.accountSid, config.twilio.authToken)
        : null;
    if (!this.twilioClient) {
      logger.warn('Twilio credentials not set — SMS OTP will be logged to console only');
    }
  }

  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async checkRateLimit(identifier) {
    const windowStart = new Date(Date.now() - config.otp.rateLimitWindow * 1000);
    const count = await OTP.countDocuments({
      identifier,
      createdAt: { $gte: windowStart },
    });
    if (count >= config.otp.rateLimitMax) {
      throw new Error(`Too many OTP requests. Please wait before requesting another.`);
    }
  }

  async storeOTP(identifier, otp) {
    // Remove any existing OTPs for this identifier
    await OTP.deleteMany({ identifier });

    const expiresAt = new Date(Date.now() + config.otp.expirationSeconds * 1000);
    await OTP.create({ identifier, otp, expiresAt });

    logger.info('OTP stored in MongoDB', { identifier, expiresIn: config.otp.expirationSeconds });
  }

  async verifyOTP(identifier, otp) {
    const record = await OTP.findOne({
      identifier,
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      return { valid: false, error: 'OTP expired or not found. Please request a new one.' };
    }

    if (record.otp !== otp) {
      // Increment attempt counter
      await OTP.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
      return { valid: false, error: 'Invalid OTP' };
    }

    // Delete after successful verification (single-use)
    await OTP.deleteOne({ _id: record._id });
    logger.info('OTP verified successfully', { identifier });
    return { valid: true };
  }

  async sendEmailOTP(email, otp) {
    const expiryMinutes = Math.floor(config.otp.expirationSeconds / 60);

    if (!this.resend) {
      // Dev fallback — log to console
      logger.info(`[DEV] Email OTP for ${email}: ${otp}`);
      return { success: true, devMode: true };
    }

    const { error } = await this.resend.emails.send({
      from: config.resend.fromEmail,
      to: email,
      subject: 'Your Livo verification code',
      html: `
      <img src = "C:\Users\ejoym\livo-streaming-app\mobile_app\assets\images\home_logo.png">
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#1a1a1a">Your verification code</h2>
          <p style="color:#555">Use the code below to verify your identity on Livo.</p>
          <div style="background:#f4f4f4;border-radius:8px;padding:24px;text-align:center;margin:24px 0">
            <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#22c55e">${otp}</span>
          </div>
          <p style="color:#888;font-size:13px">This code expires in ${expiryMinutes} minutes. Do not share it with anyone.</p>
        </div>
      `,
    });

    if (error) {
      logger.error('Resend email failed', { error: error.message, email });
      throw new Error('Failed to send email OTP');
    }

    logger.info('Email OTP sent via Resend', { email });
    return { success: true };
  }

  async sendSMSOTP(phoneNumber, otp) {
    const expiryMinutes = Math.floor(config.otp.expirationSeconds / 60);

    if (!this.twilioClient) {
      // Dev fallback — log to console
      logger.info(`[DEV] SMS OTP for ${phoneNumber}: ${otp}`);
      return { success: true, devMode: true };
    }

    await this.twilioClient.messages.create({
      body: `Your Livo code is: ${otp}. Valid for ${expiryMinutes} minutes. Do not share this code.`,
      from: config.twilio.phoneNumber,
      to: phoneNumber,
    });

    logger.info('SMS OTP sent via Twilio', { phoneNumber });
    return { success: true };
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

    return { success: true, expiresIn: config.otp.expirationSeconds };
  }
}

module.exports = new OTPService();
