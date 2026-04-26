# Implementation Plan: Social Live Streaming Application

## Overview

This implementation plan breaks down the social live streaming application into discrete, incremental coding tasks. The application consists of three main components: Flutter mobile app, Node.js backend service, and HTML/JavaScript admin dashboard. Each task builds on previous work and includes specific requirements references for traceability.

The implementation follows a bottom-up approach: core infrastructure first, then user features, followed by streaming capabilities, and finally admin tools.

## Tasks

- [x] 1. Backend: Project setup and core infrastructure
  - Initialize Node.js project with Express.js framework
  - Configure TypeScript or JavaScript with ESLint and Prettier
  - Set up MongoDB connection with connection pooling (min: 10, max: 100)
  - Set up Redis connection for caching and session management
  - Configure environment variable loading with validation
  - Create project structure: routes/, controllers/, models/, services/, middleware/
  - Set up Winston logger with structured logging (JSON format)
  - Implement global error handler middleware
  - Create health check endpoint at /health
  - _Requirements: 28.4, 34.1, 34.2, 34.4, 35.1, 35.3_

- [x] 2. Backend: Authentication and user management
  - [x] 2.1 Implement Firebase Authentication integration
    - Initialize Firebase Admin SDK with service account credentials
    - Create authentication middleware to verify Firebase tokens
    - Implement JWT token generation for session management
    - Create token verification middleware for protected routes
    - _Requirements: 1.5, 2.1, 2.4, 30.1, 30.2_
  
  - [x] 2.2 Implement user registration endpoints
    - Create POST /api/auth/register endpoint
    - Implement phone number registration with OTP validation
    - Implement email registration with OTP validation
    - Implement social media OAuth registration
    - Validate unique phone numbers and email addresses
    - Hash passwords with bcrypt (12 rounds)
    - Create user document in MongoDB users collection
    - Initialize user wallet on registration
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 31.1_
  
  - [x] 2.3 Implement user login and logout endpoints
    - Create POST /api/auth/login endpoint with credential validation
    - Create POST /api/auth/logout endpoint with session invalidation
    - Implement session timeout logic (30 days)
    - Return authentication token and user data on successful login
    - _Requirements: 2.1, 2.2, 2.3, 2.6_
  
  - [x] 2.4 Implement OTP sending service
    - Create POST /api/auth/send-otp endpoint
    - Integrate with Render email service for email OTP
    - Integrate with SMS gateway for phone OTP
    - Store OTP with 5-minute expiration in Redis
    - Implement rate limiting for OTP requests (5 per 15 minutes)
    - _Requirements: 1.2, 1.3_


- [x] 3. Backend: User profile and social features
  - [x] 3.1 Implement user profile endpoints
    - Create GET /api/users/:userId endpoint to retrieve public profile
    - Create PUT /api/users/:userId endpoint to update profile
    - Validate display name uniqueness before updates
    - Validate profile picture file size (max 5MB)
    - Implement image upload to CDN or cloud storage
    - _Requirements: 3.1, 3.2, 3.4, 3.5_
  
  - [x] 3.2 Implement social connection endpoints
    - Create POST /api/users/:userId/follow endpoint
    - Create DELETE /api/users/:userId/follow/:targetUserId endpoint
    - Update follower and following arrays in user documents
    - Create GET /api/users/:userId/followers endpoint with pagination
    - Create GET /api/users/:userId/following endpoint with pagination
    - Trigger notification on new follower
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 3.3 Implement user blocking and reporting
    - Create POST /api/users/:userId/block endpoint
    - Update blockedUserIds array in user document
    - Create POST /api/users/:userId/report endpoint
    - Store report in reports collection with all required fields
    - Implement blocking logic to prevent all interactions
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 4. Backend: Database models and indexes
  - [x] 4.1 Create MongoDB schemas and models
    - Define User model with all fields from design
    - Define Host model with statistics and approval fields
    - Define Stream model with viewer tracking and moderation
    - Define VoiceRoom model with participant management
    - Define Wallet model with balance tracking
    - Define Transaction model with metadata
    - Define VirtualGift model with pricing and assets
    - Define Report model with resolution tracking
    - Define Notification model with read status
    - Define WithdrawalRequest model with approval workflow
    - Define Agent model with commission tracking
    - _Requirements: All data requirements_
  
  - [x] 4.2 Create database indexes for performance
    - Create unique indexes on users: phoneNumber, email, displayName
    - Create compound index on users: { displayName: 1, isBlocked: 1 }
    - Create indexes on streams: hostId, status, startedAt
    - Create compound index on streams: { status: 1, startedAt: -1 }
    - Create compound index on transactions: { userId: 1, timestamp: -1 }
    - Create compound index on notifications: { userId: 1, isRead: 1, createdAt: -1 }
    - Create compound index on reports: { status: 1, submittedAt: -1 }
    - Create indexes on chatMessages: streamId, voiceRoomId, timestamp
    - _Requirements: 39.1, 39.5_


- [x] 5. Backend: Real-time communication with Socket.io
  - [x] 5.1 Set up Socket.io server with Redis adapter
    - Install and configure Socket.io with Express server
    - Configure Redis adapter for horizontal scaling
    - Implement authentication middleware for WebSocket connections
    - Set up room-based message broadcasting
    - Implement heartbeat mechanism for connection health
    - _Requirements: 28.1, 28.2, 28.3_
  
  - [x] 5.2 Implement stream-related WebSocket events
    - Handle 'stream:join' event to add viewer to stream room
    - Handle 'stream:leave' event to remove viewer from stream room
    - Handle 'stream:chat' event to broadcast chat messages
    - Handle 'stream:gift' event to process and broadcast gifts
    - Emit 'stream:viewer-joined' to notify other viewers
    - Emit 'stream:viewer-left' to notify other viewers
    - Emit 'stream:chat-message' to broadcast messages within 500ms
    - Emit 'stream:gift-sent' to trigger gift animations
    - Emit 'stream:ended' when host ends stream
    - Emit 'stream:moderation' for mute/kick actions
    - _Requirements: 6.1, 7.1, 8.1, 8.2, 9.3, 10.1, 10.2, 10.3_
  
  - [x] 5.3 Implement voice room WebSocket events
    - Handle 'voice:join' event to add participant to voice room
    - Handle 'voice:leave' event to remove participant from voice room
    - Handle 'voice:raise-hand' event to notify host
    - Handle 'voice:chat' event to broadcast text messages
    - Emit 'voice:participant-joined' to notify room members
    - Emit 'voice:participant-left' to notify room members
    - Emit 'voice:role-changed' when speaker/listener role changes
    - Emit 'voice:hand-raised' to notify host
    - _Requirements: 11.1, 11.5, 12.1, 12.4, 12.5, 12.6, 13.1, 13.2_
  
  - [x] 5.4 Implement notification WebSocket events
    - Emit 'notification:new' for real-time notifications
    - Ensure notification delivery within 2 seconds
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.7_

