// Simple test script to verify authentication endpoints
const config = require('./src/config');
const { generateJWT, verifyJWT } = require('./src/middleware/auth');

console.log('Testing JWT generation and verification...\n');

try {
  // Test JWT generation
  const payload = {
    userId: '507f1f77bcf86cd799439011',
    isHost: false,
    isAdmin: false,
  };

  console.log('1. Generating JWT token...');
  const token = generateJWT(payload);
  console.log('✓ Token generated successfully');
  console.log('Token:', token.substring(0, 50) + '...\n');

  // Test JWT verification
  console.log('2. Verifying JWT token...');
  const decoded = verifyJWT(token);
  console.log('✓ Token verified successfully');
  console.log('Decoded payload:', decoded);
  console.log('\n✓ All authentication tests passed!');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}
