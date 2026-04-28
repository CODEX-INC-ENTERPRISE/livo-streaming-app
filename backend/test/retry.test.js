/**
 * Retry Utility Tests
 * Tests for retry with exponential backoff implementation
 */
const { retryWithBackoff, sleep, createRetryable, defaultRetryFilter } = require('../src/utils/retry');

describe('Retry Utility', () => {
  describe('retryWithBackoff', () => {
    test('should succeed on first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await retryWithBackoff(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should retry on failure and succeed', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success');
      
      const result = await retryWithBackoff(mockFn, { maxRetries: 3 });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('should fail after max retries', async () => {
      const error = new Error('Persistent failure');
      const mockFn = jest.fn().mockRejectedValue(error);
      
      await expect(retryWithBackoff(mockFn, { maxRetries: 2 }))
        .rejects.toThrow('Persistent failure');
      
      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    test('should respect shouldRetry filter', async () => {
      const retryableError = new Error('Retryable error');
      retryableError.statusCode = 503;
      
      const nonRetryableError = new Error('Non-retryable error');
      nonRetryableError.statusCode = 400;
      
      const mockFn = jest.fn()
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(nonRetryableError);
      
      const shouldRetry = (error) => error.statusCode === 503;
      
      await expect(retryWithBackoff(mockFn, { shouldRetry }))
        .rejects.toThrow('Non-retryable error');
      
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('should apply exponential backoff', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce('success');
      
      const startTime = Date.now();
      await retryWithBackoff(mockFn, { baseDelay: 100, maxDelay: 1000 });
      const endTime = Date.now();
      
      expect(mockFn).toHaveBeenCalledTimes(3);
      expect(endTime - startTime).toBeGreaterThan(300); // At least 100 + 200ms
    });
  });

  describe('defaultRetryFilter', () => {
    test('should retry network errors', () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      
      expect(defaultRetryFilter(error)).toBe(true);
    });

    test('should retry rate limiting errors', () => {
      const error = new Error('Too many requests');
      error.statusCode = 429;
      
      expect(defaultRetryFilter(error)).toBe(true);
    });

    test('should retry service unavailable errors', () => {
      const error = new Error('Service unavailable');
      error.statusCode = 503;
      
      expect(defaultRetryFilter(error)).toBe(true);
    });

    test('should not retry client errors (except 429)', () => {
      const error = new Error('Bad request');
      error.statusCode = 400;
      
      expect(defaultRetryFilter(error)).toBe(false);
    });

    test('should retry server errors', () => {
      const error = new Error('Internal server error');
      error.statusCode = 500;
      
      expect(defaultRetryFilter(error)).toBe(true);
    });
  });

  describe('createRetryable', () => {
    test('should create retryable function wrapper', async () => {
      const originalFn = jest.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockResolvedValueOnce('success');
      
      const retryableFn = createRetryable(originalFn, { maxRetries: 2 });
      
      const result = await retryableFn('arg1', 'arg2');
      
      expect(result).toBe('success');
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(originalFn).toHaveBeenCalledTimes(2);
    });

    test('should preserve function context', async () => {
      const context = {
        value: 'test',
        getValue: function() {
          return this.value;
        }
      };
      
      const retryableGetValue = createRetryable(context.getValue);
      
      const result = await retryableGetValue.call(context);
      
      expect(result).toBe('test');
    });
  });

  describe('sleep', () => {
    test('should sleep for specified time', async () => {
      const startTime = Date.now();
      await sleep(100);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(90);
    });
  });
});