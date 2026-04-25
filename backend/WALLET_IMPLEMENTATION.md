# Wallet and Transaction Management Implementation

## Overview

This document describes the wallet and transaction management system for the social live streaming application. The implementation provides atomic wallet operations with complete transaction logging to ensure data integrity and immutability.

## Architecture

### Components

1. **Transaction Service** (`src/services/transactionService.js`)
   - Handles all wallet operations atomically using MongoDB transactions
   - Records immutable transaction history
   - Ensures wallet balances never go negative

2. **Wallet Controller** (`src/controllers/walletController.js`)
   - Provides REST API endpoints for wallet operations
   - Handles authorization and validation
   - Returns wallet balances and transaction history

3. **Wallet Routes** (`src/routes/wallet.js`)
   - Defines API routes for wallet endpoints
   - Applies authentication middleware

4. **Models**
   - `Wallet` model: Stores user coin and diamond balances
   - `Transaction` model: Immutable record of all wallet changes

## API Endpoints

### 1. Get Wallet Information

**Endpoint:** `GET /api/wallet/:userId`

**Description:** Returns wallet balances and recent transactions (last 10)

**Authentication:** Required (Bearer token)

**Authorization:** Users can only view their own wallet

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "coinBalance": 1000,
    "diamondBalance": 500,
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "recentTransactions": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "userId": "507f1f77bcf86cd799439011",
        "type": "giftSent",
        "amount": -50,
        "currency": "coins",
        "timestamp": "2024-01-15T10:25:00.000Z",
        "description": "Sent gift worth 50 coins",
        "metadata": {
          "giftId": "507f1f77bcf86cd799439013",
          "streamId": "507f1f77bcf86cd799439014",
          "recipientId": "507f1f77bcf86cd799439015"
        }
      }
    ]
  }
}
```

**Error Responses:**
- `403 Forbidden`: Attempting to view another user's wallet
- `404 Not Found`: Wallet not found

### 2. Get Wallet Balance

**Endpoint:** `GET /api/wallet/:userId/balance`

**Description:** Returns only wallet balances (lightweight endpoint for frequent polling)

**Authentication:** Required (Bearer token)

**Authorization:** Users can only view their own balance

**Response:**
```json
{
  "success": true,
  "data": {
    "coinBalance": 1000,
    "diamondBalance": 500,
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `403 Forbidden`: Attempting to view another user's balance
- `404 Not Found`: Wallet not found

### 3. Get Transaction History

**Endpoint:** `GET /api/wallet/transactions/:userId`

**Description:** Returns paginated transaction history with optional filtering

**Authentication:** Required (Bearer token)

**Authorization:** Users can only view their own transactions

**Query Parameters:**
- `page` (optional, default: 1): Page number (must be >= 1)
- `limit` (optional, default: 20): Items per page (1-100)
- `type` (optional): Filter by transaction type

**Valid Transaction Types:**
- `coinPurchase`: User purchased coins
- `giftSent`: User sent a gift (coins deducted)
- `giftReceived`: User received a gift (diamonds credited)
- `diamondEarned`: User earned diamonds (deprecated, use giftReceived)
- `withdrawal`: User withdrew diamonds
- `commission`: Agent earned commission

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "userId": "507f1f77bcf86cd799439011",
        "type": "giftSent",
        "amount": -50,
        "currency": "coins",
        "timestamp": "2024-01-15T10:25:00.000Z",
        "description": "Sent gift worth 50 coins",
        "metadata": {
          "giftId": "507f1f77bcf86cd799439013",
          "streamId": "507f1f77bcf86cd799439014",
          "recipientId": "507f1f77bcf86cd799439015"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid pagination parameters or transaction type
- `403 Forbidden`: Attempting to view another user's transactions

## Transaction Service Methods

### 1. recordCoinPurchase(userId, amount, metadata)

Records a coin purchase transaction and credits coins to user's wallet.

**Parameters:**
- `userId`: User's ObjectId
- `amount`: Number of coins purchased (must be positive)
- `metadata`: Object containing:
  - `paymentGateway`: Payment gateway used (stripe, paypal, mada, stcpay)
  - `paymentId`: Payment transaction ID from gateway

**Returns:** `{ transaction, wallet }`

**Throws:** Error if amount is invalid or wallet not found

### 2. recordGiftSent(senderId, recipientId, coinAmount, metadata)

Records a gift sent transaction and deducts coins from sender's wallet.

**Parameters:**
- `senderId`: Sender's ObjectId
- `recipientId`: Recipient's ObjectId
- `coinAmount`: Number of coins to deduct (must be positive)
- `metadata`: Object containing:
  - `giftId`: Virtual gift ObjectId
  - `streamId`: Stream ObjectId where gift was sent

**Returns:** `{ transaction, wallet }`

**Throws:** Error if insufficient balance or wallet not found

### 3. recordGiftReceived(recipientId, senderId, diamondAmount, metadata)

Records a gift received transaction and credits diamonds to recipient's wallet.

**Parameters:**
- `recipientId`: Recipient's ObjectId
- `senderId`: Sender's ObjectId
- `diamondAmount`: Number of diamonds to credit (must be positive)
- `metadata`: Object containing:
  - `giftId`: Virtual gift ObjectId
  - `streamId`: Stream ObjectId where gift was received

**Returns:** `{ transaction, wallet }`

**Throws:** Error if amount is invalid or wallet not found

### 4. recordGiftTransaction(senderId, recipientId, coinAmount, diamondAmount, metadata)

**RECOMMENDED:** Records a complete gift transaction atomically - deducts coins from sender and credits diamonds to recipient in a single database transaction.

**Parameters:**
- `senderId`: Sender's ObjectId
- `recipientId`: Recipient's ObjectId
- `coinAmount`: Number of coins to deduct from sender
- `diamondAmount`: Number of diamonds to credit to recipient
- `metadata`: Object containing:
  - `giftId`: Virtual gift ObjectId
  - `streamId`: Stream ObjectId

**Returns:** `{ senderTransaction, recipientTransaction, senderWallet, recipientWallet }`

**Throws:** Error if insufficient balance or wallets not found

**Note:** This method is preferred over calling `recordGiftSent` and `recordGiftReceived` separately because it ensures atomicity - either both operations succeed or both fail.

### 5. recordWithdrawal(userId, diamondAmount, creditAmount, currency)

Records a diamond withdrawal transaction and deducts diamonds from user's wallet.

**Parameters:**
- `userId`: User's ObjectId
- `diamondAmount`: Number of diamonds to deduct
- `creditAmount`: Real credit amount
- `currency`: Currency code (USD, SAR, etc.)

**Returns:** `{ transaction, wallet }`

**Throws:** Error if insufficient balance or wallet not found

### 6. recordCommission(agentId, hostId, diamondAmount, metadata)

Records a commission transaction and credits diamonds to agent's wallet.

**Parameters:**
- `agentId`: Agent's ObjectId
- `hostId`: Host's ObjectId
- `diamondAmount`: Number of diamonds to credit
- `metadata`: Additional commission metadata

**Returns:** `{ transaction, wallet }`

**Throws:** Error if amount is invalid or wallet not found

### 7. getTransactionHistory(userId, options)

Retrieves paginated transaction history for a user.

**Parameters:**
- `userId`: User's ObjectId
- `options`: Object containing:
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 20)
  - `type`: Filter by transaction type (optional)

**Returns:** `{ transactions, pagination }`

## Key Features

### 1. Atomic Operations

All wallet operations use MongoDB transactions to ensure atomicity:
- Either all changes succeed or all fail
- No partial updates
- Consistent state guaranteed

```javascript
const session = await mongoose.startSession();
session.startTransaction();
try {
  // Perform wallet updates
  await wallet.save({ session });
  await transaction.save({ session });
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

### 2. Immutable Transaction History

- Transactions are never updated or deleted
- Complete audit trail of all wallet changes
- Each transaction includes metadata for traceability

### 3. Balance Protection

- Wallet balances cannot go negative (enforced at model level)
- Insufficient balance checks before deductions
- Validation of positive amounts

### 4. Authorization

- Users can only access their own wallet data
- Middleware enforces authentication
- Controller validates user ownership

### 5. Comprehensive Logging

- All operations logged with structured data
- Success and failure cases tracked
- Transaction IDs included for traceability

## Usage Examples

### Example 1: Get User Wallet

```javascript
// Client-side request
const response = await fetch(`/api/wallet/${userId}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
const data = await response.json();
console.log('Coin balance:', data.data.coinBalance);
console.log('Diamond balance:', data.data.diamondBalance);
```

### Example 2: Get Transaction History with Filter

```javascript
// Get only gift sent transactions
const response = await fetch(
  `/api/wallet/transactions/${userId}?page=1&limit=20&type=giftSent`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  }
);
const data = await response.json();
console.log('Gift transactions:', data.data.transactions);
```

### Example 3: Record a Gift Transaction (Backend)

```javascript
const transactionService = require('./services/transactionService');

// When a user sends a gift
try {
  const result = await transactionService.recordGiftTransaction(
    senderId,
    recipientId,
    giftCoinPrice,
    giftDiamondValue,
    {
      giftId: gift._id,
      streamId: stream._id,
    }
  );
  
  console.log('Sender new balance:', result.senderWallet.coinBalance);
  console.log('Recipient new balance:', result.recipientWallet.diamondBalance);
} catch (error) {
  if (error.message === 'Insufficient coin balance') {
    // Handle insufficient funds
  }
}
```

### Example 4: Record Coin Purchase (Backend)

```javascript
// After payment gateway confirms payment
try {
  const result = await transactionService.recordCoinPurchase(
    userId,
    coinAmount,
    {
      paymentGateway: 'stripe',
      paymentId: paymentIntent.id,
    }
  );
  
  console.log('New coin balance:', result.wallet.coinBalance);
} catch (error) {
  console.error('Failed to credit coins:', error);
}
```

## Testing

A test script is provided at `backend/test-wallet-endpoints.js`.

### Setup

1. Start the server: `npm start`
2. Update the test script with valid `USER_ID` and `AUTH_TOKEN`
3. Run tests: `node test-wallet-endpoints.js`

### Test Coverage

The test script covers:
- ✓ Get wallet information
- ✓ Get balance only
- ✓ Get transaction history
- ✓ Filter transactions by type
- ✓ Authorization checks (403 Forbidden)
- ✓ Invalid pagination parameters (400 Bad Request)
- ✓ Invalid transaction type (400 Bad Request)

## Database Schema

### Wallet Collection

```javascript
{
  _id: ObjectId,
  userId: ObjectId (unique, indexed),
  coinBalance: Number (min: 0),
  diamondBalance: Number (min: 0),
  updatedAt: Date,
  createdAt: Date,
  __v: Number
}
```

### Transaction Collection

```javascript
{
  _id: ObjectId,
  userId: ObjectId (indexed),
  type: String (indexed, enum),
  amount: Number,
  currency: String (enum: coins, diamonds, USD, SAR),
  timestamp: Date (indexed),
  description: String (max: 500),
  metadata: {
    giftId: ObjectId,
    streamId: ObjectId,
    paymentGateway: String,
    paymentId: String,
    recipientId: ObjectId
  },
  createdAt: Date,
  updatedAt: Date,
  __v: Number
}
```

### Indexes

- `wallets`: `{ userId: 1 }` (unique)
- `transactions`: `{ userId: 1, timestamp: -1 }` (compound)
- `transactions`: `{ userId: 1 }` (single)
- `transactions`: `{ type: 1 }` (single)
- `transactions`: `{ timestamp: 1 }` (single)

## Requirements Mapping

This implementation satisfies the following requirements:

- **Requirement 14.1**: Wallet created for each user upon registration (handled by auth system)
- **Requirement 14.2**: Display coin and diamond balances (GET /api/wallet/:userId/balance)
- **Requirement 14.3**: Record all wallet changes as transactions (transactionService)
- **Requirement 14.4**: Display transaction history (GET /api/wallet/transactions/:userId)
- **Requirement 14.5**: Ensure balances cannot become negative (model validation + service checks)

## Security Considerations

1. **Authentication**: All endpoints require valid JWT token
2. **Authorization**: Users can only access their own wallet data
3. **Input Validation**: Pagination parameters and transaction types validated
4. **Balance Protection**: Multiple layers prevent negative balances
5. **Atomic Operations**: MongoDB transactions prevent race conditions
6. **Immutable History**: Transactions cannot be modified or deleted

## Performance Considerations

1. **Indexes**: Compound index on `{ userId, timestamp }` for fast transaction queries
2. **Pagination**: Limits result set size to prevent memory issues
3. **Lightweight Endpoint**: `/balance` endpoint for frequent polling without transaction data
4. **Connection Pooling**: MongoDB connection pool handles concurrent requests
5. **Caching**: Consider Redis caching for frequently accessed wallet balances

## Future Enhancements

1. **Webhook Support**: Add webhook notifications for wallet changes
2. **Real-time Updates**: WebSocket events for balance changes
3. **Transaction Receipts**: Generate PDF receipts for transactions
4. **Export**: Allow users to export transaction history as CSV
5. **Analytics**: Add spending analytics and insights
6. **Refunds**: Support for transaction reversals and refunds
7. **Multi-currency**: Support for multiple fiat currencies

## Troubleshooting

### Issue: "Wallet not found"

**Cause**: User doesn't have a wallet created

**Solution**: Ensure wallet is created during user registration

### Issue: "Insufficient coin balance"

**Cause**: User trying to spend more coins than available

**Solution**: Check balance before attempting transaction, display error to user

### Issue: "Transaction failed"

**Cause**: Database transaction aborted due to error

**Solution**: Check logs for specific error, ensure MongoDB replica set is configured for transactions

### Issue: 403 Forbidden

**Cause**: User trying to access another user's wallet

**Solution**: Ensure userId in URL matches authenticated user's ID

## Support

For questions or issues with the wallet implementation, please refer to:
- API documentation in this file
- Transaction service source code: `src/services/transactionService.js`
- Wallet controller source code: `src/controllers/walletController.js`
- Test script: `test-wallet-endpoints.js`
