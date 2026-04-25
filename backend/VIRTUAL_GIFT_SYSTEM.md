# Virtual Gift System Implementation

## Overview

The virtual gift system allows viewers to send virtual gifts to hosts during live streams. Gifts are purchased with coins and converted to diamonds for hosts, which can later be converted to real credit.

## Architecture

### Components

1. **VirtualGift Model** (`src/models/VirtualGift.js`)
   - Stores gift catalog with pricing and assets
   - Categories: basic, premium, luxury, special
   - Fields: name, coinPrice, diamondValue, animationAssetUrl, thumbnailUrl

2. **Gift Controller** (`src/controllers/giftController.js`)
   - `createGift()` - Admin endpoint to add gifts to catalog
   - `getGifts()` - Public endpoint to list available gifts
   - `sendGift()` - Endpoint to send gifts during streams

3. **Gift Routes** (`src/routes/gifts.js`)
   - `POST /api/admin/gifts` - Create new gift (admin)
   - `GET /api/gifts` - List available gifts (public)
   - `POST /api/streams/:streamId/gift` - Send gift (authenticated)

4. **WebSocket Handler** (`src/socket/streamHandlers.js`)
   - `stream:gift` event - Real-time gift sending
   - Broadcasts gift animations to all viewers
   - Sends notifications to host

## API Endpoints

### 1. Create Virtual Gift (Admin)

