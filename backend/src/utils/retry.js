/**
 * Retry utility with exponential backoff
 * Implements retry logic for transient failures
 */

const logger = require('./logger');

/**
 * Retry with exponential backoff
 * @param {Function} fn - Function to retry (should return Promise)
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.baseDelay - Base delay in milliseconds (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in milliseconds (default: 10000)
 * @param {Function} options.shouldRetry - Function to determine if error should be retried (default: retry all errors)
 * @returns {Promise<any>} - Result from the function
 */
async function retryWithBackoff(fn, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const baseDelay = options.baseDelay || 1000;
  const maxDelay = options.maxDelay || 10000;
  const shouldRetry = options.shouldRetry || (() => true);

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        logger.info('Retry succeeded', {
          attempt,
          totalAttempts: attempt + 1,
          function: fn.name || 'anonymous'
        });
      }
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if we should retry this error
      if (!shouldRetry(error) || attempt === maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );
      
      logger.warn('Retry attempt failed, waiting before retry', {
        attempt: attempt + 1,
        maxRetries,
        delay: Math.round(delay),
        error: error.message,
        function: fn.name || 'anonymous'
      });
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a retryable function wrapper
 * @param {Function} fn - Function to wrap
 * @param {Object} options - Retry options
 * @returns {Function} - Wrapped function with retry logic
 */
function createRetryable(fn, options = {}) {
  return async function(...args) {
    const boundFn = fn.bind(this, ...args);
    return retryWithBackoff(boundFn, options);
  };
}

/**
 * Default error filter for retryable operations
 * Retries network errors, timeouts, and rate limits
 * @param {Error} error - Error to check
 * @returns {boolean} - Whether to retry
 */
function defaultRetryFilter(error) {
  // Retry network errors
  if (error.code === 'ECONNREFUSED' || 
      error.code === 'ECONNRESET' || 
      error.code === 'ETIMEDOUT') {
    return true;
  }
  
  // Retry rate limiting errors
  if (error.statusCode === 429) {
    return true;
  }
  
  // Retry service unavailable errors
  if (error.statusCode === 503 || error.statusCode === 504) {
    return true;
  }
  
  // Don't retry client errors (4xx) except 429
  if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
    return false;
  }
  
  // Default: retry server errors (5xx)
  return error.statusCode >= 500;
}

module.exports = {
  retryWithBackoff,
  sleep,
  createRetryable,
  defaultRetryFilter
};