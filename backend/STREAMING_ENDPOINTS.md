# Live Streaming Endpoints Documentation

This document describes the live streaming endpoints implemented for the social live streaming application.

## Overview

The streaming system uses Agora SDK for real-time video streaming with low latency (< 2 seconds). The backend provides REST API endpoints for stream management, viewer interaction, chat, and moderation.

## Prerequisites

- Agora App ID and App Certificate configured in environment variables
- MongoDB database with Stream and ChatMessage collections
- Socket.io for real-time events
- User authentication with JWT tokens

## Environment Variables

```env
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
```

## Endpoints

### 1. Start Stream

Start a new live stream session.

**Endpoint:** `POST /api/streams/start`

**Authentication:** Required (Host permissions)

**Request Body:**
```json
{
  "title": "My Live Stream"
}
```

**Response (201):**
```json
{
  "streamId": "507f1f77bcf86cd799439011",
  "agoraChannelId": "stream_507f1f77bcf86cd799439011_1234567890",
  "agoraToken": "006abc123...",
  "appId": "your_agora_app_id"
}
```

**Validations:**
- User must have `isHost: true` flag
- User cannot have another active stream
- System capacity check (max 5000 concurrent viewers)
- Title max length: 200 characters

**Requirements:** 6.1, 6.6, 28.1

---

### 2. End Stream

End an active live stream session.

**Endpoint:** `POST /api/streams/:streamId/end`

**Authentication:** Required (Host ownership)

**Response (200):**
```json
{
  "success": true,
  "statistics": {
    "streamId": "507f1f77bcf86cd799439011",
    "duration": 3600,
    "peakViewerCount": 150,
    "totalGiftsReceived": 25
  }
}
```

**Validations:**
- Only the host can end their own stream
- Stream must be in 'active' status

**Side Effects:**
- Updates stream status to 'ended'
- Records end time
- Broadcasts 'stream:ended' event to all viewers via WebSocket

**Requirements:** 6.4, 6.5, 7.5

---

### 3. Get Active Streams

Retrieve a paginated list of active streams.

**Endpoint:** `GET /api/streams/active`

**Authentication:** Required

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response (200):**
```json
{
  "streams": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "hostId": {
        "_id": "507f1f77bcf86cd799439012",
        "displayName": "John Doe",
        "profilePictureUrl": "https://..."
      },
      "title": "My Live Stream",
      "startedAt": "2024-01-15T10:30:00.000Z",
      "viewerCount": 42,
      "status": "active"
    }
  ],
  "total": 15,
  "page": 1,
  "totalPages": 1
}
```

**Requirements:** 7.1

---

### 4. Join Stream

Join a stream as a viewer.

**Endpoint:** `POST /api/streams/:streamId/join`

**Authentication:** Required

**Response (200):**
```json
{
  "streamId": "507f1f77bcf86cd799439011",
  "agoraChannelId": "stream_507f1f77bcf86cd799439011_1234567890",
  "agoraToken": "006xyz789...",
  "appId": "your_agora_app_id",
  "playbackUrl": "stream_507f1f77bcf86cd799439011_1234567890"
}
```

**Validations:**
- Stream must be active
- Viewer must not be kicked from the stream
- Viewer must not be blocked by the host

**Side Effects:**
- Adds viewer to `currentViewerIds` array
- Updates `peakViewerCount` if necessary
- Broadcasts 'stream:viewer-joined' event via WebSocket

**Requirements:** 7.1, 7.3, 7.6

---

### 5. Leave Stream

Leave a stream as a viewer.

**Endpoint:** `POST /api/streams/:streamId/leave`

