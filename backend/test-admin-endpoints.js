const request = require('supertest');
const mongoose = require('mongoose');
const app = require('./src/app');
const User = require('./src/models/User');
const Transaction = require('./src/models/Transaction');
const Report = require('./src/models/Report');
const Stream = require('./src/models/Stream');
const ChatMessage = require('./src/models/ChatMessage');
const WithdrawalRequest = require('./src/models/WithdrawalRequest');

// Test data
let adminToken;
let adminUser;
let regularUser;
let regularUser2;

describe('Admin User Management Endpoints', () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test_social_streaming', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Create admin user
    adminUser = new User({
      displayName: 'AdminUser',
      email: 'admin@test.com',
      phoneNumber: '+1234567890',
      isAdmin: true,
      isHost: false,
      isBlocked: false,
    });
    await adminUser.save();

    // Create regular users
    regularUser = new User({
      displayName: 'RegularUser1',
      email: 'regular1@test.com',
      phoneNumber: '+1234567891',
      isAdmin: false,
      isHost: true,
      isBlocked: false,
    });
    await regularUser.save();

    regularUser2 = new User({
      displayName: 'RegularUser2',
      email: 'regular2@test.com',
      phoneNumber: '+1234567892',
      isAdmin: false,
      isHost: false,
      isBlocked: true,
    });
    await regularUser2.save();

    // Create test transactions
    const transaction1 = new Transaction({
      userId: regularUser._id,
      type: 'coinPurchase',
      amount: 100,
      currency: 'coins',
      description: 'Test purchase',
    });
    await transaction1.save();

    const transaction2 = new Transaction({
      userId: regularUser._id,
      type: 'giftSent',
      amount: 50,
      currency: 'coins',
      description: 'Test gift',
    });
    await transaction2.save();

    // Create test reports
    const report1 = new Report({
      reporterId: regularUser._id,
      reportedUserId: regularUser2._id,
      reason: 'spam',
      description: 'Test report',
    });
    await report1.save();

    const report2 = new Report({
      reporterId: regularUser2._id,
      reportedUserId: regularUser._id,
      reason: 'harassment',
      description: 'Test report 2',
    });
    await report2.save();

    // Create test stream
    const stream = new Stream({
      hostId: regularUser._id,
      title: 'Test Stream',
      status: 'ended',
      peakViewerCount: 10,
      totalGiftsReceived: 5,
    });
    await stream.save();

    // Generate admin token (simplified for testing)
    adminToken = 'admin-test-token';
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  describe('GET /api/admin/users', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer regular-token`);
      
      expect(response.status).toBe(403);
    });

    it('should return paginated user list for admin', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 20);
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    it('should support search functionality', async () => {
      const response = await request(app)
        .get('/api/admin/users?search=RegularUser1')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.users.length).toBe(1);
      expect(response.body.users[0].displayName).toBe('RegularUser1');
    });

    it('should filter by status (blocked)', async () => {
      const response = await request(app)
        .get('/api/admin/users?status=blocked')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.users.length).toBe(1);
      expect(response.body.users[0].isBlocked).toBe(true);
    });

    it('should filter by host status', async () => {
      const response = await request(app)
        .get('/api/admin/users?isHost=true')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.users.length).toBe(1);
      expect(response.body.users[0].isHost).toBe(true);
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/admin/users?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.users.length).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
    });
  });

  describe('GET /api/admin/users/:userId', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get(`/api/admin/users/${regularUser._id}`)
        .set('Authorization', `Bearer regular-token`);
      
      expect(response.status).toBe(403);
    });

    it('should return user details for admin', async () => {
      const response = await request(app)
        .get(`/api/admin/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('displayName', 'RegularUser1');
      expect(response.body.user).toHaveProperty('email', 'regular1@test.com');
      expect(response.body.user).toHaveProperty('isHost', true);
      expect(response.body.user).toHaveProperty('isBlocked', false);
      expect(response.body.user).toHaveProperty('statistics');
      expect(response.body.user.statistics).toHaveProperty('transactionCount', 2);
      expect(response.body.user.statistics).toHaveProperty('reportCount', 2);
      expect(response.body.user.statistics).toHaveProperty('streamCount', 1);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/admin/users/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/admin/users/:userId', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${regularUser._id}`)
        .set('Authorization', `Bearer regular-token`)
        .send({ displayName: 'UpdatedName' });
      
      expect(response.status).toBe(403);
    });

    it('should update user display name', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ displayName: 'UpdatedDisplayName' });
      
      expect(response.status).toBe(200);
      expect(response.body.user.displayName).toBe('UpdatedDisplayName');
    });

    it('should block a user', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isBlocked: true });
      
      expect(response.status).toBe(200);
      expect(response.body.user.isBlocked).toBe(true);
    });

    it('should update user email', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'updated@test.com' });
      
      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('updated@test.com');
    });

    it('should validate display name uniqueness', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ displayName: 'AdminUser' }); // Already taken by admin user
      
      expect(response.status).toBe(400);
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'invalid-email' });
      
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/admin/users/:userId/activity', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get(`/api/admin/users/${regularUser._id}/activity`)
        .set('Authorization', `Bearer regular-token`);
      
      expect(response.status).toBe(403);
    });

    it('should return user activity logs', async () => {
      const response = await request(app)
        .get(`/api/admin/users/${regularUser._id}/activity`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('activityLogs');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body).toHaveProperty('summary');
      expect(response.body.summary).toHaveProperty('transactionCount', 2);
      expect(response.body.summary).toHaveProperty('reportCount', 2);
      expect(response.body.summary).toHaveProperty('streamCount', 1);
      
      // Should have activity logs
      expect(response.body.activityLogs.length).toBeGreaterThan(0);
      
      // Should have different types of activities
      const activityTypes = response.body.activityLogs.map(log => log.type);
      expect(activityTypes).toContain('transaction');
      expect(activityTypes).toContain('report');
      expect(activityTypes).toContain('stream');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/admin/users/${regularUser._id}/activity?page=1&limit=2`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.activityLogs.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.limit).toBe(2);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/admin/users/507f1f77bcf86cd799439011/activity')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(404);
    });
  });
});

describe('Admin Stream Monitoring Endpoints', () => {
  let activeStream;
  let endedStream;
  let hostUser;

  beforeAll(async () => {
    // Create a host user for stream testing
    hostUser = new User({
      displayName: 'StreamHost',
      email: 'host@test.com',
      phoneNumber: '+1234567893',
      isAdmin: false,
      isHost: true,
      isBlocked: false,
    });
    await hostUser.save();

    // Create active stream
    activeStream = new Stream({
      hostId: hostUser._id,
      title: 'Active Test Stream',
      status: 'active',
      startedAt: new Date(Date.now() - 3600000), // 1 hour ago
      peakViewerCount: 50,
      totalGiftsReceived: 25,
      currentViewerIds: [regularUser._id, regularUser2._id],
      mutedUserIds: [regularUser2._id],
      kickedUserIds: [],
      moderatorIds: [],
      agoraChannelId: 'test-channel-123',
    });
    await activeStream.save();

    // Create ended stream
    endedStream = new Stream({
      hostId: hostUser._id,
      title: 'Ended Test Stream',
      status: 'ended',
      startedAt: new Date(Date.now() - 7200000), // 2 hours ago
      endedAt: new Date(Date.now() - 3600000), // 1 hour ago
      peakViewerCount: 100,
      totalGiftsReceived: 50,
      currentViewerIds: [],
      mutedUserIds: [],
      kickedUserIds: [],
      moderatorIds: [],
      agoraChannelId: 'test-channel-456',
    });
    await endedStream.save();

    // Create chat messages for the active stream
    const chatMessage1 = new ChatMessage({
      streamId: activeStream._id,
      senderId: regularUser._id,
      message: 'Test chat message 1',
      timestamp: new Date(),
    });
    await chatMessage1.save();

    const chatMessage2 = new ChatMessage({
      streamId: activeStream._id,
      senderId: regularUser2._id,
      message: 'Test chat message 2',
      timestamp: new Date(),
    });
    await chatMessage2.save();
  });

  describe('GET /api/admin/streams', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/streams')
        .set('Authorization', `Bearer regular-token`);
      
      expect(response.status).toBe(403);
    });

    it('should return all streams for admin', async () => {
      const response = await request(app)
        .get('/api/admin/streams')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('streams');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.streams.length).toBeGreaterThanOrEqual(2); // active + ended + previous test stream
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 20);
    });

    it('should filter by status (active)', async () => {
      const response = await request(app)
        .get('/api/admin/streams?status=active')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.streams.length).toBe(1);
      expect(response.body.streams[0].status).toBe('active');
      expect(response.body.streams[0].title).toBe('Active Test Stream');
    });

    it('should filter by status (ended)', async () => {
      const response = await request(app)
        .get('/api/admin/streams?status=ended')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.streams.length).toBeGreaterThanOrEqual(1);
      expect(response.body.streams[0].status).toBe('ended');
    });

    it('should support search functionality', async () => {
      const response = await request(app)
        .get('/api/admin/streams?search=Active')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.streams.length).toBe(1);
      expect(response.body.streams[0].title).toContain('Active');
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/admin/streams?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.streams.length).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
    });

    it('should include host information in response', async () => {
      const response = await request(app)
        .get('/api/admin/streams?status=active')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.streams[0]).toHaveProperty('hostName');
      expect(response.body.streams[0].hostName).toBe('StreamHost');
      expect(response.body.streams[0]).toHaveProperty('currentViewerCount', 2);
      expect(response.body.streams[0]).toHaveProperty('peakViewerCount', 50);
      expect(response.body.streams[0]).toHaveProperty('totalGiftsReceived', 25);
    });
  });

  describe('GET /api/admin/streams/:streamId', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get(`/api/admin/streams/${activeStream._id}`)
        .set('Authorization', `Bearer regular-token`);
      
      expect(response.status).toBe(403);
    });

    it('should return stream details for admin', async () => {
      const response = await request(app)
        .get(`/api/admin/streams/${activeStream._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('stream');
      expect(response.body.stream).toHaveProperty('id');
      expect(response.body.stream).toHaveProperty('title', 'Active Test Stream');
      expect(response.body.stream).toHaveProperty('status', 'active');
      expect(response.body.stream).toHaveProperty('host');
      expect(response.body.stream.host).toHaveProperty('displayName', 'StreamHost');
      expect(response.body.stream).toHaveProperty('statistics');
      expect(response.body.stream.statistics).toHaveProperty('currentViewerCount', 2);
      expect(response.body.stream.statistics).toHaveProperty('mutedUserCount', 1);
      expect(response.body.stream.statistics).toHaveProperty('chatMessageCount', 2);
      expect(response.body.stream).toHaveProperty('viewers');
      expect(response.body.stream.viewers.length).toBe(2);
      expect(response.body.stream).toHaveProperty('mutedUsers');
      expect(response.body.stream.mutedUsers.length).toBe(1);
    });

    it('should return 404 for non-existent stream', async () => {
      const response = await request(app)
        .get('/api/admin/streams/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/admin/streams/:streamId/terminate', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .post(`/api/admin/streams/${activeStream._id}/terminate`)
        .set('Authorization', `Bearer regular-token`);
      
      expect(response.status).toBe(403);
    });

    it('should terminate an active stream', async () => {
      const response = await request(app)
        .post(`/api/admin/streams/${activeStream._id}/terminate`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Stream terminated successfully');
      expect(response.body).toHaveProperty('statistics');
      expect(response.body.statistics).toHaveProperty('streamId');
      expect(response.body.statistics).toHaveProperty('viewerCountAtTermination', 2);

      // Verify stream status was updated
      const updatedStream = await Stream.findById(activeStream._id);
      expect(updatedStream.status).toBe('terminated');
      expect(updatedStream.endedAt).toBeDefined();
    });

    it('should return error for already ended stream', async () => {
      const response = await request(app)
        .post(`/api/admin/streams/${endedStream._id}/terminate`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Stream is not active');
    });

    it('should return 404 for non-existent stream', async () => {
      const response = await request(app)
        .post('/api/admin/streams/507f1f77bcf86cd799439011/terminate')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/admin/streams/:streamId/flag', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .post(`/api/admin/streams/${endedStream._id}/flag`)
        .set('Authorization', `Bearer regular-token`)
        .send({ reason: 'Test flag reason' });
      
      expect(response.status).toBe(403);
    });

    it('should flag a stream for review', async () => {
      const reason = 'Inappropriate content';
      const notes = 'Needs further review by moderation team';
      
      const response = await request(app)
        .post(`/api/admin/streams/${endedStream._id}/flag`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason, notes });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Stream flagged successfully for review');
      expect(response.body).toHaveProperty('flagRecord');
      expect(response.body.flagRecord).toHaveProperty('streamId');
      expect(response.body.flagRecord).toHaveProperty('streamTitle', 'Ended Test Stream');
      expect(response.body.flagRecord).toHaveProperty('reason', reason);
      expect(response.body.flagRecord).toHaveProperty('status', 'pending_review');
      expect(response.body.flagRecord).toHaveProperty('flaggedAt');

      // Verify stream was flagged
      const updatedStream = await Stream.findById(endedStream._id);
      expect(updatedStream.flagged).toBe(true);
      expect(updatedStream.flagReason).toBe(reason);
      expect(updatedStream.flagNotes).toBe(notes);
      expect(updatedStream.flagStatus).toBe('pending_review');
      expect(updatedStream.flaggedBy.toString()).toBe(adminUser._id.toString());
    });

    it('should require a reason for flagging', async () => {
      const response = await request(app)
        .post(`/api/admin/streams/${endedStream._id}/flag`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({}); // No reason provided
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Reason is required');
    });

    it('should return 404 for non-existent stream', async () => {
      const response = await request(app)
        .post('/api/admin/streams/507f1f77bcf86cd799439011/flag')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Test reason' });
      
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/admin/streams/flagged', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/streams/flagged')
        .set('Authorization', `Bearer regular-token`);
      
      expect(response.status).toBe(403);
    });

    it('should return flagged streams for admin', async () => {
      const response = await request(app)
        .get('/api/admin/streams/flagged')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('streams');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.streams.length).toBeGreaterThanOrEqual(1);
      expect(response.body.streams[0]).toHaveProperty('flagged', true);
      expect(response.body.streams[0]).toHaveProperty('flagReason');
      expect(response.body.streams[0]).toHaveProperty('flagStatus', 'pending_review');
      expect(response.body.streams[0]).toHaveProperty('flaggedBy');
    });

    it('should filter flagged streams by status', async () => {
      const response = await request(app)
        .get('/api/admin/streams/flagged?status=pending_review')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.streams.length).toBeGreaterThanOrEqual(1);
      expect(response.body.streams[0].flagStatus).toBe('pending_review');
    });

    it('should support pagination for flagged streams', async () => {
      const response = await request(app)
        .get('/api/admin/streams/flagged?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.streams.length).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
    });
  });
});

