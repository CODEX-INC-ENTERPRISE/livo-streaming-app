/**
 * Test script for moderation endpoints (Task 13.6)
 * Run with: node test-moderation-endpoints.js
 */

const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'your-admin-token-here';
const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-id';

// Headers for authenticated requests
const headers = {
  'Authorization': `Bearer ${ADMIN_TOKEN}`,
  'Content-Type': 'application/json'
};

// Test data
const testKeywords = [
  { keyword: 'badword1', action: 'block', severity: 'high', category: 'hate_speech' },
  { keyword: 'badword2', action: 'warn', severity: 'medium', category: 'harassment' },
  { keyword: 'badword3', action: 'flag', severity: 'low', category: 'spam' }
];

const testMessages = [
  { message: 'Hello world, this is a normal message', shouldPass: true },
  { message: 'This message contains badword1 which should be blocked', shouldPass: false },
  { message: 'This has badword2 which should trigger a warning', shouldPass: true },
  { message: 'This has badword3 which should be flagged', shouldPass: true }
];

async function testModerationEndpoints() {
  console.log('=== Testing Moderation Endpoints (Task 13.6) ===\n');
  
  let passedTests = 0;
  let totalTests = 0;
  
  // Helper function to run test
  async function runTest(name, testFn) {
    totalTests++;
    try {
      await testFn();
      console.log(`✓ ${name}`);
      passedTests++;
    } catch (error) {
      console.log(`✗ ${name}: ${error.message}`);
    }
  }
  
  // Test 1: Create moderation keywords
  await runTest('Create moderation keywords', async () => {
    for (const keywordData of testKeywords) {
      const response = await axios.post(
        `${BASE_URL}/api/admin/moderation/keywords`,
        keywordData,
        { headers }
      );
      
      if (response.status !== 201) {
        throw new Error(`Failed to create keyword: ${response.status}`);
      }
      
      console.log(`  Created keyword: ${keywordData.keyword}`);
    }
  });
  
  // Test 2: Get moderation keywords
  await runTest('Get moderation keywords', async () => {
    const response = await axios.get(
      `${BASE_URL}/api/admin/moderation/keywords`,
      { headers }
    );
    
    if (response.status !== 200) {
      throw new Error(`Failed to get keywords: ${response.status}`);
    }
    
    const { keywords } = response.data;
    if (!Array.isArray(keywords)) {
      throw new Error('Keywords response is not an array');
    }
    
    console.log(`  Found ${keywords.length} keywords`);
  });
  
  // Test 3: Test keyword matching (simulated)
  await runTest('Test keyword matching logic', async () => {
    const { checkMessageForKeywords } = require('./src/controllers/adminModerationController');
    
    for (const test of testMessages) {
      const result = await checkMessageForKeywords(test.message);
      
      if (test.shouldPass && result.hasViolation && result.mostSevereViolation?.action === 'block') {
        throw new Error(`Message should pass but was blocked: "${test.message.substring(0, 50)}..."`);
      }
      
      if (!test.shouldPass && !result.hasViolation) {
        throw new Error(`Message should be blocked but passed: "${test.message.substring(0, 50)}..."`);
      }
      
      console.log(`  Message: "${test.message.substring(0, 30)}..." - ${result.hasViolation ? 'Violation detected' : 'Clean'}`);
    }
  });
  
  // Test 4: Get moderation logs
  await runTest('Get moderation logs', async () => {
    const response = await axios.get(
      `${BASE_URL}/api/admin/moderation/logs`,
      { headers }
    );
    
    if (response.status !== 200) {
      throw new Error(`Failed to get logs: ${response.status}`);
    }
    
    const { logs } = response.data;
    if (!Array.isArray(logs)) {
      throw new Error('Logs response is not an array');
    }
    
    console.log(`  Found ${logs.length} moderation logs`);
  });
  
  // Test 5: Update a keyword
  await runTest('Update moderation keyword', async () => {
    // First get a keyword ID
    const getResponse = await axios.get(
      `${BASE_URL}/api/admin/moderation/keywords`,
      { headers }
    );
    
    if (getResponse.data.keywords.length === 0) {
      console.log('  No keywords to update');
      return;
    }
    
    const keywordId = getResponse.data.keywords[0].id;
    
    const updateResponse = await axios.put(
      `${BASE_URL}/api/admin/moderation/keywords/${keywordId}`,
      { isActive: false },
      { headers }
    );
    
    if (updateResponse.status !== 200) {
      throw new Error(`Failed to update keyword: ${updateResponse.status}`);
    }
    
    console.log(`  Updated keyword ${keywordId}`);
  });
  
  // Test 6: Delete a keyword
  await runTest('Delete moderation keyword', async () => {
    // First get a keyword ID
    const getResponse = await axios.get(
      `${BASE_URL}/api/admin/moderation/keywords`,
      { headers }
    );
    
    if (getResponse.data.keywords.length === 0) {
      console.log('  No keywords to delete');
      return;
    }
    
    const keywordId = getResponse.data.keywords[0].id;
    
    const deleteResponse = await axios.delete(
      `${BASE_URL}/api/admin/moderation/keywords/${keywordId}`,
      { headers }
    );
    
    if (deleteResponse.status !== 200) {
      throw new Error(`Failed to delete keyword: ${deleteResponse.status}`);
    }
    
    console.log(`  Deleted keyword ${keywordId}`);
  });
  
  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('✅ All moderation endpoint tests passed!');
  } else {
    console.log(`⚠️  ${totalTests - passedTests} test(s) failed`);
  }
  
  // Cleanup recommendations
  console.log('\n=== Implementation Notes ===');
  console.log('1. Moderation endpoints are now available at:');
  console.log('   - GET/POST /api/admin/moderation/keywords');
  console.log('   - PUT/DELETE /api/admin/moderation/keywords/:keywordId');
  console.log('   - GET /api/admin/moderation/logs');
  console.log('\n2. Keyword matching is integrated into:');
  console.log('   - Stream chat messages (backend/src/socket/streamHandlers.js)');
  console.log('   - Voice room chat messages (backend/src/socket/voiceRoomHandlers.js)');
  console.log('\n3. Models created:');
  console.log('   - ModerationKeyword (backend/src/models/ModerationKeyword.js)');
  console.log('   - ModerationLog (backend/src/models/ModerationLog.js)');
  console.log('\n4. Controller: backend/src/controllers/adminModerationController.js');
  console.log('\n5. To test with actual chat messages, start the server and:');
  console.log('   - Add moderation keywords via admin dashboard');
  console.log('   - Send chat messages containing those keywords');
  console.log('   - Check moderation logs for violations');
}

// Run tests
testModerationEndpoints().catch(error => {
  console.error('Test suite failed:', error.message);
  process.exit(1);
});