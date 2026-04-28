const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const User = require('../models/User');
const Host = require('../models/Host');
const logger = require('../utils/logger');

/**
 * Admin Financial Controller
 * Handles admin financial tracking endpoints for revenue, diamonds, withdrawals, and transactions
 */

/**
 * Calculate total revenue from coin purchases with daily/weekly/monthly breakdowns
 * GET /api/admin/analytics/revenue
 */
exports.getRevenueAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, period = 'monthly' } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }
    
    // Build query for coin purchase transactions
    const query = {
      type: 'coinPurchase',
      currency: 'coins'
    };
    
    if (Object.keys(dateFilter).length > 0) {
      query.timestamp = dateFilter;
    }
    
    // Get all coin purchase transactions
    const transactions = await Transaction.find(query)
      .sort({ timestamp: 1 })
      .lean();
    
    // Calculate total revenue
    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    // Group by period
    const breakdown = {};
    transactions.forEach(tx => {
      const date = new Date(tx.timestamp);
      let key;
      
      switch (period) {
        case 'daily':
          key = date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'weekly':
          // Get week number
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
        default:
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
          break;
      }
      
      if (!breakdown[key]) {
        breakdown[key] = {
          period: key,
          revenue: 0,
          transactionCount: 0
        };
      }
      
      breakdown[key].revenue += tx.amount;
      breakdown[key].transactionCount++;
    });
    
    // Convert breakdown object to array
    const breakdownArray = Object.values(breakdown).sort((a, b) => a.period.localeCompare(b.period));
    
    res.json({
      success: true,
      data: {
        totalRevenue,
        period,
        breakdown: breakdownArray,
        transactionCount: transactions.length,
        dateRange: {
          start: startDate || 'all',
          end: endDate || 'all'
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get revenue analytics', { error: error.message });
    next(error);
  }
};

/**
 * Calculate total diamonds earned by hosts
 * GET /api/admin/analytics/diamonds
 */
exports.getDiamondsAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy = 'host' } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }
    
    // Build query for diamond transactions (giftReceived, commission)
    const query = {
      type: { $in: ['giftReceived', 'commission'] },
      currency: 'diamonds',
      amount: { $gt: 0 }
    };
    
    if (Object.keys(dateFilter).length > 0) {
      query.timestamp = dateFilter;
    }
    
    // Get all diamond transactions
    const transactions = await Transaction.find(query)
      .populate('userId', 'displayName')
      .sort({ timestamp: 1 })
      .lean();
    
    // Calculate total diamonds earned
    const totalDiamonds = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    // Group by host or by transaction type
    let breakdown;
    if (groupBy === 'host') {
      // Group by user (host)
      const hostMap = {};
      transactions.forEach(tx => {
        const userId = tx.userId._id.toString();
        const displayName = tx.userId.displayName;
        
        if (!hostMap[userId]) {
          hostMap[userId] = {
            userId,
            displayName,
            totalDiamonds: 0,
            transactionCount: 0,
            breakdown: {
              giftReceived: 0,
              commission: 0
            }
          };
        }
        
        hostMap[userId].totalDiamonds += tx.amount;
        hostMap[userId].transactionCount++;
        hostMap[userId].breakdown[tx.type] += tx.amount;
      });
      
      breakdown = Object.values(hostMap).sort((a, b) => b.totalDiamonds - a.totalDiamonds);
    } else {
      // Group by transaction type
      const typeMap = {};
      transactions.forEach(tx => {
        if (!typeMap[tx.type]) {
          typeMap[tx.type] = {
            type: tx.type,
            totalDiamonds: 0,
            transactionCount: 0
          };
        }
        
        typeMap[tx.type].totalDiamonds += tx.amount;
        typeMap[tx.type].transactionCount++;
      });
      
      breakdown = Object.values(typeMap);
    }
    
    // Get top hosts (users with isHost flag)
    const topHosts = await User.find({ isHost: true })
      .select('displayName registeredAt')
      .limit(10)
      .lean();
    
    res.json({
      success: true,
      data: {
        totalDiamonds,
        transactionCount: transactions.length,
        breakdown,
        topHosts: topHosts.map(host => ({
          displayName: host.displayName,
          registeredAt: host.registeredAt
        })),
        dateRange: {
          start: startDate || 'all',
          end: endDate || 'all'
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get diamonds analytics', { error: error.message });
    next(error);
  }
};

/**
 * Get withdrawal requests with status filter
 * GET /api/admin/withdrawals
 */
exports.getWithdrawals = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, userId } = req.query;
    const skip = (page - 1) * limit;
    
    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }
    if (userId) {
      query.userId = userId;
    }
    
    // Get withdrawals with user details
    const [withdrawals, total] = await Promise.all([
      WithdrawalRequest.find(query)
        .populate('userId', 'displayName phoneNumber email')
        .populate('processedBy', 'displayName')
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WithdrawalRequest.countDocuments(query)
    ]);
    
    // Calculate totals by status
    const statusCounts = await WithdrawalRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalDiamonds: { $sum: '$diamondAmount' },
          totalCredit: { $sum: '$creditAmount' }
        }
      }
    ]);
    
    const statusSummary = {};
    statusCounts.forEach(stat => {
      statusSummary[stat._id] = {
        count: stat.count,
        totalDiamonds: stat.totalDiamonds,
        totalCredit: stat.totalCredit
      };
    });
    
    res.json({
      success: true,
      data: {
        withdrawals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        summary: {
          totalWithdrawals: total,
          statusSummary
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get withdrawals', { error: error.message });
    next(error);
  }
};

/**
 * Approve or reject a withdrawal request
 * PUT /api/admin/withdrawals/:withdrawalId
 */
exports.updateWithdrawalStatus = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { withdrawalId } = req.params;
    const { status, notes, paymentMethod, paymentDetails } = req.body;
    const adminId = req.userId;
    
    // Validate status
    if (!['approved', 'rejected', 'processing', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        message: 'Status must be one of: approved, rejected, processing, completed'
      });
    }
    
    // Find withdrawal request
    const withdrawal = await WithdrawalRequest.findById(withdrawalId).session(session);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Withdrawal request not found'
      });
    }
    
    // Check if withdrawal can be updated
    if (withdrawal.status === 'completed' || withdrawal.status === 'rejected') {
      return res.status(400).json({
        success: false,
        error: 'Invalid operation',
        message: 'Cannot update a completed or rejected withdrawal'
      });
    }
    
    // Update withdrawal
    withdrawal.status = status;
    withdrawal.processedAt = new Date();
    withdrawal.processedBy = adminId;
    
    if (notes) {
      withdrawal.notes = notes;
    }
    
    if (paymentMethod) {
      withdrawal.paymentMethod = paymentMethod;
    }
    
    if (paymentDetails) {
      withdrawal.paymentDetails = paymentDetails;
    }
    
    await withdrawal.save({ session });
    
    // If rejected, refund diamonds to user's wallet
    if (status === 'rejected') {
      const Wallet = require('../models/Wallet');
      const wallet = await Wallet.findOne({ userId: withdrawal.userId }).session(session);
      
      if (wallet) {
        wallet.diamondBalance += withdrawal.diamondAmount;
        wallet.updatedAt = new Date();
        await wallet.save({ session });
        
        // Create refund transaction
        const Transaction = require('../models/Transaction');
        const refundTransaction = new Transaction({
          userId: withdrawal.userId,
          type: 'giftReceived', // Using giftReceived type for refund
          amount: withdrawal.diamondAmount,
          currency: 'diamonds',
          description: `Refund for rejected withdrawal request ${withdrawalId}`,
          metadata: {
            withdrawalId: withdrawal._id,
            reason: 'withdrawal_rejected'
          }
        });
        await refundTransaction.save({ session });
      }
    }
    
    await session.commitTransaction();
    
    logger.info('Withdrawal status updated', {
      withdrawalId,
      status,
      adminId,
      userId: withdrawal.userId
    });
    
    // Get updated withdrawal with user details
    const updatedWithdrawal = await WithdrawalRequest.findById(withdrawalId)
      .populate('userId', 'displayName phoneNumber email')
      .populate('processedBy', 'displayName')
      .lean();
    
    res.json({
      success: true,
      data: {
        withdrawal: updatedWithdrawal,
        message: `Withdrawal ${status} successfully`
      }
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Failed to update withdrawal status', { withdrawalId: req.params.withdrawalId, error: error.message });
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Get transactions with filters
 * GET /api/admin/transactions
 */
exports.getTransactions = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      userId,
      type,
      currency,
      startDate,
      endDate,
      minAmount,
      maxAmount
    } = req.query;
    
    const skip = (page - 1) * limit;
    
    // Build query
    const query = {};
    
    if (userId) {
      query.userId = userId;
    }
    
    if (type) {
      query.type = type;
    }
    
    if (currency) {
      query.currency = currency;
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }
    
    // Amount range filter
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) {
        query.amount.$gte = parseFloat(minAmount);
      }
      if (maxAmount) {
        query.amount.$lte = parseFloat(maxAmount);
      }
    }
    
    // Get transactions with user details
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate('userId', 'displayName isHost')
        .populate('metadata.recipientId', 'displayName')
        .populate('metadata.giftId', 'name')
        .populate('metadata.streamId', 'title')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(query)
    ]);
    
    // Calculate summary statistics
    const summary = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' },
          minAmount: { $min: '$amount' },
          maxAmount: { $max: '$amount' },
          transactionCount: { $sum: 1 }
        }
      }
    ]);
    
    // Get breakdown by type
    const typeBreakdown = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Get breakdown by currency
    const currencyBreakdown = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$currency',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        summary: summary[0] || {
          totalAmount: 0,
          avgAmount: 0,
          minAmount: 0,
          maxAmount: 0,
          transactionCount: 0
        },
        breakdown: {
          byType: typeBreakdown,
          byCurrency: currencyBreakdown
        },
        filters: {
          userId: userId || 'all',
          type: type || 'all',
          currency: currency || 'all',
          dateRange: {
            start: startDate || 'all',
            end: endDate || 'all'
          },
          amountRange: {
            min: minAmount || 'all',
            max: maxAmount || 'all'
          }
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get transactions', { error: error.message });
    next(error);
  }
};


