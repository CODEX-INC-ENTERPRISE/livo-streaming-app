const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validateRequest, validateQuery } = require('../middleware/validation');
const { 
  updateUserSchema, 
  resolveReportSchema, 
  updateWithdrawalSchema,
  paginationSchema 
} = require('../middleware/validationSchemas');
const adminUserController = require('../controllers/adminUserController');
const adminStreamController = require('../controllers/adminStreamController');
const adminFinancialController = require('../controllers/adminFinancialController');
const adminReportController = require('../controllers/adminReportController');
const adminModerationController = require('../controllers/adminModerationController');

// Admin user management routes
router.get('/admin/users', authenticate, requireAdmin, validateQuery(paginationSchema), adminUserController.getUsers);
router.get('/admin/users/:userId', authenticate, requireAdmin, adminUserController.getUserDetails);
router.put('/admin/users/:userId', authenticate, requireAdmin, validateRequest(updateUserSchema), adminUserController.updateUser);
router.get('/admin/users/:userId/activity', authenticate, requireAdmin, validateQuery(paginationSchema), adminUserController.getUserActivity);

// Admin stream monitoring routes
router.get('/admin/streams', authenticate, requireAdmin, validateQuery(paginationSchema), adminStreamController.getStreams);
router.get('/admin/streams/:streamId', authenticate, requireAdmin, adminStreamController.getStreamDetails);
router.post('/admin/streams/:streamId/terminate', authenticate, requireAdmin, adminStreamController.terminateStream);
router.post('/admin/streams/:streamId/flag', authenticate, requireAdmin, adminStreamController.flagStream);
router.get('/admin/streams/flagged', authenticate, requireAdmin, validateQuery(paginationSchema), adminStreamController.getFlaggedStreams);

// Admin financial tracking routes
router.get('/admin/analytics/revenue', authenticate, requireAdmin, validateQuery(paginationSchema), adminFinancialController.getRevenueAnalytics);
router.get('/admin/analytics/diamonds', authenticate, requireAdmin, validateQuery(paginationSchema), adminFinancialController.getDiamondsAnalytics);
router.get('/admin/withdrawals', authenticate, requireAdmin, validateQuery(paginationSchema), adminFinancialController.getWithdrawals);
router.put('/admin/withdrawals/:withdrawalId', authenticate, requireAdmin, validateRequest(updateWithdrawalSchema), adminFinancialController.updateWithdrawalStatus);
router.get('/admin/transactions', authenticate, requireAdmin, validateQuery(paginationSchema), adminFinancialController.getTransactions);

// Admin analytics endpoints (Task 13.5)
router.get('/admin/analytics/users', authenticate, requireAdmin, validateQuery(paginationSchema), adminFinancialController.getUserAnalytics);
router.get('/admin/analytics/streams', authenticate, requireAdmin, validateQuery(paginationSchema), adminFinancialController.getStreamAnalytics);
router.get('/admin/analytics/engagement', authenticate, requireAdmin, validateQuery(paginationSchema), adminFinancialController.getEngagementAnalytics);
router.get('/admin/analytics/export', authenticate, requireAdmin, validateQuery(paginationSchema), adminFinancialController.exportAnalytics);

// Admin report handling routes
router.get('/admin/reports', authenticate, requireAdmin, validateQuery(paginationSchema), adminReportController.getReports);
router.get('/admin/reports/:reportId', authenticate, requireAdmin, adminReportController.getReportDetails);
router.put('/admin/reports/:reportId', authenticate, requireAdmin, validateRequest(resolveReportSchema), adminReportController.updateReport);

// Admin moderation endpoints (Task 13.6)
router.get('/admin/moderation/keywords', authenticate, requireAdmin, validateQuery(paginationSchema), adminModerationController.getModerationKeywords);
router.post('/admin/moderation/keywords', authenticate, requireAdmin, adminModerationController.createModerationKeyword);
router.put('/admin/moderation/keywords/:keywordId', authenticate, requireAdmin, adminModerationController.updateModerationKeyword);
router.delete('/admin/moderation/keywords/:keywordId', authenticate, requireAdmin, adminModerationController.deleteModerationKeyword);
router.get('/admin/moderation/logs', authenticate, requireAdmin, validateQuery(paginationSchema), adminModerationController.getModerationLogs);

module.exports = router;