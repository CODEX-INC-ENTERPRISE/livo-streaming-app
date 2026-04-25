const jwt = require('jsonwebtoken');
const { getFirebaseAuth } = require('../config/firebase');
const config = require('../config');
const logger = require('../utils/logger');

class AuthenticationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}

class AuthorizationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
  }
}

const verifyFirebaseToken = async (token) => {
  try {
    const firebaseAuth = getFirebaseAuth();
    if (!firebaseAuth) {
      throw new Error('Firebase not configured');
    }
    
    const decodedToken = await firebaseAuth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    logger.error('Firebase token verification failed', {
      error: error.message,
    });
    throw new AuthenticationError('Invalid Firebase token');
  }
};

const verifyJWT = (token) => {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    return decoded;
  } catch (error) {
    logger.error('JWT verification failed', {
      error: error.message,
    });
    throw new AuthenticationError('Invalid or expired token');
  }
};

const generateJWT = (payload) => {
  try {
    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiration,
    });
    return token;
  } catch (error) {
    logger.error('JWT generation failed', {
      error: error.message,
    });
    throw error;
  }
};

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No authentication token provided');
    }
    
    const token = authHeader.split(' ')[1];
    
    const decoded = verifyJWT(token);
    
    req.userId = decoded.userId;
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: 'AUTH_ERROR',
      });
    }
    
    logger.error('Authentication middleware error', {
      error: error.message,
      stack: error.stack,
    });
    
    return res.status(401).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
    });
  }
};

const requireHost = async (req, res, next) => {
  try {
    if (!req.user || !req.user.isHost) {
      throw new AuthorizationError('Host permissions required');
    }
    
    next();
  } catch (error) {
    return res.status(error.statusCode || 403).json({
      error: error.message,
      code: 'AUTHORIZATION_ERROR',
    });
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      throw new AuthorizationError('Admin permissions required');
    }
    
    next();
  } catch (error) {
    return res.status(error.statusCode || 403).json({
      error: error.message,
      code: 'AUTHORIZATION_ERROR',
    });
  }
};

module.exports = {
  authenticate,
  requireHost,
  requireAdmin,
  verifyFirebaseToken,
  verifyJWT,
  generateJWT,
  AuthenticationError,
  AuthorizationError,
};
