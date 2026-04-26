const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const Joi = require('joi');

/**
 * Wallet Routes
 * All routes require authentication
 */

// Validation schemas
const purchaseCoinsSchema = Joi.object({
  packageId: Joi.string().required(),
  gateway: Joi.string().valid('stripe', 'paypal', 'mada', 'stcpay').default('stripe'),
  currency: Joi.string().valid('USD', 'SAR', 'EUR', 'GBP').default('USD'),
});

// Get wallet information (balance + recent transactions)
router.get('/:userId', authenticate, walletController.getWallet);

// Get wallet balance only (lightweight)
router.get('/:userId/balance', authenticate, walletController.getBalance);

// Get transaction history with pagination and filtering
router.get('/transactions/:userId', authenticate, walletController.getTransactions);

// Purchase coins endpoint
router.post('/purchase-coins', authenticate, validateRequest(purchaseCoinsSchema), walletController.purchaseCoins);

// Get available coin packages
router.get('/packages', walletController.getCoinPackages);

// Webhook endpoints (no authentication - verified by signature)
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), walletController.handleStripeWebhook);
router.post('/webhook/paypal', express.json(), walletController.handlePayPalWebhook);
router.post('/webhook/mada', express.json(), walletController.handleMadaWebhook);
router.post('/webhook/stcpay', express.json(), walletController.handleStcPayWebhook);

module.exports = router;
