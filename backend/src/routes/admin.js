const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const adminUserController = require('../controllers/adminUserController');
const adminStreamController = require('../controllers/adminStreamController');
const adminFinancialController = require('../controllers/adminFinancialController');
const adminReportController = require('../controllers/adminReportController');
const adminModerationController = require('../controllers/adminModerationController');

// Admin user management routes
router.get('/admin/users', authenticate, requireAdmin, adminUserController.getUsers);
router.get('/admin/users/:userId', authenticate, requireAdmin, adminUserController.getUserDetails);
router.put('/admin/users/:userId', authenticate, requireAdmin, adminUserController.updateUser);
router.get('/admin/users/:userId/activity', authenticate, requireAdmin, adminUserController.getUserActivity);

// Admin stream monitoring routes
router.get('/admin/streams', authenticate, requireAdmin, adminStreamController.getStreams);
router.get('/admin/streams/:streamId', authenticate, requireAdmin, adminStreamController.getStreamDetails);
router.post('/admin/streams/:streamId/terminate', authenticate, requireAdmin, adminStreamController.terminateStream);
router.post('/admin/streams/:streamId/flag', authenticate, requireAdmin, adminStreamController.flagStream);
router.get('/admin/streams/flagged', authenticate, requireAdmin, adminStreamController.getFlaggedStreams);

// Admin financial tracking routes
router.get('/admin/analytics/revenue', authenticate, requireAdmin, adminFinancialController.getRevenueAnalytics);
router.get('/admin/analytics/diamonds', authenticate, requireAdmin, adminFinancialController.getDiamondsAnalytics);
router.get('/admin/withdrawals', authenticate, requireAdmin, adminFinancialController.getWithdrawals);
router.put('/admin/withdrawals/:withdrawalId', authenticate, requireAdmin, adminFinancialController.updateWithdrawalStatus);
router.get('/admin/transactions', authenticate, requireAdmin, adminFinancialController.getTransactions);

// Admin analytics endpoints (Task 13.5)
router.get('/admin/analytics/users', authenticate, requireAdmin, adminFinancialController.getUserAnalytics);
router.get('/admin/analytics/streams', authenticate, requireAdmin, adminFinancialController.getStreamAnalytics);
router.get('/admin/analytics/engagement', authenticate, requireAdmin, adminFinancialController.getEngagementAnalytics);
router.get('/admin/analytics/export', authenticate, requireAdmin, adminFinancialController.exportAnalytics);

// Admin report handling routes
router.get('/admin/reports', authenticate, requireAdmin, adminReportController.getReports);
router.get('/admin/reports/:reportId', authenticate, requireAdmin, adminReportController.getReportDetails);
router.put('/admin/reports/:reportId', authenticate, requireAdmin, adminReportController.updateReport);

// Admin moderation endpoints (Task 13.6)
router.get('/admin/moderation/keywords', authenticate, requireAdmin, adminModerationController.getModerationKeywords);
router.post('/admin/moderation/keywords', authenticate, requireAdmin, adminModerationController.createModerationKeyword);
router.put('/admin/moderation/keywords/:keywordId', authenticate, requireAdmin, adminModerationController.updateModerationKeyword);
router.delete('/admin/moderation/keywords/:keywordId', authenticate, requireAdmin, adminModerationController.deleteModerationKeyword);
router.get('/admin/moderation/logs', authenticate, requireAdmin, adminModerationController.getModerationLogs);

module.exports = router;