describe('Admin Financial Tracking Endpoints', () => {
  let withdrawalRequest;
  let hostWithTransactions;
  let diamondTransaction1;
  let diamondTransaction2;
  let coinPurchaseTransaction;

  beforeAll(async () => {
    // Create a host user for diamond testing
    hostWithTransactions = new User({
      displayName: 'DiamondHost',
      email: 'diamond@test.com',
      phoneNumber: '+1234567894',
      isAdmin: false,
      isHost: true,
      isBlocked: false,
    });
    await hostWithTransactions.save();

    // Create diamond transactions for the host
    diamondTransaction1 = new Transaction({
      userId: hostWithTransactions._id,
      type: 'giftReceived',
      amount: 500,
      currency: 'diamonds',
      description: 'Received gift worth 500 diamonds',
      timestamp: new Date(Date.now() - 86400000), // 1 day ago
    });
    await diamondTransaction1.save();

    diamondTransaction2 = new Transaction({
      userId: hostWithTransactions._id,
      type: 'commission',
      amount: 250,
      currency: 'diamonds',
      description: 'Commission from host earnings',
      timestamp: new Date(Date.now() - 43200000), // 12 hours ago
    });
    await diamondTransaction2.save();

    // Create coin purchase transaction
    coinPurchaseTransaction = new Transaction({
      userId: regularUser._id,
      type: 'coinPurchase',
      amount: 1000,
      currency: 'coins',
      description: 'Purchased 1000 coins',
      timestamp: new Date(Date.now() - 172800000), // 2 days ago
    });
    await coinPurchaseTransaction.save();

    // Create withdrawal request
    withdrawalRequest = new WithdrawalRequest({
      userId: hostWithTransactions._id,
      diamondAmount: 750,
      creditAmount: 75.00,
      status: 'pending',
      requestedAt: new Date(),
      paymentMethod: 'bank_transfer',
    });
    await withdrawalRequest.save();
  });

  describe('GET /api/admin/analytics/revenue', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/revenue')
        .set('Authorization', `Bearer regular-token`);
      
      expect(response.status).toBe(403);
    });

    it('should return revenue analytics for admin', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/revenue')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('totalRevenue');
      expect(response.body.data).toHaveProperty('period', 'monthly');
      expect(response.body.data).toHaveProperty('breakdown');
      expect(response.body.data).toHaveProperty('transactionCount');
      expect(response.body.data).toHaveProperty('dateRange');
      
      // Should have at least 1 coin purchase transaction
      expect(response.body.data.transactionCount).toBeGreaterThanOrEqual(1);
      expect(response.body.data.totalRevenue).toBeGreaterThanOrEqual(1000); // 1000 coins from test
    });

    it('should support daily breakdown', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/revenue?period=daily')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.period).toBe('daily');
      expect(response.body.data.breakdown).toBeInstanceOf(Array);
    });

    it('should support weekly breakdown', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/revenue?period=weekly')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.period).toBe('weekly');
      expect(response.body.data.breakdown).toBeInstanceOf(Array);
    });

    it('should filter by date range', async () => {
      const startDate = new Date(Date.now() - 2592000000).toISOString().split('T')[0]; // 30 days ago
      const endDate = new Date().toISOString().split('T')[0]; // Today
      
      const response = await request(app)
        .get(`/api/admin/analytics/revenue?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.dateRange.start).toBe(startDate);
      expect(response.body.data.dateRange.end).toBe(endDate);
    });
  });

  describe('GET /api/admin/analytics/diamonds', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/diamonds')
        .set('Authorization', `Bearer regular-token`);
      
      expect(response.status).toBe(403);
    });

    it('should return diamonds analytics for admin', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/diamonds')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('totalDiamonds');
      expect(response.body.data).toHaveProperty('transactionCount');
      expect(response.body.data).toHaveProperty('breakdown');
      expect(response.body.data).toHaveProperty('topHosts');
      expect(response.body.data).toHaveProperty('dateRange');
      
      // Should have at least 2 diamond transactions (500 + 250)
      expect(response.body.data.transactionCount).toBeGreaterThanOrEqual(2);
      expect(response.body.data.totalDiamonds).toBeGreaterThanOrEqual(750);
    });

    it('should group diamonds by host', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/diamonds?groupBy=host')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.breakdown).toBeInstanceOf(Array);
      expect(response.body.data.breakdown.length).toBeGreaterThan(0);
      
      // Should have breakdown by host with displayName
      const hostBreakdown = response.body.data.breakdown[0];
      expect(hostBreakdown).toHaveProperty('displayName');
      expect(hostBreakdown).toHaveProperty('totalDiamonds');
      expect(hostBreakdown).toHaveProperty('transactionCount');
      expect(hostBreakdown).toHaveProperty('breakdown');
      expect(hostBreakdown.breakdown).toHaveProperty('giftReceived');
      expect(hostBreakdown.breakdown).toHaveProperty('commission');
    });

    it('should group diamonds by transaction type', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/diamonds?groupBy=type')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.breakdown).toBeInstanceOf(Array);
      
      // Should have breakdown by transaction type
      const typeBreakdown = response.body.data.breakdown;
      const types = typeBreakdown.map(item => item.type);
      expect(types).toContain('giftReceived');
      expect(types).toContain('commission');
    });

    it('should filter by date range', async () => {
      const startDate = new Date(Date.now() - 2592000000).toISOString().split('T')[0]; // 30 days ago
      const endDate = new Date().toISOString().split('T')[0]; // Today
      
      const response = await request(app)
        .get(`/api/admin/analytics/diamonds?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.dateRange.start).toBe(startDate);
      expect(response.body.data.dateRange.end).toBe(endDate);
    });
  });

  describe('GET /api/admin/withdrawals', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/withdrawals')
        .set('Authorization', `Bearer regular-token`);
      
      expect(response.status).toBe(403);
    });

    it('should return withdrawals for admin', async () => {
      const response = await request(app)
        .get('/api/admin/withdrawals')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('withdrawals');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data.summary).toHaveProperty('totalWithdrawals');
      expect(response.body.data.summary).toHaveProperty('statusSummary');
      
      // Should have at least 1 withdrawal
      expect(response.body.data.withdrawals.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data.summary.totalWithdrawals).toBeGreaterThanOrEqual(1);
    });

    it('should filter withdrawals by status', async () => {
      const response = await request(app)
        .get('/api/admin/withdrawals?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.withdrawals.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data.withdrawals[0].status).toBe('pending');
    });

    it('should filter withdrawals by user ID', async () => {
      const response = await request(app)
        .get(`/api/admin/withdrawals?userId=${hostWithTransactions._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.withdrawals.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data.withdrawals[0].userId._id.toString()).toBe(hostWithTransactions._id.toString());
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/admin/withdrawals?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.withdrawals.length).toBe(1);
      expect(response.body.data.pagination.limit).toBe(1);
    });

    it('should include user details in response', async () => {
      const response = await request(app)
        .get('/api/admin/withdrawals')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.withdrawals[0]).toHaveProperty('userId');
      expect(response.body.data.withdrawals[0].userId).toHaveProperty('displayName');
      expect(response.body.data.withdrawals[0].userId).toHaveProperty('phoneNumber');
      expect(response.body.data.withdrawals[0].userId).toHaveProperty('email');
    });
  });

  describe('PUT /api/admin/withdrawals/:withdrawalId', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .put(`/api/admin/withdrawals/${withdrawalRequest._id}`)
        .set('Authorization', `Bearer regular-token`)
        .send({ status: 'approved' });
      
      expect(response.status).toBe(403);
    });

    it('should approve a withdrawal request', async () => {
      const response = await request(app)
        .put(`/api/admin/withdrawals/${withdrawalRequest._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          status: 'approved',
          notes: 'Approved for processing',
          paymentMethod: 'bank_transfer'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('withdrawal');
      expect(response.body.data).toHaveProperty('message', 'Withdrawal approved successfully');
      expect(response.body.data.withdrawal.status).toBe('approved');
      expect(response.body.data.withdrawal.processedBy.toString()).toBe(adminUser._id.toString());
      expect(response.body.data.withdrawal.notes).toBe('Approved for processing');
      expect(response.body.data.withdrawal.paymentMethod).toBe('bank_transfer');
    });

    it('should reject a withdrawal request', async () => {
      // Create another withdrawal request to reject
      const withdrawalToReject = new WithdrawalRequest({
        userId: hostWithTransactions._id,
        diamondAmount: 500,
        creditAmount: 50.00,
        status: 'pending',
        requestedAt: new Date(),
      });
      await withdrawalToReject.save();

      const response = await request(app)
        .put(`/api/admin/withdrawals/${withdrawalToReject._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          status: 'rejected',
          notes: 'Insufficient documentation'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data.withdrawal.status).toBe('rejected');
      expect(response.body.data.withdrawal.notes).toBe('Insufficient documentation');
    });

    it('should return error for invalid status', async () => {
      const response = await request(app)
        .put(`/api/admin/withdrawals/${withdrawalRequest._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'invalid_status' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid status');
    });

    it('should return error for completed withdrawal', async () => {
      // Create a completed withdrawal
      const completedWithdrawal = new WithdrawalRequest({
        userId: hostWithTransactions._id,
        diamondAmount: 100,
        creditAmount: 10.00,
        status: 'completed',
        requestedAt: new Date(),
        processedAt: new Date(),
        processedBy: adminUser._id,
      });
      await completedWithdrawal.save();

      const response = await request(app)
        .put(`/api/admin/withdrawals/${completedWithdrawal._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Cannot update a completed or rejected withdrawal');
    });

    it('should return 404 for non-existent withdrawal', async () => {
      const response = await request(app)
        .put('/api/admin/withdrawals/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' });
      
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/admin/transactions', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/transactions')
        .set('Authorization', `Bearer regular-token`);
      
      expect(response.status).toBe(403);
    });

    it('should return transactions for admin', async () => {
      const response = await request(app)
        .get('/api/admin/transactions')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('transactions');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('breakdown');
      expect(response.body.data).toHaveProperty('filters');
      
      // Should have multiple transactions
      expect(response.body.data.transactions.length).toBeGreaterThanOrEqual(3);
      expect(response.body.data.summary.transactionCount).toBeGreaterThanOrEqual(3);
    });

    it('should filter transactions by user ID', async () => {
      const response = await request(app)
        .get(`/api/admin/transactions?userId=${hostWithTransactions._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.transactions.length).toBeGreaterThanOrEqual(2);
      expect(response.body.data.transactions[0].userId._id.toString()).toBe(hostWithTransactions._id.toString());
    });

    it('should filter transactions by type', async () => {
      const response = await request(app)
        .get('/api/admin/transactions?type=coinPurchase')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.transactions.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data.transactions[0].type).toBe('coinPurchase');
    });

    it('should filter transactions by currency', async () => {
      const response = await request(app)
        .get('/api/admin/transactions?currency=diamonds')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.transactions.length).toBeGreaterThanOrEqual(2);
      expect(response.body.data.transactions[0].currency).toBe('diamonds');
    });

    it('should filter transactions by date range', async () => {
      const startDate = new Date(Date.now() - 2592000000).toISOString().split('T')[0]; // 30 days ago
      const endDate = new Date().toISOString().split('T')[0]; // Today
      
      const response = await request(app)
        .get(`/api/admin/transactions?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.filters.dateRange.start).toBe(startDate);
      expect(response.body.data.filters.dateRange.end).toBe(endDate);
    });

    it('should filter transactions by amount range', async () => {
      const response = await request(app)
        .get('/api/admin/transactions?minAmount=100&maxAmount=1000')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.filters.amountRange.min).toBe('100');
      expect(response.body.data.filters.amountRange.max).toBe('1000');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/admin/transactions?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.transactions.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination.limit).toBe(2);
    });

    it('should include user details in response', async () => {
      const response = await request(app)
        .get('/api/admin/transactions')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.transactions[0]).toHaveProperty('userId');
      expect(response.body.data.transactions[0].userId).toHaveProperty('displayName');
      expect(response.body.data.transactions[0].userId).toHaveProperty('isHost');
    });

    it('should provide breakdown by type and currency', async () => {
      const response = await request(app)
        .get('/api/admin/transactions')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.breakdown.byType).toBeInstanceOf(Array);
      expect(response.body.data.breakdown.byCurrency).toBeInstanceOf(Array);
      
      // Should have breakdown data
      expect(response.body.data.breakdown.byType.length).toBeGreaterThan(0);
      expect(response.body.data.breakdown.byCurrency.length).toBeGreaterThan(0);
    });
  });
});


describe('Admin Report Handling Endpoints', () => {
  let testReport1;
  let testReport2;
  let testReport3;

  beforeAll(async () => {
    // Create test reports
    testReport1 = new Report({
      reporterId: regularUser._id,
      reportedUserId: regularUser2._id,
      reason: 'spam',
      description: 'User is spamming messages',
      status: 'pending',
    });
    await testReport1.save();

    testReport2 = new Report({
      reporterId: regularUser2._id,
      reportedUserId: regularUser._id,
      reason: 'harassment',
      description: 'User is harassing others',
      status: 'under_review',
    });
    await testReport2.save();

    testReport3 = new Report({
      reporterId: regularUser._id,
      reportedUserId: regularUser2._id,
      reason: 'inappropriate_content',
      description: 'User posted inappropriate content',
      status: 'resolved',
      resolvedBy: adminUser._id,
      resolvedAt: new Date(Date.now() - 86400000), // 1 day ago
      resolutionNotes: 'Warning issued',
    });
    await testReport3.save();
  });

  describe('GET /api/admin/reports', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer regular-token`);
      
      expect(response.status).toBe(403);
    });

    it('should return paginated reports for admin', async () => {
      const response = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('reports');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 20);
      expect(response.body.reports.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter reports by status', async () => {
      const response = await request(app)
        .get('/api/admin/reports?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.reports.length).toBeGreaterThanOrEqual(1);
      expect(response.body.reports[0].status).toBe('pending');
    });

    it('should filter reports by reporter ID', async () => {
      const response = await request(app)
        .get(`/api/admin/reports?reporterId=${regularUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.reports.length).toBeGreaterThanOrEqual(2);
      expect(response.body.reports[0].reporter.id.toString()).toBe(regularUser._id.toString());
    });

    it('should filter reports by reported user ID', async () => {
      const response = await request(app)
        .get(`/api/admin/reports?reportedUserId=${regularUser2._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.reports.length).toBeGreaterThanOrEqual(2);
      expect(response.body.reports[0].reportedUser.id.toString()).toBe(regularUser2._id.toString());
    });

    it('should filter reports by reason', async () => {
      const response = await request(app)
        .get('/api/admin/reports?reason=spam')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.reports.length).toBeGreaterThanOrEqual(1);
      expect(response.body.reports[0].reason).toBe('spam');
    });

    it('should filter reports by date range', async () => {
      const startDate = new Date(Date.now() - 2592000000).toISOString().split('T')[0]; // 30 days ago
      const endDate = new Date().toISOString().split('T')[0]; // Today
      
      const response = await request(app)
        .get(`/api/admin/reports?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.reports.length).toBeGreaterThanOrEqual(3);
    });

    it('should include populated user data in response', async () => {
      const response = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.reports[0]).toHaveProperty('reporter');
      expect(response.body.reports[0].reporter).toHaveProperty('displayName');
      expect(response.body.reports[0].reporter).toHaveProperty('email');
      expect(response.body.reports[0].reporter).toHaveProperty('profilePictureUrl');
      expect(response.body.reports[0]).toHaveProperty('reportedUser');
      expect(response.body.reports[0].reportedUser).toHaveProperty('displayName');
      expect(response.body.reports[0].reportedUser).toHaveProperty('email');
      expect(response.body.reports[0].reportedUser).toHaveProperty('userStatus');
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/admin/reports?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.reports.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.limit).toBe(2);
    });
  });

  describe('GET /api/admin/reports/:reportId', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get(`/api/admin/reports/${testReport1._id}`)
        .set('Authorization', `Bearer regular-token`);
      
      expect(response.status).toBe(403);
    });

    it('should return report details for admin', async () => {
      const response = await request(app)
        .get(`/api/admin/reports/${testReport1._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('report');
      expect(response.body.report).toHaveProperty('id');
      expect(response.body.report).toHaveProperty('reporter');
      expect(response.body.report.reporter).toHaveProperty('displayName', 'RegularUser1');
      expect(response.body.report.reporter).toHaveProperty('email', 'regular1@test.com');
      expect(response.body.report.reporter).toHaveProperty('previousReportsCount');
      expect(response.body.report).toHaveProperty('reportedUser');
      expect(response.body.report.reportedUser).toHaveProperty('displayName', 'RegularUser2');
      expect(response.body.report.reportedUser).toHaveProperty('email', 'regular2@test.com');
      expect(response.body.report.reportedUser).toHaveProperty('userStatus');
      expect(response.body.report.reportedUser).toHaveProperty('warningCount');
      expect(response.body.report.reportedUser).toHaveProperty('isBlocked');
      expect(response.body.report.reportedUser).toHaveProperty('previousReportsCount');
      expect(response.body.report).toHaveProperty('reason', 'spam');
      expect(response.body.report).toHaveProperty('description', 'User is spamming messages');
      expect(response.body.report).toHaveProperty('status', 'pending');
      expect(response.body.report).toHaveProperty('submittedAt');
    });

    it('should return 404 for non-existent report', async () => {
      const response = await request(app)
        .get('/api/admin/reports/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/admin/reports/:reportId', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .put(`/api/admin/reports/${testReport1._id}`)
        .set('Authorization', `Bearer regular-token`)
        .send({ status: 'resolved' });
      
      expect(response.status).toBe(403);
    });

    it('should resolve a report without action', async () => {
      const response = await request(app)
        .put(`/api/admin/reports/${testReport1._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          status: 'resolved',
          notes: 'Report resolved without action'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('report');
      expect(response.body).toHaveProperty('message', 'Report updated');
      expect(response.body.report.status).toBe('resolved');
      expect(response.body.report.resolvedBy).toBeDefined();
      expect(response.body.report.resolvedAt).toBeDefined();

      // Verify report was updated
      const updatedReport = await Report.findById(testReport1._id);
      expect(updatedReport.status).toBe('resolved');
      expect(updatedReport.resolvedBy.toString()).toBe(adminUser._id.toString());
      expect(updatedReport.resolutionNotes).toBe('Report resolved without action');
    });

    it('should issue a warning to reported user', async () => {
      // Create a new report for warning test
      const warningReport = new Report({
        reporterId: regularUser._id,
        reportedUserId: regularUser2._id,
        reason: 'spam',
        description: 'Test warning report',
        status: 'pending',
      });
      await warningReport.save();

      // Get user's current warning count
      const userBefore = await User.findById(regularUser2._id);
      const initialWarningCount = userBefore.warningCount || 0;

      const response = await request(app)
        .put(`/api/admin/reports/${warningReport._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          status: 'resolved',
          action: 'warning',
          notes: 'User warned for spamming'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('warning action applied');
      expect(response.body.report.status).toBe('resolved');

      // Verify user was warned
      const updatedUser = await User.findById(regularUser2._id);
      expect(updatedUser.warningCount).toBe(initialWarningCount + 1);
      expect(updatedUser.userStatus).toBe('warning');
    });

    it('should suspend a user after 3 warnings', async () => {
      // Create a user with 2 warnings already
      const userToSuspend = new User({
        displayName: 'SuspendUser',
        email: 'suspend@test.com',
        phoneNumber: '+1234567895',
        warningCount: 2,
        userStatus: 'warning',
      });
      await userToSuspend.save();

      // Create report for this user
      const suspendReport = new Report({
        reporterId: regularUser._id,
        reportedUserId: userToSuspend._id,
        reason: 'harassment',
        description: 'User harassing others',
        status: 'pending',
      });
      await suspendReport.save();

      const response = await request(app)
        .put(`/api/admin/reports/${suspendReport._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          status: 'resolved',
          action: 'warning',
          notes: 'Third warning - automatic suspension'
        });
      
      expect(response.status).toBe(200);

      // Verify user was suspended (3rd warning triggers suspension)
      const updatedUser = await User.findById(userToSuspend._id);
      expect(updatedUser.warningCount).toBe(3);
      expect(updatedUser.userStatus).toBe('suspended');
      expect(updatedUser.suspensionEndDate).toBeDefined();
    });

    it('should suspend a user directly', async () => {
      // Create a new user for direct suspension test
      const userToSuspendDirectly = new User({
        displayName: 'DirectSuspendUser',
        email: 'directsuspend@test.com',
        phoneNumber: '+1234567896',
        warningCount: 0,
        userStatus: 'active',
      });
      await userToSuspendDirectly.save();

      // Create report for this user
      const directSuspendReport = new Report({
        reporterId: regularUser._id,
        reportedUserId: userToSuspendDirectly._id,
        reason: 'violence',
        description: 'User threatening violence',
        status: 'pending',
      });
      await directSuspendReport.save();

      const response = await request(app)
        .put(`/api/admin/reports/${directSuspendReport._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          status: 'resolved',
          action: 'suspension',
          notes: 'User suspended for 7 days due to threats'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('suspension action applied');

      // Verify user was suspended
      const updatedUser = await User.findById(userToSuspendDirectly._id);
      expect(updatedUser.userStatus).toBe('suspended');
      expect(updatedUser.suspensionEndDate).toBeDefined();
      expect(updatedUser.warningCount).toBe(0); // Warning count not incremented for direct suspension
    });

    it('should ban a user', async () => {
      // Create a new user for ban test
      const userToBan = new User({
        displayName: 'BanUser',
        email: 'ban@test.com',
        phoneNumber: '+1234567897',
        warningCount: 0,
        userStatus: 'active',
        isBlocked: false,
      });
      await userToBan.save();

      // Create report for this user
      const banReport = new Report({
        reporterId: regularUser._id,
        reportedUserId: userToBan._id,
        reason: 'hate_speech',
        description: 'User posting hate speech',
        status: 'pending',
      });
      await banReport.save();

      const response = await request(app)
        .put(`/api/admin/reports/${banReport._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          status: 'resolved',
          action: 'ban',
          notes: 'User banned permanently for hate speech'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('ban action applied');

      // Verify user was banned
      const updatedUser = await User.findById(userToBan._id);
      expect(updatedUser.userStatus).toBe('banned');
      expect(updatedUser.isBlocked).toBe(true);
      expect(updatedUser.banReason).toBe('User banned permanently for hate speech');
    });

    it('should validate action parameter', async () => {
      const response = await request(app)
        .put(`/api/admin/reports/${testReport2._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          status: 'resolved',
          action: 'invalid_action',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid action value');
    });

    it('should validate status parameter', async () => {
      const response = await request(app)
        .put(`/api/admin/reports/${testReport2._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          status: 'invalid_status',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid status value');
    });

    it('should return 404 for non-existent report', async () => {
      const response = await request(app)
        .put('/api/admin/reports/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'resolved' });
      
      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent reported user when taking action', async () => {
      // Create report with non-existent user
      const reportWithInvalidUser = new Report({
        reporterId: regularUser._id,
        reportedUserId: new mongoose.Types.ObjectId(), // Non-existent user ID
        reason: 'spam',
        description: 'Test report',
        status: 'pending',
      });
      await reportWithInvalidUser.save();

      const response = await request(app)
        .put(`/api/admin/reports/${reportWithInvalidUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          status: 'resolved',
          action: 'warning',
        });
      
      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Reported user not found');
    });
  });
});


  describe('GET /api/admin/analytics/users', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/users')
        .set('Authorization', `Bearer regular-token`);
      
      expect(response.status).toBe(403);
    });

    it('should return user analytics for admin', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/users')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('totalUsers');
      expect(response.body.data).toHaveProperty('activeUsers');
      expect(response.body.data).toHaveProperty('hostCount');
      expect(response.body.data).toHaveProperty('blockedUsers');
      expect(response.body.data).toHaveProperty('growthTrends');
      expect(response.body.data).toHaveProperty('period', 'monthly');
      expect(response.body.data).toHaveProperty('dateRange');
      
      // Should have at least 3 users (admin + 2 regular users)
      expect(response.body.data.totalUsers).toBeGreaterThanOrEqual(3);
      expect(response.body.data.activeUsers).toBeGreaterThanOrEqual(3);
    });

    it('should support daily breakdown', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/users?period=daily')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.period).toBe('daily');
      expect(response.body.data.growthTrends).toBeInstanceOf(Array);
    });

    it('should support weekly breakdown', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/users?period=weekly')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.period).toBe('weekly');
      expect(response.body.data.growthTrends).toBeInstanceOf(Array);
    });

    it('should support date range filtering', async () => {
      const startDate = new Date(Date.now() - 2592000000).toISOString().split('T')[0]; // 30 days ago
      const endDate = new Date().toISOString().split('T')[0]; // Today
      
      const response = await request(app)
        .get(`/api/admin/analytics/users?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.dateRange.start).toBe(startDate);
      expect(response.body.data.dateRange.end).toBe(endDate);
    });
  });

  describe('GET /api/admin/analytics/streams', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/streams')
        .set('Authorization', `Bearer regular-token`);
      
      expect(response.status).toBe(403);
    });

    it('should return stream analytics for admin', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/streams')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('currentActiveStreams');
      expect(response.body.data).toHaveProperty('totalStreams');
      expect(response.body.data).toHaveProperty('avgDuration');
      expect(response.body.data).toHaveProperty('totalViewers');
      expect(response.body.data).toHaveProperty('totalGifts');
      expect(response.body.data).toHaveProperty('historicalData');
      expect(response.body.data).toHaveProperty('topHosts');
      expect(response.body.data).toHaveProperty('period', 'monthly');
      expect(response.body.data).toHaveProperty('dateRange');
      
      // Should have at least 1 stream
      expect(response.body.data.totalStreams).toBeGreaterThanOrEqual(1);
    });

    it('should support daily breakdown', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/streams?period=daily')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.period).toBe('daily');
      expect(response.body.data.historicalData).toBeInstanceOf(Array);
    });

    it('should support weekly breakdown', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/streams?period=weekly')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.period).toBe('weekly');
      expect(response.body.data.historicalData).toBeInstanceOf(Array);
    });

    it('should support date range filtering', async () => {
      const startDate = new Date(Date.now() - 2592000000).toISOString().split('T')[0]; // 30 days ago
      const endDate = new Date().toISOString().split('T')[0]; // Today
      
      const response = await request(app)
        .get(`/api/admin/analytics/streams?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.dateRange.start).toBe(startDate);
      expect(response.body.data.dateRange.end).toBe(endDate);
    });
  });

  describe('GET /api/admin/analytics/engagement', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/engagement')
        .set('Authorization', `Bearer regular-token`);
      
      expect(response.status).toBe(403);
    });

    it('should return engagement analytics for admin', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/engagement')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('totalActiveUsers');
      expect(response.body.data).toHaveProperty('avgDailyActiveUsers');
      expect(response.body.data).toHaveProperty('retentionRate');
      expect(response.body.data).toHaveProperty('avgSessionDuration');
      expect(response.body.data).toHaveProperty('dailyActiveUsers');
      expect(response.body.data).toHaveProperty('period', 'daily');
      expect(response.body.data).toHaveProperty('dateRange');
      expect(response.body.data).toHaveProperty('note');
    });

    it('should support monthly breakdown', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/engagement?period=monthly')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.period).toBe('monthly');
      expect(response.body.data.dailyActiveUsers).toBeInstanceOf(Array);
    });

    it('should support date range filtering', async () => {
      const startDate = new Date(Date.now() - 2592000000).toISOString().split('T')[0]; // 30 days ago
      const endDate = new Date().toISOString().split('T')[0]; // Today
      
      const response = await request(app)
        .get(`/api/admin/analytics/engagement?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.dateRange.start).toBe(startDate);
      expect(response.body.data.dateRange.end).toBe(endDate);
    });
  });

  describe('GET /api/admin/analytics/export', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/export?type=users')
        .set('Authorization', `Bearer regular-token`);
      
      expect(response.status).toBe(403);
    });

    it('should export user analytics as CSV', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/export?type=users')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.csv');
      expect(response.text).toContain('Display Name');
      expect(response.text).toContain('Email');
      expect(response.text).toContain('Phone Number');
      expect(response.text).toContain('Registered At');
    });

    it('should export stream analytics as CSV', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/export?type=streams')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.csv');
      expect(response.text).toContain('Title');
      expect(response.text).toContain('Host');
      expect(response.text).toContain('Started At');
      expect(response.text).toContain('Ended At');
    });

    it('should export revenue analytics as CSV', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/export?type=revenue')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.csv');
      expect(response.text).toContain('Date');
      expect(response.text).toContain('User');
      expect(response.text).toContain('Amount (Coins)');
      expect(response.text).toContain('Description');
    });

    it('should export diamond analytics as CSV', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/export?type=diamonds')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.csv');
      expect(response.text).toContain('Date');
      expect(response.text).toContain('User');
      expect(response.text).toContain('Type');
      expect(response.text).toContain('Amount (Diamonds)');
    });

    it('should return 400 for missing type parameter', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/export')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Missing parameter');
    });

    it('should return 400 for invalid type parameter', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/export?type=invalid')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid type');
    });

    it('should support date range filtering for export', async () => {
      const startDate = new Date(Date.now() - 2592000000).toISOString().split('T')[0]; // 30 days ago
      const endDate = new Date().toISOString().split('T')[0]; // Today
      
      const response = await request(app)
        .get(`/api/admin/analytics/export?type=users&startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });
  });
});
