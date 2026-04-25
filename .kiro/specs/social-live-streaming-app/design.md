# Design Document: Social Live Streaming Application

## 1. System Architecture

### 1.1 High-Level Architecture

The system follows a three-tier architecture:

**Presentation Layer:**
- Mobile App (Flutter/Dart) for iOS and Android
- Admin Dashboard (HTML/TailwindCSS/JavaScript) for web

**Application Layer:**
- Backend Service (Node.js/Express recommended for real-time capabilities)
- Real-time Communication Service (WebRTC/Socket.io)
- Streaming Service (Media server integration)

**Data Layer:**
- MongoDB (primary database)
- Firebase Authentication
- Redis (caching and session management)
- CDN (static asset delivery)

### 1.2 Technology Stack

**Mobile Application:**
- Framework: Flutter 3.x
- Language: Dart
- State Management: Provider or Riverpod
- Real-time: Socket.io client
- Video Streaming: Agora SDK or WebRTC
- Local Storage: Hive or SharedPreferences

**Backend Service:**
- Runtime: Node.js 18+
- Framework: Express.js
- Real-time: Socket.io
- Authentication: Firebase Admin SDK
- Payment: Stripe SDK, PayPal SDK, Mada/stc pay integration

**Database:**
- Primary: MongoDB 6.0+
- Caching: Redis 7.0+
- Indexes: Compound indexes for performance

**Admin Dashboard:**
- HTML5, TailwindCSS 3.x, Vanilla JavaScript
- Charts: Chart.js
- Real-time updates: Socket.io client


## 2. Data Models

### 2.1 User Model

```dart
class User {
  String id;
  String phoneNumber;
  String email;
  String displayName;
  String bio;
  String profilePictureUrl;
  DateTime registeredAt;
  DateTime lastLoginAt;
  bool isBlocked;
  bool isHost;
  List<String> followerIds;
  List<String> followingIds;
  List<String> blockedUserIds;
  UserWallet wallet;
  NotificationPreferences notificationPrefs;
}
```

### 2.2 Host Model

```dart
class Host {
  String userId;
  String agentId;
  bool isApproved;
  DateTime approvedAt;
  HostStatistics statistics;
  List<WithdrawalRequest> withdrawalHistory;
}
```

### 2.3 Stream Model

```dart
class Stream {
  String id;
  String hostId;
  String title;
  DateTime startedAt;
  DateTime endedAt;
  int peakViewerCount;
  int totalGiftsReceived;
  List<String> currentViewerIds;
  List<ChatMessage> chatHistory;
  StreamStatus status;
  List<String> mutedUserIds;
  List<String> kickedUserIds;
  List<String> moderatorIds;
}
```

### 2.4 Voice Room Model

```dart
class VoiceRoom {
  String id;
  String hostId;
  String name;
  int participantLimit;
  DateTime createdAt;
  List<VoiceParticipant> participants;
  List<ChatMessage> chatHistory;
  VoiceRoomStatus status;
}

class VoiceParticipant {
  String userId;
  ParticipantRole role;
  bool isHandRaised;
  bool isMuted;
}
```


### 2.5 Wallet and Transaction Models

```dart
class UserWallet {
  String userId;
  int coinBalance;
  int diamondBalance;
  List<Transaction> transactionHistory;
}

class Transaction {
  String id;
  String userId;
  TransactionType type;
  int amount;
  String currency;
  DateTime timestamp;
  String description;
  Map<String, dynamic> metadata;
}

enum TransactionType {
  coinPurchase,
  giftSent,
  giftReceived,
  diamondEarned,
  withdrawal,
  commission
}
```

### 2.6 Virtual Gift Model

```dart
class VirtualGift {
  String id;
  String name;
  int coinPrice;
  int diamondValue;
  String animationAssetUrl;
  String thumbnailUrl;
  GiftCategory category;
}
```

### 2.7 Report Model

```dart
class Report {
  String id;
  String reporterId;
  String reportedUserId;
  String reportedStreamId;
  ReportReason reason;
  String description;
  DateTime submittedAt;
  ReportStatus status;
  String resolvedBy;
  DateTime resolvedAt;
  String resolutionNotes;
}
```

### 2.8 Notification Model

```dart
class Notification {
  String id;
  String userId;
  NotificationType type;
  String title;
  String message;
  Map<String, dynamic> data;
  DateTime createdAt;
  bool isRead;
}
```


## 3. API Design

### 3.1 Authentication Endpoints

**POST /api/auth/register**
- Request: `{ phoneNumber?, email?, socialProvider?, otp? }`
- Response: `{ userId, token, user }`
- Validates: Unique phone/email, valid OTP

**POST /api/auth/login**
- Request: `{ phoneNumber?, email?, password }`
- Response: `{ userId, token, user }`
- Validates: Credentials, account not blocked

**POST /api/auth/logout**
- Request: `{ token }`
- Response: `{ success: true }`
- Invalidates session

**POST /api/auth/send-otp**
- Request: `{ phoneNumber?, email? }`
- Response: `{ success: true, expiresIn: 300 }`
- Sends OTP via SMS or email

### 3.2 User Management Endpoints

**GET /api/users/:userId**
- Response: `{ user }`
- Returns public profile information

