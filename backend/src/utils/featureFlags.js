/**
 * Feature Flags Utility
 * Enables graceful degradation by toggling features on/off
 */

const logger = require('./logger');

/**
 * Feature flags configuration
 * Each feature can be enabled/disabled globally or per environment
 */
const FEATURE_FLAGS = {
  // Core features (always enabled in production)
  AUTHENTICATION: {
    enabled: true,
    description: 'User authentication and registration',
    environments: ['development', 'staging', 'production']
  },
  STREAMING: {
    enabled: true,
    description: 'Live video streaming',
    environments: ['development', 'staging', 'production']
  },
  PAYMENTS: {
    enabled: true,
    description: 'Payment processing and wallet management',
    environments: ['development', 'staging', 'production']
  },
  
  // Optional features (can be disabled for graceful degradation)
  VOICE_ROOMS: {
    enabled: process.env.FEATURE_VOICE_ROOMS !== 'false',
    description: 'Voice room functionality',
    environments: ['development', 'staging', 'production'],
    fallback: 'Use text chat instead'
  },
  GIFT_ANIMATIONS: {
    enabled: process.env.FEATURE_GIFT_ANIMATIONS !== 'false',
    description: 'Animated gift effects',
    environments: ['development', 'staging', 'production'],
    fallback: 'Show simple gift notifications'
  },
  PUSH_NOTIFICATIONS: {
    enabled: process.env.FEATURE_PUSH_NOTIFICATIONS !== 'false',
    description: 'Push notifications via FCM',
    environments: ['development', 'staging', 'production'],
    fallback: 'Use in-app notifications only'
  },
  ANALYTICS: {
    enabled: process.env.FEATURE_ANALYTICS !== 'false',
    description: 'Analytics and metrics collection',
    environments: ['development', 'staging', 'production'],
    fallback: 'Basic metrics only'
  },
  
  // Experimental features (disabled by default)
  AI_MODERATION: {
    enabled: process.env.FEATURE_AI_MODERATION === 'true',
    description: 'AI-powered content moderation',
    environments: ['development', 'staging'],
    fallback: 'Use keyword-based moderation'
  },
  ADVANCED_SEARCH: {
    enabled: process.env.FEATURE_ADVANCED_SEARCH === 'true',
    description: 'Advanced search with filters',
    environments: ['development'],
    fallback: 'Basic search functionality'
  }
};

/**
 * Feature Flags Manager
 */
class FeatureFlags {
  constructor() {
    this.flags = FEATURE_FLAGS;
    this.environment = process.env.NODE_ENV || 'development';
    this.initializeFlags();
  }
  
  /**
   * Initialize feature flags based on environment
   */
  initializeFlags() {
    Object.keys(this.flags).forEach(key => {
      const flag = this.flags[key];
      
      // Check if feature is enabled for current environment
      if (!flag.environments.includes(this.environment)) {
        flag.enabled = false;
        logger.warn(`Feature ${key} disabled for environment: ${this.environment}`);
      }
      
      // Log feature status
      if (flag.enabled) {
        logger.debug(`Feature ${key} enabled`, {
          feature: key,
          description: flag.description,
          environment: this.environment
        });
      } else {
        logger.info(`Feature ${key} disabled`, {
          feature: key,
          description: flag.description,
          environment: this.environment,
          fallback: flag.fallback
        });
      }
    });
  }
  
  /**
   * Check if a feature is enabled
   * @param {string} featureName - Feature name
   * @returns {boolean} - Whether feature is enabled
   */
  isEnabled(featureName) {
    const flag = this.flags[featureName];
    if (!flag) {
      logger.warn(`Unknown feature flag: ${featureName}`);
      return false;
    }
    return flag.enabled;
  }
  
  /**
   * Enable a feature
   * @param {string} featureName - Feature name
   */
  enable(featureName) {
    const flag = this.flags[featureName];
    if (flag) {
      flag.enabled = true;
      logger.info(`Feature ${featureName} enabled`);
    } else {
      logger.warn(`Cannot enable unknown feature: ${featureName}`);
    }
  }
  
  /**
   * Disable a feature
   * @param {string} featureName - Feature name
   */
  disable(featureName) {
    const flag = this.flags[featureName];
    if (flag) {
      flag.enabled = false;
      logger.info(`Feature ${featureName} disabled`);
    } else {
      logger.warn(`Cannot disable unknown feature: ${featureName}`);
    }
  }
  
  /**
   * Get feature information
   * @param {string} featureName - Feature name
   * @returns {Object|null} - Feature information
   */
  getFeature(featureName) {
    return this.flags[featureName] || null;
  }
  
  /**
   * Get all features with their status
   * @returns {Object} - All features and their status
   */
  getAllFeatures() {
    const result = {};
    Object.keys(this.flags).forEach(key => {
      result[key] = {
        enabled: this.flags[key].enabled,
        description: this.flags[key].description,
        environment: this.environment
      };
    });
    return result;
  }
  
  /**
   * Execute function only if feature is enabled
   * @param {string} featureName - Feature name
   * @param {Function} fn - Function to execute
   * @param {Function} fallbackFn - Fallback function (optional)
   * @returns {Promise<any>} - Result from function or fallback
   */
  async executeIfEnabled(featureName, fn, fallbackFn) {
    if (this.isEnabled(featureName)) {
      try {
        return await fn();
      } catch (error) {
        logger.error(`Feature ${featureName} execution failed`, {
          error: error.message,
          feature: featureName
        });
        
        // If fallback provided, use it
        if (fallbackFn) {
          logger.info(`Using fallback for feature ${featureName}`);
          return await fallbackFn();
        }
        throw error;
      }
    } else if (fallbackFn) {
      // Feature disabled, use fallback
      logger.debug(`Feature ${featureName} disabled, using fallback`);
      return await fallbackFn();
    } else {
      // Feature disabled and no fallback
      const flag = this.flags[featureName];
      throw new Error(`Feature ${featureName} is disabled. ${flag?.fallback || 'No fallback available.'}`);
    }
  }
  
  /**
   * Wrap a function with feature flag check
   * @param {string} featureName - Feature name
   * @param {Function} fn - Function to wrap
   * @param {Function} fallbackFn - Fallback function (optional)
   * @returns {Function} - Wrapped function
   */
  wrap(featureName, fn, fallbackFn) {
    return async (...args) => {
      return this.executeIfEnabled(
        featureName,
        () => fn(...args),
        fallbackFn ? () => fallbackFn(...args) : undefined
      );
    };
  }
  
  /**
   * Health check for feature flags
   * @returns {Object} - Health status
   */
  getHealthStatus() {
    const enabledFeatures = Object.keys(this.flags).filter(key => this.flags[key].enabled);
    const disabledFeatures = Object.keys(this.flags).filter(key => !this.flags[key].enabled);
    
    return {
      healthy: true,
      environment: this.environment,
      totalFeatures: Object.keys(this.flags).length,
      enabledFeatures: enabledFeatures.length,
      disabledFeatures: disabledFeatures.length,
      criticalFeaturesEnabled: ['AUTHENTICATION', 'STREAMING', 'PAYMENTS'].every(f => this.isEnabled(f))
    };
  }
}

// Create singleton instance
const featureFlags = new FeatureFlags();

module.exports = featureFlags;