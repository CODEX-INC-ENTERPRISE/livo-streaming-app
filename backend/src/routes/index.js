const express = require('express');
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./auth');
const userRoutes = require('./users');
const streamRoutes = require('./streams');

const router = express.Router();

router.use('/', healthRoutes);
router.use('/api/auth', authRoutes);
router.use('/api/users', userRoutes);
router.use('/api/streams', streamRoutes);

module.exports = router;