**PUT /api/users/:userId**
- Request: `{ displayName?, bio?, profilePicture? }`
- Response: `{ user }`
- Validates: Display name uniqueness, image size

**POST /api/users/:userId/follow**
- Request: `{ targetUserId }`
- Response: `{ success: true }`
- Creates follow relationship, sends notification

**DELETE /api/users/:userId/follow/:targetUserId**
- Response: `{ success: true }`
- Removes follow relationship

**POST /api/users/:userId/block**
- Request: `{ targetUserId }`
- Response: `{ success: true }`
- Blocks user, prevents all interactions

**POST /api/users/:userId/report**
- Request: `{ reportedUserId, reason, description }`
- Response: `{ reportId }`
- Creates report for admin review


### 3.3 Live Streaming Endpoints

**POST /api/streams/start**
- Request: `{ hostId, title }`
- Response: `{ streamId, rtmpUrl, streamKey }`
- Validates: Host permissions, system capacity
- Allocates streaming resources

**POST /api/streams/:streamId/end**
- Response: `{ statistics }`
- Terminates stream, saves metadata

**GET /api/streams/active**
- Response: `{ streams: [] }`
- Returns list of active streams

**POST /api/streams/:streamId/join**
- Request: `{ userId }`
- Response: `{ playbackUrl, chatToken }`
- Adds viewer to stream

**POST /api/streams/:streamId/leave**
- Request: `{ userId }`
- Response: `{ success: true }`
- Removes viewer from stream

**POST /api/streams/:streamId/chat**
- Request: `{ userId, message }`
- Response: `{ messageId }`
- Broadcasts message via WebSocket

**POST /api/streams/:streamId/gift**
- Request: `{ senderId, giftId }`
- Response: `{ success: true, newBalance }`
- Validates: Sufficient coins, deducts coins, credits diamonds

**POST /api/streams/:streamId/moderate**
- Request: `{ action: 'mute'|'kick'|'block', targetUserId }`
- Response: `{ success: true }`
- Validates: Host or moderator permissions


### 3.4 Voice Room Endpoints

**POST /api/voice-rooms/create**
- Request: `{ hostId, name, participantLimit }`
- Response: `{ roomId, audioToken }`
- Creates voice room, allocates audio resources

**POST /api/voice-rooms/:roomId/join**
- Request: `{ userId }`
- Response: `{ audioToken, participants }`
- Adds user as listener

**POST /api/voice-rooms/:roomId/leave**
- Request: `{ userId }`
- Response: `{ success: true }`
- Removes user from room

**POST /api/voice-rooms/:roomId/raise-hand**
- Request: `{ userId }`
- Response: `{ success: true }`
- Notifies host via WebSocket

**POST /api/voice-rooms/:roomId/promote**
- Request: `{ userId, targetUserId }`
- Response: `{ success: true }`
- Validates: Host permissions, promotes to speaker

**POST /api/voice-rooms/:roomId/demote**
- Request: `{ userId, targetUserId }`
- Response: `{ success: true }`
- Validates: Host permissions, demotes to listener

**POST /api/voice-rooms/:roomId/chat**
- Request: `{ userId, message }`
- Response: `{ messageId }`
- Broadcasts message via WebSocket


### 3.5 Wallet and Payment Endpoints

**GET /api/wallet/:userId**
- Response: `{ coinBalance, diamondBalance, transactions }`
- Returns wallet information

**POST /api/wallet/purchase-coins**
- Request: `{ userId, packageId, paymentMethod }`
- Response: `{ paymentUrl, sessionId }`
- Creates payment session with gateway

**POST /api/wallet/webhook/:gateway**
- Request: Payment gateway webhook payload
- Response: `{ received: true }`
- Validates payment, credits coins

**POST /api/wallet/withdraw**
- Request: `{ userId, diamondAmount }`
- Response: `{ withdrawalRequestId }`
- Validates: Minimum balance, creates withdrawal request

**GET /api/wallet/transactions/:userId**
- Query: `{ page, limit, type? }`
- Response: `{ transactions, total, page }`
- Returns paginated transaction history

### 3.6 Host Management Endpoints

**POST /api/hosts/register**
- Request: `{ userId, additionalInfo }`
- Response: `{ hostId, status: 'pending' }`
- Creates host registration request

**GET /api/hosts/:userId/earnings**
- Response: `{ totalDiamonds, pendingWithdrawals, completedWithdrawals }`
- Returns earnings dashboard data

**GET /api/hosts/:userId/statistics**
- Response: `{ totalStreams, totalViewers, averageViewers, topGifters }`
- Returns host performance metrics


### 3.7 Admin Dashboard Endpoints

**GET /api/admin/users**
- Query: `{ page, limit, search?, status? }`
- Response: `{ users, total, page }`
- Returns paginated user list

**PUT /api/admin/users/:userId**
- Request: `{ isBlocked?, displayName?, ... }`
- Response: `{ user }`
- Updates user information

**GET /api/admin/streams**
- Query: `{ status: 'active'|'ended', page, limit }`
- Response: `{ streams, total }`
- Returns stream list with filters

**POST /api/admin/streams/:streamId/terminate**
- Response: `{ success: true }`
- Immediately ends stream

**GET /api/admin/reports**
- Query: `{ status?, page, limit }`
- Response: `{ reports, total }`
- Returns report list

