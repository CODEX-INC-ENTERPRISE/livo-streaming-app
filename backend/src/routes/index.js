const express = require('express');
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./auth');
const userRoutes = require('./users');
const streamRoutes = require('./streams');
const giftRoutes = require('./gifts');
const walletRoutes = require('./wallet');

const router = express.Router();

router.use('/', healthRoutes);
router.use('/api/auth', authRoutes);
router.use('/api/users', userRoutes);
router.use('/api/streams', streamRoutes);
router.use('/api/gifts', giftRoutes);
router.use('/api', giftRoutes); // For /api/admin/gifts endpoint
router.use('/api/wallet', walletRoutes);

module.exports = router;
