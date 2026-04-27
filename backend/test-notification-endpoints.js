const axios = require('axios');
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Notification = require('./src/models/Notification');

const BASE_URL = 'http://localhost:3000/api';
let authToken = '';
let testUserId = '';
let testNotificationId = '';

async function setupTestUser() {
  // Create a test user
  const testUser = new User({
    phoneNumber: '+1234567890',
    displayName: 'TestUser',
    email: 'test@example.com',
    passwordHash: 'hashedpassword',
    notificationPrefs: {
      streamStart: true,
      gifts: true,
      followers: true,
      messages: true,
    },
  });
  
  await testUser.save();
  testUserId = testUser._id.toString();
  
  // Login to get auth token
  const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
    phoneNumber: '+1234567890',
    password: 'password123',
  });
  
  authToken = loginResponse.data.token;
  console.log('Test user created and logged in:', testUserId);
}

async function testNotificationEndpoints() {
  console.log('\n=== Testing Notification Endpoints ===\n');
  
  const headers = {
    Authorization: `Bearer ${authToken}`,
  };

  try {
    // 1. Test GET /api/notifications/:userId
    console.log('1. Testing GET /api/notifications/:userId');
    const getResponse = await axios.get(`${BASE_URL}/notifications/${testUserId}`, { headers });
    console.log('✓ GET notifications successful:', getResponse.data.notifications.length, 'notifications');
    
    // 2. Test creating a notification
    console.log('\n2. Creating a test notification');
    const testNotification = new Notification({
      userId: testUserId,
      type: 'system',
      title: 'Test Notification',
      message: 'This is a test notification',
      data: { test: true },
    });
    await testNotification.save();
    testNotificationId = testNotification._id.toString();
    console.log('✓ Test notification created:', testNotificationId);
    
    // 3. Test PUT /api/notifications/:notificationId/read
    console.log('\n3. Testing PUT /api/notifications/:notificationId/read');
    const markReadResponse = await axios.put(
      `${BASE_URL}/notifications/${testNotificationId}/read`,
      {},
      { headers }
    );
    console.log('✓ Mark notification as read successful:', markReadResponse.data.message);
    
    // 4. Test PUT /api/notifications/:userId/read-all
    console.log('\n4. Testing PUT /api/notifications/:userId/read-all');
    const markAllReadResponse = await axios.put(
      `${BASE_URL}/notifications/${testUserId}/read-all`,
      {},
      { headers }
    );
    console.log('✓ Mark all notifications as read successful:', markAllReadResponse.data.message);
    
    // 5. Test GET /api/users/:userId/notification-preferences
    console.log('\n5. Testing GET /api/users/:userId/notification-preferences');
    const getPrefsResponse = await axios.get(
      `${BASE_URL}/users/${testUserId}/notification-preferences`,
      { headers }
    );
    console.log('✓ Get notification preferences successful:', getPrefsResponse.data.preferences);
    
    // 6. Test PUT /api/users/:userId/notification-preferences
    console.log('\n6. Testing PUT /api/users/:userId/notification-preferences');
    const updatePrefsResponse = await axios.put(
      `${BASE_URL}/users/${testUserId}/notification-preferences`,
      {
        streamStart: false,
        gifts: true,
        followers: false,
        messages: true,
      },
      { headers }
    );
    console.log('✓ Update notification preferences successful:', updatePrefsResponse.data.preferences);
    
    // 7. Test POST /api/users/:userId/fcm-token
    console.log('\n7. Testing POST /api/users/:userId/fcm-token');
    const registerFCMResponse = await axios.post(
      `${BASE_URL}/users/${testUserId}/fcm-token`,
      {
        fcmToken: 'test-fcm-token-12345',
      },
      { headers }
    );
    console.log('✓ Register FCM token successful:', registerFCMResponse.data.message);
    
    // 8. Test DELETE /api/users/:userId/fcm-token
    console.log('\n8. Testing DELETE /api/users/:userId/fcm-token');
    const unregisterFCMResponse = await axios.delete(
      `${BASE_URL}/users/${testUserId}/fcm-token`,
      { headers }
    );
    console.log('✓ Unregister FCM token successful:', unregisterFCMResponse.data.message);
    
    console.log('\n=== All notification endpoint tests passed! ===\n');
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

async function cleanup() {
  // Clean up test data
  await User.deleteOne({ _id: testUserId });
  await Notification.deleteMany({ userId: testUserId });
  console.log('Test data cleaned up');
}

async function runTests() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/social-streaming', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');
    
    await setupTestUser();
    await testNotificationEndpoints();
    await cleanup();
    
    process.exit(0);
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
}

runTests();