- [x] 6. Backend: Live streaming endpoints
  - [x] 6.1 Implement stream start endpoint
    - Create POST /api/streams/start endpoint
    - Validate host permissions (isHost flag)
    - Check system capacity (max 5000 concurrent viewers)
    - Generate Agora channel ID and token
    - Create stream document in MongoDB
    - Allocate streaming resources
    - Return stream ID, Agora channel ID, and token
    - _Requirements: 6.1, 6.6, 28.1_
  
  - [x] 6.2 Implement stream end endpoint
    - Create POST /api/streams/:streamId/end endpoint
    - Validate host ownership
    - Update stream document with end time and statistics
    - Release streaming resources
    - Broadcast 'stream:ended' event to all viewers
    - Return stream statistics
    - _Requirements: 6.4, 6.5, 7.5_
  
  - [x] 6.3 Implement stream viewing endpoints
    - Create GET /api/streams/active endpoint with pagination
    - Create POST /api/streams/:streamId/join endpoint
    - Generate Agora viewer token
    - Add viewer to currentViewerIds array
    - Return playback URL and chat token
    - Create POST /api/streams/:streamId/leave endpoint
    - Remove viewer from currentViewerIds array
    - Update viewer count
    - _Requirements: 7.1, 7.3, 7.6_


  - [x] 6.4 Implement stream chat endpoints
    - Create POST /api/streams/:streamId/chat endpoint
    - Validate message length (max 500 characters)
    - Store message in chatMessages collection
    - Broadcast message via WebSocket within 500ms
    - Create POST /api/streams/:streamId/pin-message endpoint
    - Update message isPinned flag
    - Broadcast pinned message to all viewers
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [x] 6.5 Implement stream moderation endpoints
    - Create POST /api/streams/:streamId/moderate endpoint
    - Validate host or moderator permissions
    - Implement mute action (add to mutedUserIds)
    - Implement kick action (add to kickedUserIds, remove from viewers)
    - Implement block action (add to host's blockedUserIds)
    - Implement moderator assignment (add to moderatorIds)
    - Broadcast moderation actions via WebSocket
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 7. Backend: Virtual gift system
  - [x] 7.1 Create virtual gifts catalog
    - Create POST /api/admin/gifts endpoint to add gifts
    - Create GET /api/gifts endpoint to list available gifts
    - Store gift data with coin price, diamond value, and asset URLs
    - Implement gift categories for organization
    - _Requirements: 9.1_
  
  - [x] 7.2 Implement gift sending endpoint
    - Create POST /api/streams/:streamId/gift endpoint
    - Validate viewer has sufficient coins in wallet
    - Deduct coin price from viewer's wallet atomically
    - Convert coins to diamonds using conversion rate
    - Credit diamonds to host's wallet atomically
    - Create transaction records for both users
    - Broadcast gift animation via WebSocket
    - Send notification to host
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 14.5_

- [x] 8. Backend: Wallet and transaction management
  - [x] 8.1 Implement wallet endpoints
    - Create GET /api/wallet/:userId endpoint
    - Return coin balance, diamond balance, and recent transactions
    - Create GET /api/wallet/transactions/:userId endpoint with pagination
    - Implement filtering by transaction type
    - Ensure wallet balances cannot become negative
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  
  - [x] 8.2 Implement transaction recording service
    - Create transaction service to record all wallet changes
    - Implement atomic wallet updates with transaction logging
    - Store transaction metadata (gift ID, stream ID, payment info)
    - Ensure transaction history is immutable
    - _Requirements: 14.3_


- [x] 9. Backend: Payment gateway integration
  - [x] 9.1 Implement payment service abstraction
    - Create PaymentService class with gateway abstraction
    - Define common interface for all payment gateways
    - Implement payment session creation
    - Implement webhook verification
    - Implement fraud detection checks
    - _Requirements: 17.1, 17.5, 32.4_
  
  - [x] 9.2 Integrate Stripe payment gateway
    - Install Stripe SDK
    - Implement StripeGateway class
    - Create checkout session creation
    - Implement webhook signature verification
    - Create POST /api/wallet/webhook/stripe endpoint
    - _Requirements: 17.1, 17.3, 17.4, 32.3_
  
  - [x] 9.3 Integrate PayPal payment gateway
    - Install PayPal SDK
    - Implement PayPalGateway class
    - Create payment order creation
    - Implement webhook verification
    - Create POST /api/wallet/webhook/paypal endpoint
    - _Requirements: 17.1, 17.3, 17.4_
  
  - [x] 9.4 Integrate Mada and stc pay gateways
    - Implement MadaGateway class with provider API
    - Implement StcPayGateway class with provider API
    - Create webhook endpoints for both gateways
    - _Requirements: 17.1, 17.3, 17.4_
  
  - [x] 9.5 Implement coin purchase flow
    - Create POST /api/wallet/purchase-coins endpoint
    - Define coin packages with prices
    - Create payment session with selected gateway
    - Store payment intent in database
    - Return payment URL to client
    - Implement webhook handler to credit coins on success
    - Verify payment authenticity before crediting
    - Log all payment attempts with IP and device info
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 32.5_

- [x] 10. Backend: Host and agency management
  - [x] 10.1 Implement host registration
    - Create POST /api/hosts/register endpoint
    - Store host profile with pending approval status
    - Create GET /api/admin/hosts/pending endpoint for admin review
    - Create PUT /api/admin/hosts/:hostId/approve endpoint
    - Update user isHost flag on approval
    - _Requirements: 18.1, 18.2, 18.3, 18.5_
  
  - [x] 10.2 Implement host earnings dashboard
    - Create GET /api/hosts/:userId/earnings endpoint
    - Calculate total diamonds earned from transactions
    - Calculate pending withdrawal amounts
    - Calculate completed withdrawal amounts
    - Return earnings breakdown
    - _Requirements: 18.4_
  
  - [x] 10.3 Implement diamond withdrawal system
    - Create POST /api/wallet/withdraw endpoint
    - Validate minimum diamond balance (1000 diamonds)
    - Calculate real credit amount using conversion rate
    - Create withdrawal request in database
    - Set status to pending
    - Create GET /api/wallet/withdrawals/:userId endpoint
    - Return withdrawal request history with status
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_


  - [x] 10.4 Implement agency system
    - Create POST /api/admin/agents/register endpoint
    - Store agent profile with commission rate
    - Create PUT /api/admin/hosts/:hostId/assign-agent endpoint
    - Record host-agent relationship in host document
    - Implement commission calculation on host earnings
    - Credit commission to agent wallet automatically
    - Create GET /api/admin/agents/:agentId/commissions endpoint
    - Return commission reports with per-host breakdown
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 20.1, 20.2, 20.3, 20.4_

- [ ] 11. Backend: Voice room implementation
  - [ ] 11.1 Implement voice room creation
    - Create POST /api/voice-rooms/create endpoint
    - Allocate Agora audio channel
    - Create voice room document with host and settings
    - Generate Agora audio token for host
    - Return room ID and audio token
    - _Requirements: 11.1, 11.2, 11.3_
  
  - [ ] 11.2 Implement voice room participation
    - Create POST /api/voice-rooms/:roomId/join endpoint
    - Add user as listener by default
    - Generate Agora audio token
    - Return token and current participants list
    - Create POST /api/voice-rooms/:roomId/leave endpoint
    - Remove user from participants array
    - Broadcast participant left event
    - _Requirements: 11.4, 11.5, 12.3_
  
  - [ ] 11.3 Implement voice room controls
    - Create POST /api/voice-rooms/:roomId/raise-hand endpoint
    - Update participant isHandRaised flag
    - Broadcast hand raise event to host
    - Create POST /api/voice-rooms/:roomId/promote endpoint
    - Validate host permissions
    - Change participant role to speaker
    - Broadcast role change event
    - Create POST /api/voice-rooms/:roomId/demote endpoint
    - Change participant role to listener
    - Broadcast role change event
    - _Requirements: 12.4, 12.5, 12.6_
  
  - [ ] 11.4 Implement voice room chat
    - Create POST /api/voice-rooms/:roomId/chat endpoint
    - Validate message length (max 500 characters)
    - Store message in chatMessages collection
    - Broadcast message via WebSocket within 500ms
    - _Requirements: 13.1, 13.2, 13.3_

- [ ] 12. Backend: Notification system
  - [ ] 12.1 Implement notification service
    - Initialize Firebase Cloud Messaging (FCM)
    - Create NotificationService class
    - Implement sendNotification method with FCM
    - Implement notification preference checking
    - Store notification in database
    - Handle FCM token registration
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.6, 27.7_
  
  - [ ] 12.2 Implement notification triggers
    - Trigger notification on stream start to all followers
    - Trigger notification on gift received
    - Trigger notification on new follower
    - Trigger notification on new message
    - Ensure delivery within 2 seconds
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.7_
  
  - [ ] 12.3 Implement notification endpoints
    - Create GET /api/notifications/:userId endpoint with pagination
    - Create PUT /api/notifications/:notificationId/read endpoint
    - Create PUT /api/users/:userId/notification-preferences endpoint
    - _Requirements: 27.5, 27.6_


- [ ] 13. Backend: Admin dashboard API endpoints
  - [ ] 13.1 Implement admin user management endpoints
    - Create GET /api/admin/users endpoint with search and pagination
    - Create GET /api/admin/users/:userId endpoint for detailed view
    - Create PUT /api/admin/users/:userId endpoint to edit user data
    - Implement user blocking (set isBlocked flag)
    - Create GET /api/admin/users/:userId/activity endpoint for logs
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_
  
  - [ ] 13.2 Implement admin stream monitoring endpoints
    - Create GET /api/admin/streams endpoint with status filter
    - Create GET /api/admin/streams/:streamId endpoint for details
    - Create POST /api/admin/streams/:streamId/terminate endpoint
    - Immediately end stream and notify host
    - Create POST /api/admin/streams/:streamId/flag endpoint
    - Store flagged streams for review
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5_
  
  - [ ] 13.3 Implement admin financial tracking endpoints
    - Create GET /api/admin/analytics/revenue endpoint
    - Calculate total revenue with daily/weekly/monthly breakdowns
    - Create GET /api/admin/analytics/diamonds endpoint
    - Calculate total diamonds earned by hosts
    - Create GET /api/admin/withdrawals endpoint with status filter
    - Create PUT /api/admin/withdrawals/:withdrawalId endpoint
    - Implement approval and rejection logic
    - Create GET /api/admin/transactions endpoint with filters
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5_
  
  - [ ] 13.4 Implement admin report handling endpoints
    - Create GET /api/admin/reports endpoint with filters
    - Create GET /api/admin/reports/:reportId endpoint for details
    - Create PUT /api/admin/reports/:reportId endpoint to resolve
    - Implement warning, suspension, and ban actions
    - Store resolution history
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5_
  
  - [ ] 13.5 Implement admin analytics endpoints
    - Create GET /api/admin/analytics/users endpoint
    - Return total users and growth trends
    - Create GET /api/admin/analytics/streams endpoint
    - Return active stream count and historical data
    - Create GET /api/admin/analytics/engagement endpoint
    - Calculate daily active users and session duration
    - Create GET /api/admin/analytics/export endpoint
    - Export analytics data in CSV format
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5_
  
  - [ ] 13.6 Implement content moderation endpoints
    - Create POST /api/admin/moderation/keywords endpoint
    - Store keyword filtering rules
    - Create GET /api/admin/moderation/keywords endpoint
    - Implement keyword matching in chat middleware
    - Block messages matching filtered keywords
    - Log violations in moderation logs
    - Create GET /api/admin/moderation/logs endpoint
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5_

- [ ] 14. Backend: Security and performance features
  - [ ] 14.1 Implement rate limiting
    - Install rate limiting middleware
    - Configure Redis store for distributed rate limiting
    - Apply rate limits: auth (5/15min), API (100/min), chat (5/sec), payment (10/hour)
    - Return 429 status on rate limit exceeded
    - _Requirements: 30.3_
  
  - [ ] 14.2 Implement input validation and sanitization
    - Create validation schemas for all endpoints
    - Implement request validation middleware
    - Sanitize HTML in user-generated content
    - Validate file uploads (type, size, content)
    - _Requirements: 30.6_
  
  - [ ] 14.3 Implement caching layer
    - Configure Redis caching with TTL
    - Cache user profiles (5 min TTL)
    - Cache stream list (10 sec TTL)
    - Cache virtual gifts (1 hour TTL)
    - Cache wallet balance (1 min TTL)
    - Implement cache invalidation on updates
    - _Requirements: 39.2_


  - [ ] 14.4 Implement monitoring and logging
    - Set up Prometheus metrics collection
    - Track API request duration by route and status
    - Track active streams count
    - Track concurrent viewers count
    - Implement request tracking middleware
    - Log all API requests with response time
    - Expose /metrics endpoint for Prometheus
    - _Requirements: 29.1, 29.2, 29.3_
  
  - [ ] 14.5 Implement circuit breaker for external services
    - Create CircuitBreaker class
    - Wrap Agora API calls with circuit breaker
    - Wrap payment gateway calls with circuit breaker
    - Wrap email service calls with circuit breaker
    - Configure failure threshold and timeout
    - _Requirements: 36.3_
  
  - [ ] 14.6 Implement error handling and recovery
    - Create custom error classes (ValidationError, AuthenticationError, etc.)
    - Implement retry logic with exponential backoff
    - Implement graceful degradation with feature flags
    - Ensure structured error logging with context
    - _Requirements: 35.1, 35.2, 36.1, 36.2, 36.4_

- [ ] 15. Checkpoint - Backend core functionality complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Mobile App: Flutter project setup
  - [ ] 16.1 Initialize Flutter project
    - Create new Flutter project with proper package name
    - Configure iOS and Android app identifiers
    - Set up project structure: core/, models/, providers/, screens/, widgets/
    - Add dependencies: dio, provider, socket_io_client, agora_rtc_engine, firebase_core, firebase_auth, firebase_messaging
    - Configure Flutter version constraints
    - _Requirements: 33.1, 33.2_
  
  - [ ] 16.2 Configure Firebase for mobile app
    - Add Firebase configuration files (google-services.json, GoogleService-Info.plist)
    - Initialize Firebase in main.dart
    - Configure Firebase Authentication
    - Configure Firebase Cloud Messaging for push notifications
    - Request notification permissions
    - _Requirements: 1.5, 27.5_
  
  - [ ] 16.3 Set up app theme and constants
    - Create theme configuration with colors and typography
    - Define app constants (API URLs, Agora app ID)
    - Create environment configuration for dev/prod
    - Set up app routing with named routes
    - _Requirements: General UI requirements_

- [ ] 17. Mobile App: Core services
  - [ ] 17.1 Implement API service
    - Create ApiService class with Dio HTTP client
    - Configure base URL and timeouts (10 seconds)
    - Implement authentication interceptor to add token to headers
    - Implement logging interceptor for debugging
    - Create custom ApiException class
    - Implement error handling for network errors
    - _Requirements: 30.5_
  
  - [ ] 17.2 Implement authentication service
    - Create AuthService class
    - Implement phone number authentication with Firebase
    - Implement email authentication with Firebase
    - Implement social OAuth (Google, Facebook, Apple)
    - Store authentication token in secure storage (flutter_secure_storage)
    - Implement token refresh logic
    - _Requirements: 1.1, 1.5, 2.1, 2.4_


  - [ ] 17.3 Implement WebSocket service
    - Create SocketService class with Socket.io client
    - Implement connection with authentication token
    - Set up event listeners for all WebSocket events
    - Implement automatic reconnection handling
    - Create StreamController for each event type
    - Implement disconnect and cleanup methods
    - _Requirements: 28.2, 28.3_
  
  - [ ] 17.4 Implement storage service
    - Create StorageService class with flutter_secure_storage
    - Implement token storage and retrieval
    - Implement user data caching
    - Implement secure credential storage
    - _Requirements: 2.4_

- [ ] 18. Mobile App: Data models
  - [ ] 18.1 Create Dart data models
    - Create User model with fromJson and toJson methods
    - Create Stream model with fromJson and toJson methods
    - Create VoiceRoom model with fromJson and toJson methods
    - Create Wallet model with fromJson and toJson methods
    - Create Transaction model with fromJson and toJson methods
    - Create VirtualGift model with fromJson and toJson methods
    - Create ChatMessage model with fromJson and toJson methods
    - Create Notification model with fromJson and toJson methods
    - Implement JSON serialization for all models
    - _Requirements: All data requirements_

- [ ] 19. Mobile App: State management with Provider
  - [ ] 19.1 Implement AuthProvider
    - Create AuthProvider extending ChangeNotifier
    - Implement login method with API call
    - Implement logout method with token cleanup
    - Implement registration methods (phone, email, social)
    - Store current user and authentication state
    - Notify listeners on state changes
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3_
  
  - [ ] 19.2 Implement UserProvider
    - Create UserProvider extending ChangeNotifier
    - Implement profile update method
    - Implement follow/unfollow methods
    - Implement block user method
    - Implement report user method
    - Maintain follower and following lists
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 5.1, 5.3_
  
  - [ ] 19.3 Implement StreamProvider
    - Create StreamProvider extending ChangeNotifier
    - Implement fetch active streams method
    - Implement join stream method
    - Implement leave stream method
    - Maintain current stream state
    - Handle stream events from WebSocket
    - _Requirements: 6.1, 6.4, 7.1, 7.5_
  
  - [ ] 19.4 Implement WalletProvider
    - Create WalletProvider extending ChangeNotifier
    - Implement fetch wallet balance method
    - Implement fetch transaction history method
    - Implement purchase coins method
    - Implement send gift method
    - Update balance on transactions
    - _Requirements: 14.1, 14.2, 14.3, 15.1, 15.2, 9.2_
  
  - [ ] 19.5 Implement NotificationProvider
    - Create NotificationProvider extending ChangeNotifier
    - Implement fetch notifications method
    - Implement mark as read method
    - Handle real-time notification events
    - Maintain unread count
    - _Requirements: 27.5, 27.6_


- [ ] 20. Mobile App: Authentication screens
  - [ ] 20.1 Create login screen
    - Build login UI with phone/email input fields
    - Add social login buttons (Google, Facebook, Apple)
    - Implement form validation
    - Call AuthProvider login method
    - Navigate to home on success
    - Display error messages on failure
    - _Requirements: 2.1, 2.2_
  
  - [ ] 20.2 Create registration screen
    - Build registration UI with input fields
    - Add phone number registration with OTP
    - Add email registration with OTP
    - Add social registration options
    - Implement form validation
    - Call AuthProvider register method
    - Navigate to home on success
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [ ] 20.3 Create OTP verification screen
    - Build OTP input UI with 6-digit code entry
    - Implement OTP resend functionality
    - Display countdown timer (5 minutes)
    - Verify OTP with backend
    - Navigate to home on success
    - _Requirements: 1.2, 1.3_

- [ ] 21. Mobile App: Home and navigation
  - [ ] 21.1 Create main navigation structure
    - Build bottom navigation bar with tabs: Home, Discover, Profile, Wallet
    - Implement tab switching
    - Maintain state across tabs
    - _Requirements: General navigation_
  
  - [ ] 21.2 Create home screen
    - Build home screen with active streams list
    - Display stream thumbnails, host names, viewer counts
    - Implement pull-to-refresh
    - Implement infinite scroll pagination
    - Navigate to stream view on tap
    - _Requirements: 7.1, 7.3_
  
  - [ ] 21.3 Create discover screen
    - Display voice rooms list
    - Display featured hosts
    - Implement search functionality
    - Navigate to voice room or profile on tap
    - _Requirements: 11.4_

- [ ] 22. Mobile App: User profile screens
  - [ ] 22.1 Create profile view screen
    - Display user profile information (name, bio, picture)
    - Display follower and following counts
    - Display follow button for other users
    - Display edit button for own profile
    - Display user's past streams
    - Implement follow/unfollow functionality
    - _Requirements: 3.1, 3.3, 4.3, 4.4_
  
  - [ ] 22.2 Create profile edit screen
    - Build edit form with display name, bio, profile picture
    - Implement image picker for profile picture
    - Validate display name uniqueness
    - Validate image size (max 5MB)
    - Call UserProvider update method
    - Display success/error messages
    - _Requirements: 3.1, 3.2, 3.4, 3.5_
  
  - [ ] 22.3 Create followers/following list screens
    - Display paginated list of followers
    - Display paginated list of following
    - Show user avatars and names
    - Navigate to user profile on tap
    - _Requirements: 4.4_


- [ ] 23. Mobile App: Live streaming implementation
  - [ ] 23.1 Implement Agora streaming service
    - Create StreamService class
    - Initialize Agora RTC engine with app ID
    - Implement startBroadcasting method for hosts
    - Implement joinAsViewer method for viewers
    - Configure video encoder (1280x720, 30fps, 2000kbps)
    - Implement leaveChannel method
    - Handle Agora callbacks and events
    - _Requirements: 6.1, 6.2, 7.1, 7.2_
  
  - [ ] 23.2 Create stream broadcast screen (host)
    - Build broadcast UI with video preview
    - Display viewer count in real-time
    - Display chat messages overlay
    - Add end stream button
    - Add moderation controls (mute, kick, block)
    - Implement gift animation display
    - Call backend to start stream
    - Initialize Agora broadcasting
    - Handle stream end
    - _Requirements: 6.1, 6.4, 8.2, 9.3, 10.1, 10.2, 10.3, 10.5_
  
  - [ ] 23.3 Create stream viewer screen
    - Build viewer UI with video player
    - Display host information and viewer count
    - Display chat messages overlay
    - Add chat input field
    - Add gift sending button
    - Implement adaptive video quality
    - Call backend to join stream
    - Initialize Agora viewer mode
    - Handle stream ended event
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 9.2, 9.3_
  
  - [ ] 23.4 Implement stream chat widget
    - Create chat message list widget
    - Display messages with sender name and timestamp
    - Auto-scroll to latest message
    - Highlight pinned messages
    - Implement chat input with send button
    - Validate message length (max 500 characters)
    - Send messages via WebSocket
    - Receive and display messages in real-time
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ] 23.5 Implement gift sending UI
    - Create gift selection bottom sheet
    - Display available gifts with prices
    - Show user's coin balance
    - Implement gift selection and confirmation
    - Call backend to send gift
    - Display gift animation on success
    - Update wallet balance
    - Show insufficient funds error if needed
    - _Requirements: 9.1, 9.2, 9.3, 9.5_
  
  - [ ] 23.6 Implement host moderation UI
    - Create moderation menu for viewers
    - Add mute, kick, block, assign moderator options
    - Show confirmation dialogs
    - Call backend moderation endpoint
    - Update UI based on moderation actions
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 24. Mobile App: Voice room implementation
  - [ ] 24.1 Create voice room screen
    - Build voice room UI with participant grid
    - Display host and speakers prominently
    - Display listeners list
    - Show speaking indicators
    - Add raise hand button for listeners
    - Add chat panel
    - Implement leave room button
    - _Requirements: 11.1, 11.4, 11.5, 12.1, 12.3, 12.4_
  
  - [ ] 24.2 Implement voice room audio
    - Initialize Agora audio engine
    - Implement audio-only mode
    - Handle speaker role (enable microphone)
    - Handle listener role (disable microphone)
    - Implement mute/unmute controls
    - Handle role changes from host
    - _Requirements: 12.1, 12.2, 12.3, 12.5, 12.6_
  
  - [ ] 24.3 Implement voice room controls
    - Implement raise hand functionality
    - Implement promote to speaker (host only)
    - Implement demote to listener (host only)
    - Update UI based on role changes
    - Handle WebSocket events for role changes
    - _Requirements: 12.4, 12.5, 12.6_
  
  - [ ] 24.4 Implement voice room chat
    - Create chat widget for voice rooms
    - Display text messages with sender names
    - Implement chat input and send
    - Validate message length (max 500 characters)
    - Send messages via WebSocket
    - Receive and display messages in real-time
    - _Requirements: 13.1, 13.2, 13.3_


