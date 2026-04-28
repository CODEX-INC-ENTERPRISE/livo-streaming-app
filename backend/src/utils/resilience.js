/**
 * Resilience Utility
 * Combines retry logic with circuit breaker for robust external service calls
 */

const circuitBreakerService = require('../services/circuitBreakerService');
const { retryWithBackoff, defaultRetryFilter } = require('./retry');
const logger = require('./logger');

/**
 * Make a resilient call to an external service
 * Combines retry with exponential backoff and circuit breaker protection
 * 
 * @param {string} serviceName - Name of the service registered with circuit breaker
 * @param {string} method - Method to call on the service
 * @param {...any} args - Arguments for the method
 * @param {Object} options - Resilience options
 * @param {number} options.maxRetries - Maximum retries (default: 3)
 * @param {number} options.baseDelay - Base delay in ms (default: 1000)
 * @param {Function} options.shouldRetry - Retry filter function
 * @returns {Promise<any>} - Result from the service
 */
async function resilientCall(serviceName, method, ...args) {
  const options = typeof args[args.length - 1] === 'object' && args[args.length - 1].resilienceOptions 
    ? args.pop().resilienceOptions 
    : {};
  
  const resilienceOptions = {
    maxRetries: options.maxRetries || 3,
    baseDelay: options.baseDelay || 1000,
    shouldRetry: options.shouldRetry || defaultRetryFilter
  };
  
  // Create a function that calls through circuit breaker
  const callThroughBreaker = async () => {
    return circuitBreakerService.call(serviceName, method, ...args);
  };
  
  // Apply retry with exponential backoff
  return retryWithBackoff(callThroughBreaker, resilienceOptions);
}

/**
 * Create a resilient function wrapper
 * @param {string} serviceName - Name of the service
 * @param {string} method - Method name
 * @param {Object} options - Resilience options
 * @returns {Function} - Resilient function
 */
function createResilientFunction(serviceName, method, options = {}) {
  return async function(...args) {
    return resilientCall(serviceName, method, ...args, { resilienceOptions: options });
  };
}

/**
 * Register a service with both retry and circuit breaker protection
 * @param {string} serviceName - Service name
 * @param {Object} service - Service object
 * @param {Object} circuitBreakerOptions - Circuit breaker options
 * @param {Object} retryOptions - Retry options
 * @returns {Object} - Wrapped service with resilient methods
 */
function registerResilientService(serviceName, service, circuitBreakerOptions = {}, retryOptions = {}) {
  // Register with circuit breaker
  const breaker = circuitBreakerService.registerService(serviceName, service, circuitBreakerOptions);
  
  // Create wrapped service with resilient methods
  const wrappedService = { ...service };
  
  // Wrap all methods that return promises
  Object.getOwnPropertyNames(Object.getPrototypeOf(service)).forEach(methodName => {
    if (methodName !== 'constructor' && typeof service[methodName] === 'function') {
      const originalMethod = service[methodName];
      
      // Only wrap async methods
      if (originalMethod.constructor.name === 'AsyncFunction' || 
          (originalMethod.length > 0 && originalMethod.toString().includes('async'))) {
        wrappedService[methodName] = async function(...args) {
          return resilientCall(serviceName, methodName, ...args, { resilienceOptions: retryOptions });
        };
      }
    }
  });
  
  return {
    breaker,
    service: wrappedService,
    call: (method, ...args) => resilientCall(serviceName, method, ...args, { resilienceOptions: retryOptions })
  };
}

/**
 * Get resilience health status
 * @returns {Object} - Health status of all resilient services
 */
function getResilienceHealthStatus() {
  const circuitBreakerHealth = circuitBreakerService.getHealthStatus();
  
  return {
    circuitBreakers: circuitBreakerHealth,
    resilienceStrategy: 'retry + circuit breaker',
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  resilientCall,
  createResilientFunction,
  registerResilientService,
  getResilienceHealthStatus
};