/**
 * Get user analytics - total users and growth trends
 * GET /api/admin/analytics/users
 */
exports.getUserAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, period = 'monthly' } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }
    
    // Build query
    const query = {};
    if (Object.keys(dateFilter).length > 0) {
      query.registeredAt = dateFilter;
    }
    
    // Get all users for the date range
    const users = await User.find(query)
      .select('registeredAt isHost isBlocked')
      .sort({ registeredAt: 1 })
      .lean();
    
    // Calculate total users
    const totalUsers = users.length;
    
    // Calculate active users (not blocked)
    const activeUsers = users.filter(user => !user.isBlocked).length;
    
    // Calculate host count
    const hostCount = users.filter(user => user.isHost).length;
    
    // Group by period for growth trends
    const growthTrends = {};
    users.forEach(user => {
      const date = new Date(user.registeredAt);
      let key;
      
      switch (period) {
        case 'daily':
          key = date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'weekly':
          // Get week number
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
        default:
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
          break;
      }
      
      if (!growthTrends[key]) {
        growthTrends[key] = {
          period: key,
          newUsers: 0,
          newHosts: 0,
          blockedUsers: 0
        };
      }
      
      growthTrends[key].newUsers++;
      if (user.isHost) {
        growthTrends[key].newHosts++;
      }
      if (user.isBlocked) {
        growthTrends[key].blockedUsers++;
      }
    });
    
    // Convert growth trends object to array
    const growthTrendsArray = Object.values(growthTrends).sort((a, b) => a.period.localeCompare(b.period));
    
    // Calculate cumulative growth
    let cumulativeUsers = 0;
    growthTrendsArray.forEach(period => {
      cumulativeUsers += period.newUsers;
      period.cumulativeUsers = cumulativeUsers;
    });
    
    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        hostCount,
        blockedUsers: totalUsers - activeUsers,
        period,
        growthTrends: growthTrendsArray,
        dateRange: {
          start: startDate || 'all',
          end: endDate || 'all'
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get user analytics', { error: error.message });
    next(error);
  }
};

