/**
 * Test script for Virtual Gift System endpoints
 * 
 * This script tests:
 * 1. Creating virtual gifts (admin)
 * 2. Listing available gifts
 * 3. Sending gifts during streams
 * 
 * Prerequisites:
 * - Server must be running
 * - MongoDB must be running
 * - Valid authentication tokens
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Test configuration
const config = {
  adminToken: 'YOUR_ADMIN_TOKEN_HERE',
  viewerToken: 'YOUR_VIEWER_TOKEN_HERE',
  hostToken: 'YOUR_HOST_TOKEN_HERE',
};

// Helper function to make authenticated requests
async function makeRequest(method, url, data = null, token = null) {
  try {
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await axios({
      method,
      url: `${BASE_URL}${url}`,
      data,
      headers,
    });

    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status,
    };
  }
}

// Test 1: Create virtual gifts (admin)
async function testCreateGift() {
  console.log('\n=== Test 1: Create Virtual Gift ===');

  const gifts = [
    {
      name: 'Rose',
      coinPrice: 10,
      diamondValue: 8,
      animationAssetUrl: 'https://example.com/animations/rose.json',
      thumbnailUrl: 'https://example.com/thumbnails/rose.png',
      category: 'basic',
    },
    {
      name: 'Diamond Ring',
      coinPrice: 100,
      diamondValue: 85,
      animationAssetUrl: 'https://example.com/animations/diamond-ring.json',
      thumbnailUrl: 'https://example.com/thumbnails/diamond-ring.png',
      category: 'premium',
    },
    {
      name: 'Sports Car',
      coinPrice: 1000,
      diamondValue: 900,
      animationAssetUrl: 'https://example.com/animations/sports-car.json',
      thumbnailUrl: 'https://example.com/thumbnails/sports-car.png',
      category: 'luxury',
    },
  ];

  for (const gift of gifts) {
    const result = await makeRequest('POST', '/admin/gifts', gift, config.adminToken);
    if (result.success) {
      console.log(`✓ Created gift: ${gift.name} (${gift.coinPrice} coins)`);
      console.log(`  Gift ID: ${result.data.gift._id}`);
    } else {
      console.log(`✗ Failed to create gift: ${gift.name}`);
      console.log(`  Error: ${JSON.stringify(result.error)}`);
    }
  }
}

// Test 2: Get all available gifts
async function testGetGifts() {
  console.log('\n=== Test 2: Get Available Gifts ===');

  const result = await makeRequest('GET', '/gifts');
  if (result.success) {
    console.log(`✓ Retrieved ${result.data.total} gifts`);
    console.log('\nGifts by category:');
    Object.entries(result.data.giftsByCategory).forEach(([category, gifts]) => {
      console.log(`\n${category.toUpperCase()}:`);
      gifts.forEach((gift) => {
        console.log(`  - ${gift.name}: ${gift.coinPrice} coins → ${gift.diamondValue} diamonds`);
      });
    });
    return result.data.gifts;
  } else {
    console.log('✗ Failed to retrieve gifts');
    console.log(`  Error: ${JSON.stringify(result.error)}`);
    return [];
  }
}

// Test 3: Send a gift during a stream
async function testSendGift(streamId, giftId) {
  console.log('\n=== Test 3: Send Gift During Stream ===');

  if (!streamId || !giftId) {
    console.log('✗ Skipping: streamId and giftId required');
    console.log('  Please start a stream and get a gift ID first');
    return;
  }

  const result = await makeRequest(
    'POST',
    `/streams/${streamId}/gift`,
    { giftId },
    config.viewerToken
  );

  if (result.success) {
    console.log('✓ Gift sent successfully!');
    console.log(`  Gift: ${result.data.gift.name}`);
    console.log(`  Cost: ${result.data.gift.coinPrice} coins`);
    console.log(`  Host receives: ${result.data.gift.diamondValue} diamonds`);
    console.log(`  New balance: ${result.data.newBalance} coins`);
    console.log(`  Transaction ID: ${result.data.transactionId}`);
  } else {
    console.log('✗ Failed to send gift');
    console.log(`  Error: ${JSON.stringify(result.error)}`);
    console.log(`  Status: ${result.status}`);
  }
}

// Test 4: Test insufficient coins scenario
async function testInsufficientCoins(streamId, giftId) {
  console.log('\n=== Test 4: Test Insufficient Coins ===');

  if (!streamId || !giftId) {
    console.log('✗ Skipping: streamId and giftId required');
    return;
  }

  // Try to send an expensive gift (assuming viewer has insufficient coins)
  const result = await makeRequest(
    'POST',
    `/streams/${streamId}/gift`,
    { giftId },
    config.viewerToken
  );

  if (!result.success && result.status === 402) {
    console.log('✓ Insufficient coins error handled correctly');
    console.log(`  Required: ${result.error.required} coins`);
    console.log(`  Available: ${result.error.available} coins`);
  } else if (result.success) {
    console.log('✓ Gift sent (viewer had sufficient coins)');
  } else {
    console.log('✗ Unexpected error');
    console.log(`  Error: ${JSON.stringify(result.error)}`);
  }
}

// Test 5: Get gifts by category
async function testGetGiftsByCategory(category) {
  console.log(`\n=== Test 5: Get Gifts by Category (${category}) ===`);

  const result = await makeRequest('GET', `/gifts?category=${category}`);
  if (result.success) {
    console.log(`✓ Retrieved ${result.data.total} ${category} gifts`);
    result.data.gifts.forEach((gift) => {
      console.log(`  - ${gift.name}: ${gift.coinPrice} coins`);
    });
  } else {
    console.log('✗ Failed to retrieve gifts by category');
    console.log(`  Error: ${JSON.stringify(result.error)}`);
  }
}

// Main test runner
async function runTests() {
  console.log('===========================================');
  console.log('Virtual Gift System - API Tests');
  console.log('===========================================');

  // Test 1: Create gifts
  await testCreateGift();

  // Test 2: Get all gifts
  const gifts = await testGetGifts();

  // Test 5: Get gifts by category
  if (gifts.length > 0) {
    await testGetGiftsByCategory('basic');
  }

  // Test 3 & 4: Send gifts (requires manual setup)
  console.log('\n=== Manual Tests Required ===');
  console.log('To test gift sending:');
  console.log('1. Start a stream and get the streamId');
  console.log('2. Get a giftId from the gifts list above');
  console.log('3. Update the tokens in this script');
  console.log('4. Uncomment and run the following tests:');
  console.log('');
  console.log('   const streamId = "YOUR_STREAM_ID";');
  console.log('   const giftId = "YOUR_GIFT_ID";');
  console.log('   await testSendGift(streamId, giftId);');
  console.log('   await testInsufficientCoins(streamId, expensiveGiftId);');

  console.log('\n===========================================');
  console.log('Tests completed!');
  console.log('===========================================\n');
}

// Run tests
runTests().catch((error) => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
