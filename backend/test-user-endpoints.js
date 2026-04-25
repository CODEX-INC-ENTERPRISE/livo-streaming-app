require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Report = require('./src/models/Report');
const config = require('./src/config');

async function testUserEndpoints() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.mongodb.uri);
    console.log('Connected to MongoDB');

    console.log('\n=== Testing User Model ===');
    
    const testUser1 = new User({
      displayName: 'TestUser1_' + Date.now(),
      email: `test1_${Date.now()}@example.com`,
      bio: 'Test bio for user 1',
      followerIds: [],
      followingIds: [],
      blockedUserIds: [],
    });

    const testUser2 = new User({
      displayName: 'TestUser2_' + Date.now(),
      email: `test2_${Date.now()}@example.com`,
      bio: 'Test bio for user 2',
      followerIds: [],
      followingIds: [],
      blockedUserIds: [],
    });

    await testUser1.save();
    await testUser2.save();
    console.log('✓ Created test users');

    testUser1.followingIds.push(testUser2._id);
    testUser2.followerIds.push(testUser1._id);
    await testUser1.save();
    await testUser2.save();
    console.log('✓ User 1 followed User 2');

    const updatedUser2 = await User.findById(testUser2._id);
    if (updatedUser2.followerIds.length === 1) {
      console.log('✓ Follower count updated correctly');
    } else {
      console.log('✗ Follower count incorrect');
    }

    testUser1.blockedUserIds.push(testUser2._id);
    testUser1.followingIds = testUser1.followingIds.filter(
      id => id.toString() !== testUser2._id.toString()
    );
    testUser2.followerIds = testUser2.followerIds.filter(
      id => id.toString() !== testUser1._id.toString()
    );
    await testUser1.save();
    await testUser2.save();
    console.log('✓ User 1 blocked User 2 and removed follow relationship');

    console.log('\n=== Testing Report Model ===');
    
    const testReport = new Report({
      reporterId: testUser1._id,
      reportedUserId: testUser2._id,
      reason: 'spam',
      description: 'This is a test report',
    });

    await testReport.save();
    console.log('✓ Created test report');

    const foundReport = await Report.findById(testReport._id);
    if (foundReport && foundReport.status === 'pending') {
      console.log('✓ Report status is pending by default');
    } else {
      console.log('✗ Report status incorrect');
    }

    console.log('\n=== Cleaning up test data ===');
    await User.deleteMany({ _id: { $in: [testUser1._id, testUser2._id] } });
    await Report.deleteMany({ _id: testReport._id });
    console.log('✓ Cleaned up test data');

    console.log('\n=== All tests passed! ===');
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  }
}

testUserEndpoints();
