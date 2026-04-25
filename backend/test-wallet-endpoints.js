/**
 * Test script for wallet endpoints
 * 
 * This script tests the wallet management endpoints:
 * - GET /api/wallet/:userId - Get wallet with recent transactions
 * - GET /api/wallet/:userId/balance - Get balance only
 * - GET /api/wallet/transactions/:userId - Get transaction history with pagination
 * 
 * Prerequisites:
 * 1. Server must be running (npm start)
 * 2. MongoDB must be running
 * 3. You need a valid user ID and authentication token
 * 
 * Usage:
 * 1. Update USER_ID and AUTH_TOKEN below with valid values
 * 2. Run: node test-wallet-endpoints.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000';
const USER_ID = 'YOUR_USER_ID_HERE'; // Replace with actual user ID
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE'; // Replace with actual auth token

// Create axios instance with auth header
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

// Test functions
async function testGetWallet() {
  console.log('\n=== Testing GET /api/wallet/:userId ===');
  try {
    const response = await api.get(`/api/wallet/${USER_ID}`);
    console.log('✓ Success:', response.status);
    console.log('Wallet Data:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log('✗ Failed:', error.response?.status, error.response?.data || error.message);
    return false;
  }
}

async function testGetBalance() {
  console.log('\n=== Testing GET /api/wallet/:userId/balance ===');
  try {
    const response = await api.get(`/api/wallet/${USER_ID}/balance`);
    console.log('✓ Success:', response.status);
    console.log('Balance Data:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log('✗ Failed:', error.response?.status, error.response?.data || error.message);
    return false;
  }
}

async function testGetTransactions() {
  console.log('\n=== Testing GET /api/wallet/transactions/:userId ===');
  try {
    const response = await api.get(`/api/wallet/transactions/${USER_ID}`, {
      params: {
        page: 1,
        limit: 10,
      },
    });
    console.log('✓ Success:', response.status);
    console.log('Transactions Data:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log('✗ Failed:', error.response?.status, error.response?.data || error.message);
    return false;
  }
}

async function testGetTransactionsWithFilter() {
  console.log('\n=== Testing GET /api/wallet/transactions/:userId with type filter ===');
  try {
    const response = await api.get(`/api/wallet/transactions/${USER_ID}`, {
      params: {
        page: 1,
        limit: 10,
        type: 'giftSent',
      },
    });
    console.log('✓ Success:', response.status);
    console.log('Filtered Transactions:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log('✗ Failed:', error.response?.status, error.response?.data || error.message);
    return false;
  }
}

async function testUnauthorizedAccess() {
  console.log('\n=== Testing unauthorized access (different user ID) ===');
  try {
    const differentUserId = '507f1f77bcf86cd799439011'; // Random ObjectId
    const response = await api.get(`/api/wallet/${differentUserId}`);
    console.log('✗ Should have failed but got:', response.status);
    return false;
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('✓ Correctly rejected with 403 Forbidden');
      return true;
    }
    console.log('✗ Failed with unexpected error:', error.response?.status, error.response?.data || error.message);
    return false;
  }
}

async function testInvalidPagination() {
  console.log('\n=== Testing invalid pagination parameters ===');
  try {
    const response = await api.get(`/api/wallet/transactions/${USER_ID}`, {
      params: {
        page: -1,
        limit: 200,
      },
    });
    console.log('✗ Should have failed but got:', response.status);
    return false;
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✓ Correctly rejected with 400 Bad Request');
      console.log('Error message:', error.response.data.message);
      return true;
    }
    console.log('✗ Failed with unexpected error:', error.response?.status, error.response?.data || error.message);
    return false;
  }
}

async function testInvalidTransactionType() {
  console.log('\n=== Testing invalid transaction type ===');
  try {
    const response = await api.get(`/api/wallet/transactions/${USER_ID}`, {
      params: {
        page: 1,
        limit: 10,
        type: 'invalidType',
      },
    });
    console.log('✗ Should have failed but got:', response.status);
    return false;
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✓ Correctly rejected with 400 Bad Request');
      console.log('Error message:', error.response.data.message);
      return true;
    }
    console.log('✗ Failed with unexpected error:', error.response?.status, error.response?.data || error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('='.repeat(60));
  console.log('Wallet Endpoints Test Suite');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`User ID: ${USER_ID}`);
  console.log(`Auth Token: ${AUTH_TOKEN.substring(0, 20)}...`);

  if (USER_ID === 'YOUR_USER_ID_HERE' || AUTH_TOKEN === 'YOUR_AUTH_TOKEN_HERE') {
    console.log('\n⚠️  Please update USER_ID and AUTH_TOKEN in the script before running tests');
    return;
  }

  const results = [];

  // Run tests
  results.push(await testGetWallet());
  results.push(await testGetBalance());
  results.push(await testGetTransactions());
  results.push(await testGetTransactionsWithFilter());
  results.push(await testUnauthorizedAccess());
  results.push(await testInvalidPagination());
  results.push(await testInvalidTransactionType());

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`Passed: ${passed}/${total}`);
  console.log(`Failed: ${total - passed}/${total}`);
  
  if (passed === total) {
    console.log('\n✓ All tests passed!');
  } else {
    console.log('\n✗ Some tests failed. Please review the output above.');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
