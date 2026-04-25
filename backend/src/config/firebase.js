const admin = require('firebase-admin');
const config = require('./index');
const logger = require('../utils/logger');

let firebaseApp = null;

const initializeFirebase = () => {
  try {
    if (firebaseApp) {
      return firebaseApp;
    }

    if (!config.firebase.projectId || !config.firebase.privateKey || !config.firebase.clientEmail) {
      logger.warn('Firebase credentials not configured, Firebase features will be disabled');
      return null;
    }

    const privateKey = config.firebase.privateKey.replace(/\\n/g, '\n');

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        privateKey: privateKey,
        clientEmail: config.firebase.clientEmail,
      }),
    });

    logger.info('Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

const getFirebaseAuth = () => {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return firebaseApp ? admin.auth() : null;
};

module.exports = {
  initializeFirebase,
  getFirebaseAuth,
};
