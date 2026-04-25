# Social Live Streaming Backend

Backend service for the social live streaming application built with Node.js and Express.js.

## Features

- Express.js REST API framework
- MongoDB with connection pooling (min: 10, max: 100)
- Redis for caching and session management
- Winston structured logging (JSON format)
- Global error handling middleware
- Environment variable configuration with validation
- Health check endpoint at `/health`

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration and database connections
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Express middleware
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   ├── app.js           # Express application
│   └── server.js        # Server entry point
├── logs/                # Application logs
├── .env.example         # Environment variables template
└── package.json
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
   - MongoDB connection string
   - Redis connection details
   - API keys and service endpoints

4. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## Environment Variables

### Required
- `MONGODB_URI` - MongoDB connection string
- `REDIS_HOST` - Redis server host

### Optional
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `MONGODB_MIN_POOL_SIZE` - Min DB connections (default: 10)
- `MONGODB_MAX_POOL_SIZE` - Max DB connections (default: 100)
- `REDIS_PORT` - Redis port (default: 6379)
- `REDIS_PASSWORD` - Redis password

## API Endpoints

### Health Check
- `GET /health` - System health status

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "checks": {
    "database": {
      "status": "up",
      "state": "connected"
    },
    "redis": {
      "status": "up",
      "connected": true
    }
  }
}
```

## Logging

Logs are written in JSON format to:
- `logs/error.log` - Error level logs
- `logs/combined.log` - All logs

Log structure:
```json
{
  "timestamp": "2024-01-01 00:00:00",
  "level": "info",
  "message": "Log message",
  "context": {}
}
```

## Error Handling

Global error handler provides consistent error responses:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Development

```bash
# Run with auto-reload
npm run dev

# Lint code
npm run lint

# Format code
npm run format
```