- [ ] 25. Mobile App: Wallet and payments
  - [ ] 25.1 Create wallet screen
    - Display coin balance and diamond balance
    - Display transaction history with pagination
    - Add purchase coins button
    - Add withdraw diamonds button (hosts only)
    - Implement transaction filtering by type
    - _Requirements: 14.1, 14.2, 14.3, 14.4_
  
  - [ ] 25.2 Create coin purchase screen
    - Display coin packages with prices
    - Show payment method options (Stripe, PayPal, Mada, stc pay)
    - Implement package selection
    - Call backend to create payment session
    - Open payment URL in webview or browser
    - Handle payment success/failure callbacks
    - Update wallet balance on success
    - _Requirements: 15.1, 15.2, 15.3, 15.6, 17.2_
  
  - [ ] 25.3 Create withdrawal screen (hosts only)
    - Display diamond balance and equivalent credit
    - Show minimum withdrawal amount (1000 diamonds)
    - Implement withdrawal request form
    - Call backend to create withdrawal request
    - Display withdrawal status
    - Show withdrawal history
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_
  
  - [ ] 25.4 Create host earnings dashboard
    - Display total diamonds earned
    - Display pending withdrawals
    - Display completed withdrawals
    - Show earnings breakdown by stream
    - Display top gifters
    - _Requirements: 18.4_

