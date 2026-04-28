const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { requestTrackingMiddleware, metricsEndpointMiddleware } = require('./middleware/metricsMiddleware');
const logger = require('./utils/logger');

const app = express();

app.use(helmet());

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request tracking middleware for metrics and logging
app.use(requestTrackingMiddleware);

// Metrics endpoint for Prometheus
app.get('/metrics', metricsEndpointMiddleware);

const { getApiRateLimiter } = require('./middleware/rateLimit');
const apiRateLimiter = getApiRateLimiter();
app.use(apiRateLimiter);

app.use('/', routes);

app.use(notFoundHandler);

app.use(errorHandler);

module.exports = app;
