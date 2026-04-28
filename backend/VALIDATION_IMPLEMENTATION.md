# Input Validation and Sanitization Implementation

## Overview
Comprehensive input validation and sanitization has been implemented for all API endpoints in the social live streaming application backend. This implementation addresses Requirement 30.6: "Validate and sanitize all user input to prevent injection attacks."

## What Was Implemented

### 1. Validation Middleware Enhancement (`src/middleware/validation.js`)
- **HTML Sanitization**: Basic HTML entity encoding to prevent XSS attacks
- **File Upload Validation**: Validation for file type, size, and content
- **Enhanced Validation Functions**:
  - `validateRequest()`: Validates request body with HTML sanitization
  - `validateQuery()`: Validates query parameters
  - `validateFile()`: Middleware for file upload validation
  - `sanitizeHTML()`: Function to sanitize HTML content
  - `validateFileUpload()`: Function to validate file uploads

### 2. Comprehensive Validation Schemas (`src/middleware/validationSchemas.js`)
Created Joi validation schemas for all endpoints:

#### Authentication Schemas
- `sendOTPSchema`: Phone/email OTP requests
- `registerSchema`: User registration with method validation
- `loginSchema`: User login validation

#### User Management Schemas
- `updateProfileSchema`: Profile updates with display name uniqueness
- `followUserSchema`: Follow user requests
- `blockUserSchema`: Block user requests
- `reportUserSchema`: User reporting with reason validation

#### Stream Management Schemas
- `startStreamSchema`: Stream creation
- `chatMessageSchema`: Chat messages (max 500 chars)
- `pinMessageSchema`: Message pinning
- `moderateSchema`: Stream moderation actions
- `sendGiftSchema`: Gift sending

#### Voice Room Schemas
- `createVoiceRoomSchema`: Voice room creation
- `promoteDemoteSchema`: Speaker promotion/demotion
- `voiceRoomChatSchema`: Voice room chat messages

#### Wallet and Payment Schemas
- `purchaseCoinsSchema`: Coin purchases
- `createWithdrawalSchema`: Diamond withdrawal requests

#### Gift Management Schemas
- `createGiftSchema`: Gift creation (admin)

#### Host and Agency Schemas
- `registerHostSchema`: Host registration
- `registerAgentSchema`: Agent registration
- `assignAgentSchema`: Host-agent assignment

#### Admin Management Schemas
- `updateUserSchema`: User updates (admin)
- `resolveReportSchema`: Report resolution
- `updateWithdrawalSchema`: Withdrawal status updates

#### Notification Schemas
- `notificationPreferencesSchema`: Notification preferences
- `fcmTokenSchema`: FCM token registration

#### Common Schemas
- `paginationSchema`: Standard pagination parameters
- `fileUploadSchema`: File upload validation

### 3. File Upload Implementation (`src/middleware/fileUpload.js`)
- **File Upload Middleware**: Handles file uploads with validation
- **File Processing**: Secure filename generation and processing
- **Validation Features**:
  - File size limits (configurable)
  - MIME type validation
  - File extension validation
  - Basic file content validation (signature checking)
  - Image dimension validation (placeholder)

### 4. Updated Route Files
All route files have been updated to use validation middleware:

#### `src/routes/auth.js`
- Added validation for OTP sending, registration, and login

#### `src/routes/users.js`
- Added validation for profile updates, follow/block/report actions
- Added pagination validation for follower/following lists

#### `src/routes/streams.js`
- Enhanced existing validation with additional schemas

#### `src/routes/voiceRooms.js`
- Added validation for room creation, promotion/demotion, chat
- Added pagination for active rooms list

#### `src/routes/wallet.js`
- Enhanced existing validation schemas

#### `src/routes/gifts.js`
- Added validation for gift creation

#### `src/routes/hosts.js`
- Added validation for host registration, agent management
- Added pagination for admin lists

#### `src/routes/admin.js`
- Added validation for all admin endpoints
- Added pagination for all list endpoints
- Added request validation for update operations

#### `src/routes/notifications.js`
- Added pagination for notification lists
- Added validation for notification preferences and FCM tokens

#### `src/routes/uploads.js` (NEW)
- Created file upload endpoints with validation
- Profile picture upload endpoint
- Gift animation upload endpoint (admin)
- Bulk file upload endpoint

#### `src/routes/index.js`
- Added uploads route to main router

### 5. Package Updates
- Added `multer` dependency for file upload handling

## Security Features Implemented

### 1. Input Validation
- **Schema-based validation** for all request bodies and query parameters
- **Custom validation logic** for complex scenarios (registration methods)
- **Pattern matching** for phone numbers, emails, MongoDB ObjectIds
- **Enum validation** for predefined options (actions, reasons, statuses)

### 2. HTML Sanitization
- **Automatic sanitization** of all string fields in request bodies
- **HTML entity encoding** for `<`, `>`, `&`, `"`, `'`, `/` characters
- **Recursive sanitization** for nested objects and arrays

### 3. File Upload Security
- **File type validation** using MIME types and extensions
- **File size limits** (configurable per endpoint)
- **Content validation** using file signatures
- **Secure filename generation** to prevent path traversal
- **Malicious content detection** (basic implementation)

### 4. Error Handling
- **Structured error responses** with error codes
- **Detailed validation errors** showing field-specific messages
- **Logging** of all validation failures for monitoring
- **User-friendly error messages** without exposing internal details

## Testing
Validation has been tested with:
- Valid and invalid registration scenarios
- Profile updates with HTML content
- File uploads with various file types and sizes
- Chat messages with length validation
- Payment and wallet operations
- Admin operations with proper authorization

## Compliance with Requirements
This implementation fully addresses **Requirement 30.6**: "The Backend_Service SHALL validate and sanitize all user input to prevent injection attacks" by:

1. **Validating all user input** through Joi schemas
2. **Sanitizing HTML content** to prevent XSS attacks
3. **Validating file uploads** to prevent malicious file uploads
4. **Preventing injection attacks** through proper input validation
5. **Providing comprehensive error handling** for validation failures

## Usage Examples

### 1. Using Validation Middleware
```javascript
// In route files
router.post('/register', validateRequest(registerSchema), authController.register);
router.get('/users', validateQuery(paginationSchema), userController.getUsers);
```

### 2. File Upload with Validation
```javascript
router.post('/profile-picture', 
  authenticate,
  upload.single('profilePicture'),
  validateFile({
    maxSize: 5 * 1024 * 1024,
    allowedTypes: ['image/jpeg', 'image/png']
  }),
  userController.uploadProfilePicture
);
```

### 3. Custom Validation Logic
```javascript
// In validationSchemas.js
const registerSchema = Joi.object({...}).custom((value, helpers) => {
  // Custom validation logic
  if (socialProvider && !firebaseToken) {
    return helpers.error('any.required', { message: 'Firebase token required for social registration' });
  }
  return value;
});
```

## Future Enhancements
1. **Advanced HTML Sanitization**: Use a library like `DOMPurify` for more comprehensive sanitization
2. **Image Processing**: Integrate image processing for resizing and optimization
3. **Virus Scanning**: Integrate virus scanning for uploaded files
4. **Rate Limiting**: Add more granular rate limiting based on validation failures
5. **Validation Caching**: Cache validation results for common requests

## Files Created/Modified
- `src/middleware/validation.js` (enhanced)
- `src/middleware/validationSchemas.js` (new)
- `src/middleware/fileUpload.js` (new)
- `src/routes/uploads.js` (new)
- All route files updated with validation middleware
- `package.json` updated with multer dependency
- `src/routes/index.js` updated with uploads route