**Endpoint:** `POST /api/admin/gifts`

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "name": "Rose",
  "coinPrice": 10,
  "diamondValue": 8,
  "animationAssetUrl": "https://example.com/animations/rose.json",
  "thumbnailUrl": "https://example.com/thumbnails/rose.png",
  "category": "basic"
}
```

**Response:**
```json
{
  "success": true,
  "gift": {
    "_id": "gift_id",
    "name": "Rose",
    "coinPrice": 10,
    "diamondValue": 8,
    "animationAssetUrl": "https://example.com/animations/rose.json",
    "thumbnailUrl": "https://example.com/thumbnails/rose.png",
    "category": "basic",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Validation:**
- All fields are required
- `coinPrice` and `diamondValue` must be at least 1
- `category` must be one of: basic, premium, luxury, special
- `name` must be unique

### 2. Get Available Gifts

**Endpoint:** `GET /api/gifts`

**Authentication:** Not required

**Query Parameters:**
- `category` (optional) - Filter by category
- `isActive` (optional) - Filter by active status (default: true)

**Response:**
```json
{
  "gifts": [
    {
      "_id": "gift_id",
      "name": "Rose",
      "coinPrice": 10,
      "diamondValue": 8,
      "animationAssetUrl": "https://example.com/animations/rose.json",
      "thumbnailUrl": "https://example.com/thumbnails/rose.png",
      "category": "basic",
      "isActive": true
    }
  ],
  "giftsByCategory": {
    "basic": [...],
    "premium": [...],
    "luxury": [...],
    "special": [...]
  },
  "total": 10
}
```

### 3. Send Gift During Stream

**Endpoint:** `POST /api/streams/:streamId/gift`

**Authentication:** Required

**Request Body:**
```json
{
  "giftId": "gift_id"
}
```

**Response:**
```json
{
  "success": true,
  "gift": {
    "id": "gift_id",
    "name": "Rose",
    "coinPrice": 10,
    "diamondValue": 8
  },
  "newBalance": 90,
  "transactionId": "transaction_id"
}
```

**Error Responses:**

1. Insufficient Coins (402):
```json
{
  "error": "Insufficient coins",
  "required": 10,
  "available": 5
}
```

2. Stream Not Active (400):
```json
{
  "error": "Stream is not active"
}
```

3. Gift Not Found (404):
```json
{
  "error": "Gift not found"
}
```

## Transaction Flow

### HTTP Endpoint Flow

1. **Validation Phase**
   - Verify stream exists and is active
   - Verify gift exists and is active
   - Verify sender is not the host
   - Verify sender has sufficient coins

2. **Atomic Transaction Phase** (MongoDB Session)
   - Deduct coins from sender's wallet
   - Credit diamonds to host's wallet
   - Update stream statistics (totalGiftsReceived)
   - Create transaction record for sender (giftSent)
   - Create transaction record for host (giftReceived)
   - Commit all changes atomically

3. **Notification Phase**
   - Broadcast gift animation to all stream viewers via WebSocket
   - Send notification to host
   - Return success response to sender

### WebSocket Flow

The WebSocket implementation (`stream:gift` event) follows the same atomic transaction pattern:

1. Client emits `stream:gift` event with `{ streamId, giftId }`
2. Server validates and processes transaction atomically
3. Server broadcasts `stream:gift-sent` event to all viewers
4. Server sends `notification:new` event to host
5. Server confirms to sender with `stream:gift-confirmed` event

## Atomic Transactions

All wallet operations use MongoDB transactions to ensure atomicity:

```javascript
const session = await mongoose.startSession();
session.startTransaction();

try {
  // Deduct coins from sender
  senderWallet.coinBalance -= gift.coinPrice;
  await senderWallet.save({ session });

  // Credit diamonds to host
  hostWallet.diamondBalance += gift.diamondValue;
  await hostWallet.save({ session });

  // Create transaction records
  await senderTransaction.save({ session });
  await hostTransaction.save({ session });

  // Commit all changes
  await session.commitTransaction();
} catch (error) {
  // Rollback on any error
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

This ensures:
- No partial updates (all or nothing)
- No race conditions
- Consistent wallet balances
- Complete transaction history

## WebSocket Events

### Client to Server

**Event:** `stream:gift`

**Payload:**
```json
{
  "streamId": "stream_id",
  "giftId": "gift_id"
}
```

### Server to Client

**Event:** `stream:gift-sent` (broadcast to all viewers)

**Payload:**
```json
{
  "streamId": "stream_id",
  "senderId": "sender_id",
  "senderName": "John Doe",
  "senderAvatar": "https://example.com/avatar.jpg",
  "hostId": "host_id",
  "giftId": "gift_id",
  "giftName": "Rose",
  "giftAnimationUrl": "https://example.com/animations/rose.json",
  "giftThumbnailUrl": "https://example.com/thumbnails/rose.png",
  "coinPrice": 10,
  "diamondValue": 8,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Event:** `notification:new` (sent to host only)

**Payload:**
```json
{
  "type": "gift_received",
  "title": "Gift Received!",
  "message": "John Doe sent you Rose",
  "data": {
    "streamId": "stream_id",
    "senderId": "sender_id",
    "giftId": "gift_id",
    "giftName": "Rose",
    "diamondValue": 8
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Event:** `stream:gift-confirmed` (sent to sender only)

**Payload:**
```json
{
  "success": true,
  "newBalance": 90,
  "transactionId": "transaction_id"
}
```

**Event:** `error` (sent to sender on failure)

**Payload:**
```json
{
  "message": "Insufficient coins",
  "required": 10,
  "available": 5
}
```

## Transaction Records

Each gift transaction creates two transaction records:

### Sender Transaction
```json
{
  "userId": "sender_id",
  "type": "giftSent",
  "amount": 10,
  "currency": "coins",
  "description": "Sent Rose to host",
  "metadata": {
    "giftId": "gift_id",
    "streamId": "stream_id",
    "recipientId": "host_id"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Host Transaction
```json
{
  "userId": "host_id",
  "type": "giftReceived",
  "amount": 8,
  "currency": "diamonds",
  "description": "Received Rose from viewer",
  "metadata": {
    "giftId": "gift_id",
    "streamId": "stream_id",
    "recipientId": "sender_id"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Conversion Rate

The conversion rate from coins to diamonds is defined per gift:
- Each gift has a `coinPrice` (what viewers pay)
- Each gift has a `diamondValue` (what hosts receive)
- The platform takes the difference as commission

Example:
- Rose costs 10 coins
- Host receives 8 diamonds
- Platform commission: 2 coins (20%)

## Error Handling

### Validation Errors (400)
- Missing required fields
- Invalid category
- Stream not active
- Cannot send gifts to yourself

### Authentication Errors (401)
- Missing or invalid token

### Payment Errors (402)
- Insufficient coins in wallet

### Not Found Errors (404)
- Stream not found
- Gift not found
- Wallet not found

### Server Errors (500)
- Database transaction failures
- Unexpected errors

All errors are logged with context for debugging.

## Testing

Use the provided test script to verify the implementation:

```bash
node test-gift-endpoints.js
```

The test script covers:
1. Creating virtual gifts (admin)
2. Listing available gifts
3. Sending gifts during streams
4. Handling insufficient coins
5. Filtering gifts by category

## Requirements Mapping

### Requirement 9.1: Gift Catalog
✅ Implemented in `VirtualGift` model and `createGift()` / `getGifts()` endpoints

### Requirement 9.2: Deduct Coins
✅ Implemented with atomic transaction in `sendGift()`

### Requirement 9.3: Display Animation
✅ Implemented via WebSocket broadcast with animation URL

### Requirement 9.4: Convert to Diamonds
✅ Implemented with atomic transaction in `sendGift()`

### Requirement 9.5: Reject Insufficient Coins
✅ Implemented with validation before transaction

### Requirement 9.6: Notify Host
✅ Implemented via WebSocket notification event

### Requirement 14.5: Transaction Records
✅ Implemented with dual transaction records for sender and host

## Security Considerations

1. **Atomic Transactions**: All wallet operations use MongoDB sessions to prevent race conditions
2. **Validation**: Comprehensive input validation before processing
3. **Authentication**: All endpoints require valid authentication tokens
4. **Authorization**: Prevents sending gifts to yourself
5. **Error Handling**: Graceful error handling with proper rollback
6. **Logging**: All operations are logged for audit trail

## Performance Considerations

1. **Indexes**: Optimized indexes on `coinPrice` and `category` for fast queries
2. **Caching**: Gift catalog can be cached (1 hour TTL recommended)
3. **WebSocket**: Real-time broadcasts with minimal latency (<500ms)
4. **Transactions**: MongoDB transactions ensure consistency without blocking

## Future Enhancements

1. Gift combos (send multiple gifts at once)
2. Gift history per stream
3. Top gifters leaderboard
4. Gift animations with sound effects
5. Limited edition gifts
6. Gift bundles with discounts
7. Gift reactions from host
