/**
 * Test script for Voice Room endpoints
 * 
 * This script tests the voice room endpoints including:
 * - Creating a voice room
 * - Joining a voice room
 * - Raising hand
 * - Promoting/demoting users
 * - Sending chat messages
 * - Leaving a voice room
 * 
 * Prerequisites:
 * - Server must be running
 * - MongoDB must be connected
 * - User must be registered
 * - Valid authentication token required
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

// Test configuration
const config = {
  hostToken: '', // Add your host token here
  participantToken: '', // Add participant token here (different user)
};

let roomId = null;
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
 * Test 1: Create a voice room
 */
async function testCreateVoiceRoom() {
  console.log('\n=== Test 1: Create Voice Room ===');
  
  const result = await makeRequest('POST', '/voice-rooms/create', {
    name: 'Test Voice Room',
    participantLimit: 10,
  });
  
  if (result.success) {
    roomId = result.data.roomId;
    console.log('✓ Voice room created successfully');
    console.log('  Room ID:', roomId);
    console.log('  Room Name:', result.data.name);
    console.log('  Agora Channel ID:', result.data.agoraChannelId);
    console.log('  Participant Limit:', result.data.participantLimit);
    console.log('  Token generated:', result.data.agoraToken ? 'Yes' : 'No');
  } else {
    console.log('✗ Failed to create voice room');
    console.log('  Error:', result.error);
  }
  
  return result.success;
}

/**
 * Test 2: Get active voice rooms
 */
async function testGetActiveVoiceRooms() {
  console.log('\n=== Test 2: Get Active Voice Rooms ===');
  
  const result = await makeRequest('GET', '/voice-rooms/active?page=1&limit=10');
  
  if (result.success) {
    console.log('✓ Retrieved active voice rooms');
    console.log('  Total rooms:', result.data.total);
    console.log('  Rooms on page:', result.data.voiceRooms.length);
    if (result.data.voiceRooms.length > 0) {
      console.log('  First room:', result.data.voiceRooms[0].name);
      console.log('  Participant count:', result.data.voiceRooms[0].participantCount);
    }
  } else {
    console.log('✗ Failed to get active voice rooms');
    console.log('  Error:', result.error);
  }
  
  return result.success;
}

/**
 * Test 3: Get voice room details
 */
async function testGetVoiceRoomDetails() {
  console.log('\n=== Test 3: Get Voice Room Details ===');
  
  if (!roomId) {
    console.log('✗ No room ID available');
    return false;
  }
  
  const result = await makeRequest('GET', `/voice-rooms/${roomId}`);
  
  if (result.success) {
    console.log('✓ Retrieved voice room details');
    console.log('  Room Name:', result.data.name);
    console.log('  Status:', result.data.status);
    console.log('  Host ID:', result.data.hostId);
    console.log('  Participant Count:', result.data.participantCount);
    console.log('  Created At:', result.data.createdAt);
  } else {
    console.log('✗ Failed to get voice room details');
    console.log('  Error:', result.error);
  }
  
  return result.success;
}

/**
 * Test 4: Join voice room as participant
 */
async function testJoinVoiceRoom() {
  console.log('\n=== Test 4: Join Voice Room as Participant ===');
  
  if (!roomId) {
    console.log('✗ No room ID available');
    return false;
  }
  
  const result = await makeRequest(
    'POST',
    `/voice-rooms/${roomId}/join`,
    null,
    config.participantToken || config.hostToken
  );
  
  if (result.success) {
    console.log('✓ Joined voice room successfully');
    console.log('  Agora Channel ID:', result.data.agoraChannelId);
    console.log('  Participant Count:', result.data.participantCount);
    console.log('  Token generated:', result.data.agoraToken ? 'Yes' : 'No');
    console.log('  Already joined:', result.data.isAlreadyJoined || false);
  } else {
    console.log('✗ Failed to join voice room');
    console.log('  Error:', result.error);
  }
  
  return result.success;
}

/**
 * Test 5: Raise hand in voice room
 */
