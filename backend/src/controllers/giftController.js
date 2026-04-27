const VirtualGift = require('../models/VirtualGift');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Stream = require('../models/Stream');
const User = require('../models/User');
const Host = require('../models/Host');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

/**
 * Create a new virtual gift (Admin only)
 * POST /api/admin/gifts
 */
exports.createGift = async (req, res, next) => {
  try {
    const { name, coinPrice, diamondValue, animationAssetUrl, thumbnailUrl, category } = req.body;

    // Validate required fields
    if (!name || !coinPrice || !diamondValue || !animationAssetUrl || !thumbnailUrl || !category) {
      return res.status(400).json({
        error: 'All fields are required: name, coinPrice, diamondValue, animationAssetUrl, thumbnailUrl, category',
      });
    }

    // Validate category
    const validCategories = ['basic', 'premium', 'luxury', 'special'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      });
    }

    // Validate numeric values
    if (coinPrice < 1 || diamondValue < 1) {
      return res.status(400).json({
        error: 'coinPrice and diamondValue must be at least 1',
      });
    }

    // Check for duplicate name
    const existingGift = await VirtualGift.findOne({ name });
    if (existingGift) {
      return res.status(400).json({
        error: 'A gift with this name already exists',
      });
    }

    // Create gift
    const gift = new VirtualGift({
      name,
      coinPrice,
      diamondValue,
      animationAssetUrl,
      thumbnailUrl,
      category,
      isActive: true,
    });

    await gift.save();

    logger.info('Virtual gift created', {
      giftId: gift._id,
      name: gift.name,
      coinPrice: gift.coinPrice,
    });

    res.status(201).json({
      success: true,
      gift,
    });
  } catch (error) {
    logger.error('Error creating gift', { error: error.message });
    next(error);
  }
};

/**
 * Get all available gifts
 * GET /api/gifts
 */
exports.getGifts = async (req, res, next) => {
  try {
    const { category, isActive = 'true' } = req.query;

    // Build query
    const query = {};
    
    if (category) {
      query.category = category;
    }

    // Only show active gifts by default
    if (isActive === 'true') {
      query.isActive = true;
    }

    const gifts = await VirtualGift.find(query)
      .sort({ coinPrice: 1, name: 1 })
      .lean();

    // Group by category for easier frontend consumption
    const giftsByCategory = gifts.reduce((acc, gift) => {
      if (!acc[gift.category]) {
        acc[gift.category] = [];
      }
      acc[gift.category].push(gift);
      return acc;
    }, {});

    res.json({
      gifts,
      giftsByCategory,
      total: gifts.length,
    });
  } catch (error) {
    logger.error('Error fetching gifts', { error: error.message });
    next(error);
  }
};

/**
 * Send a gift to a host during a stream
 * POST /api/streams/:streamId/gift
 */
