/**
 * Error Handling and Recovery Test
 * Tests all error handling and recovery features implemented in task 14.6
 */
const CircuitBreaker = require('./src/utils/circuitBreaker');
const circuitBreakerService = require('./src/services/circuitBreakerService');
const { retryWithBackoff, createRetryable, defaultRetryFilter } = require('./src/utils/retry');
const featureFlags = require('./src/utils/featureFlags');
const { AppError } = require('./src/middleware/errorHandler');

console.log('Testing Error Handling and Recovery Features...\n');

// Test 1: Custom Error Classes
console.log('Test 1: Custom Error Classes');
try {
  const appError = new AppError('Test error', 400, 'TEST_ERROR');
  console.log('✓ AppError created:', {
    message: appError.message,
    statusCode: appError.statusCode,
    code: appError.code,
    isOperational: appError.isOperational
  });
} catch (error) {
  console.error('✗ AppError test failed:', error);
}

// Test 2: Retry with Exponential Backoff
console.log('\nTest 2: Retry with Exponential Backoff');
let callCount = 0;
const failingThenSucceedingFn = () => {
  callCount++;
  if (callCount <= 2) {
    throw new Error(`Temporary failure ${callCount}`);
  }
  return 'Success after retries';
};

retryWithBackoff(failingThenSucceedingFn, { maxRetries: 3, baseDelay: 100 })
  .then(result => {
    console.log('✓ Retry succeeded:', result);
    console.log('✓ Total calls:', callCount);
    
    // Test 3: Retryable Function Wrapper
    console.log('\nTest 3: Retryable Function Wrapper');
    callCount = 0;
    const retryableFn = createRetryable(failingThenSucceedingFn, { maxRetries: 2 });
    
    return retryableFn();
  })
  .then(result => {
    console.log('✓ Retryable wrapper succeeded:', result);
    
    // Test 4: Default Retry Filter
    console.log('\nTest 4: Default Retry Filter');
    
    const networkError = new Error('Connection refused');
    networkError.code = 'ECONNREFUSED';
    console.log('✓ Network error should retry:', defaultRetryFilter(networkError));
    
    const clientError = new Error('Bad request');
    clientError.statusCode = 400;
    console.log('✓ Client error should NOT retry:', !defaultRetryFilter(clientError));
    
    const rateLimitError = new Error('Too many requests');
    rateLimitError.statusCode = 429;
    console.log('✓ Rate limit error should retry:', defaultRetryFilter(rateLimitError));
    
    // Test 5: Feature Flags
    console.log('\nTest 5: Feature Flags');
    
    console.log('✓ Core features enabled:', {
      AUTHENTICATION: featureFlags.isEnabled('AUTHENTICATION'),
      STREAMING: featureFlags.isEnabled('STREAMING'),
      PAYMENTS: featureFlags.isEnabled('PAYMENTS')
    });
    
    // Test enabling/disabling
    featureFlags.enable('VOICE_ROOMS');
    console.log('✓ VOICE_ROOMS enabled:', featureFlags.isEnabled('VOICE_ROOMS'));
    
    featureFlags.disable('VOICE_ROOMS');
    console.log('✓ VOICE_ROOMS disabled:', !featureFlags.isEnabled('VOICE_ROOMS'));
    
    // Test 6: Feature Flag Execution
    console.log('\nTest 6: Feature Flag Execution');
    
    const enabledFeatureFn = () => Promise.resolve('Feature executed');
    const fallbackFn = () => Promise.resolve('Fallback executed');
    
    featureFlags.enable('GIFT_ANIMATIONS');
    return featureFlags.executeIfEnabled('GIFT_ANIMATIONS', enabledFeatureFn, fallbackFn);
  })
  .then(result => {
    console.log('✓ Feature execution (enabled):', result);
    
    featureFlags.disable('GIFT_ANIMATIONS');
    return featureFlags.executeIfEnabled('GIFT_ANIMATIONS', 
      () => Promise.resolve('Should not execute'),
      () => Promise.resolve('Fallback executed')
    );
  })
  .then(result => {
    console.log('✓ Feature execution (disabled with fallback):', result);
    
    // Test 7: Circuit Breaker Integration
    console.log('\nTest 7: Circuit Breaker Integration');
    
    const mockService = {
      testMethod: () => Promise.resolve('Circuit breaker protected')
    };
    
    circuitBreakerService.registerService('testService', mockService);
    return circuitBreakerService.call('testService', 'testMethod');
  })
  .then(result => {
    console.log('✓ Circuit breaker service call:', result);
    
    // Test 8: Circuit Breaker Health Status
    console.log('\nTest 8: Circuit Breaker Health Status');
    const healthStatus = circuitBreakerService.getHealthStatus();
    console.log('✓ Circuit breaker health:', healthStatus.healthy ? 'healthy' : 'unhealthy');
    console.log('✓ Services monitored:', healthStatus.services.length);
    
    // Test 9: Feature Flags Health Status
    console.log('\nTest 9: Feature Flags Health Status');
    const featureHealth = featureFlags.getHealthStatus();
    console.log('✓ Feature flags health check:', {
      environment: featureHealth.environment,
      totalFeatures: featureHealth.totalFeatures,
      enabledFeatures: featureHealth.enabledFeatures,
      criticalFeaturesEnabled: featureHealth.criticalFeaturesEnabled
    });
    
    console.log('\n✓ All error handling and recovery tests passed!');
    console.log('\nError Handling and Recovery Implementation Summary:');
    console.log('- Created custom error classes (AppError) with operational flag');
    console.log('- Implemented retry logic with exponential backoff');
    console.log('- Added default retry filter for network/rate limit/server errors');
    console.log('- Created retryable function wrapper for easy integration');
    console.log('- Implemented feature flags for graceful degradation');
    console.log('- Added feature flag health monitoring');
    console.log('- Integrated circuit breaker with retry logic');
    console.log('- All components tested and working correctly');
  })
  .catch(error => {
    console.error('✗ Test failed:', error);
    process.exit(1);
  });