**PUT /api/admin/reports/:reportId**
- Request: `{ status: 'resolved', action?, notes? }`
- Response: `{ report }`
- Updates report status

**GET /api/admin/analytics**
- Query: `{ startDate, endDate, metric }`
- Response: `{ data, aggregations }`
- Returns analytics data

**GET /api/admin/withdrawals**
- Query: `{ status?, page, limit }`
- Response: `{ withdrawals, total }`
- Returns withdrawal requests

**PUT /api/admin/withdrawals/:withdrawalId**
- Request: `{ status: 'approved'|'rejected', notes? }`
- Response: `{ withdrawal }`
- Approves or rejects withdrawal

**POST /api/admin/agents/register**
- Request: `{ name, email, commissionRate }`
- Response: `{ agentId }`
- Creates agent account

**PUT /api/admin/hosts/:hostId/assign-agent**
- Request: `{ agentId }`
- Response: `{ success: true }`
- Assigns host to agent


## 4. Real-Time Communication Design

### 4.1 WebSocket Events

**Client to Server:**
- `stream:join` - Join stream as viewer
- `stream:leave` - Leave stream
- `stream:chat` - Send chat message
- `stream:gift` - Send virtual gift
- `voice:join` - Join voice room
- `voice:leave` - Leave voice room
- `voice:raise-hand` - Request to speak
- `voice:chat` - Send voice room chat

**Server to Client:**
- `stream:viewer-joined` - New viewer notification
- `stream:viewer-left` - Viewer left notification
- `stream:chat-message` - New chat message
- `stream:gift-sent` - Gift animation trigger
- `stream:ended` - Stream ended notification
- `stream:moderation` - User muted/kicked
- `voice:participant-joined` - New participant
- `voice:participant-left` - Participant left
- `voice:role-changed` - Speaker/listener role change
- `voice:hand-raised` - Hand raise notification
- `notification:new` - General notification

### 4.2 Real-Time Architecture

**Connection Management:**
- Socket.io for WebSocket connections
- Redis adapter for horizontal scaling
- Room-based message broadcasting
- Automatic reconnection handling
- Heartbeat mechanism for connection health

**Message Flow:**
1. Client sends event via WebSocket
2. Server validates authentication and permissions
3. Server processes business logic
4. Server broadcasts to relevant room subscribers
5. Clients receive and render updates

**Scalability:**
- Redis Pub/Sub for cross-server communication
- Sticky sessions for WebSocket connections
- Load balancer with WebSocket support
- Horizontal scaling of Socket.io servers


## 5. Video Streaming Architecture

### 5.1 Streaming Protocol

**Technology Choice: Agora SDK**
- Low latency (< 2 seconds)
- Built-in scalability
- Cross-platform support
- Automatic quality adaptation

**Alternative: WebRTC + Media Server**
- WebRTC for peer connections
- Janus or Kurento media server
- TURN/STUN servers for NAT traversal

### 5.2 Streaming Flow

**Host Side:**
1. Request stream start from backend
2. Receive Agora channel token
3. Initialize Agora SDK with token
4. Capture video/audio from device
5. Publish stream to Agora channel
6. Monitor stream health metrics

**Viewer Side:**
1. Request stream join from backend
2. Receive Agora channel token
3. Initialize Agora SDK with token
4. Subscribe to host's stream
5. Decode and render video/audio
6. Adapt quality based on network

### 5.3 Quality Adaptation

**Adaptive Bitrate Streaming:**
- Multiple quality levels: 1080p, 720p, 480p, 360p
- Automatic switching based on bandwidth
- Manual quality selection option
- Bandwidth estimation algorithm

**Network Optimization:**
- Buffer management for smooth playback
- Jitter buffer for audio synchronization
- Packet loss concealment
- Forward error correction


## 6. Database Schema Design

### 6.1 MongoDB Collections

**users**
```javascript
{
  _id: ObjectId,
  phoneNumber: String (unique, indexed),
  email: String (unique, indexed),
  passwordHash: String,
  displayName: String (unique, indexed),
  bio: String,
  profilePictureUrl: String,
  registeredAt: Date (indexed),
  lastLoginAt: Date,
  isBlocked: Boolean (indexed),
  isHost: Boolean (indexed),
  followerIds: [ObjectId] (indexed),
  followingIds: [ObjectId],
  blockedUserIds: [ObjectId],
  notificationPrefs: {
    streamStart: Boolean,
    gifts: Boolean,
    followers: Boolean,
    messages: Boolean
  }
}
```

**hosts**
```javascript
{
  _id: ObjectId,
  userId: ObjectId (indexed),
  agentId: ObjectId (indexed),
  isApproved: Boolean (indexed),
  approvedAt: Date,
  approvedBy: ObjectId,
  statistics: {
    totalStreams: Number,
    totalViewers: Number,
    totalGiftsReceived: Number,
    totalDiamondsEarned: Number
  }
}
```

**streams**
```javascript
{
  _id: ObjectId,
  hostId: ObjectId (indexed),
  title: String,
  startedAt: Date (indexed),
  endedAt: Date,
  status: String (indexed),
  peakViewerCount: Number,
  totalGiftsReceived: Number,
  currentViewerIds: [ObjectId],
  mutedUserIds: [ObjectId],
  kickedUserIds: [ObjectId],
  moderatorIds: [ObjectId],
  agoraChannelId: String
}
```