- [ ] 26. Mobile App: Notifications
  - [ ] 26.1 Implement push notification handling
    - Configure FCM token registration
    - Send FCM token to backend on login
    - Handle foreground notifications
    - Handle background notifications
    - Handle notification tap to navigate to relevant screen
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5_
  
  - [ ] 26.2 Create notifications screen
    - Display notification list with pagination
    - Show notification icon, title, message, timestamp
    - Highlight unread notifications
    - Implement mark as read on tap
    - Navigate to relevant screen on notification tap
    - _Requirements: 27.5_
  
  - [ ] 26.3 Create notification preferences screen
    - Display toggle switches for each notification type
    - Stream start notifications
    - Gift received notifications
    - New follower notifications
    - Message notifications
    - Save preferences to backend
    - _Requirements: 27.6_

- [ ] 27. Mobile App: Additional features
  - [ ] 27.1 Implement image caching
    - Create ImageCache class with LRU cache
    - Cache profile pictures and gift images
    - Implement lazy loading for image lists
    - Display placeholder while loading
    - _Requirements: 40.2, 40.3, 40.5_
  
  - [ ] 27.2 Implement error handling
    - Create error boundary widgets
    - Display user-friendly error messages
    - Implement retry mechanisms
    - Log errors for debugging
    - Prevent app crashes from errors
    - _Requirements: 36.1, 36.2_
  
  - [ ] 27.3 Implement blocking and reporting UI
    - Add block user option in profile menu
    - Add report user option in profile menu
    - Create report form with reason selection
    - Call backend to block/report user
    - Update UI to hide blocked user content
    - _Requirements: 5.1, 5.2, 5.3_