/**
 * Get stream analytics - active stream count and historical data
 * GET /api/admin/analytics/streams
 */
exports.getStreamAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, period = 'monthly' } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }
    
    // Build query for streams
    const query = {};
    if (Object.keys(dateFilter).length > 0) {
      query.startedAt = dateFilter;
    }
    
    // Get all streams for the date range
    const streams = await Stream.find(query)
      .select('startedAt endedAt status peakViewerCount totalGiftsReceived hostId')
      .populate('hostId', 'displayName')
      .sort({ startedAt: 1 })
      .lean();
    
    // Calculate current active streams
    const activeStreams = streams.filter(stream => stream.status === 'active').length;
    
    // Calculate total streams
    const totalStreams = streams.length;
    
    // Calculate average stream duration
    const endedStreams = streams.filter(stream => stream.endedAt);
    const totalDuration = endedStreams.reduce((sum, stream) => {
      const duration = (new Date(stream.endedAt) - new Date(stream.startedAt)) / (1000 * 60); // minutes
      return sum + duration;
    }, 0);
    const avgDuration = endedStreams.length > 0 ? totalDuration / endedStreams.length : 0;
    
    // Calculate total viewers across all streams
    const totalViewers = streams.reduce((sum, stream) => sum + (stream.peakViewerCount || 0), 0);
    
    // Calculate total gifts received
    const totalGifts = streams.reduce((sum, stream) => sum + (stream.totalGiftsReceived || 0), 0);
    
    // Group by period for historical data
    const historicalData = {};
    streams.forEach(stream => {
      const date = new Date(stream.startedAt);
      let key;
      
      switch (period) {
        case 'daily':
          key = date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'weekly':
          // Get week number
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
        default:
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
          break;
      }
      
      if (!historicalData[key]) {
        historicalData[key] = {
          period: key,
          streamCount: 0,
          activeStreams: 0,
          totalViewers: 0,
          totalGifts: 0,
          avgViewers: 0,
          streamDurations: []
        };
      }
      
      historicalData[key].streamCount++;
      if (stream.status === 'active') {
        historicalData[key].activeStreams++;
      }
      historicalData[key].totalViewers += stream.peakViewerCount || 0;
      historicalData[key].totalGifts += stream.totalGiftsReceived || 0;
      
      // Calculate duration for ended streams
      if (stream.endedAt) {
        const duration = (new Date(stream.endedAt) - new Date(stream.startedAt)) / (1000 * 60); // minutes
        historicalData[key].streamDurations.push(duration);
      }
    });
    
    // Calculate averages for each period
    Object.keys(historicalData).forEach(key => {
      const periodData = historicalData[key];
      periodData.avgViewers = periodData.streamCount > 0 ? periodData.totalViewers / periodData.streamCount : 0;
      periodData.avgDuration = periodData.streamDurations.length > 0 
        ? periodData.streamDurations.reduce((a, b) => a + b, 0) / periodData.streamDurations.length 
        : 0;
      delete periodData.streamDurations;
    });
    
    // Convert historical data object to array
    const historicalDataArray = Object.values(historicalData).sort((a, b) => a.period.localeCompare(b.period));
    
    // Get top hosts by stream count
    const hostStreamCounts = {};
    streams.forEach(stream => {
      if (stream.hostId) {
        const hostId = stream.hostId._id.toString();
        const hostName = stream.hostId.displayName;
        
        if (!hostStreamCounts[hostId]) {
          hostStreamCounts[hostId] = {
            hostId,
            displayName: hostName,
            streamCount: 0,
            totalViewers: 0,
            totalGifts: 0
          };
        }
        
        hostStreamCounts[hostId].streamCount++;
        hostStreamCounts[hostId].totalViewers += stream.peakViewerCount || 0;
        hostStreamCounts[hostId].totalGifts += stream.totalGiftsReceived || 0;
      }
    });
    
    const topHosts = Object.values(hostStreamCounts)
      .sort((a, b) => b.streamCount - a.streamCount)
      .slice(0, 10);
    
    res.json({
      success: true,
      data: {
        currentActiveStreams: activeStreams,
        totalStreams,
        avgDuration: Math.round(avgDuration * 100) / 100, // Round to 2 decimal places
        totalViewers,
        totalGifts,
        period,
        historicalData: historicalDataArray,
        topHosts,
        dateRange: {
          start: startDate || 'all',
          end: endDate || 'all'
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get stream analytics', { error: error.message });
    next(error);
  }
};

/**
 * Get user engagement analytics - daily active users and session duration
 * GET /api/admin/analytics/engagement
 */
exports.getEngagementAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, period = 'daily' } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }
    
    // For now, we'll use lastLoginAt as a proxy for daily active users
    // In a production system, you would have proper session tracking
    
    // Get users who have logged in within the date range
    const loginQuery = {};
    if (Object.keys(dateFilter).length > 0) {
      loginQuery.lastLoginAt = dateFilter;
    }
    
    const users = await User.find(loginQuery)
      .select('lastLoginAt registeredAt isHost')
      .sort({ lastLoginAt: 1 })
      .lean();
    
    // Calculate daily active users (users who logged in each day)
    const dailyActiveUsers = {};
    users.forEach(user => {
      const date = new Date(user.lastLoginAt);
      const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!dailyActiveUsers[dayKey]) {
        dailyActiveUsers[dayKey] = {
          date: dayKey,
          activeUsers: 0,
          newUsers: 0,
          returningUsers: 0
        };
      }
      
      dailyActiveUsers[dayKey].activeUsers++;
      
      // Check if this is a new user (registered on or after this day)
      const registeredDate = new Date(user.registeredAt).toISOString().split('T')[0];
      if (registeredDate === dayKey) {
        dailyActiveUsers[dayKey].newUsers++;
      } else {
        dailyActiveUsers[dayKey].returningUsers++;
      }
    });
    
    // Convert to array and sort by date
    const dailyActiveUsersArray = Object.values(dailyActiveUsers)
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Calculate metrics
    const totalActiveUsers = users.length;
    const avgDailyActiveUsers = dailyActiveUsersArray.length > 0 
      ? dailyActiveUsersArray.reduce((sum, day) => sum + day.activeUsers, 0) / dailyActiveUsersArray.length 
      : 0;
    
    // Calculate retention rate (users who logged in more than once)
    // This is simplified - in production you'd track proper sessions
    const userLoginCounts = {};
    users.forEach(user => {
      const userId = user._id.toString();
      userLoginCounts[userId] = (userLoginCounts[userId] || 0) + 1;
    });
    
    const returningUsersCount = Object.values(userLoginCounts).filter(count => count > 1).length;
    const retentionRate = totalActiveUsers > 0 ? (returningUsersCount / totalActiveUsers) * 100 : 0;
    
    // For session duration, we'll use a placeholder since we don't have actual session tracking
    // In production, you would calculate actual session durations from session logs
    const avgSessionDuration = 15; // Placeholder: 15 minutes average session
    
    res.json({
      success: true,
      data: {
        totalActiveUsers,
        avgDailyActiveUsers: Math.round(avgDailyActiveUsers * 100) / 100,
        retentionRate: Math.round(retentionRate * 100) / 100,
        avgSessionDuration,
        dailyActiveUsers: dailyActiveUsersArray,
        period,
        dateRange: {
          start: startDate || 'all',
          end: endDate || 'all'
        },
        note: 'Session duration is estimated. Implement session tracking for accurate data.'
      }
    });
  } catch (error) {
    logger.error('Failed to get engagement analytics', { error: error.message });
    next(error);
  }
};

