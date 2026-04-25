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
  
  COMMISSION_RATE: Joi.number().min(0).max(1).default(0.15),
  DIAMOND_TO_CREDIT_RATE: Joi.number().min(0).default(0.01),
  MIN_WITHDRAWAL_DIAMONDS: Joi.number().min(0).default(1000),
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
  
  businessRules: {
    commissionRate: envVars.COMMISSION_RATE,
    diamondToCreditRate: envVars.DIAMOND_TO_CREDIT_RATE,
    minWithdrawalDiamonds: envVars.MIN_WITHDRAWAL_DIAMONDS,
  },
};
