const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

const connectDatabase = async () => {
  try {
    const options = {
      minPoolSize: config.mongodb.minPoolSize,
      maxPoolSize: config.mongodb.maxPoolSize,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(config.mongodb.uri, options);
    
    logger.info('MongoDB connected successfully', {
      minPoolSize: config.mongodb.minPoolSize,
      maxPoolSize: config.mongodb.maxPoolSize,
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err.message, stack: err.stack });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

  } catch (error) {
    logger.error('Failed to connect to MongoDB', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

module.exports = connectDatabase;
