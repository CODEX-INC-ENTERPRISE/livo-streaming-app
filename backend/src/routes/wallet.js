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

module.exports = router;
