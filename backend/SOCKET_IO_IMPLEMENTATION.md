# Socket.io Real-Time Communication Implementation

## Overview

This document describes the Socket.io implementation for real-time communication in the social live streaming application. The implementation supports horizontal scaling using Redis adapter and includes authentication, room-based broadcasting, and heartbeat mechanisms.

## Architecture

### Components

1. **Socket.io Server** (`src/config/socket.js`)
   - Initializes Socket.io with Express server
   - Configures Redis adapter for horizontal scaling
   - Implements authentication middleware
   - Sets up connection handling and heartbeat

2. **Event Handlers**
   - **Stream Handlers** (`src/socket/streamHandlers.js`) - Live stream events
   - **Voice Room Handlers** (`src/socket/voiceRoomHandlers.js`) - Voice room events
   - **Notification Handlers** (`src/socket/notificationHandlers.js`) - Real-time notifications

3. **Helper Functions** (`src/socket/helpers.js`)
   - Utility functions to emit events from other services
   - Used by controllers and services to send real-time updates

## Features

### Authentication

All WebSocket connections require JWT authentication:

```javascript
// Client-side connection
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

The server validates the token and attaches user information to the socket:
- `socket.userId` - User's ID
- `socket.user` - Decoded JWT payload

### Horizontal Scaling

Redis adapter enables multiple Socket.io servers to communicate:
- Uses Redis Pub/Sub for cross-server message broadcasting
- Supports sticky sessions for WebSocket connections
- Automatic failover and reconnection

### Heartbeat Mechanism

Connection health monitoring:
- Client sends `ping` event
- Server responds with `pong` event
- Configurable ping interval (25s) and timeout (60s)

## Event Reference

### Stream Events

#### Client to Server

**stream:join**
```javascript
socket.emit('stream:join', { streamId: 'stream-id' });
```
Join a live stream as a viewer.

**stream:leave**
```javascript
socket.emit('stream:leave', { streamId: 'stream-id' });
```
Leave a live stream.

**stream:chat**
```javascript
socket.emit('stream:chat', {
  streamId: 'stream-id',
  message: 'Hello!'
});
```
Send a chat message (max 500 characters).

**stream:gift**
```javascript
socket.emit('stream:gift', {
  streamId: 'stream-id',
  giftId: 'gift-id'
});
```
Send a virtual gift to the host.

#### Server to Client

**stream:joined**
```javascript
socket.on('stream:joined', (data) => {
  // { streamId, viewerCount }
});
```
Confirmation of successful stream join.

**stream:viewer-joined**
```javascript
socket.on('stream:viewer-joined', (data) => {
  // { userId, displayName, profilePictureUrl, viewerCount }
});
```
Notification when another viewer joins.

**stream:viewer-left**
```javascript
socket.on('stream:viewer-left', (data) => {
  // { userId, viewerCount }
});
```
Notification when a viewer leaves.

**stream:chat-message**
```javascript
socket.on('stream:chat-message', (data) => {
  // { messageId, streamId, senderId, senderName, senderAvatar, message, timestamp }
});
```
Broadcast chat message (delivered within 500ms).

**stream:gift-sent**
```javascript
socket.on('stream:gift-sent', (data) => {
  // { streamId, senderId, senderName, senderAvatar, giftId, timestamp }
});
```
Trigger gift animation.

**stream:ended**
```javascript
socket.on('stream:ended', (data) => {
  // { streamId, reason, timestamp }
});
```
Notification when stream ends.

**stream:moderation**
```javascript
socket.on('stream:moderation', (data) => {
  // { streamId, action, targetUserId, moderatorId, timestamp }
  // action: 'mute', 'kick', 'block'
});
```
Notification of moderation action.

**stream:kicked**
```javascript
socket.on('stream:kicked', (data) => {
  // { streamId, reason }
});
```
Personal notification when kicked from stream.

### Voice Room Events

#### Client to Server

**voice:join**
```javascript
socket.emit('voice:join', { roomId: 'room-id' });
```
Join a voice room as a listener.

**voice:leave**
```javascript
socket.emit('voice:leave', { roomId: 'room-id' });
```
Leave a voice room.

**voice:raise-hand**
```javascript
socket.emit('voice:raise-hand', { roomId: 'room-id' });
```
Request to speak (notify host).

**voice:chat**
```javascript
socket.emit('voice:chat', {
  roomId: 'room-id',
  message: 'Hello!'
});
```
Send a text message in voice room.

#### Server to Client

**voice:joined**
```javascript
socket.on('voice:joined', (data) => {
  // { roomId, participants, participantCount }
});
```
Confirmation of successful voice room join.

**voice:participant-joined**
```javascript
socket.on('voice:participant-joined', (data) => {
  // { userId, displayName, profilePictureUrl, role, participantCount }
});
```
Notification when a participant joins.

**voice:participant-left**
```javascript
socket.on('voice:participant-left', (data) => {
  // { userId, participantCount }
});
```
Notification when a participant leaves.

**voice:role-changed**
```javascript
socket.on('voice:role-changed', (data) => {
  // { roomId, userId, newRole, timestamp }
  // newRole: 'speaker' or 'listener'
});
```
Notification when role changes.

**voice:hand-raised**
```javascript
socket.on('voice:hand-raised', (data) => {
  // { userId, displayName, profilePictureUrl, roomId, timestamp }
});
```
Notification when someone raises hand.

**voice:chat-message**
```javascript
socket.on('voice:chat-message', (data) => {
  // { messageId, roomId, senderId, senderName, senderAvatar, message, timestamp }
});
```
Broadcast text message in voice room.

### Notification Events

#### Server to Client

**notification:new**
```javascript
socket.on('notification:new', (data) => {
  // { notificationId, type, title, message, data, timestamp, isRead }
});
```
Real-time notification (delivered within 2 seconds).

## Room-Based Broadcasting

### Stream Rooms
- Room name: `stream:{streamId}`
- All viewers of a stream join this room
- Messages broadcast to all room members

### Voice Rooms
- Room name: `voice:{roomId}`
- All participants join this room
- Messages broadcast to all room members

### User Notification Rooms
- Room name: `user:{userId}`
- Personal room for each user
- Used for direct notifications

## Usage from Services

### Sending Notifications

```javascript
const { sendNotificationToUser, sendNotificationToUsers } = require('../socket/helpers');