- [ ] 28. Checkpoint - Mobile app core functionality complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 29. Admin Dashboard: Project setup
  - [ ] 29.1 Create HTML structure
    - Create index.html with semantic HTML5 structure
    - Set up navigation sidebar with menu items
    - Create main content area for dynamic content
    - Add TailwindCSS CDN or build setup
    - Include Chart.js library for analytics
    - Include Socket.io client library
    - _Requirements: General admin dashboard structure_
  
  - [ ] 29.2 Create CSS styling
    - Configure TailwindCSS theme
    - Create custom CSS for dashboard layout
    - Style navigation sidebar
    - Style data tables
    - Style cards and statistics widgets
    - Ensure responsive design
    - _Requirements: General UI requirements_
  
  - [ ] 29.3 Set up JavaScript modules
    - Create main.js for initialization
    - Create api.js for API client
    - Create auth.js for authentication
    - Create users.js for user management
    - Create streams.js for stream monitoring
    - Create reports.js for report handling
    - Create analytics.js for analytics display
    - Create withdrawals.js for withdrawal management
    - _Requirements: General admin functionality_

- [ ] 30. Admin Dashboard: Authentication
  - [ ] 30.1 Implement admin login
    - Create login page with email and password fields
    - Implement login form submission
    - Call backend admin login endpoint
    - Store admin token in localStorage
    - Redirect to dashboard on success
    - Display error messages on failure
    - _Requirements: Admin authentication_
  
  - [ ] 30.2 Implement API client
    - Create AdminAPI class
    - Implement request method with authentication header
    - Handle API errors and display messages
    - Implement token refresh logic
    - _Requirements: 30.1, 30.2_

