const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validateRequest, validateQuery } = require('../middleware/validation');
const { 
  registerHostSchema, 
  registerAgentSchema, 
  assignAgentSchema,
  paginationSchema 
} = require('../middleware/validationSchemas');
const hostController = require('../controllers/hostController');
const agentController = require('../controllers/agentController');

// Public routes (authenticated users only)
router.post('/register', authenticate, validateRequest(registerHostSchema), hostController.registerHost);
router.get('/:userId/earnings', authenticate, hostController.getHostEarnings);

// Admin routes
router.get('/admin/hosts/pending', authenticate, requireAdmin, validateQuery(paginationSchema), hostController.getPendingHosts);
router.put('/admin/hosts/:hostId/approve', authenticate, requireAdmin, hostController.approveHost);
router.put('/admin/hosts/:hostId/assign-agent', authenticate, requireAdmin, validateRequest(assignAgentSchema), agentController.assignHostToAgent);

// Agent routes (admin only)
router.post('/admin/agents/register', authenticate, requireAdmin, validateRequest(registerAgentSchema), agentController.registerAgent);
router.get('/admin/agents/:agentId/commissions', authenticate, requireAdmin, validateQuery(paginationSchema), agentController.getAgentCommissions);

module.exports = router;