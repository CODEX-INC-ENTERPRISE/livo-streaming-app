const express = require('express');
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./auth');
const userRoutes = require('./users');

const router = express.Router();

router.use('/', healthRoutes);
router.use('/api/auth', authRoutes);
router.use('/api/users', userRoutes);

module.exports = router;
