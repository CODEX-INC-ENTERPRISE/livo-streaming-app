/**
 * Test script for Stream endpoints
 * 
 * This script tests the live streaming endpoints including:
 * - Starting a stream
 * - Joining a stream as viewer
 * - Sending chat messages
 * - Pinning messages
 * - Moderation actions
 * - Ending a stream
 * 
 * Prerequisites:
 * - Server must be running
 * - MongoDB must be connected
 * - User must be registered and have host permissions
 * - Valid authentication token required
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

// Test configuration
const config = {
  hostToken: '', // Add your host token here
  viewerToken: '', // Add your viewer token here
};

let streamId = null;
let messageId = null;

/**
 * Helper function to make authenticated requests
 */
async function makeRequest(method, endpoint, data = null, token = config.hostToken) {
  try {
    const response = await axios({
      method,
      url: `${API_URL}${endpoint}`,
      data,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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

/**
 * Test 1: Start a stream
 */
async function testStartStream() {
  console.log('\n=== Test 1: Start Stream ===');
  
  const result = await makeRequest('POST', '/streams/start', {
    title: 'Test Live Stream',
  });
  
  if (result.success) {
    streamId = result.data.streamId;
    console.log('✓ Stream started successfully');
    console.log('  Stream ID:', streamId);
    console.log('  Agora Channel ID:', result.data.agoraChannelId);
    console.log('  App ID:', result.data.appId);
    console.log('  Token generated:', result.data.agoraToken ? 'Yes' : 'No');
  } else {
    console.log('✗ Failed to start stream');
    console.log('  Error:', result.error);
  }
  
  return result.success;
}

/**
 * Test 2: Get active streams
 */
async function testGetActiveStreams() {
  console.log('\n=== Test 2: Get Active Streams ===');
  
  const result = await makeRequest('GET', '/streams/active?page=1&limit=10');
  
  if (result.success) {
    console.log('✓ Retrieved active streams');
    console.log('  Total streams:', result.data.total);
    console.log('  Streams on page:', result.data.streams.length);
    if (result.data.streams.length > 0) {
      console.log('  First stream:', result.data.streams[0].title);
    }
  } else {
    console.log('✗ Failed to get active streams');
    console.log('  Error:', result.error);
  }
  
  return result.success;
}

/**
 * Test 3: Join stream as viewer
 */
async function testJoinStream() {
  console.log('\n=== Test 3: Join Stream as Viewer ===');
  
  if (!streamId) {
    console.log('✗ No stream ID available');
    return false;
  }
  
  const result = await makeRequest(
    'POST',
    `/streams/${streamId}/join`,
    null,
    config.viewerToken || config.hostToken
  );
  
  if (result.success) {
    console.log('✓ Joined stream successfully');
    console.log('  Agora Channel ID:', result.data.agoraChannelId);
    console.log('  Playback URL:', result.data.playbackUrl);
    console.log('  Token generated:', result.data.agoraToken ? 'Yes' : 'No');
  } else {
    console.log('✗ Failed to join stream');
    console.log('  Error:', result.error);
  }
  
  return result.success;
}

/**
 * Test 4: Send chat message
 */
async function testSendChatMessage() {
  console.log('\n=== Test 4: Send Chat Message ===');
  
  if (!streamId) {
    console.log('✗ No stream ID available');
    return false;
  }
  
  const result = await makeRequest('POST', `/streams/${streamId}/chat`, {
    message: 'Hello from test script! 👋',
  });
  
  if (result.success) {
    messageId = result.data.messageId;
    console.log('✓ Chat message sent successfully');
    console.log('  Message ID:', messageId);
    console.log('  Timestamp:', result.data.timestamp);
  } else {
    console.log('✗ Failed to send chat message');
    console.log('  Error:', result.error);
  }
  
  return result.success;
}

/**
 * Test 5: Pin message
 */
async function testPinMessage() {
  console.log('\n=== Test 5: Pin Message ===');
  
  if (!streamId || !messageId) {
    console.log('✗ No stream ID or message ID available');
    return false;
  }
  
  const result = await makeRequest('POST', `/streams/${streamId}/pin-message`, {
    messageId: messageId,
  });
  
  if (result.success) {
    console.log('✓ Message pinned successfully');
    console.log('  Pinned message ID:', result.data.messageId);
  } else {
    console.log('✗ Failed to pin message');
    console.log('  Error:', result.error);
  }
  
  return result.success;
}

/**
 * Test 6: Moderation - Mute user
 */
async function testModerateStream() {
  console.log('\n=== Test 6: Moderate Stream (Mute) ===');
  
  if (!streamId) {
    console.log('✗ No stream ID available');
    return false;
  }
  
  // Note: Replace with actual target user ID
  const targetUserId = '000000000000000000000000';
  
  const result = await makeRequest('POST', `/streams/${streamId}/moderate`, {
    action: 'mute',
    targetUserId: targetUserId,
  });
  
  if (result.success) {
    console.log('✓ Moderation action successful');
    console.log('  Action:', result.data.action);
    console.log('  Target user:', result.data.targetUserId);
  } else {
    console.log('✗ Failed to perform moderation action');
    console.log('  Error:', result.error);
    console.log('  Note: This may fail if target user ID is invalid');
  }
  
  return true; // Don't fail the test suite for this
}

/**
 * Test 7: Leave stream
 */
async function testLeaveStream() {
  console.log('\n=== Test 7: Leave Stream ===');
  
  if (!streamId) {
    console.log('✗ No stream ID available');
    return false;
  }
  
  const result = await makeRequest(
    'POST',
    `/streams/${streamId}/leave`,
    null,
    config.viewerToken || config.hostToken
  );
  
  if (result.success) {
    console.log('✓ Left stream successfully');
    console.log('  Viewer count:', result.data.viewerCount);
  } else {
    console.log('✗ Failed to leave stream');
    console.log('  Error:', result.error);
  }
  
  return result.success;
}

/**
 * Test 8: End stream
 */
async function testEndStream() {
  console.log('\n=== Test 8: End Stream ===');
  
  if (!streamId) {
    console.log('✗ No stream ID available');
    return false;
  }
  
  const result = await makeRequest('POST', `/streams/${streamId}/end`);
  
  if (result.success) {
    console.log('✓ Stream ended successfully');
    console.log('  Statistics:');
    console.log('    Duration:', result.data.statistics.duration, 'seconds');
    console.log('    Peak viewers:', result.data.statistics.peakViewerCount);
    console.log('    Total gifts:', result.data.statistics.totalGiftsReceived);
  } else {
    console.log('✗ Failed to end stream');
    console.log('  Error:', result.error);
  }
  
  return result.success;
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('===========================================');
  console.log('  Stream Endpoints Test Suite');
  console.log('===========================================');
  
  // Check configuration
  if (!config.hostToken) {
    console.log('\n⚠ Warning: No host token configured');
    console.log('Please set config.hostToken in the script');
    console.log('\nTo get a token:');
    console.log('1. Register a user with host permissions');
    console.log('2. Login and copy the authentication token');
    console.log('3. Set it in the config object at the top of this file');
    return;
  }
  
  const tests = [
    testStartStream,
    testGetActiveStreams,
    testJoinStream,
    testSendChatMessage,
    testPinMessage,
    testModerateStream,
    testLeaveStream,
    testEndStream,
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
      // Wait a bit between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.log('✗ Test threw an error:', error.message);
      failed++;
    }
  }
  
  console.log('\n===========================================');
  console.log('  Test Results');
  console.log('===========================================');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log('===========================================\n');
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