**chatMessages**
```javascript
{
  _id: ObjectId,
  streamId: ObjectId (indexed),
  voiceRoomId: ObjectId (indexed),
  senderId: ObjectId (indexed),
  message: String,
  timestamp: Date (indexed),
  isPinned: Boolean
}
```


**voiceRooms**
```javascript
{
  _id: ObjectId,
  hostId: ObjectId (indexed),
  name: String,
  participantLimit: Number,
  createdAt: Date (indexed),
  status: String (indexed),
  participants: [{
    userId: ObjectId,
    role: String,
    isHandRaised: Boolean,
    joinedAt: Date
  }],
  agoraChannelId: String
}
```

**wallets**
```javascript
{
  _id: ObjectId,
  userId: ObjectId (unique, indexed),
  coinBalance: Number,
  diamondBalance: Number,
  updatedAt: Date
}
```

**transactions**
```javascript
{
  _id: ObjectId,
  userId: ObjectId (indexed),
  type: String (indexed),
  amount: Number,
  currency: String,
  timestamp: Date (indexed),
  description: String,
  metadata: {
    giftId: ObjectId,
    streamId: ObjectId,
    paymentGateway: String,
    paymentId: String
  }
}
```

**virtualGifts**
```javascript
{
  _id: ObjectId,
  name: String,
  coinPrice: Number (indexed),
  diamondValue: Number,
  animationAssetUrl: String,
  thumbnailUrl: String,
  category: String (indexed),
  isActive: Boolean
}
```

**reports**
```javascript
{
  _id: ObjectId,
  reporterId: ObjectId (indexed),
  reportedUserId: ObjectId (indexed),
  reportedStreamId: ObjectId,
  reason: String (indexed),
  description: String,
  submittedAt: Date (indexed),
  status: String (indexed),
  resolvedBy: ObjectId,
  resolvedAt: Date,
  resolutionNotes: String
}
```

**notifications**
```javascript
{
  _id: ObjectId,
  userId: ObjectId (indexed),
  type: String (indexed),
  title: String,
  message: String,
  data: Object,
  createdAt: Date (indexed),
  isRead: Boolean (indexed)
}
```

**withdrawalRequests**
```javascript
{
  _id: ObjectId,
  userId: ObjectId (indexed),
  diamondAmount: Number,
  creditAmount: Number,
  status: String (indexed),
  requestedAt: Date (indexed),
  processedAt: Date,
  processedBy: ObjectId,
  notes: String
}
```

**agents**
```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  commissionRate: Number,
  createdAt: Date,
  isActive: Boolean
}
```

### 6.2 Indexes

**Compound Indexes:**
- users: `{ displayName: 1, isBlocked: 1 }`
- streams: `{ hostId: 1, startedAt: -1 }`
- streams: `{ status: 1, startedAt: -1 }`
- transactions: `{ userId: 1, timestamp: -1 }`
- notifications: `{ userId: 1, isRead: 1, createdAt: -1 }`
- reports: `{ status: 1, submittedAt: -1 }`


## 7. Security Design

### 7.1 Authentication and Authorization

**Firebase Authentication:**
- Phone number authentication with SMS OTP
- Email authentication with email OTP
- Social provider OAuth (Google, Facebook, Apple)
- Custom token generation for backend integration

**Session Management:**
- JWT tokens with 30-day expiration
- Refresh token mechanism
- Token stored in secure storage (Keychain/Keystore)
- Session invalidation on logout

**Authorization Middleware:**
```javascript
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const decoded = verifyToken(token);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireHost(req, res, next) {
  if (!req.user.isHost) {
    return res.status(403).json({ error: 'Host permissions required' });
  }
  next();
}
```

### 7.2 Data Encryption

**At Rest:**
- MongoDB encryption at rest enabled
- Password hashing with bcrypt (12 rounds)
- Sensitive fields encrypted with AES-256
- Encryption keys stored in environment variables

**In Transit:**
- TLS 1.3 for all API communications
- Certificate pinning in mobile app
- Encrypted WebSocket connections (WSS)

### 7.3 Input Validation

**Request Validation:**
```javascript
const registerSchema = {
  phoneNumber: { type: 'string', pattern: '^\\+[1-9]\\d{1,14}$' },
  email: { type: 'string', format: 'email' },
  displayName: { type: 'string', minLength: 3, maxLength: 30 }
};

function validateRequest(schema) {
  return (req, res, next) => {
    const errors = validate(req.body, schema);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }
    next();
  };
}
```

**Sanitization:**
- HTML escaping for user-generated content
- SQL injection prevention (using MongoDB parameterized queries)
- XSS prevention in admin dashboard
- File upload validation (type, size, content)


### 7.4 Rate Limiting

**API Rate Limits:**
```javascript
const rateLimits = {
  auth: { windowMs: 15 * 60 * 1000, max: 5 },
  api: { windowMs: 60 * 1000, max: 100 },
  chat: { windowMs: 1000, max: 5 },
  payment: { windowMs: 60 * 60 * 1000, max: 10 }
};

function rateLimit(type) {
  return new RateLimiter({
    store: new RedisStore({ client: redisClient }),
    ...rateLimits[type],
    handler: (req, res) => {
      res.status(429).json({ error: 'Too many requests' });
    }
  });
}
```