- [ ] 31. Admin Dashboard: User management
  - [ ] 31.1 Create users list page
    - Display users table with columns: ID, name, email, status, registered date
    - Implement search functionality
    - Implement pagination
    - Add view, edit, block buttons for each user
    - Fetch users from backend API
    - _Requirements: 21.1_
  
  - [ ] 31.2 Create user detail view
    - Display detailed user information
    - Display user activity logs
    - Display user statistics (streams, followers, transactions)
    - Add edit and block buttons
    - Fetch user details from backend
    - _Requirements: 21.2, 21.5_
  
  - [ ] 31.3 Implement user editing
    - Create edit user modal or page
    - Allow editing display name, email, status
    - Implement form validation
    - Call backend to update user
    - Refresh user list on success
    - _Requirements: 21.4_
  
  - [ ] 31.4 Implement user blocking
    - Add block/unblock button
    - Show confirmation dialog
    - Call backend to block user
    - Update user status in UI
    - _Requirements: 21.3_


- [ ] 32. Admin Dashboard: Stream monitoring
  - [ ] 32.1 Create active streams page
    - Display active streams table with host, viewers, duration
    - Show real-time viewer count updates
    - Add view and terminate buttons
    - Implement auto-refresh every 10 seconds
    - Fetch active streams from backend
    - _Requirements: 22.1_
  
  - [ ] 32.2 Implement stream viewing
    - Create stream viewer modal
    - Embed stream video player
    - Display stream chat
    - Allow admin to view any active stream
    - _Requirements: 22.2_
  
  - [ ] 32.3 Implement stream termination
    - Add terminate button with confirmation
    - Call backend to terminate stream
    - Remove stream from active list
    - Show success message
    - _Requirements: 22.3_
  
  - [ ] 32.4 Create stream history page
    - Display past streams table with filters
    - Show stream metadata and statistics
    - Add flag for review button
    - Implement pagination
    - _Requirements: 22.4, 22.5_
  
  - [ ] 32.5 Implement real-time updates
    - Connect to backend via Socket.io
    - Listen for stream:started event
    - Listen for stream:ended event
    - Update active streams list in real-time
    - _Requirements: 22.1_

