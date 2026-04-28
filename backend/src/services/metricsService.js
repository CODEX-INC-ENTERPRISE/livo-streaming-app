const promClient = require('prom-client');
const logger = require('../utils/logger');

class MetricsService {
  constructor() {
    this.register = new promClient.Registry();
    promClient.collectDefaultMetrics({ register: this.register });

    // API request metrics
    this.apiRequestDuration = new promClient.Histogram({
      name: 'api_request_duration_seconds',
      help: 'API request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
    });

    // Active streams gauge
    this.activeStreams = new promClient.Gauge({
      name: 'active_streams_total',
      help: 'Number of active streams',
    });

    // Concurrent viewers gauge
    this.concurrentViewers = new promClient.Gauge({
      name: 'concurrent_viewers_total',
      help: 'Total concurrent viewers across all streams',
    });

    // API request count
    this.apiRequestsTotal = new promClient.Counter({
      name: 'api_requests_total',
      help: 'Total number of API requests',
      labelNames: ['method', 'route', 'status'],
    });

    // Error count
    this.apiErrorsTotal = new promClient.Counter({
      name: 'api_errors_total',
      help: 'Total number of API errors',
      labelNames: ['method', 'route', 'status'],
    });

    // Register all metrics
    this.register.registerMetric(this.apiRequestDuration);
    this.register.registerMetric(this.activeStreams);
    this.register.registerMetric(this.concurrentViewers);
    this.register.registerMetric(this.apiRequestsTotal);
    this.register.registerMetric(this.apiErrorsTotal);
  }

  /**
   * Track API request duration
   */
  trackRequestDuration(method, route, status, duration) {
    this.apiRequestDuration.observe(
      { method, route, status },
      duration
    );
  }

  /**
   * Increment API request counter
   */
  incrementRequestCounter(method, route, status) {
    this.apiRequestsTotal.inc({ method, route, status });
  }

  /**
   * Increment error counter
   */
  incrementErrorCounter(method, route, status) {
    this.apiErrorsTotal.inc({ method, route, status });
  }

  /**
   * Update active streams count
   */
  setActiveStreams(count) {
    this.activeStreams.set(count);
  }

  /**
   * Update concurrent viewers count
   */
  setConcurrentViewers(count) {
    this.concurrentViewers.set(count);
  }

  /**
   * Get metrics as string for Prometheus scraping
   */
  async getMetrics() {
    return await this.register.metrics();
  }

  /**
   * Get metrics registry
   */
  getRegistry() {
    return this.register;
  }
}

module.exports = new MetricsService();