### 7.5 Payment Security

**PCI Compliance:**
- Never store card numbers
- Use payment gateway tokenization
- Implement 3D Secure for card payments
- Log all payment attempts with IP and device info

**Fraud Detection:**
```javascript
function detectFraud(transaction) {
  const checks = [
    checkVelocity(transaction.userId),
    checkAmount(transaction.amount),
    checkLocation(transaction.ipAddress),
    checkDevice(transaction.deviceId)
  ];
  
  const riskScore = calculateRiskScore(checks);
  if (riskScore > FRAUD_THRESHOLD) {
    flagForReview(transaction);
    return false;
  }
  return true;
}
```

## 8. Performance Optimization

### 8.1 Caching Strategy

**Redis Caching:**
```javascript
const cacheConfig = {
  userProfile: { ttl: 300 },
  streamList: { ttl: 10 },
  virtualGifts: { ttl: 3600 },
  walletBalance: { ttl: 60 }
};

async function getCached(key, fetchFn, ttl) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  const data = await fetchFn();
  await redis.setex(key, ttl, JSON.stringify(data));
  return data;
}
```

**Cache Invalidation:**
- Write-through cache for wallet updates
- Cache invalidation on profile updates
- TTL-based expiration for read-heavy data
- Pub/Sub for distributed cache invalidation


### 8.2 Database Optimization

**Connection Pooling:**
```javascript
const mongoConfig = {
  minPoolSize: 10,
  maxPoolSize: 100,
  maxIdleTimeMS: 30000,
  waitQueueTimeoutMS: 5000
};
```

**Query Optimization:**
- Use projection to limit returned fields
- Implement pagination for all list queries
- Use aggregation pipeline for complex queries
- Monitor slow queries with profiling

**Example Optimized Query:**
```javascript
async function getActiveStreams(page = 1, limit = 20) {
  return await db.collection('streams')
    .find({ status: 'active' })
    .project({ title: 1, hostId: 1, currentViewerIds: 1 })
    .sort({ startedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();
}
```

### 8.3 Asset Optimization

**CDN Configuration:**
- CloudFront or Cloudflare for static assets
- Image optimization and compression
- Lazy loading for images
- Progressive image loading

**Mobile App Optimization:**
```dart
class ImageCache {
  static final cache = LRUCache<String, Uint8List>(maxSize: 100);
  
  static Future<Uint8List> loadImage(String url) async {
    if (cache.containsKey(url)) {
      return cache.get(url);
    }
    
    final bytes = await http.get(url);
    cache.put(url, bytes);
    return bytes;
  }
}
```

### 8.4 Load Balancing

**Architecture:**
- Nginx as reverse proxy and load balancer
- Round-robin distribution for HTTP requests
- Sticky sessions for WebSocket connections
- Health checks for backend instances

**Configuration:**
```nginx
upstream backend {
  least_conn;
  server backend1:3000 max_fails=3 fail_timeout=30s;
  server backend2:3000 max_fails=3 fail_timeout=30s;
  server backend3:3000 max_fails=3 fail_timeout=30s;
}

upstream websocket {
  ip_hash;
  server ws1:3000;
  server ws2:3000;
}
```


## 9. Error Handling and Resilience

### 9.1 Error Handling Strategy

**Error Categories:**
```javascript
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

class AuthenticationError extends AppError {
  constructor(message) {
    super(message, 401, 'AUTH_ERROR');
  }
}

class InsufficientFundsError extends AppError {
  constructor(message) {
    super(message, 402, 'INSUFFICIENT_FUNDS');
  }
}
```

**Global Error Handler:**
```javascript
function errorHandler(err, req, res, next) {
  logger.error({
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: req.userId
  });
  
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code
    });
  }
  
  return res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
}
```

### 9.2 Circuit Breaker Pattern

**External Service Protection:**
```javascript
class CircuitBreaker {
  constructor(service, threshold = 5, timeout = 60000) {
    this.service = service;
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED';
    this.nextAttempt = Date.now();
  }
  
  async call(method, ...args) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await this.service[method](...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}
```


### 9.3 Retry Logic

**Exponential Backoff:**
```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000;
      await sleep(delay);
    }
  }
}
```

### 9.4 Graceful Degradation

**Feature Flags:**
```javascript
const features = {
  voiceRooms: true,
  giftAnimations: true,
  notifications: true,
  analytics: true
};

function isFeatureEnabled(feature) {
  return features[feature] !== false;
}

async function sendNotification(userId, notification) {
  if (!isFeatureEnabled('notifications')) {
    logger.warn('Notifications disabled, skipping');
    return;
  }
  
  try {
    await notificationService.send(userId, notification);
  } catch (error) {
    logger.error('Notification failed', error);
  }
}
```

## 10. Monitoring and Logging

### 10.1 Logging Strategy

**Structured Logging:**
```javascript
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

logger.info('Stream started', {
  streamId: stream.id,
  hostId: stream.hostId,
  timestamp: new Date()
});
```

