const express = require('express');
const giftController = require('../controllers/giftController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Public endpoint - Get all available gifts
router.get('/', giftController.getGifts);

// Admin endpoint - Create a new gift
// Note: This should be protected with admin middleware in production
router.post('/admin/gifts', authenticate, giftController.createGift);

module.exports = router;