// Send to single user
sendNotificationToUser(userId, {
  type: 'gift_received',
  title: 'Gift Received!',
  message: 'John sent you a gift',
  data: { giftId: 'gift-123' }
});

// Send to multiple users
sendNotificationToUsers([userId1, userId2], {
  type: 'stream_start',
  title: 'Live Stream Started',
  message: 'Jane is now live!'
});
```

### Stream Events

```javascript
const { notifyStreamEnded, notifyModerationAction } = require('../socket/helpers');

// Notify stream ended
notifyStreamEnded(streamId, 'Host ended stream');

// Notify moderation action
notifyModerationAction(streamId, 'kick', targetUserId, moderatorId);
```

### Voice Room Events

```javascript
const { notifyRoleChanged } = require('../socket/helpers');

// Notify role change
notifyRoleChanged(roomId, userId, 'speaker');
```

## Testing

Run the Socket.io test script:

```bash
# Start the server first
npm start

# In another terminal, run the test
node test-socket.js
```

The test script verifies:
- Connection establishment
- Authentication
- Heartbeat mechanism
- Stream events
- Voice room events

## Performance Considerations

### Latency Requirements
- Chat messages: < 500ms delivery
- Notifications: < 2 seconds delivery
- Stream events: Real-time (< 100ms)

### Scalability
- Supports 5000+ concurrent connections
- Redis adapter enables horizontal scaling
- Connection pooling for database queries
- Efficient room-based broadcasting

### Error Handling
- Automatic reconnection on disconnect
- Graceful degradation if Redis unavailable
- Error events emitted to clients
- Comprehensive logging

## Security

### Authentication
- JWT token required for all connections
- Token validated on connection
- User context attached to socket

### Authorization
- Stream/room membership verified
- Muted users cannot send messages
- Kicked users removed from rooms

### Input Validation
- Message length limits (500 characters)
- Required field validation
- Sanitization of user input

## Monitoring

### Logging
All socket events are logged with:
- Socket ID
- User ID
- Event type
- Timestamp
- Additional context

### Metrics
Monitor these metrics:
- Active connections
- Messages per second
- Room sizes
- Error rates
- Latency

## Configuration

Environment variables:
```env
# Server
PORT=3000
CORS_ORIGIN=*

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRATION=30d
```

## Troubleshooting

### Connection Issues
- Verify JWT token is valid
- Check CORS configuration
- Ensure Redis is running
- Check firewall rules

### Message Delivery Issues
- Verify room membership
- Check Redis connection
- Monitor network latency
- Review error logs

### Performance Issues
- Scale horizontally with more servers
- Optimize database queries
- Increase Redis memory
- Use connection pooling
