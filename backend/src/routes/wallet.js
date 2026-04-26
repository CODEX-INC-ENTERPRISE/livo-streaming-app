const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { authenticate } = require('../middleware/auth');

/**
 * Wallet Routes
 * All routes require authentication
 */

// Get wallet information (balance + recent transactions)
router.get('/:userId', authenticate, walletController.getWallet);

// Get wallet balance only (lightweight)
router.get('/:userId/balance', authenticate, walletController.getBalance);

// Get transaction history with pagination and filtering
router.get('/transactions/:userId', authenticate, walletController.getTransactions);

// Purchase coins endpoint
router.post('/purchase-coins', authenticate, walletController.purchaseCoins);

// Get available coin packages
router.get('/packages', walletController.getCoinPackages);

// Webhook endpoints (no authentication - verified by signature)
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), walletController.handleStripeWebhook);
router.post('/webhook/paypal', express.json(), walletController.handlePayPalWebhook);

module.exports = router;
