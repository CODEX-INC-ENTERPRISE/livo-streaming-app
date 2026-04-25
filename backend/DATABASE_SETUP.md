# Database Setup Guide

## Overview

This document describes the MongoDB database schema and indexes for the Social Live Streaming Application.

## Collections

### 1. Users
Stores user account information and preferences.

**Indexes:**
- `phoneNumber` (unique, sparse)
- `email` (unique, sparse)
- `displayName` (unique)
- `{ displayName: 1, isBlocked: 1 }` (compound)
- `registeredAt`
- `isBlocked`
- `isHost`
- `followerIds`

### 2. Hosts
Stores host-specific information and statistics.

**Indexes:**
- `userId` (unique)
- `agentId`
- `isApproved`

### 3. Streams
Stores live stream information and viewer tracking.

**Indexes:**
- `hostId`
- `status`
- `startedAt`
- `{ hostId: 1, startedAt: -1 }` (compound)
- `{ status: 1, startedAt: -1 }` (compound)

### 4. VoiceRooms
Stores voice room information and participant management.

**Indexes:**
- `hostId`
- `status`
- `createdAt`

### 5. Wallets
Stores user wallet balances (coins and diamonds).

**Indexes:**
- `userId` (unique)

### 6. Transactions
Stores all financial transactions.

**Indexes:**
- `userId`
- `type`
- `timestamp`
- `{ userId: 1, timestamp: -1 }` (compound)

### 7. VirtualGifts
Stores virtual gift catalog.

**Indexes:**
- `name` (unique)
- `coinPrice`
- `category`

### 8. Reports
Stores user and content reports.

**Indexes:**
- `reporterId`
- `reportedUserId`
- `reason`
- `submittedAt`
- `status`
- `{ status: 1, submittedAt: -1 }` (compound)

### 9. Notifications
Stores user notifications.

**Indexes:**
- `userId`
- `type`
- `createdAt`
- `isRead`
- `{ userId: 1, isRead: 1, createdAt: -1 }` (compound)

### 10. WithdrawalRequests
Stores diamond withdrawal requests.

**Indexes:**
- `userId`
- `status`
- `requestedAt`

### 11. Agents
Stores agent information for host management.

**Indexes:**
- `email` (unique)

### 12. ChatMessages
Stores chat messages from streams and voice rooms.

**Indexes:**
- `streamId`
- `voiceRoomId`
- `senderId`
- `timestamp`

## Index Initialization

To create all database indexes, run:

```bash
npm run init-indexes
```

This script will:
1. Connect to MongoDB using the configuration from `.env`
2. Create all required indexes on all collections
3. Log the progress and any errors
4. Close the connection when complete

## Index Rationale

### Compound Indexes

1. **users: { displayName: 1, isBlocked: 1 }**
   - Supports queries filtering by display name and checking if user is blocked
   - Used in user search and profile lookups

2. **streams: { hostId: 1, startedAt: -1 }**
   - Supports queries for a host's streams sorted by start time
   - Used in host dashboard and stream history

3. **streams: { status: 1, startedAt: -1 }**
   - Supports queries for active/ended streams sorted by start time
   - Used in stream listing and discovery

4. **transactions: { userId: 1, timestamp: -1 }**
   - Supports queries for user's transaction history sorted by time
   - Used in wallet transaction history

5. **notifications: { userId: 1, isRead: 1, createdAt: -1 }**
   - Supports queries for user's unread notifications sorted by time
   - Used in notification center and badge counts

6. **reports: { status: 1, submittedAt: -1 }**
   - Supports queries for pending reports sorted by submission time
   - Used in admin dashboard report queue

### Single Field Indexes

Single field indexes are created on frequently queried fields to improve query performance:
- Foreign key references (userId, hostId, etc.)
- Status fields for filtering
- Timestamp fields for sorting
- Unique constraints (email, phoneNumber, displayName)

## Performance Considerations

1. **Index Size**: Monitor index size as data grows. Indexes consume memory and disk space.

2. **Write Performance**: Each index adds overhead to write operations. The indexes defined here are essential for read performance.

3. **Index Usage**: Use MongoDB's `explain()` method to verify indexes are being used:
   ```javascript
   db.users.find({ displayName: "john", isBlocked: false }).explain("executionStats")
   ```

4. **Index Maintenance**: MongoDB automatically maintains indexes, but consider periodic maintenance:
   - Monitor slow queries
   - Review index usage statistics
   - Remove unused indexes

## Monitoring

Monitor index performance using:

```javascript
// Check index usage
db.users.aggregate([{ $indexStats: {} }])

// Check slow queries
db.setProfilingLevel(1, { slowms: 100 })
db.system.profile.find().sort({ ts: -1 }).limit(10)
```

## Migration

When adding new indexes to production:

1. Create indexes during low-traffic periods
2. Use background index creation: `{ background: true }`
3. Monitor server performance during index creation
4. Test queries before and after index creation

## Troubleshooting

### Index Creation Fails

If index creation fails:
1. Check MongoDB logs for errors
2. Verify sufficient disk space
3. Check for duplicate key violations on unique indexes
4. Ensure MongoDB version supports index types

### Slow Queries

If queries are slow despite indexes:
1. Use `explain()` to verify index usage
2. Check if index is covering the query
3. Consider adding compound indexes
4. Review query patterns and optimize