- [ ] 33. Admin Dashboard: Financial tracking
  - [ ] 33.1 Create revenue dashboard
    - Display total revenue card
    - Display revenue by time period (daily, weekly, monthly)
    - Create revenue chart with Chart.js
    - Display revenue breakdown by payment method
    - Fetch revenue data from backend
    - _Requirements: 23.1_
  
  - [ ] 33.2 Create diamonds tracking page
    - Display total diamonds earned by all hosts
    - Display top earning hosts
    - Create diamonds earned chart over time
    - _Requirements: 23.2_
  
  - [ ] 33.3 Create withdrawals management page
    - Display withdrawal requests table with status filter
    - Show pending, approved, rejected, completed withdrawals
    - Display host name, amount, request date, status
    - Add approve and reject buttons for pending requests
    - Implement pagination
    - _Requirements: 23.3, 23.4_
  
  - [ ] 33.4 Implement withdrawal approval
    - Create approval modal with notes field
    - Call backend to approve withdrawal
    - Update withdrawal status in UI
    - Show success message
    - _Requirements: 23.4_
  
  - [ ] 33.5 Create transactions page
    - Display all transactions table
    - Implement filters: user, date range, transaction type
    - Show transaction details: user, type, amount, date
    - Implement pagination
    - Add export to CSV button
    - _Requirements: 23.5_


- [ ] 34. Admin Dashboard: Report handling
  - [ ] 34.1 Create reports list page
    - Display reports table with status filter
    - Show reporter, reported user, reason, date, status
    - Add view and resolve buttons
    - Implement pagination
    - Fetch reports from backend
    - _Requirements: 24.1_
  
  - [ ] 34.2 Create report detail view
    - Display full report details
    - Show evidence and context
    - Display reported user profile link
    - Add action buttons: warn, suspend, ban
    - Add resolution notes field
    - _Requirements: 24.2_
  
  - [ ] 34.3 Implement report resolution
    - Create resolution modal with action selection
    - Add notes field for resolution details
    - Call backend to resolve report
    - Update report status in UI
    - Show success message
    - _Requirements: 24.3, 24.4_
  
  - [ ] 34.4 Create resolution history page
    - Display resolved reports
    - Show resolution action and notes
    - Display resolved by admin and date
    - Implement filtering and search
    - _Requirements: 24.5_
  
  - [ ] 34.5 Implement real-time report notifications
    - Listen for report:new event via Socket.io
    - Show notification badge on reports menu
    - Display toast notification for new reports
    - _Requirements: 24.1_

- [ ] 35. Admin Dashboard: Analytics
  - [ ] 35.1 Create analytics overview page
    - Display key metrics cards: total users, active streams, revenue
    - Create user growth chart with Chart.js
    - Create stream activity chart
    - Create revenue trend chart
    - Fetch analytics data from backend
    - _Requirements: 25.1, 25.2, 25.3_
  
  - [ ] 35.2 Create user analytics page
    - Display total registered users
    - Display user growth trends (daily, weekly, monthly)
    - Create user registration chart
    - Display user demographics if available
    - _Requirements: 25.1_
  
  - [ ] 35.3 Create engagement analytics page
    - Display daily active users (DAU)
    - Display average session duration
    - Create engagement metrics chart
    - Display user retention metrics
    - _Requirements: 25.4_
  
  - [ ] 35.4 Implement analytics export
    - Add export button on analytics pages
    - Call backend export endpoint
    - Download CSV file with analytics data
    - Support date range selection for export
    - _Requirements: 25.5_

- [ ] 36. Admin Dashboard: Content moderation
  - [ ] 36.1 Create keyword filtering page
    - Display current filtered keywords list
    - Add form to add new keywords
    - Add delete button for each keyword
    - Call backend to save keyword rules
    - _Requirements: 26.1, 26.2_
  
  - [ ] 36.2 Create moderation rules page
    - Display automated moderation rules
    - Add form to create new rules
    - Implement rule enable/disable toggle
    - Call backend to save rules
    - _Requirements: 26.3, 26.4_
  
  - [ ] 36.3 Create moderation logs page
    - Display moderation actions log
    - Show user, content, action taken, date
    - Implement filtering by action type
    - Implement search by user
    - Implement pagination
    - _Requirements: 26.5_


