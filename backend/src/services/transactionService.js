const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const logger = require('../utils/logger');

/**
 * Transaction Service
 * Handles atomic wallet operations with transaction logging
 * Ensures all wallet changes are recorded and immutable
 */
class TransactionService {
  /**
   * Record a coin purchase transaction
   * @param {ObjectId} userId - User ID
   * @param {Number} amount - Amount of coins purchased
   * @param {Object} metadata - Payment metadata (gateway, paymentId)
   * @returns {Promise<Object>} Transaction and updated wallet
   */
  async recordCoinPurchase(userId, amount, metadata = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate amount
      if (amount <= 0) {
        throw new Error('Amount must be positive');
      }

      // Get wallet
      const wallet = await Wallet.findOne({ userId }).session(session);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Update wallet balance
      wallet.coinBalance += amount;
      wallet.updatedAt = new Date();
      await wallet.save({ session });

      // Create transaction record
      const transaction = new Transaction({
        userId,
        type: 'coinPurchase',
        amount,
        currency: 'coins',
        description: `Purchased ${amount} coins`,
        metadata: {
          paymentGateway: metadata.paymentGateway,
          paymentId: metadata.paymentId,
        },
      });
      await transaction.save({ session });

      await session.commitTransaction();
      logger.info('Coin purchase recorded', { userId, amount, transactionId: transaction._id });

      return { transaction, wallet };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to record coin purchase', { userId, amount, error: error.message });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Record a gift sent transaction (deduct coins from sender)
   * @param {ObjectId} senderId - Sender user ID
   * @param {ObjectId} recipientId - Recipient user ID
   * @param {Number} coinAmount - Amount of coins to deduct
   * @param {Object} metadata - Gift metadata (giftId, streamId)
   * @returns {Promise<Object>} Transaction and updated wallet
   */
  async recordGiftSent(senderId, recipientId, coinAmount, metadata = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate amount
      if (coinAmount <= 0) {
        throw new Error('Amount must be positive');
      }

      // Get sender wallet
      const wallet = await Wallet.findOne({ userId: senderId }).session(session);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Check sufficient balance
      if (wallet.coinBalance < coinAmount) {
        throw new Error('Insufficient coin balance');
      }

      // Deduct coins
      wallet.coinBalance -= coinAmount;
      wallet.updatedAt = new Date();
      await wallet.save({ session });

      // Create transaction record
      const transaction = new Transaction({
        userId: senderId,
        type: 'giftSent',
        amount: -coinAmount,
        currency: 'coins',
        description: `Sent gift worth ${coinAmount} coins`,
        metadata: {
          giftId: metadata.giftId,
          streamId: metadata.streamId,
          recipientId,
        },
      });
      await transaction.save({ session });

      await session.commitTransaction();
      logger.info('Gift sent recorded', { senderId, recipientId, coinAmount, transactionId: transaction._id });

      return { transaction, wallet };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to record gift sent', { senderId, recipientId, coinAmount, error: error.message });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Record a gift received transaction (credit diamonds to recipient)
   * @param {ObjectId} recipientId - Recipient user ID
   * @param {ObjectId} senderId - Sender user ID
   * @param {Number} diamondAmount - Amount of diamonds to credit
   * @param {Object} metadata - Gift metadata (giftId, streamId)
   * @returns {Promise<Object>} Transaction and updated wallet
   */
  async recordGiftReceived(recipientId, senderId, diamondAmount, metadata = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate amount
      if (diamondAmount <= 0) {
        throw new Error('Amount must be positive');
      }

      // Get recipient wallet
      const wallet = await Wallet.findOne({ userId: recipientId }).session(session);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Credit diamonds
      wallet.diamondBalance += diamondAmount;
      wallet.updatedAt = new Date();
      await wallet.save({ session });

      // Create transaction record
      const transaction = new Transaction({
        userId: recipientId,
        type: 'giftReceived',
        amount: diamondAmount,
        currency: 'diamonds',
        description: `Received gift worth ${diamondAmount} diamonds`,
        metadata: {
          giftId: metadata.giftId,
          streamId: metadata.streamId,
          recipientId: senderId,
        },
      });
      await transaction.save({ session });

      await session.commitTransaction();
      logger.info('Gift received recorded', { recipientId, senderId, diamondAmount, transactionId: transaction._id });

      return { transaction, wallet };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to record gift received', { recipientId, senderId, diamondAmount, error: error.message });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Record a complete gift transaction (atomic operation for both sender and recipient)
   * @param {ObjectId} senderId - Sender user ID
   * @param {ObjectId} recipientId - Recipient user ID
   * @param {Number} coinAmount - Amount of coins to deduct from sender
   * @param {Number} diamondAmount - Amount of diamonds to credit to recipient
   * @param {Object} metadata - Gift metadata (giftId, streamId)
   * @returns {Promise<Object>} Both transactions and updated wallets
   */
  async recordGiftTransaction(senderId, recipientId, coinAmount, diamondAmount, metadata = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate amounts
      if (coinAmount <= 0 || diamondAmount <= 0) {
        throw new Error('Amounts must be positive');
      }

      // Get both wallets
      const senderWallet = await Wallet.findOne({ userId: senderId }).session(session);
      const recipientWallet = await Wallet.findOne({ userId: recipientId }).session(session);

      if (!senderWallet || !recipientWallet) {
        throw new Error('Wallet not found');
      }

      // Check sufficient balance
      if (senderWallet.coinBalance < coinAmount) {
        throw new Error('Insufficient coin balance');
      }

      // Update sender wallet (deduct coins)
      senderWallet.coinBalance -= coinAmount;
      senderWallet.updatedAt = new Date();
      await senderWallet.save({ session });

      // Update recipient wallet (credit diamonds)
      recipientWallet.diamondBalance += diamondAmount;
      recipientWallet.updatedAt = new Date();
      await recipientWallet.save({ session });

      // Create sender transaction record
      const senderTransaction = new Transaction({
        userId: senderId,
        type: 'giftSent',
        amount: -coinAmount,
        currency: 'coins',
        description: `Sent gift worth ${coinAmount} coins`,
        metadata: {
          giftId: metadata.giftId,
          streamId: metadata.streamId,
          recipientId,
        },
      });
      await senderTransaction.save({ session });

      // Create recipient transaction record
      const recipientTransaction = new Transaction({
        userId: recipientId,
        type: 'giftReceived',
        amount: diamondAmount,
        currency: 'diamonds',
        description: `Received gift worth ${diamondAmount} diamonds`,
        metadata: {
          giftId: metadata.giftId,
          streamId: metadata.streamId,
          recipientId: senderId,
        },
      });
      await recipientTransaction.save({ session });

      await session.commitTransaction();
      logger.info('Gift transaction recorded', {
        senderId,
        recipientId,
        coinAmount,
        diamondAmount,
        senderTransactionId: senderTransaction._id,
        recipientTransactionId: recipientTransaction._id,
      });

      return {
        senderTransaction,
        recipientTransaction,
        senderWallet,
        recipientWallet,
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to record gift transaction', {
        senderId,
        recipientId,
        coinAmount,
        diamondAmount,
        error: error.message,
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Record a diamond withdrawal transaction
   * @param {ObjectId} userId - User ID
   * @param {Number} diamondAmount - Amount of diamonds to deduct
   * @param {Number} creditAmount - Real credit amount
   * @param {String} currency - Currency code (USD, SAR, etc.)
   * @returns {Promise<Object>} Transaction and updated wallet
   */
  async recordWithdrawal(userId, diamondAmount, creditAmount, currency = 'USD') {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate amounts
      if (diamondAmount <= 0 || creditAmount <= 0) {
        throw new Error('Amounts must be positive');
      }

      // Get wallet
      const wallet = await Wallet.findOne({ userId }).session(session);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Check sufficient balance
      if (wallet.diamondBalance < diamondAmount) {
        throw new Error('Insufficient diamond balance');
      }

      // Deduct diamonds
      wallet.diamondBalance -= diamondAmount;
      wallet.updatedAt = new Date();
      await wallet.save({ session });

      // Create transaction record
      const transaction = new Transaction({
        userId,
        type: 'withdrawal',
        amount: -diamondAmount,
        currency: 'diamonds',
        description: `Withdrew ${diamondAmount} diamonds for ${creditAmount} ${currency}`,
        metadata: {},
      });
      await transaction.save({ session });

      await session.commitTransaction();
      logger.info('Withdrawal recorded', { userId, diamondAmount, creditAmount, transactionId: transaction._id });

      return { transaction, wallet };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to record withdrawal', { userId, diamondAmount, creditAmount, error: error.message });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Record a commission transaction
   * @param {ObjectId} agentId - Agent user ID
   * @param {ObjectId} hostId - Host user ID
   * @param {Number} diamondAmount - Amount of diamonds to credit
   * @param {Object} metadata - Commission metadata
   * @returns {Promise<Object>} Transaction and updated wallet
   */
  async recordCommission(agentId, hostId, diamondAmount, metadata = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate amount
      if (diamondAmount <= 0) {
        throw new Error('Amount must be positive');
      }

      // Get agent wallet
      const wallet = await Wallet.findOne({ userId: agentId }).session(session);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Credit diamonds
      wallet.diamondBalance += diamondAmount;
      wallet.updatedAt = new Date();
      await wallet.save({ session });

      // Create transaction record
      const transaction = new Transaction({
        userId: agentId,
        type: 'commission',
        amount: diamondAmount,
        currency: 'diamonds',
        description: `Commission from host earnings: ${diamondAmount} diamonds`,
        metadata: {
          recipientId: hostId,
          ...metadata,
        },
      });
      await transaction.save({ session });

      await session.commitTransaction();
      logger.info('Commission recorded', { agentId, hostId, diamondAmount, transactionId: transaction._id });

      return { transaction, wallet };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to record commission', { agentId, hostId, diamondAmount, error: error.message });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get transaction history for a user
   * @param {ObjectId} userId - User ID
   * @param {Object} options - Query options (page, limit, type)
   * @returns {Promise<Object>} Transactions and pagination info
   */
  async getTransactionHistory(userId, options = {}) {
    try {
      const { page = 1, limit = 20, type } = options;
      const skip = (page - 1) * limit;

      const query = { userId };
      if (type) {
        query.type = type;
      }

      const [transactions, total] = await Promise.all([
        Transaction.find(query)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Transaction.countDocuments(query),
      ]);

      return {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to get transaction history', { userId, error: error.message });
      throw error;
    }
  }
}

module.exports = new TransactionService();
