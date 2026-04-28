/**
 * Circuit Breaker Pattern Implementation
 * Protects external service calls from cascade failures
 * 
 * States:
 * - CLOSED: Normal operation, calls pass through
 * - OPEN: Service is failing, calls fail fast
 * - HALF_OPEN: Testing if service has recovered
 * 
 * @class CircuitBreaker
 */
class CircuitBreaker {
  /**
   * Create a circuit breaker for a service
   * @param {Object} service - The service object to protect
   * @param {string} serviceName - Name of the service for logging
   * @param {number} failureThreshold - Number of failures before opening circuit (default: 5)
   * @param {number} timeout - Time in ms to wait before attempting half-open (default: 60000 = 1 minute)
   * @param {number} halfOpenSuccessThreshold - Number of successful calls needed to close circuit (default: 3)
   */
  constructor(service, serviceName, failureThreshold = 5, timeout = 60000, halfOpenSuccessThreshold = 3) {
    this.service = service;
    this.serviceName = serviceName;
    this.failureThreshold = failureThreshold;
    this.timeout = timeout;
    this.halfOpenSuccessThreshold = halfOpenSuccessThreshold;
    
    // State tracking
    this.failureCount = 0;
    this.successCount = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
    
    // Statistics
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      circuitOpens: 0,
      circuitCloses: 0,
      lastFailure: null,
      lastSuccess: null
    };
    
    this.logger = require('./logger');
  }

  /**
   * Call a method on the protected service with circuit breaker protection
   * @param {string} method - Method name to call
   * @param {...any} args - Arguments to pass to the method
   * @returns {Promise<any>} - Result from the service method
   * @throws {Error} - If circuit is open or service call fails
   */
  async call(method, ...args) {
    this.stats.totalCalls++;
    
    // Check if circuit is OPEN
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        this.logger.warn(`Circuit breaker OPEN for ${this.serviceName}.${method}, failing fast`, {
          service: this.serviceName,
          method,
          nextAttempt: new Date(this.nextAttempt).toISOString(),
          state: this.state
        });
        throw new Error(`Circuit breaker is OPEN for ${this.serviceName}. Service unavailable.`);
      }
      
      // Timeout expired, transition to HALF_OPEN
      this.state = 'HALF_OPEN';
      this.successCount = 0;
      this.logger.info(`Circuit breaker transitioning to HALF_OPEN for ${this.serviceName}`, {
        service: this.serviceName,
        state: this.state
      });
    }
    
    try {
      // Call the service method
      const result = await this.service[method](...args);
      
      // Handle success
      this.onSuccess();
      return result;
    } catch (error) {
      // Handle failure
      this.onFailure(error, method);
      throw error;
    }
  }

  /**
   * Handle successful call
   * @private
   */
  onSuccess() {
    this.stats.successfulCalls++;
    this.stats.lastSuccess = new Date();
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        // Enough successful calls in HALF_OPEN state, close the circuit
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.stats.circuitCloses++;
        
        this.logger.info(`Circuit breaker CLOSED for ${this.serviceName} after ${this.successCount} successful calls`, {
          service: this.serviceName,
          state: this.state,
          successCount: this.successCount
        });
      }
    } else {
      // Reset failure count on success in CLOSED state
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed call
   * @param {Error} error - The error that occurred
   * @param {string} method - Method name that failed
   * @private
   */
  onFailure(error, method) {
    this.stats.failedCalls++;
    this.stats.lastFailure = new Date();
    this.failureCount++;
    
    this.logger.warn(`Circuit breaker failure for ${this.serviceName}.${method}`, {
      service: this.serviceName,
      method,
      error: error.message,
      failureCount: this.failureCount,
      threshold: this.failureThreshold,
      state: this.state
    });
    
    if (this.state === 'HALF_OPEN') {
      // Failed in HALF_OPEN state, go back to OPEN
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      this.successCount = 0;
      
      this.logger.warn(`Circuit breaker re-OPENED for ${this.serviceName} after HALF_OPEN failure`, {
        service: this.serviceName,
        state: this.state,
        nextAttempt: new Date(this.nextAttempt).toISOString()
      });
    } else if (this.state === 'CLOSED' && this.failureCount >= this.failureThreshold) {
      // Too many failures in CLOSED state, open the circuit
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      this.stats.circuitOpens++;
      
      this.logger.error(`Circuit breaker OPENED for ${this.serviceName} after ${this.failureCount} failures`, {
        service: this.serviceName,
        state: this.state,
        failureCount: this.failureCount,
        threshold: this.failureThreshold,
        nextAttempt: new Date(this.nextAttempt).toISOString()
      });
    }
  }

  /**
   * Get current circuit breaker state
   * @returns {Object} - Current state and statistics
   */
  getState() {
    return {
      serviceName: this.serviceName,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
      stats: this.stats
    };
  }

  /**
   * Manually reset the circuit breaker to CLOSED state
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    
    this.logger.info(`Circuit breaker manually RESET for ${this.serviceName}`, {
      service: this.serviceName,
      state: this.state
    });
  }
}

module.exports = CircuitBreaker;