- [ ] 37. Admin Dashboard: Host and agency management
  - [ ] 37.1 Create host approval page
    - Display pending host registrations
    - Show host application details
    - Add approve and reject buttons
    - Call backend to approve/reject host
    - Update list on action
    - _Requirements: 18.3, 18.5_
  
  - [ ] 37.2 Create hosts list page
    - Display all approved hosts
    - Show host statistics: streams, earnings, viewers
    - Add view details button
    - Implement search and filtering
    - _Requirements: 18.4_
  
  - [ ] 37.3 Create agents management page
    - Display agents list
    - Add create agent button
    - Show agent commission rate and total earnings
    - Add edit and deactivate buttons
    - _Requirements: 19.1, 19.2_
  
  - [ ] 37.4 Implement agent creation
    - Create agent form with name, email, commission rate
    - Validate form inputs
    - Call backend to create agent
    - Add agent to list
    - _Requirements: 19.1, 19.2_
  
  - [ ] 37.5 Implement host-agent assignment
    - Add assign agent dropdown in host details
    - Display current agent if assigned
    - Call backend to assign host to agent
    - Update host details
    - _Requirements: 19.3, 19.4_
  
  - [ ] 37.6 Create agent commission reports
    - Display agent commission dashboard
    - Show total commissions earned
    - Display per-host commission breakdown
    - Create commission chart over time
    - _Requirements: 20.2, 20.3_

- [ ] 38. Admin Dashboard: System configuration
  - [ ] 38.1 Create configuration page
    - Display business rule settings
    - Add fields for commission rates
    - Add fields for conversion rates
    - Add fields for minimum withdrawal amounts
    - Implement save configuration button
    - Call backend to update configuration
    - _Requirements: 34.3_
  
  - [ ] 38.2 Create virtual gifts management
    - Display gifts catalog
    - Add create gift button
    - Show gift details: name, price, diamond value, assets
    - Add edit and deactivate buttons
    - Implement gift creation form
    - Upload gift animation and thumbnail
    - _Requirements: 9.1_

- [ ] 39. Checkpoint - Admin dashboard complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 40. Integration and deployment
  - [ ] 40.1 Configure production environment variables
    - Set up production MongoDB connection string
    - Set up production Redis connection string
    - Configure Firebase production credentials
    - Configure Agora production app ID and certificate
    - Configure payment gateway production keys
    - Set up CDN URLs for assets
    - Configure email service credentials
    - _Requirements: 34.1, 34.2_
  
  - [ ] 40.2 Set up Docker containers
    - Create Dockerfile for backend service
    - Create docker-compose.yml for local development
    - Configure MongoDB and Redis containers
    - Test containerized deployment locally
    - _Requirements: 33.3_


  - [ ] 40.3 Deploy backend to production
    - Set up cloud infrastructure (AWS/GCP)
    - Configure load balancer
    - Deploy backend containers with orchestration
    - Configure auto-scaling rules
    - Set up MongoDB Atlas or production database
    - Set up Redis Cloud or production cache
    - Configure SSL certificates
    - Test production API endpoints
    - _Requirements: 33.3, 33.4_
  
  - [ ] 40.4 Deploy admin dashboard
    - Build production admin dashboard
    - Upload to static hosting (S3, Netlify, or web server)
    - Configure custom domain with SSL
    - Configure API proxy for backend
    - Test admin dashboard in production
    - _Requirements: 33.5_
  
  - [ ] 40.5 Prepare mobile app for iOS release
    - Configure app signing in Xcode
    - Update app version and build number
    - Configure production API URLs
    - Test on physical iOS devices
    - Archive app for App Store
    - Create App Store Connect listing with metadata
    - Upload screenshots and app preview
    - Submit for App Store review
    - _Requirements: 33.1_
  
  - [ ] 40.6 Prepare mobile app for Android release
    - Configure signing key in build.gradle
    - Update version code and version name
    - Configure production API URLs
    - Test on physical Android devices
    - Build release APK/AAB: flutter build appbundle
    - Create Google Play Console listing with metadata
    - Upload screenshots and feature graphic
    - Submit for Google Play review
    - _Requirements: 33.2_
  
  - [ ] 40.7 Set up monitoring and logging
    - Configure Prometheus for metrics collection
    - Set up Grafana dashboards for visualization
    - Configure log aggregation (ELK stack or cloud logging)
    - Set up alerting for critical errors
    - Configure uptime monitoring
    - Test monitoring and alerting
    - _Requirements: 29.2, 29.3, 29.4_
  
  - [ ] 40.8 Set up CDN for static assets
    - Configure CloudFront or Cloudflare CDN
    - Upload static assets (images, animations)
    - Configure cache headers
    - Update backend to serve assets from CDN
    - Test asset delivery
    - _Requirements: 40.1, 40.4_
  
  - [ ] 40.9 Configure database backups
    - Set up automated MongoDB backups
    - Configure backup retention policy
    - Test backup restoration process
    - Document backup and recovery procedures
    - _Requirements: 33.4_
  
  - [ ] 40.10 Perform load testing
    - Create load testing scripts for API endpoints
    - Test with 5000 concurrent users
    - Measure stream latency under load
    - Measure chat message delivery latency
    - Identify and fix performance bottlenecks
    - Verify system meets performance requirements
    - _Requirements: 28.1, 28.2, 28.3, 6.6, 7.6_

- [ ] 41. Final checkpoint and handoff
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all requirements are implemented
  - Document any known issues or limitations
  - Provide deployment documentation
  - Provide API documentation
  - Provide user guides for admin dashboard

## Notes

- Tasks are organized by component: Backend, Mobile App, Admin Dashboard, Integration
- Each task references specific requirements for traceability
- Implementation follows bottom-up approach: infrastructure → features → integration
- Checkpoints ensure incremental validation at major milestones
- No comments should be added to the codebase per client requirements
- Focus on stability and scalability to prevent crashes with multiple users
- All code must follow the designs exactly as specified

