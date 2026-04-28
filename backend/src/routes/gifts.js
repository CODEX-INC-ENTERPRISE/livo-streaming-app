const express = require('express');
const giftController = require('../controllers/giftController');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { createGiftSchema } = require('../middleware/validationSchemas');

const router = express.Router();

// Public endpoint - Get all available gifts
router.get('/', giftController.getGifts);

// Admin endpoint - Create a new gift
// Note: This should be protected with admin middleware in production
router.post('/admin/gifts', authenticate, validateRequest(createGiftSchema), giftController.createGift);

module.exports = router;
