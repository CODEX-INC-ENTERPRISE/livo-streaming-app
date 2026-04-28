const streamMetricsService = require('../services/streamMetricsService');
const logger = require('../utils/logger');

class MetricsUpdateJob {
  constructor(intervalMinutes = 5) {
    this.intervalMinutes = intervalMinutes;
    this.intervalId = null;
  }

  /**
   * Start the periodic metrics update job
   */
  start() {
    if (this.intervalId) {
      logger.warn('Metrics update job is already running');
      return;
    }

    // Update metrics immediately on start
    this.updateMetrics();

    // Set up periodic updates
    this.intervalId = setInterval(() => {
      this.updateMetrics();
    }, this.intervalMinutes * 60 * 1000);

    logger.info('Metrics update job started', {
      intervalMinutes: this.intervalMinutes,
    });
  }

  /**
   * Stop the periodic metrics update job
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Metrics update job stopped');
    }
  }

  /**
   * Update stream metrics
   */
  async updateMetrics() {
    try {
      const metrics = await streamMetricsService.updateStreamMetrics();
      logger.debug('Periodic metrics update completed', metrics);
    } catch (error) {
      logger.error('Failed to update metrics in periodic job', {
        error: error.message,
      });
    }
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      running: this.intervalId !== null,
      intervalMinutes: this.intervalMinutes,
    };
  }
}

module.exports = new MetricsUpdateJob();