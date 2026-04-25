const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../utils/logger');

// Import all models to ensure schemas are registered
require('../models');

async function createIndexes() {
  try {
    await mongoose.connect(config.database.uri, config.database.options);
    logger.info('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Users collection indexes
    logger.info('Creating indexes for users collection...');
    await db.collection('users').createIndex({ phoneNumber: 1 }, { unique: true, sparse: true });
    await db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true });
    await db.collection('users').createIndex({ displayName: 1 }, { unique: true });
    await db.collection('users').createIndex({ displayName: 1, isBlocked: 1 });
    await db.collection('users').createIndex({ registeredAt: 1 });
    await db.collection('users').createIndex({ isBlocked: 1 });
    await db.collection('users').createIndex({ isHost: 1 });
    await db.collection('users').createIndex({ followerIds: 1 });

    // Hosts collection indexes
    logger.info('Creating indexes for hosts collection...');
    await db.collection('hosts').createIndex({ userId: 1 }, { unique: true });
    await db.collection('hosts').createIndex({ agentId: 1 });
    await db.collection('hosts').createIndex({ isApproved: 1 });

    // Streams collection indexes
    logger.info('Creating indexes for streams collection...');
    await db.collection('streams').createIndex({ hostId: 1 });
    await db.collection('streams').createIndex({ status: 1 });
    await db.collection('streams').createIndex({ startedAt: 1 });
    await db.collection('streams').createIndex({ hostId: 1, startedAt: -1 });
    await db.collection('streams').createIndex({ status: 1, startedAt: -1 });

    // VoiceRooms collection indexes
    logger.info('Creating indexes for voicerooms collection...');
    await db.collection('voicerooms').createIndex({ hostId: 1 });
    await db.collection('voicerooms').createIndex({ status: 1 });
    await db.collection('voicerooms').createIndex({ createdAt: 1 });

    // Wallets collection indexes
    logger.info('Creating indexes for wallets collection...');
    await db.collection('wallets').createIndex({ userId: 1 }, { unique: true });

    // Transactions collection indexes
    logger.info('Creating indexes for transactions collection...');
    await db.collection('transactions').createIndex({ userId: 1 });
    await db.collection('transactions').createIndex({ type: 1 });
    await db.collection('transactions').createIndex({ timestamp: 1 });
    await db.collection('transactions').createIndex({ userId: 1, timestamp: -1 });

    // VirtualGifts collection indexes
    logger.info('Creating indexes for virtualgifts collection...');
    await db.collection('virtualgifts').createIndex({ name: 1 }, { unique: true });
    await db.collection('virtualgifts').createIndex({ coinPrice: 1 });
    await db.collection('virtualgifts').createIndex({ category: 1 });

    // Reports collection indexes
    logger.info('Creating indexes for reports collection...');
    await db.collection('reports').createIndex({ reporterId: 1 });
    await db.collection('reports').createIndex({ reportedUserId: 1 });
    await db.collection('reports').createIndex({ reason: 1 });
    await db.collection('reports').createIndex({ submittedAt: 1 });
    await db.collection('reports').createIndex({ status: 1 });
    await db.collection('reports').createIndex({ status: 1, submittedAt: -1 });

    // Notifications collection indexes
    logger.info('Creating indexes for notifications collection...');
    await db.collection('notifications').createIndex({ userId: 1 });
    await db.collection('notifications').createIndex({ type: 1 });
    await db.collection('notifications').createIndex({ createdAt: 1 });
    await db.collection('notifications').createIndex({ isRead: 1 });
    await db.collection('notifications').createIndex({ userId: 1, isRead: 1, createdAt: -1 });

    // WithdrawalRequests collection indexes
    logger.info('Creating indexes for withdrawalrequests collection...');
    await db.collection('withdrawalrequests').createIndex({ userId: 1 });
    await db.collection('withdrawalrequests').createIndex({ status: 1 });
    await db.collection('withdrawalrequests').createIndex({ requestedAt: 1 });

    // Agents collection indexes
    logger.info('Creating indexes for agents collection...');
    await db.collection('agents').createIndex({ email: 1 }, { unique: true });

    // ChatMessages collection indexes
    logger.info('Creating indexes for chatmessages collection...');
    await db.collection('chatmessages').createIndex({ streamId: 1 });
    await db.collection('chatmessages').createIndex({ voiceRoomId: 1 });
    await db.collection('chatmessages').createIndex({ senderId: 1 });
    await db.collection('chatmessages').createIndex({ timestamp: 1 });

    logger.info('All indexes created successfully');
  } catch (error) {
    logger.error('Error creating indexes:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    logger.info('Database connection closed');
  }
}

// Run if executed directly
if (require.main === module) {
  createIndexes()
    .then(() => {
      console.log('Index initialization completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Index initialization failed:', error);
      process.exit(1);
    });
}

module.exports = createIndexes;
