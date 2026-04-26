const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const hostController = require('../controllers/hostController');
const agentController = require('../controllers/agentController');

// Public routes (authenticated users only)
router.post('/register', authenticate, hostController.registerHost);
router.get('/:userId/earnings', authenticate, hostController.getHostEarnings);

// Admin routes
router.get('/admin/hosts/pending', authenticate, requireAdmin, hostController.getPendingHosts);
router.put('/admin/hosts/:hostId/approve', authenticate, requireAdmin, hostController.approveHost);
router.put('/admin/hosts/:hostId/assign-agent', authenticate, requireAdmin, agentController.assignHostToAgent);

// Agent routes (admin only)
router.post('/admin/agents/register', authenticate, requireAdmin, agentController.registerAgent);
router.get('/admin/agents/:agentId/commissions', authenticate, requireAdmin, agentController.getAgentCommissions);

module.exports = router;