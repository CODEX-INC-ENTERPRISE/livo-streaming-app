const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Cache configuration with TTL values in seconds
 */
const CACHE_CONFIG = {
  USER_PROFILE: {
    keyPrefix: 'user:profile:',
    ttl: 300, // 5 minutes
  },
  STREAM_LIST: {
    keyPrefix: 'stream:list:',
    ttl: 10, // 10 seconds
  },
  VIRTUAL_GIFTS: {
    keyPrefix: 'gifts:',
    ttl: 3600, // 1 hour
  },
  WALLET_BALANCE: {
    keyPrefix: 'wallet:balance:',
    ttl: 60, // 1 minute
  },
};

/**
 * Cache service for Redis caching with TTL
 */
class CacheService {
  constructor() {
    this.redis = getRedisClient();
  }

  /**
   * Get cached data by key
   * @param {string} key - Cache key
   * @returns {Promise<any>} - Cached data or null
   */
  async get(key) {
    try {
      const data = await this.redis.get(key);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set cached data with TTL
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<void>}
   */
  async set(key, data, ttl) {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(data));
    } catch (error) {
      logger.error('Cache set error', { key, error: error.message });
    }
  }

  /**
   * Delete cached data
   * @param {string} key - Cache key
   * @returns {Promise<void>}
   */
  async delete(key) {
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error('Cache delete error', { key, error: error.message });
    }
  }

  /**
   * Get cached data or fetch and cache if not exists
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Function to fetch data if not cached
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<any>} - Cached or fetched data
   */
  async getCached(key, fetchFn, ttl) {
    try {
      const cached = await this.get(key);
      if (cached !== null) {
        return cached;
      }

      const data = await fetchFn();
      await this.set(key, data, ttl);
      return data;
    } catch (error) {
      logger.error('Cache getCached error', { key, error: error.message });
      // If cache fails, fall back to direct fetch
      return await fetchFn();
    }
  }

  /**
   * Invalidate cache by pattern
   * @param {string} pattern - Redis pattern to match keys
   * @returns {Promise<number>} - Number of keys deleted
   */
  async invalidateByPattern(pattern) {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(keys);
        logger.info('Cache invalidated', { pattern, count: keys.length });
        return keys.length;
      }
      return 0;
    } catch (error) {
      logger.error('Cache invalidateByPattern error', { pattern, error: error.message });
      return 0;
    }
  }

  /**
   * Get user profile from cache or fetch
   * @param {string} userId - User ID
   * @param {Function} fetchFn - Function to fetch user profile
   * @returns {Promise<any>} - User profile
   */
  async getUserProfile(userId, fetchFn) {
    const key = `${CACHE_CONFIG.USER_PROFILE.keyPrefix}${userId}`;
    return this.getCached(key, fetchFn, CACHE_CONFIG.USER_PROFILE.ttl);
  }

  /**
   * Invalidate user profile cache
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async invalidateUserProfile(userId) {
    const key = `${CACHE_CONFIG.USER_PROFILE.keyPrefix}${userId}`;
    await this.delete(key);
    logger.info('User profile cache invalidated', { userId });
  }

  /**
   * Get stream list from cache or fetch
   * @param {string} filterKey - Filter key (e.g., 'active', 'featured')
   * @param {Function} fetchFn - Function to fetch stream list
   * @returns {Promise<any>} - Stream list
   */
  async getStreamList(filterKey, fetchFn) {
    const key = `${CACHE_CONFIG.STREAM_LIST.keyPrefix}${filterKey}`;
    return this.getCached(key, fetchFn, CACHE_CONFIG.STREAM_LIST.ttl);
  }

  /**
   * Invalidate stream list cache
   * @param {string} filterKey - Filter key (e.g., 'active', 'featured')
   * @returns {Promise<void>}
   */
  async invalidateStreamList(filterKey) {
    const key = `${CACHE_CONFIG.STREAM_LIST.keyPrefix}${filterKey}`;
    await this.delete(key);
    logger.info('Stream list cache invalidated', { filterKey });
  }

  /**
   * Get virtual gifts from cache or fetch
   * @param {Function} fetchFn - Function to fetch virtual gifts
   * @returns {Promise<any>} - Virtual gifts list
   */
  async getVirtualGifts(fetchFn) {
    const key = CACHE_CONFIG.VIRTUAL_GIFTS.keyPrefix;
    return this.getCached(key, fetchFn, CACHE_CONFIG.VIRTUAL_GIFTS.ttl);
  }

  /**
   * Invalidate virtual gifts cache
   * @returns {Promise<void>}
   */
  async invalidateVirtualGifts() {
    const key = CACHE_CONFIG.VIRTUAL_GIFTS.keyPrefix;
    await this.delete(key);
    logger.info('Virtual gifts cache invalidated');
  }

  /**
   * Get wallet balance from cache or fetch
   * @param {string} userId - User ID
   * @param {Function} fetchFn - Function to fetch wallet balance
   * @returns {Promise<any>} - Wallet balance
   */
  async getWalletBalance(userId, fetchFn) {
    const key = `${CACHE_CONFIG.WALLET_BALANCE.keyPrefix}${userId}`;
    return this.getCached(key, fetchFn, CACHE_CONFIG.WALLET_BALANCE.ttl);
  }

  /**
   * Invalidate wallet balance cache
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async invalidateWalletBalance(userId) {
    const key = `${CACHE_CONFIG.WALLET_BALANCE.keyPrefix}${userId}`;
    await this.delete(key);
    logger.info('Wallet balance cache invalidated', { userId });
  }

  /**
   * Invalidate all cache for a user (e.g., on profile update)
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async invalidateAllUserCache(userId) {
    await Promise.all([
      this.invalidateUserProfile(userId),
      this.invalidateWalletBalance(userId),
    ]);
    logger.info('All user cache invalidated', { userId });
  }

  /**
   * Clear all cache (for testing/debugging)
   * @returns {Promise<number>} - Number of keys deleted
   */
  async clearAll() {
    try {
      const keys = await this.redis.keys('*');
      if (keys.length > 0) {
        await this.redis.del(keys);
        logger.info('All cache cleared', { count: keys.length });
        return keys.length;
      }
      return 0;
    } catch (error) {
      logger.error('Cache clearAll error', { error: error.message });
      return 0;
    }
  }
}

module.exports = new CacheService();