exports.sendGift = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { streamId } = req.params;
    const { giftId } = req.body;
    const senderId = req.userId;

    // Validate inputs
    if (!giftId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'giftId is required' });
    }

    // Find stream
    const stream = await Stream.findById(streamId).session(session);
    if (!stream) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Stream not found' });
    }

    if (stream.status !== 'active') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Stream is not active' });
    }

    const hostId = stream.hostId;

    // Prevent sending gifts to yourself
    if (senderId === hostId.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Cannot send gifts to yourself' });
    }

    // Find gift
    const gift = await VirtualGift.findById(giftId).session(session);
    if (!gift) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Gift not found' });
    }

    if (!gift.isActive) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'This gift is no longer available' });
    }

    // Get sender's wallet
    const senderWallet = await Wallet.findOne({ userId: senderId }).session(session);
    if (!senderWallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Sender wallet not found' });
    }

    // Validate sufficient coins
    if (senderWallet.coinBalance < gift.coinPrice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(402).json({
        error: 'Insufficient coins',
        required: gift.coinPrice,
        available: senderWallet.coinBalance,
      });
    }

    // Get host's wallet
    let hostWallet = await Wallet.findOne({ userId: hostId }).session(session);
    if (!hostWallet) {
      // Create wallet if it doesn't exist
      hostWallet = new Wallet({ userId: hostId });
      await hostWallet.save({ session });
    }

    // Deduct coins from sender atomically
    senderWallet.coinBalance -= gift.coinPrice;
    senderWallet.updatedAt = new Date();
    await senderWallet.save({ session });

    // Credit diamonds to host atomically
    hostWallet.diamondBalance += gift.diamondValue;
    hostWallet.updatedAt = new Date();
    await hostWallet.save({ session });

    // Update stream statistics
    stream.totalGiftsReceived += 1;
    await stream.save({ session });

    // Update host statistics
    const host = await Host.findOne({ userId: hostId }).session(session);
    if (host) {
      host.statistics.totalGiftsReceived += 1;
      host.statistics.totalDiamondsEarned += gift.diamondValue;
      await host.save({ session });
    }

    // Create transaction record for sender
    const senderTransaction = new Transaction({
      userId: senderId,
      type: 'giftSent',
      amount: gift.coinPrice,
      currency: 'coins',
      description: `Sent ${gift.name} to host`,
      metadata: {
        giftId: gift._id,
        streamId: stream._id,
        recipientId: hostId,
      },
    });
    await senderTransaction.save({ session });

    // Create transaction record for host
    const hostTransaction = new Transaction({
      userId: hostId,
      type: 'giftReceived',
      amount: gift.diamondValue,
      currency: 'diamonds',
      description: `Received ${gift.name} from viewer`,
      metadata: {
        giftId: gift._id,
        streamId: stream._id,
        recipientId: senderId,
      },
    });
    await hostTransaction.save({ session });

    // Calculate and credit commission to agent if host has an agent
    const agentController = require('./agentController');
    const commissionData = await agentController.calculateCommission(hostId, gift.diamondValue, session);
    
    if (commissionData) {
      // Credit commission to agent within the same transaction
      await agentController.creditCommissionToAgent(commissionData, session);
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    // Get sender info for WebSocket broadcast
    const sender = await User.findById(senderId).select('displayName profilePictureUrl');

    // Broadcast gift animation via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to(`stream:${streamId}`).emit('stream:gift-sent', {
        streamId,
        senderId,
        senderName: sender?.displayName,
        senderAvatar: sender?.profilePictureUrl,
        hostId,
        giftId: gift._id,
        giftName: gift.name,
        giftAnimationUrl: gift.animationAssetUrl,
        giftThumbnailUrl: gift.thumbnailUrl,
        coinPrice: gift.coinPrice,
        diamondValue: gift.diamondValue,
        timestamp: new Date(),
      });
    }

    // Send notification to host about gift received
    try {
      const notification = {
        type: 'gift_received',
        title: 'Gift Received!',
        message: `${sender?.displayName} sent you ${gift.name}`,
        data: {
          streamId,
          senderId,
          giftId: gift._id,
          giftName: gift.name,
          diamondValue: gift.diamondValue,
        },
      };
      
      await notificationService.sendNotification(hostId, notification);
      
      logger.info('Gift notification sent to host', {
        streamId,
        senderId,
        hostId,
        giftId: gift._id,
      });
    } catch (notificationError) {
      logger.warn('Failed to send gift notification', {
        error: notificationError.message,
        streamId,
        hostId,
      });
      // Continue even if notification fails
    }

    logger.info('Gift sent successfully', {
      streamId,
      senderId,
      hostId,
      giftId: gift._id,
      giftName: gift.name,
      coinPrice: gift.coinPrice,
      diamondValue: gift.diamondValue,
    });

    res.json({
      success: true,
      gift: {
        id: gift._id,
        name: gift.name,
        coinPrice: gift.coinPrice,
        diamondValue: gift.diamondValue,
      },
      newBalance: senderWallet.coinBalance,
      transactionId: senderTransaction._id,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error('Error sending gift', { error: error.message, stack: error.stack });
    next(error);
  }
};

module.exports = {
  createGift,
  getGifts,
  sendGift,
};
