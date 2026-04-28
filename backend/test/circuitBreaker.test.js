/**
 * Circuit Breaker Tests
 * Tests for circuit breaker pattern implementation
 */
const CircuitBreaker = require('../src/utils/circuitBreaker');
const circuitBreakerService = require('../src/services/circuitBreakerService');

describe('Circuit Breaker Pattern', () => {
  describe('CircuitBreaker Class', () => {
    let mockService;
    let circuitBreaker;

    beforeEach(() => {
      mockService = {
        testMethod: jest.fn()
      };
      circuitBreaker = new CircuitBreaker(mockService, 'testService', 3, 1000, 2);
    });

    test('should start in CLOSED state', () => {
      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failureCount).toBe(0);
    });

    test('should call service method when circuit is CLOSED', async () => {
      mockService.testMethod.mockResolvedValue('success');
      
      const result = await circuitBreaker.call('testMethod', 'arg1', 'arg2');
      
      expect(result).toBe('success');
      expect(mockService.testMethod).toHaveBeenCalledWith('arg1', 'arg2');
      expect(circuitBreaker.failureCount).toBe(0);
    });

    test('should increment failure count on service failure', async () => {
      mockService.testMethod.mockRejectedValue(new Error('Service error'));
      
      await expect(circuitBreaker.call('testMethod')).rejects.toThrow('Service error');
      
      expect(circuitBreaker.failureCount).toBe(1);
      expect(circuitBreaker.state).toBe('CLOSED');
    });

    test('should open circuit after threshold failures', async () => {
      mockService.testMethod.mockRejectedValue(new Error('Service error'));
      
      // First 3 failures (threshold is 3)
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.call('testMethod')).rejects.toThrow('Service error');
      }
      
      expect(circuitBreaker.failureCount).toBe(3);
      expect(circuitBreaker.state).toBe('OPEN');
      expect(circuitBreaker.nextAttempt).toBeGreaterThan(Date.now());
    });

    test('should fail fast when circuit is OPEN', async () => {
      // Open the circuit first
      circuitBreaker.state = 'OPEN';
      circuitBreaker.nextAttempt = Date.now() + 10000;
      
      await expect(circuitBreaker.call('testMethod')).rejects.toThrow('Circuit breaker is OPEN');
      
      // Service should not be called
      expect(mockService.testMethod).not.toHaveBeenCalled();
    });

    test('should transition to HALF_OPEN after timeout', async () => {
      // Open the circuit
      circuitBreaker.state = 'OPEN';
      circuitBreaker.nextAttempt = Date.now() - 1000; // Past timeout
      
      mockService.testMethod.mockResolvedValue('success');
      
      const result = await circuitBreaker.call('testMethod');
      
      expect(result).toBe('success');
      expect(circuitBreaker.state).toBe('HALF_OPEN');
    });

    test('should close circuit after successful calls in HALF_OPEN', async () => {
      // Start in HALF_OPEN state
      circuitBreaker.state = 'HALF_OPEN';
      circuitBreaker.successCount = 1; // Already had 1 success
      mockService.testMethod.mockResolvedValue('success');
      
      // Need 2 successes to close (halfOpenSuccessThreshold = 2)
      await circuitBreaker.call('testMethod');
      
      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failureCount).toBe(0);
      expect(circuitBreaker.successCount).toBe(0);
    });

    test('should re-open circuit on failure in HALF_OPEN', async () => {
      // Start in HALF_OPEN state
      circuitBreaker.state = 'HALF_OPEN';
      mockService.testMethod.mockRejectedValue(new Error('Service error'));
      
      await expect(circuitBreaker.call('testMethod')).rejects.toThrow('Service error');
      
      expect(circuitBreaker.state).toBe('OPEN');
      expect(circuitBreaker.nextAttempt).toBeGreaterThan(Date.now());
    });

    test('should reset failure count on success', async () => {
      // Set failure count to 2
      circuitBreaker.failureCount = 2;
      mockService.testMethod.mockResolvedValue('success');
      
      await circuitBreaker.call('testMethod');
      
      expect(circuitBreaker.failureCount).toBe(0);
    });

    test('should get state information', () => {
      const state = circuitBreaker.getState();
      
      expect(state.serviceName).toBe('testService');
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
      expect(state.stats).toHaveProperty('totalCalls');
    });

    test('should manually reset circuit', () => {
      // Open the circuit
      circuitBreaker.state = 'OPEN';
      circuitBreaker.failureCount = 5;
      
      circuitBreaker.reset();
      
      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failureCount).toBe(0);
    });
  });

  describe('CircuitBreakerService', () => {
    beforeEach(() => {
      // Clear any existing breakers
      circuitBreakerService.breakers.clear();
    });

    test('should register service with circuit breaker', () => {
      const mockService = { testMethod: () => {} };
      
      const breaker = circuitBreakerService.registerService('testService', mockService, {
        failureThreshold: 5,
        timeout: 10000
      });
      
      expect(breaker).toBeInstanceOf(CircuitBreaker);
      expect(circuitBreakerService.getBreaker('testService')).toBe(breaker);
    });

    test('should return existing breaker for duplicate registration', () => {
      const mockService = { testMethod: () => {} };
      
      const breaker1 = circuitBreakerService.registerService('testService', mockService);
      const breaker2 = circuitBreakerService.registerService('testService', mockService);
      
      expect(breaker1).toBe(breaker2);
    });

    test('should call service through circuit breaker', async () => {
      const mockService = {
        testMethod: jest.fn().mockResolvedValue('success')
      };
      
      circuitBreakerService.registerService('testService', mockService);
      
      const result = await circuitBreakerService.call('testService', 'testMethod', 'arg1', 'arg2');
      
      expect(result).toBe('success');
      expect(mockService.testMethod).toHaveBeenCalledWith('arg1', 'arg2');
    });

    test('should throw error for unregistered service', async () => {
      await expect(circuitBreakerService.call('unknownService', 'testMethod'))
        .rejects.toThrow('No circuit breaker registered for unknownService');
    });

    test('should get all circuit breaker states', () => {
      const mockService = { testMethod: () => {} };
      
      circuitBreakerService.registerService('service1', mockService);
      circuitBreakerService.registerService('service2', mockService);
      
      const states = circuitBreakerService.getAllStates();
      
      expect(states).toHaveLength(2);
      expect(states[0].serviceName).toBe('service1');
      expect(states[1].serviceName).toBe('service2');
    });

    test('should reset specific circuit breaker', () => {
      const mockService = { testMethod: () => {} };
      
      const breaker = circuitBreakerService.registerService('testService', mockService);
      breaker.state = 'OPEN';
      breaker.failureCount = 5;
      
      circuitBreakerService.resetBreaker('testService');
      
      expect(breaker.state).toBe('CLOSED');
      expect(breaker.failureCount).toBe(0);
    });

    test('should reset all circuit breakers', () => {
      const mockService = { testMethod: () => {} };
      
      const breaker1 = circuitBreakerService.registerService('service1', mockService);
      const breaker2 = circuitBreakerService.registerService('service2', mockService);
      
      breaker1.state = 'OPEN';
      breaker2.state = 'OPEN';
      
      circuitBreakerService.resetAll();
      
      expect(breaker1.state).toBe('CLOSED');
      expect(breaker2.state).toBe('CLOSED');
    });

    test('should get health status', () => {
      const mockService = { testMethod: () => {} };
      
      circuitBreakerService.registerService('healthyService', mockService);
      
      const healthStatus = circuitBreakerService.getHealthStatus();
      
      expect(healthStatus).toHaveProperty('healthy');
      expect(healthStatus).toHaveProperty('services');
      expect(healthStatus.services).toHaveLength(1);
      expect(healthStatus.services[0].name).toBe('healthyService');
      expect(healthStatus.services[0].healthy).toBe(true);
    });

    test('should report unhealthy when any circuit is OPEN', () => {
      const mockService = { testMethod: () => {} };
      
      const breaker = circuitBreakerService.registerService('unhealthyService', mockService);
      breaker.state = 'OPEN';
      
      const healthStatus = circuitBreakerService.getHealthStatus();
      
      expect(healthStatus.healthy).toBe(false);
      expect(healthStatus.services[0].healthy).toBe(false);
    });
  });
});