**Log Levels:**
- ERROR: Application errors requiring immediate attention
- WARN: Potential issues or degraded functionality
- INFO: Important business events (stream start, payment)
- DEBUG: Detailed diagnostic information


### 10.2 Performance Monitoring

**Metrics Collection:**
```javascript
const metrics = {
  apiRequestDuration: new Histogram({
    name: 'api_request_duration_seconds',
    help: 'API request duration',
    labelNames: ['method', 'route', 'status']
  }),
  
  activeStreams: new Gauge({
    name: 'active_streams_total',
    help: 'Number of active streams'
  }),
  
  concurrentViewers: new Gauge({
    name: 'concurrent_viewers_total',
    help: 'Total concurrent viewers'
  })
};

function trackRequest(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    metrics.apiRequestDuration.observe({
      method: req.method,
      route: req.route?.path,
      status: res.statusCode
    }, duration);
  });
  
  next();
}
```

### 10.3 Health Checks

**Endpoint Implementation:**
```javascript
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      agora: await checkAgora()
    }
  };
  
  const isHealthy = Object.values(health.checks).every(c => c.status === 'up');
  res.status(isHealthy ? 200 : 503).json(health);
});

async function checkDatabase() {
  try {
    await db.admin().ping();
    return { status: 'up', latency: 5 };
  } catch (error) {
    return { status: 'down', error: error.message };
  }
}
```

## 11. Mobile App Architecture

### 11.1 Flutter Project Structure

```
lib/
├── main.dart
├── app.dart
├── core/
│   ├── constants/
│   ├── theme/
│   ├── utils/
│   └── services/
│       ├── api_service.dart
│       ├── auth_service.dart
│       ├── socket_service.dart
│       └── storage_service.dart
├── models/
│   ├── user.dart
│   ├── stream.dart
│   ├── voice_room.dart
│   └── wallet.dart
├── providers/
│   ├── auth_provider.dart
│   ├── stream_provider.dart
│   └── wallet_provider.dart
├── screens/
│   ├── auth/
│   ├── home/
│   ├── stream/
│   ├── voice_room/
│   ├── profile/
│   └── wallet/
└── widgets/
    ├── common/
    ├── stream/
    └── chat/
```


### 11.2 State Management

**Provider Pattern:**
```dart
class AuthProvider extends ChangeNotifier {
  User? _currentUser;
  String? _token;
  
  User? get currentUser => _currentUser;
  bool get isAuthenticated => _token != null;
  
  Future<void> login(String phoneNumber, String otp) async {
    final response = await apiService.login(phoneNumber, otp);
    _currentUser = response.user;
    _token = response.token;
    await storageService.saveToken(_token!);
    notifyListeners();
  }
  
  Future<void> logout() async {
    await apiService.logout(_token!);
    _currentUser = null;
    _token = null;
    await storageService.clearToken();
    notifyListeners();
  }
}
```

### 11.3 API Service Layer

**HTTP Client:**
```dart
class ApiService {
  final Dio _dio;
  final String baseUrl;
  
  ApiService(this.baseUrl) : _dio = Dio(BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: Duration(seconds: 10),
    receiveTimeout: Duration(seconds: 10),
  )) {
    _dio.interceptors.add(AuthInterceptor());
    _dio.interceptors.add(LoggingInterceptor());
  }
  
  Future<LoginResponse> login(String phoneNumber, String otp) async {
    try {
      final response = await _dio.post('/api/auth/login', data: {
        'phoneNumber': phoneNumber,
        'otp': otp
      });
      return LoginResponse.fromJson(response.data);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }
}
```

### 11.4 WebSocket Service

**Socket.io Integration:**
```dart
class SocketService {
  IO.Socket? _socket;
  final String serverUrl;
  
  SocketService(this.serverUrl);
  
  void connect(String token) {
    _socket = IO.io(serverUrl, IO.OptionBuilder()
      .setTransports(['websocket'])
      .setAuth({'token': token})
      .build());
    
    _socket!.connect();
    _setupListeners();
  }
  
  void _setupListeners() {
    _socket!.on('stream:chat-message', (data) {
      final message = ChatMessage.fromJson(data);
      streamController.add(message);
    });
    
    _socket!.on('stream:gift-sent', (data) {
      final gift = GiftEvent.fromJson(data);
      giftController.add(gift);
    });
  }
  
  void sendChatMessage(String streamId, String message) {
    _socket!.emit('stream:chat', {
      'streamId': streamId,
      'message': message
    });
  }
  
  void disconnect() {
    _socket?.disconnect();
    _socket = null;
  }
}
```


### 11.5 Agora Integration