/**
 * Export analytics data in CSV format
 * GET /api/admin/analytics/export
 */
exports.exportAnalytics = async (req, res, next) => {
  try {
    const { type, startDate, endDate, period = 'monthly' } = req.query;
    
    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Missing parameter',
        message: 'Type parameter is required (users, streams, engagement, revenue, diamonds)'
      });
    }
    
    let csvData = '';
    let filename = '';
    
    switch (type) {
      case 'users':
        // Get user analytics data
        const userQuery = {};
        if (startDate || endDate) {
          userQuery.registeredAt = {};
          if (startDate) {
            userQuery.registeredAt.$gte = new Date(startDate);
          }
          if (endDate) {
            userQuery.registeredAt.$lte = new Date(endDate);
          }
        }
        
        const users = await User.find(userQuery)
          .select('displayName email phoneNumber registeredAt lastLoginAt isHost isBlocked')
          .sort({ registeredAt: 1 })
          .lean();
        
        // Create CSV header
        csvData = 'Display Name,Email,Phone Number,Registered At,Last Login,Is Host,Is Blocked\n';
        
        // Add data rows
        users.forEach(user => {
          csvData += `"${user.displayName || ''}","${user.email || ''}","${user.phoneNumber || ''}",`;
          csvData += `"${user.registeredAt.toISOString()}","${user.lastLoginAt ? user.lastLoginAt.toISOString() : ''}",`;
          csvData += `${user.isHost ? 'Yes' : 'No'},${user.isBlocked ? 'Yes' : 'No'}\n`;
        });
        
        filename = `user-analytics-${new Date().toISOString().split('T')[0]}.csv`;
        break;
        
      case 'streams':
        // Get stream analytics data
        const streamQuery = {};
        if (startDate || endDate) {
          streamQuery.startedAt = {};
          if (startDate) {
            streamQuery.startedAt.$gte = new Date(startDate);
          }
          if (endDate) {
            streamQuery.startedAt.$lte = new Date(endDate);
          }
        }
        
        const streams = await Stream.find(streamQuery)
          .select('title hostId startedAt endedAt status peakViewerCount totalGiftsReceived')
          .populate('hostId', 'displayName')
          .sort({ startedAt: 1 })
          .lean();
        
        // Create CSV header
        csvData = 'Title,Host,Started At,Ended At,Status,Peak Viewers,Total Gifts,Duration (minutes)\n';
        
        // Add data rows
        streams.forEach(stream => {
          const duration = stream.endedAt 
            ? Math.round((new Date(stream.endedAt) - new Date(stream.startedAt)) / (1000 * 60) * 100) / 100 
            : '';
          
          csvData += `"${stream.title || ''}","${stream.hostId?.displayName || 'Unknown'}","${stream.startedAt.toISOString()}",`;
          csvData += `"${stream.endedAt ? stream.endedAt.toISOString() : ''}","${stream.status}",`;
          csvData += `${stream.peakViewerCount || 0},${stream.totalGiftsReceived || 0},${duration}\n`;
        });
        
        filename = `stream-analytics-${new Date().toISOString().split('T')[0]}.csv`;
        break;
        
      case 'revenue':
        // Get revenue transactions
        const revenueQuery = {
          type: 'coinPurchase',
          currency: 'coins'
        };
        
        if (startDate || endDate) {
          revenueQuery.timestamp = {};
          if (startDate) {
            revenueQuery.timestamp.$gte = new Date(startDate);
          }
          if (endDate) {
            revenueQuery.timestamp.$lte = new Date(endDate);
          }
        }
        
        const revenueTransactions = await Transaction.find(revenueQuery)
          .populate('userId', 'displayName')
          .sort({ timestamp: 1 })
          .lean();
        
        // Create CSV header
        csvData = 'Date,User,Amount (Coins),Description,Payment Gateway,Payment ID\n';
        
        // Add data rows
        revenueTransactions.forEach(tx => {
          csvData += `"${tx.timestamp.toISOString()}","${tx.userId?.displayName || 'Unknown'}",`;
          csvData += `${tx.amount},"${tx.description || ''}",`;
          csvData += `${tx.metadata?.paymentGateway || ''},${tx.metadata?.paymentId || ''}\n`;
        });
        
        filename = `revenue-analytics-${new Date().toISOString().split('T')[0]}.csv`;
        break;
        
      case 'diamonds':
        // Get diamond transactions
        const diamondQuery = {
          currency: 'diamonds',
          amount: { $gt: 0 }
        };
        
        if (startDate || endDate) {
          diamondQuery.timestamp = {};
          if (startDate) {
            diamondQuery.timestamp.$gte = new Date(startDate);
          }
          if (endDate) {
            diamondQuery.timestamp.$lte = new Date(endDate);
          }
        }
        
        const diamondTransactions = await Transaction.find(diamondQuery)
          .populate('userId', 'displayName')
          .populate('metadata.recipientId', 'displayName')
          .sort({ timestamp: 1 })
          .lean();
        
        // Create CSV header
        csvData = 'Date,User,Type,Amount (Diamonds),Recipient,Description\n';
        
        // Add data rows
        diamondTransactions.forEach(tx => {
          csvData += `"${tx.timestamp.toISOString()}","${tx.userId?.displayName || 'Unknown'}",`;
          csvData += `${tx.type},${tx.amount},"${tx.metadata?.recipientId?.displayName || ''}",`;
          csvData += `"${tx.description || ''}"\n`;
        });
        
        filename = `diamond-analytics-${new Date().toISOString().split('T')[0]}.csv`;
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid type',
          message: 'Type must be one of: users, streams, engagement, revenue, diamonds'
        });
    }
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Send CSV data
    res.send(csvData);
    
    logger.info('Analytics data exported', {
      type,
      startDate,
      endDate,
      period
    });
    
  } catch (error) {
    logger.error('Failed to export analytics data', { error: error.message });
    next(error);
  }
};
