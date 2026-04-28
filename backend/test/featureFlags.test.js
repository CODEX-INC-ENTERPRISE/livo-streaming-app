/**
 * Feature Flags Tests
 * Tests for feature flags and graceful degradation
 */
const featureFlags = require('../src/utils/featureFlags');

describe('Feature Flags', () => {
  beforeEach(() => {
    // Reset feature flags to default state
    Object.keys(featureFlags.flags).forEach(key => {
      const flag = featureFlags.flags[key];
      // Reset to default based on environment variable
      if (key === 'VOICE_ROOMS') {
        flag.enabled = process.env.FEATURE_VOICE_ROOMS !== 'false';
      } else if (key === 'GIFT_ANIMATIONS') {
        flag.enabled = process.env.FEATURE_GIFT_ANIMATIONS !== 'false';
      } else if (key === 'PUSH_NOTIFICATIONS') {
        flag.enabled = process.env.FEATURE_PUSH_NOTIFICATIONS !== 'false';
      } else if (key === 'ANALYTICS') {
        flag.enabled = process.env.FEATURE_ANALYTICS !== 'false';
      } else if (key === 'AI_MODERATION') {
        flag.enabled = process.env.FEATURE_AI_MODERATION === 'true';
      } else if (key === 'ADVANCED_SEARCH') {
        flag.enabled = process.env.FEATURE_ADVANCED_SEARCH === 'true';
      } else {
        // Core features should be enabled
        flag.enabled = true;
      }
    });
  });

  test('should have core features enabled by default', () => {
    expect(featureFlags.isEnabled('AUTHENTICATION')).toBe(true);
    expect(featureFlags.isEnabled('STREAMING')).toBe(true);
    expect(featureFlags.isEnabled('PAYMENTS')).toBe(true);
  });

  test('should enable and disable features', () => {
    featureFlags.enable('VOICE_ROOMS');
    expect(featureFlags.isEnabled('VOICE_ROOMS')).toBe(true);
    
    featureFlags.disable('VOICE_ROOMS');
    expect(featureFlags.isEnabled('VOICE_ROOMS')).toBe(false);
  });

  test('should return null for unknown feature', () => {
    expect(featureFlags.getFeature('UNKNOWN_FEATURE')).toBeNull();
  });

  test('should get all features', () => {
    const allFeatures = featureFlags.getAllFeatures();
    
    expect(allFeatures).toHaveProperty('AUTHENTICATION');
    expect(allFeatures).toHaveProperty('STREAMING');
    expect(allFeatures).toHaveProperty('PAYMENTS');
    expect(allFeatures.AUTHENTICATION).toHaveProperty('enabled');
    expect(allFeatures.AUTHENTICATION).toHaveProperty('description');
  });

  test('should execute function if feature is enabled', async () => {
    featureFlags.enable('VOICE_ROOMS');
    
    const mockFn = jest.fn().mockResolvedValue('success');
    const mockFallback = jest.fn().mockResolvedValue('fallback');
    
    const result = await featureFlags.executeIfEnabled('VOICE_ROOMS', mockFn, mockFallback);
    
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalled();
    expect(mockFallback).not.toHaveBeenCalled();
  });

  test('should execute fallback if feature is disabled', async () => {
    featureFlags.disable('VOICE_ROOMS');
    
    const mockFn = jest.fn().mockResolvedValue('success');
    const mockFallback = jest.fn().mockResolvedValue('fallback');
    
    const result = await featureFlags.executeIfEnabled('VOICE_ROOMS', mockFn, mockFallback);
    
    expect(result).toBe('fallback');
    expect(mockFn).not.toHaveBeenCalled();
    expect(mockFallback).toHaveBeenCalled();
  });

  test('should throw error if feature disabled and no fallback', async () => {
    featureFlags.disable('VOICE_ROOMS');
    
    const mockFn = jest.fn().mockResolvedValue('success');
    
    await expect(featureFlags.executeIfEnabled('VOICE_ROOMS', mockFn))
      .rejects.toThrow('Feature VOICE_ROOMS is disabled');
    
    expect(mockFn).not.toHaveBeenCalled();
  });

  test('should use fallback on function failure', async () => {
    featureFlags.enable('VOICE_ROOMS');
    
    const mockFn = jest.fn().mockRejectedValue(new Error('Function failed'));
    const mockFallback = jest.fn().mockResolvedValue('fallback');
    
    const result = await featureFlags.executeIfEnabled('VOICE_ROOMS', mockFn, mockFallback);
    
    expect(result).toBe('fallback');
    expect(mockFn).toHaveBeenCalled();
    expect(mockFallback).toHaveBeenCalled();
  });

  test('should wrap function with feature flag check', async () => {
    featureFlags.enable('VOICE_ROOMS');
    
    const originalFn = jest.fn().mockResolvedValue('success');
    const wrappedFn = featureFlags.wrap('VOICE_ROOMS', originalFn);
    
    const result = await wrappedFn('arg1', 'arg2');
    
    expect(result).toBe('success');
    expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  test('should get health status', () => {
    const healthStatus = featureFlags.getHealthStatus();
    
    expect(healthStatus).toHaveProperty('healthy');
    expect(healthStatus).toHaveProperty('environment');
    expect(healthStatus).toHaveProperty('totalFeatures');
    expect(healthStatus).toHaveProperty('enabledFeatures');
    expect(healthStatus).toHaveProperty('disabledFeatures');
    expect(healthStatus).toHaveProperty('criticalFeaturesEnabled');
    
    expect(healthStatus.criticalFeaturesEnabled).toBe(true);
  });

  test('should report unhealthy if critical features disabled', () => {
    // Disable a critical feature
    featureFlags.disable('AUTHENTICATION');
    
    const healthStatus = featureFlags.getHealthStatus();
    
    expect(healthStatus.criticalFeaturesEnabled).toBe(false);
    
    // Re-enable for other tests
    featureFlags.enable('AUTHENTICATION');
  });
});