**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "viewerCount": 41
}
```

**Side Effects:**
- Removes viewer from `currentViewerIds` array
- Broadcasts 'stream:viewer-left' event via WebSocket

**Requirements:** 7.6

---

### 6. Send Chat Message

Send a message in the stream chat.

**Endpoint:** `POST /api/streams/:streamId/chat`

**Authentication:** Required

**Request Body:**
```json
{
  "message": "Hello everyone! 👋"
}
```

**Response (201):**
```json
{
  "messageId": "507f1f77bcf86cd799439013",
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

**Validations:**
- Message required and max 500 characters
- Stream must be active
- User must not be muted in the stream

**Side Effects:**
- Stores message in ChatMessage collection
- Broadcasts 'stream:chat-message' event to all viewers within 500ms

**WebSocket Event:**
```json
{
  "messageId": "507f1f77bcf86cd799439013",
  "streamId": "507f1f77bcf86cd799439011",
  "senderId": "507f1f77bcf86cd799439012",
  "senderName": "John Doe",
  "senderAvatar": "https://...",
  "message": "Hello everyone! 👋",
  "timestamp": "2024-01-15T10:35:00.000Z",
  "isPinned": false
}
```

**Requirements:** 8.1, 8.2, 8.3

---

### 7. Pin Message

Pin a chat message (host or moderator only).

**Endpoint:** `POST /api/streams/:streamId/pin-message`

**Authentication:** Required (Host or Moderator)

**Request Body:**
```json
{
  "messageId": "507f1f77bcf86cd799439013"
}
```

**Response (200):**
```json
{
  "success": true,
  "messageId": "507f1f77bcf86cd799439013"
}
```

**Validations:**
- User must be host or moderator
- Message must exist and belong to the stream

**Side Effects:**
- Unpins all other messages in the stream
- Sets `isPinned: true` on the target message
- Broadcasts 'stream:message-pinned' event to all viewers

**Requirements:** 8.4, 8.5

---

### 8. Moderate Stream

Perform moderation actions (mute, kick, block, assign moderator).

**Endpoint:** `POST /api/streams/:streamId/moderate`

**Authentication:** Required (Host or Moderator)

**Request Body:**
```json
{
  "action": "mute",
  "targetUserId": "507f1f77bcf86cd799439014"
}
```

**Actions:**
- `mute`: Prevent user from sending chat messages
- `kick`: Remove user from stream and prevent immediate rejoin
- `block`: Permanently block user from all host's streams (host only)
- `assign_moderator`: Grant moderation permissions (host only)

**Response (200):**
```json
{
  "success": true,
  "action": "muted",
  "targetUserId": "507f1f77bcf86cd799439014"
}
```

**Validations:**
- User must be host or moderator
- Only host can block users or assign moderators
- Valid action required

**Side Effects:**
- Updates stream's moderation arrays (`mutedUserIds`, `kickedUserIds`, `moderatorIds`)
- For block: Updates host's `blockedUserIds` array
- Broadcasts 'stream:moderation' event to all viewers
- Sends 'stream:moderation-action' event to target user

**Requirements:** 10.1, 10.2, 10.3, 10.4, 10.5

---

## WebSocket Events

### Client to Server

- `stream:join` - Join stream room
- `stream:leave` - Leave stream room
- `stream:chat` - Send chat message (alternative to REST)

### Server to Client

- `stream:viewer-joined` - New viewer joined
  ```json
  {
    "viewerId": "507f1f77bcf86cd799439014",
    "viewerCount": 43
  }
  ```

- `stream:viewer-left` - Viewer left
  ```json
  {
    "viewerId": "507f1f77bcf86cd799439014",
    "viewerCount": 42
  }
  ```

- `stream:chat-message` - New chat message
  ```json
  {
    "messageId": "507f1f77bcf86cd799439013",
    "streamId": "507f1f77bcf86cd799439011",
    "senderId": "507f1f77bcf86cd799439012",
    "senderName": "John Doe",
    "message": "Hello!",
    "timestamp": "2024-01-15T10:35:00.000Z"
  }
  ```

- `stream:message-pinned` - Message pinned
  ```json
  {
    "messageId": "507f1f77bcf86cd799439013",
    "senderId": "507f1f77bcf86cd799439012",
    "senderName": "John Doe",
    "message": "Important announcement!",
    "timestamp": "2024-01-15T10:35:00.000Z"
  }
  ```

- `stream:ended` - Stream ended
  ```json
  {
    "streamId": "507f1f77bcf86cd799439011",
    "endedAt": "2024-01-15T11:30:00.000Z"
  }
  ```

- `stream:moderation` - Moderation action performed
  ```json
  {
    "streamId": "507f1f77bcf86cd799439011",
    "action": "mute",
    "targetUserId": "507f1f77bcf86cd799439014",
    "moderatorId": "507f1f77bcf86cd799439012"
  }
  ```

- `stream:moderation-action` - Notification to target user
  ```json
  {
    "streamId": "507f1f77bcf86cd799439011",
    "action": "mute",
    "message": "You have been muted"
  }
  ```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "title",
      "message": "\"title\" is required"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "No authentication token provided",
  "code": "AUTH_ERROR"
}
```

### 403 Forbidden
```json
{
  "error": "Host permissions required",
  "code": "AUTHORIZATION_ERROR"
}
```

### 404 Not Found
```json
{
  "error": "Stream not found"
}
```

### 503 Service Unavailable
```json
{
  "error": "System capacity reached. Please try again later."
}
```

---

## Agora Integration

### Token Generation

The backend generates Agora RTC tokens with the following configuration:

- **Host Token:** `RtcRole.PUBLISHER` - Can publish audio/video
- **Viewer Token:** `RtcRole.SUBSCRIBER` - Can only subscribe to streams
- **Token Expiration:** 1 hour (3600 seconds)

### Channel Naming

Channel IDs are generated using the format:
```
stream_{hostId}_{timestamp}
```

Example: `stream_507f1f77bcf86cd799439011_1705318200000`

### Client Integration

Mobile clients should:
1. Call `/api/streams/start` or `/api/streams/:streamId/join`
2. Receive `agoraChannelId`, `agoraToken`, and `appId`
3. Initialize Agora SDK with these credentials
4. Join the channel using the provided token

---

## Testing

Use the provided test script to verify endpoints:

```bash
node test-stream-endpoints.js
```

Before running tests:
1. Ensure server is running
2. Set valid authentication tokens in the script
3. Ensure test user has host permissions

---

## Performance Considerations

- **System Capacity:** Maximum 5000 concurrent viewers across all streams
- **Chat Latency:** Messages broadcast within 500ms
- **Stream Latency:** Video streaming latency < 2 seconds (Agora)
- **Token Expiration:** Tokens expire after 1 hour, clients should refresh

---

## Security

- All endpoints require authentication
- Host-only actions validated by checking `isHost` flag
- Moderation permissions checked for sensitive actions
- Blocked users cannot join streams
- Kicked users cannot immediately rejoin
- Muted users cannot send chat messages

---

## Database Models

### Stream Model
```javascript
{
  hostId: ObjectId,
  title: String,
  startedAt: Date,
  endedAt: Date,
  status: 'active' | 'ended' | 'terminated',
  peakViewerCount: Number,
  totalGiftsReceived: Number,
  currentViewerIds: [ObjectId],
  mutedUserIds: [ObjectId],
  kickedUserIds: [ObjectId],
  moderatorIds: [ObjectId],
  agoraChannelId: String
}
```

### ChatMessage Model
```javascript
{
  streamId: ObjectId,
  senderId: ObjectId,
  message: String,
  timestamp: Date,
  isPinned: Boolean
}
```

---

## Future Enhancements

- Stream recording and playback
- Advanced analytics (watch time, engagement metrics)
- Automated moderation (profanity filter, spam detection)
- Multi-host streaming (co-hosting)
- Stream scheduling
- Viewer reactions and emojis
- Stream quality selection