**Stream Broadcasting:**
```dart
class StreamService {
  late RtcEngine _engine;
  
  Future<void> initializeAgora(String appId) async {
    _engine = createAgoraRtcEngine();
    await _engine.initialize(RtcEngineContext(appId: appId));
    
    await _engine.enableVideo();
    await _engine.setVideoEncoderConfiguration(
      VideoEncoderConfiguration(
        dimensions: VideoDimensions(width: 1280, height: 720),
        frameRate: 30,
        bitrate: 2000,
      ),
    );
  }
  
  Future<void> startBroadcasting(String channelId, String token) async {
    await _engine.setClientRole(role: ClientRoleType.clientRoleBroadcaster);
    await _engine.startPreview();
    
    await _engine.joinChannel(
      token: token,
      channelId: channelId,
      uid: 0,
      options: ChannelMediaOptions(
        channelProfile: ChannelProfileType.channelProfileLiveBroadcasting,
        clientRoleType: ClientRoleType.clientRoleBroadcaster,
      ),
    );
  }
  
  Future<void> joinAsViewer(String channelId, String token) async {
    await _engine.setClientRole(role: ClientRoleType.clientRoleAudience);
    
    await _engine.joinChannel(
      token: token,
      channelId: channelId,
      uid: 0,
      options: ChannelMediaOptions(
        channelProfile: ChannelProfileType.channelProfileLiveBroadcasting,
        clientRoleType: ClientRoleType.clientRoleAudience,
      ),
    );
  }
  
  Future<void> leaveChannel() async {
    await _engine.leaveChannel();
  }
  
  void dispose() {
    _engine.release();
  }
}
```

## 12. Admin Dashboard Architecture

### 12.1 Dashboard Structure

```
admin-dashboard/
├── index.html
├── css/
│   ├── tailwind.css
│   └── custom.css
├── js/
│   ├── main.js
│   ├── api.js
│   ├── auth.js
│   ├── users.js
│   ├── streams.js
│   ├── reports.js
│   ├── analytics.js
│   └── withdrawals.js
└── assets/
    └── images/
```


### 12.2 Dashboard API Client

**JavaScript API Service:**
```javascript
class AdminAPI {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('adminToken');
  }
  
  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options.headers
      }
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async getUsers(page = 1, search = '') {
    return this.request(`/api/admin/users?page=${page}&search=${search}`);
  }
  
  async blockUser(userId) {
    return this.request(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ isBlocked: true })
    });
  }
  
  async getActiveStreams() {
    return this.request('/api/admin/streams?status=active');
  }
  
  async terminateStream(streamId) {
    return this.request(`/api/admin/streams/${streamId}/terminate`, {
      method: 'POST'
    });
  }
  
  async getReports(status = 'pending') {
    return this.request(`/api/admin/reports?status=${status}`);
  }
  
  async resolveReport(reportId, action, notes) {
    return this.request(`/api/admin/reports/${reportId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'resolved', action, notes })
    });
  }
}
```

### 12.3 Real-Time Updates

**Socket.io Integration:**
```javascript
class DashboardSocket {
  constructor(serverUrl, token) {
    this.socket = io(serverUrl, {
      auth: { token }
    });
    
    this.setupListeners();
  }
  
  setupListeners() {
    this.socket.on('stream:started', (data) => {
      this.updateStreamList(data);
    });
    
    this.socket.on('stream:ended', (data) => {
      this.removeStreamFromList(data.streamId);
    });
    
    this.socket.on('report:new', (data) => {
      this.showNewReportNotification(data);
    });
  }
  
  updateStreamList(stream) {
    const streamList = document.getElementById('active-streams');
    const streamElement = createStreamElement(stream);
    streamList.prepend(streamElement);
  }
}
```


## 13. Payment Integration Design

### 13.1 Payment Gateway Abstraction

**Payment Service Interface:**
```javascript
class PaymentService {
  constructor() {
    this.gateways = {
      stripe: new StripeGateway(),
      paypal: new PayPalGateway(),
      mada: new MadaGateway(),
      stcpay: new StcPayGateway()
    };
  }
  
  async createPaymentSession(userId, amount, currency, gateway) {
    const paymentGateway = this.gateways[gateway];
    if (!paymentGateway) {
      throw new Error(`Unsupported gateway: ${gateway}`);
    }
    
    const session = await paymentGateway.createSession({
      userId,
      amount,
      currency,
      successUrl: `${config.appUrl}/payment/success`,
      cancelUrl: `${config.appUrl}/payment/cancel`
    });
    
    await this.savePaymentIntent(userId, session.id, gateway, amount);
    return session;
  }
  
  async handleWebhook(gateway, payload, signature) {
    const paymentGateway = this.gateways[gateway];
    const event = await paymentGateway.verifyWebhook(payload, signature);
    
    if (event.type === 'payment.succeeded') {
      await this.processSuccessfulPayment(event.data);
    } else if (event.type === 'payment.failed') {
      await this.processFailedPayment(event.data);
    }
  }
  
  async processSuccessfulPayment(paymentData) {
    const intent = await this.getPaymentIntent(paymentData.id);
    
    await db.collection('wallets').updateOne(
      { userId: intent.userId },
      { $inc: { coinBalance: intent.coinAmount } }
    );
    
    await this.createTransaction({
      userId: intent.userId,
      type: 'coinPurchase',
      amount: intent.coinAmount,
      currency: 'coins',
      metadata: {
        paymentId: paymentData.id,
        gateway: intent.gateway,
        realAmount: intent.amount
      }
    });
  }
}
```

### 13.2 Stripe Integration

```javascript
class StripeGateway {
  constructor() {
    this.stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  
  async createSession(options) {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: options.currency,
          product_data: { name: 'Coin Package' },
          unit_amount: options.amount * 100
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
      metadata: { userId: options.userId }
    });
    
