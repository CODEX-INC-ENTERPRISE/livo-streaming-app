const dotenv = require('dotenv');
const Joi = require('joi');

dotenv.config();

const configSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  
  MONGODB_URI: Joi.string().required().description('MongoDB connection string'),
  MONGODB_MIN_POOL_SIZE: Joi.number().default(10),
  MONGODB_MAX_POOL_SIZE: Joi.number().default(100),
  
  REDIS_HOST: Joi.string().required().description('Redis host'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  
  FIREBASE_PROJECT_ID: Joi.string().optional(),
  FIREBASE_PRIVATE_KEY: Joi.string().optional(),
  FIREBASE_CLIENT_EMAIL: Joi.string().optional(),
  
  AGORA_APP_ID: Joi.string().optional(),
  AGORA_APP_CERTIFICATE: Joi.string().optional(),
  
  JWT_SECRET: Joi.string().required().description('JWT secret key'),
  JWT_EXPIRATION: Joi.string().default('30d'),
  
  EMAIL_HOST: Joi.string().optional(),
  EMAIL_PORT: Joi.number().default(587),
  EMAIL_USER: Joi.string().optional(),
  EMAIL_PASSWORD: Joi.string().optional(),
  EMAIL_FROM: Joi.string().default('noreply@example.com'),
  
  SMS_GATEWAY_URL: Joi.string().optional(),
  SMS_GATEWAY_API_KEY: Joi.string().optional(),
  
  OTP_EXPIRATION_SECONDS: Joi.number().default(300),
  OTP_RATE_LIMIT_WINDOW: Joi.number().default(900),
  OTP_RATE_LIMIT_MAX: Joi.number().default(5),
  
  BCRYPT_ROUNDS: Joi.number().default(12),
  SESSION_TIMEOUT_DAYS: Joi.number().default(30),
  
  COMMISSION_RATE: Joi.number().min(0).max(1).default(0.15),
  DIAMOND_TO_CREDIT_RATE: Joi.number().min(0).default(0.01),
  MIN_WITHDRAWAL_DIAMONDS: Joi.number().min(0).default(1000),
  
  RATE_LIMIT_AUTH_WINDOW_MS: Joi.number().default(15 * 60 * 1000),
  RATE_LIMIT_AUTH_MAX: Joi.number().default(5),
  RATE_LIMIT_API_WINDOW_MS: Joi.number().default(60 * 1000),
  RATE_LIMIT_API_MAX: Joi.number().default(100),
  RATE_LIMIT_CHAT_WINDOW_MS: Joi.number().default(1000),
  RATE_LIMIT_CHAT_MAX: Joi.number().default(5),
  RATE_LIMIT_PAYMENT_WINDOW_MS: Joi.number().default(60 * 60 * 1000),
  RATE_LIMIT_PAYMENT_MAX: Joi.number().default(10),
}).unknown();

const { value: envVars, error } = configSchema.validate(process.env);

if (error) {
  throw new Error(`Configuration validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  
  mongodb: {
    uri: envVars.MONGODB_URI,
    minPoolSize: envVars.MONGODB_MIN_POOL_SIZE,
    maxPoolSize: envVars.MONGODB_MAX_POOL_SIZE,
  },
  
  redis: {
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT,
    password: envVars.REDIS_PASSWORD,
  },
  
  firebase: {
    projectId: envVars.FIREBASE_PROJECT_ID,
    privateKey: envVars.FIREBASE_PRIVATE_KEY,
    clientEmail: envVars.FIREBASE_CLIENT_EMAIL,
  },
  
  agora: {
    appId: envVars.AGORA_APP_ID,
    appCertificate: envVars.AGORA_APP_CERTIFICATE,
  },
  
  jwt: {
    secret: envVars.JWT_SECRET,
    expiration: envVars.JWT_EXPIRATION,
  },
  
  email: {
    host: envVars.EMAIL_HOST,
    port: envVars.EMAIL_PORT,
    user: envVars.EMAIL_USER,
    password: envVars.EMAIL_PASSWORD,
    from: envVars.EMAIL_FROM,
  },
  
  sms: {
    gatewayUrl: envVars.SMS_GATEWAY_URL,
    apiKey: envVars.SMS_GATEWAY_API_KEY,
  },
  
  otp: {
    expirationSeconds: envVars.OTP_EXPIRATION_SECONDS,
    rateLimitWindow: envVars.OTP_RATE_LIMIT_WINDOW,
    rateLimitMax: envVars.OTP_RATE_LIMIT_MAX,
  },
  
  security: {
    bcryptRounds: envVars.BCRYPT_ROUNDS,
    sessionTimeoutDays: envVars.SESSION_TIMEOUT_DAYS,
  },
  
  businessRules: {
    commissionRate: envVars.COMMISSION_RATE,
    diamondToCreditRate: envVars.DIAMOND_TO_CREDIT_RATE,
    minWithdrawalDiamonds: envVars.MIN_WITHDRAWAL_DIAMONDS,
  },
  
  rateLimit: {
    auth: {
      windowMs: envVars.RATE_LIMIT_AUTH_WINDOW_MS,
      max: envVars.RATE_LIMIT_AUTH_MAX,
    },
    api: {
      windowMs: envVars.RATE_LIMIT_API_WINDOW_MS,
      max: envVars.RATE_LIMIT_API_MAX,
    },
    chat: {
      windowMs: envVars.RATE_LIMIT_CHAT_WINDOW_MS,
      max: envVars.RATE_LIMIT_CHAT_MAX,
    },
    payment: {
      windowMs: envVars.RATE_LIMIT_PAYMENT_WINDOW_MS,
      max: envVars.RATE_LIMIT_PAYMENT_MAX,
    },
  },
};