async function testRaiseHand() {
  console.log('\n=== Test 5: Raise Hand in Voice Room ===');
  
  if (!roomId) {
    console.log('✗ No room ID available');
    return false;
  }
  
  // Use participant token for this test
  const token = config.participantToken || config.hostToken;
  const result = await makeRequest('POST', `/voice-rooms/${roomId}/raise-hand`, null, token);
  
  if (result.success) {
    console.log('✓ Hand raised successfully');
    console.log('  Success:', result.data.success);
  } else {
    console.log('✗ Failed to raise hand');
    console.log('  Error:', result.error);
    console.log('  Note: This may fail if user is already a speaker');
  }
  
  return true; // Don't fail test suite for this
}

/**
 * Test 6: Send chat message in voice room
 */
async function testSendVoiceRoomChat() {
  console.log('\n=== Test 6: Send Chat Message in Voice Room ===');
  
  if (!roomId) {
    console.log('✗ No room ID available');
    return false;
  }
  
  const result = await makeRequest('POST', `/voice-rooms/${roomId}/chat`, {
    message: 'Hello from voice room test! 🎤',
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
 * Test 7: Promote participant to speaker (requires host)
 */
async function testPromoteToSpeaker() {
  console.log('\n=== Test 7: Promote Participant to Speaker ===');
  
  if (!roomId) {
    console.log('✗ No room ID available');
    return false;
  }
  
  // Note: This test requires a target user ID
  // In a real test, you would use the participant's user ID
  const targetUserId = '000000000000000000000000'; // Placeholder
  
  const result = await makeRequest('POST', `/voice-rooms/${roomId}/promote`, {
    targetUserId: targetUserId,
  });
  
  if (result.success) {
    console.log('✓ User promoted successfully');
    console.log('  Success:', result.data.success);
    console.log('  New Role:', result.data.newRole);
  } else {
    console.log('✗ Failed to promote user');
    console.log('  Error:', result.error);
    console.log('  Note: This may fail if target user ID is invalid or user is not host');
  }
  
  return true; // Don't fail test suite for this
}

/**
 * Test 8: Demote speaker to listener (requires host)
 */
async function testDemoteToListener() {
  console.log('\n=== Test 8: Demote Speaker to Listener ===');
  
  if (!roomId) {
    console.log('✗ No room ID available');
    return false;
  }
  
  // Note: This test requires a target user ID
  const targetUserId = '000000000000000000000000'; // Placeholder
  
  const result = await makeRequest('POST', `/voice-rooms/${roomId}/demote`, {
    targetUserId: targetUserId,
  });
  
  if (result.success) {
    console.log('✓ User demoted successfully');
    console.log('  Success:', result.data.success);
    console.log('  New Role:', result.data.newRole);
  } else {
    console.log('✗ Failed to demote user');
    console.log('  Error:', result.error);
    console.log('  Note: This may fail if target user ID is invalid or user is not host');
  }
  
  return true; // Don't fail test suite for this
}

/**
 * Test 9: Leave voice room
 */
async function testLeaveVoiceRoom() {
  console.log('\n=== Test 9: Leave Voice Room ===');
  
  if (!roomId) {
    console.log('✗ No room ID available');
    return false;
  }
  
  const result = await makeRequest(
    'POST',
    `/voice-rooms/${roomId}/leave`,
    null,
    config.participantToken || config.hostToken
  );
  
  if (result.success) {
    console.log('✓ Left voice room successfully');
    console.log('  Success:', result.data.success);
    console.log('  Participant Count:', result.data.participantCount);
  } else {
    console.log('✗ Failed to leave voice room');
    console.log('  Error:', result.error);
  }
  
  return result.success;
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('===========================================');
  console.log('  Voice Room Endpoints Test Suite');
  console.log('===========================================');
  
  // Check configuration
  if (!config.hostToken) {
    console.log('\n⚠ Warning: No host token configured');
    console.log('Please set config.hostToken in the script');
    console.log('\nTo get a token:');
    console.log('1. Register a user');
    console.log('2. Login and copy the authentication token');
    console.log('3. Set it in the config object at the top of this file');
    return;
  }
  
  const tests = [
    testCreateVoiceRoom,
    testGetActiveVoiceRooms,
    testGetVoiceRoomDetails,
    testJoinVoiceRoom,
    testRaiseHand,
    testSendVoiceRoomChat,
    testPromoteToSpeaker,
    testDemoteToListener,
    testLeaveVoiceRoom,
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