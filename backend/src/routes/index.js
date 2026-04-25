const express = require('express');
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./auth');

const router = express.Router();

router.use('/', healthRoutes);
router.use('/api/auth', authRoutes);

module.exports = router;
