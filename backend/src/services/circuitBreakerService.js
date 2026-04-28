/**
 * Circuit Breaker Service
 * Manages circuit breakers for all external services
 */
const CircuitBreaker = require('../utils/circuitBreaker');
const logger = require('../utils/logger');

class CircuitBreakerService {
  constructor() {
    this.breakers = new Map();
    this.logger = logger;
  }

  /**
   * Register a service with circuit breaker protection
   * @param {string} serviceName - Unique name for the service
   * @param {Object} service - The service object to protect
   * @param {Object} options - Circuit breaker configuration
   * @param {number} options.failureThreshold - Failures before opening (default: 5)
   * @param {number} options.timeout - Time in ms before half-open (default: 60000)
   * @param {number} options.halfOpenSuccessThreshold - Successes needed to close (default: 3)
   * @returns {CircuitBreaker} - The created circuit breaker
   */
  registerService(serviceName, service, options = {}) {
    if (this.breakers.has(serviceName)) {
      this.logger.warn(`Circuit breaker already registered for ${serviceName}, returning existing`);
      return this.breakers.get(serviceName);
    }

    const breaker = new CircuitBreaker(
      service,
      serviceName,
      options.failureThreshold || 5,
      options.timeout || 60000,
      options.halfOpenSuccessThreshold || 3
    );

    this.breakers.set(serviceName, breaker);
    this.logger.info(`Circuit breaker registered for ${serviceName}`, {
      serviceName,
      failureThreshold: options.failureThreshold || 5,
      timeout: options.timeout || 60000,
      halfOpenSuccessThreshold: options.halfOpenSuccessThreshold || 3
    });

    return breaker;
  }

  /**
   * Get a circuit breaker for a service
   * @param {string} serviceName - Name of the service
   * @returns {CircuitBreaker|null} - The circuit breaker or null if not found
   */
  getBreaker(serviceName) {
    return this.breakers.get(serviceName) || null;
  }

  /**
   * Call a method on a protected service
   * @param {string} serviceName - Name of the service
   * @param {string} method - Method to call
   * @param {...any} args - Arguments for the method
   * @returns {Promise<any>} - Result from the service
   * @throws {Error} - If circuit breaker is open or service fails
   */
  async call(serviceName, method, ...args) {
    const breaker = this.breakers.get(serviceName);
    
    if (!breaker) {
      throw new Error(`No circuit breaker registered for ${serviceName}`);
    }

    return breaker.call(method, ...args);
  }

  /**
   * Get all circuit breaker states
   * @returns {Array} - Array of circuit breaker states
   */
  getAllStates() {
    const states = [];
    
    for (const [serviceName, breaker] of this.breakers) {
      states.push(breaker.getState());
    }
    
    return states;
  }

  /**
   * Reset a circuit breaker
   * @param {string} serviceName - Name of the service
   */
  resetBreaker(serviceName) {
    const breaker = this.breakers.get(serviceName);
    
    if (breaker) {
      breaker.reset();
      this.logger.info(`Circuit breaker reset for ${serviceName}`);
    } else {
      this.logger.warn(`Cannot reset circuit breaker for ${serviceName}: not found`);
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const [serviceName, breaker] of this.breakers) {
      breaker.reset();
    }
    
    this.logger.info('All circuit breakers reset');
  }

  /**
   * Health check endpoint data
   * @returns {Object} - Health status of all circuit breakers
   */
  getHealthStatus() {
    const status = {
      healthy: true,
      services: []
    };

    for (const [serviceName, breaker] of this.breakers) {
      const state = breaker.getState();
      const serviceStatus = {
        name: serviceName,
        state: state.state,
        healthy: state.state === 'CLOSED' || state.state === 'HALF_OPEN',
        failureCount: state.failureCount,
        stats: state.stats
      };

      status.services.push(serviceStatus);
      
      if (state.state === 'OPEN') {
        status.healthy = false;
      }
    }

    return status;
  }
}

// Create singleton instance
const circuitBreakerService = new CircuitBreakerService();

module.exports = circuitBreakerService;