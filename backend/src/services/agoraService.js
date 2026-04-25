const { RtcTokenBuilder, RtcRole } = require('agora-token');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Agora Service for generating tokens and managing streaming resources
 */
class AgoraService {
  constructor() {
    this.appId = config.agora.appId;
    this.appCertificate = config.agora.appCertificate;
    this.tokenExpirationInSeconds = 3600; // 1 hour
  }

  /**
   * Generate Agora RTC token for host (broadcaster)
   * @param {string} channelName - Channel name
   * @param {number} uid - User ID (0 for auto-assignment)
   * @returns {string} - Agora token
   */
  generateHostToken(channelName, uid = 0) {
    if (!this.appId || !this.appCertificate) {
      throw new Error('Agora credentials not configured');
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + this.tokenExpirationInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      this.appId,
      this.appCertificate,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      privilegeExpiredTs
    );

    logger.info('Generated host token', { channelName, uid });
    return token;
  }

  /**
   * Generate Agora RTC token for viewer (audience)
   * @param {string} channelName - Channel name
   * @param {number} uid - User ID (0 for auto-assignment)
   * @returns {string} - Agora token
   */
  generateViewerToken(channelName, uid = 0) {
    if (!this.appId || !this.appCertificate) {
      throw new Error('Agora credentials not configured');
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + this.tokenExpirationInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      this.appId,
      this.appCertificate,
      channelName,
      uid,
      RtcRole.SUBSCRIBER,
      privilegeExpiredTs
    );

    logger.info('Generated viewer token', { channelName, uid });
    return token;
  }

  /**
   * Generate unique channel ID for a stream
   * @param {string} hostId - Host user ID
   * @returns {string} - Channel ID
   */
  generateChannelId(hostId) {
    const timestamp = Date.now();
    return `stream_${hostId}_${timestamp}`;
  }
}

module.exports = new AgoraService();
