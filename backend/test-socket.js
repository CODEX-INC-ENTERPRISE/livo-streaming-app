/**
 * Simple Socket.io connection test
 * This script tests the Socket.io server setup
 */

const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Generate a test JWT token
const testToken = jwt.sign(
  {
    userId: '507f1f77bcf86cd799439011',
    isHost: false,
    isAdmin: false,
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('Connecting to Socket.io server...');
console.log('Server URL:', SERVER_URL);

// Create socket connection
const socket = io(SERVER_URL, {
  auth: {
    token: testToken,
  },
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('✓ Connected to Socket.io server');
  console.log('Socket ID:', socket.id);

  // Test heartbeat
  console.log('\nTesting heartbeat...');
  socket.emit('ping');
});

socket.on('pong', () => {
  console.log('✓ Heartbeat working (received pong)');
  
  // Test stream events
  console.log('\nTesting stream events...');
  socket.emit('stream:join', { streamId: '507f1f77bcf86cd799439012' });
});

socket.on('stream:joined', (data) => {
  console.log('✓ Stream join successful:', data);
  
  // Test chat message
  console.log('\nTesting chat message...');
  socket.emit('stream:chat', {
    streamId: '507f1f77bcf86cd799439012',
    message: 'Hello from test!',
  });
});

socket.on('stream:chat-message', (data) => {
  console.log('✓ Chat message received:', data);
  
  // Test voice room events
  console.log('\nTesting voice room events...');
  socket.emit('voice:join', { roomId: '507f1f77bcf86cd799439013' });
});

socket.on('voice:joined', (data) => {
  console.log('✓ Voice room join successful:', data);
  
  console.log('\n✓ All tests passed!');
  console.log('Disconnecting...');
  socket.disconnect();
  process.exit(0);
});

socket.on('error', (error) => {
  console.error('✗ Socket error:', error);
});

socket.on('connect_error', (error) => {
  console.error('✗ Connection error:', error.message);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error('✗ Test timeout');
  socket.disconnect();
  process.exit(1);
}, 10000);
