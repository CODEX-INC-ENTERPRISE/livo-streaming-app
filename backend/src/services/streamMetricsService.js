const metricsService = require('./metricsService');
const Stream = require('../models/Stream');
const logger = require('../utils/logger');

class StreamMetricsService {
  /**
   * Update active streams and concurrent viewers metrics
   */
  async updateStreamMetrics() {
    try {
      const activeStreams = await Stream.find({ status: 'active' });
      const activeStreamsCount = activeStreams.length;
      
      const totalConcurrentViewers = activeStreams.reduce(
        (sum, stream) => sum + stream.currentViewerIds.length,
        0
      );

      // Update metrics
      metricsService.setActiveStreams(activeStreamsCount);
      metricsService.setConcurrentViewers(totalConcurrentViewers);

      logger.debug('Stream metrics updated', {
        activeStreams: activeStreamsCount,
        concurrentViewers: totalConcurrentViewers,
      });

      return {
        activeStreams: activeStreamsCount,
        concurrentViewers: totalConcurrentViewers,
      };
    } catch (error) {
      logger.error('Failed to update stream metrics', { error: error.message });
      throw error;
    }
  }

  /**
   * Update metrics when a stream starts
   */
  async onStreamStart(streamId) {
    try {
      const metrics = await this.updateStreamMetrics();
      logger.info('Stream started - metrics updated', {
        streamId,
        ...metrics,
      });
      return metrics;
    } catch (error) {
      logger.error('Failed to update metrics on stream start', {
        streamId,
        error: error.message,
      });
    }
  }

  /**
   * Update metrics when a stream ends
   */
  async onStreamEnd(streamId) {
    try {
      const metrics = await this.updateStreamMetrics();
      logger.info('Stream ended - metrics updated', {
        streamId,
        ...metrics,
      });
      return metrics;
    } catch (error) {
      logger.error('Failed to update metrics on stream end', {
        streamId,
        error: error.message,
      });
    }
  }

  /**
   * Update metrics when a viewer joins a stream
   */
  async onViewerJoin(streamId) {
    try {
      const metrics = await this.updateStreamMetrics();
      logger.debug('Viewer joined - metrics updated', {
        streamId,
        ...metrics,
      });
      return metrics;
    } catch (error) {
      logger.error('Failed to update metrics on viewer join', {
        streamId,
        error: error.message,
      });
    }
  }

  /**
   * Update metrics when a viewer leaves a stream
   */
  async onViewerLeave(streamId) {
    try {
      const metrics = await this.updateStreamMetrics();
      logger.debug('Viewer left - metrics updated', {
        streamId,
        ...metrics,
      });
      return metrics;
    } catch (error) {
      logger.error('Failed to update metrics on viewer leave', {
        streamId,
        error: error.message,
      });
    }
  }

  /**
   * Get current stream metrics
   */
  async getCurrentMetrics() {
    return await this.updateStreamMetrics();
  }
}

module.exports = new StreamMetricsService();