    return { id: session.id, url: session.url };
  }
  
  async verifyWebhook(payload, signature) {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  }
}
```


## 14. Notification System Design

### 14.1 Notification Service

**Push Notification Implementation:**
```javascript
class NotificationService {
  constructor() {
    this.fcm = admin.messaging();
  }
  
  async sendNotification(userId, notification) {
    const user = await db.collection('users').findOne({ _id: userId });
    if (!user.fcmToken) return;
    
    const prefs = user.notificationPrefs;
    if (!this.shouldSendNotification(notification.type, prefs)) {
      return;
    }
    
    const message = {
      token: user.fcmToken,
      notification: {
        title: notification.title,
        body: notification.message
      },
      data: notification.data,
      android: {
        priority: 'high',
        notification: { sound: 'default' }
      },
      apns: {
        payload: {
          aps: { sound: 'default' }
        }
      }
    };
    
    try {
      await this.fcm.send(message);
      await this.saveNotification(userId, notification);
    } catch (error) {
      logger.error('Failed to send notification', error);
    }
  }
  
  shouldSendNotification(type, prefs) {
    const typeMap = {
      'stream_start': prefs.streamStart,
      'gift_received': prefs.gifts,
      'new_follower': prefs.followers,
      'new_message': prefs.messages
    };
    return typeMap[type] !== false;
  }
  
  async sendBulkNotification(userIds, notification) {
    const chunks = chunkArray(userIds, 500);
    
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(userId => this.sendNotification(userId, notification))
      );
    }
  }
}
```

### 14.2 Notification Triggers

**Event-Based Notifications:**
```javascript
async function onStreamStart(stream) {
  const host = await db.collection('users').findOne({ _id: stream.hostId });
  const followers = await db.collection('users')
    .find({ followingIds: stream.hostId })
    .toArray();
  
  await notificationService.sendBulkNotification(
    followers.map(f => f._id),
    {
      type: 'stream_start',
      title: `${host.displayName} is live!`,
      message: stream.title,
      data: { streamId: stream.id }
    }
  );
}

async function onGiftReceived(gift, senderId, hostId) {
  const sender = await db.collection('users').findOne({ _id: senderId });
  
  await notificationService.sendNotification(hostId, {
    type: 'gift_received',
    title: 'Gift Received!',
    message: `${sender.displayName} sent you ${gift.name}`,
    data: { giftId: gift.id, senderId }
  });
}
```


## 15. Deployment Architecture

### 15.1 Infrastructure Overview

**Production Environment:**
- Cloud Provider: AWS or Google Cloud
- Container Orchestration: Kubernetes or Docker Swarm
- Load Balancer: AWS ALB or Nginx
- CDN: CloudFront or Cloudflare
- Database: MongoDB Atlas or self-hosted
- Cache: Redis Cloud or ElastiCache
- Monitoring: Prometheus + Grafana

**Architecture Diagram:**
```
                    [CDN]
                      |
                [Load Balancer]
                      |
        +-------------+-------------+
        |             |             |
   [Backend 1]   [Backend 2]   [Backend 3]
        |             |             |
        +-------------+-------------+
                      |
        +-------------+-------------+
        |             |             |
    [MongoDB]      [Redis]      [Agora]
```

### 15.2 Backend Deployment

**Docker Configuration:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

**Kubernetes Deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: uri
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: cache-secrets
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```


### 15.3 Mobile App Deployment

**iOS Deployment:**
1. Configure app signing in Xcode
2. Update version and build number
3. Archive the app
4. Upload to App Store Connect
5. Submit for review with metadata and screenshots

**Android Deployment:**
1. Configure signing key in `android/app/build.gradle`
2. Update version code and version name
3. Build release APK/AAB: `flutter build appbundle`
4. Upload to Google Play Console
5. Submit for review with metadata and screenshots

**Flutter Build Configuration:**
```yaml
flutter:
  uses-material-design: true
  
  assets:
    - assets/images/
    - assets/animations/
  
  fonts:
    - family: CustomFont
      fonts:
        - asset: fonts/CustomFont-Regular.ttf
        - asset: fonts/CustomFont-Bold.ttf
          weight: 700
```

### 15.4 Admin Dashboard Deployment

**Static Hosting:**
- Host on AWS S3 + CloudFront
- Or use Netlify/Vercel for automatic deployments
- Configure custom domain with SSL certificate

**Nginx Configuration:**
```nginx
server {
  listen 80;
  server_name admin.example.com;
  
  root /var/www/admin-dashboard;
  index index.html;
  
  location / {
    try_files $uri $uri/ /index.html;
  }
  
  location /api {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

### 15.5 Environment Configuration

**Backend Environment Variables:**
```env
NODE_ENV=production
PORT=3000

MONGODB_URI=mongodb://...
REDIS_URL=redis://...

FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

AGORA_APP_ID=...
AGORA_APP_CERTIFICATE=...

STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...

JWT_SECRET=...
ENCRYPTION_KEY=...

CDN_URL=https://cdn.example.com
```

**Mobile App Configuration:**
```dart
class Config {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.example.com'
  );
  
  static const String socketUrl = String.fromEnvironment(
    'SOCKET_URL',
    defaultValue: 'wss://api.example.com'
  );
  
  static const String agoraAppId = String.fromEnvironment('AGORA_APP_ID');
}
```

