// Utility functions for Neo Card™ Demo Backend

const crypto = require('crypto');
const moment = require('moment');

/**
 * Generate AEI checksum using HMAC-SHA256
 * @param {string} uid - Card UID
 * @param {string} timestamp - Scan timestamp
 * @param {string} campaignId - Campaign ID
 * @param {string} secretKey - Secret key for HMAC
 * @returns {string} - AEI checksum hash
 */
const generateAEIChecksum = (uid, timestamp, campaignId, secretKey) => {
  const data = `${uid}${timestamp}${campaignId}`;
  return crypto.createHmac('sha256', secretKey).update(data).digest('hex');
};

/**
 * Verify AEI checksum
 * @param {string} uid - Card UID
 * @param {string} timestamp - Scan timestamp
 * @param {string} campaignId - Campaign ID
 * @param {string} providedChecksum - Checksum to verify
 * @param {string} secretKey - Secret key for HMAC
 * @returns {boolean} - Whether checksum is valid
 */
const verifyAEIChecksum = (uid, timestamp, campaignId, providedChecksum, secretKey) => {
  const expectedChecksum = generateAEIChecksum(uid, timestamp, campaignId, secretKey);
  return crypto.timingSafeEqual(
    Buffer.from(expectedChecksum, 'hex'),
    Buffer.from(providedChecksum, 'hex')
  );
};

/**
 * Generate API key
 * @param {string} prefix - Key prefix
 * @returns {string} - Generated API key
 */
const generateApiKey = (prefix = 'neocard') => {
  const randomBytes = crypto.randomBytes(16).toString('hex');
  return `${prefix}_${randomBytes}`;
};

/**
 * Validate UID format
 * @param {string} uid - UID to validate
 * @returns {boolean} - Whether UID is valid
 */
const isValidUID = (uid) => {
  // Basic UID validation - alphanumeric, 8-16 characters
  const uidRegex = /^[A-Za-z0-9]{8,16}$/;
  return uidRegex.test(uid);
};

/**
 * Check if scan is within cooldown period
 * @param {string} lastScanTime - Last scan timestamp
 * @param {number} cooldownMinutes - Cooldown period in minutes
 * @returns {boolean} - Whether scan is within cooldown
 */
const isWithinCooldown = (lastScanTime, cooldownMinutes) => {
  if (!lastScanTime) return false;
  
  const lastScan = moment(lastScanTime);
  const now = moment();
  const diffMinutes = now.diff(lastScan, 'minutes');
  
  return diffMinutes < cooldownMinutes;
};

/**
 * Format response data
 * @param {boolean} success - Success status
 * @param {string} message - Response message
 * @param {object} data - Response data
 * @param {object} meta - Additional metadata
 * @returns {object} - Formatted response
 */
const formatResponse = (success, message, data = null, meta = null) => {
  const response = {
    status: success ? 'success' : 'error',
    message,
    timestamp: new Date().toISOString()
  };
  
  if (data !== null) response.data = data;
  if (meta !== null) response.meta = meta;
  
  return response;
};

/**
 * Generate unique scan ID
 * @returns {string} - Unique scan ID
 */
const generateScanId = () => {
  return `scan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
};

module.exports = {
  generateAEIChecksum,
  verifyAEIChecksum,
  generateApiKey,
  isValidUID,
  isWithinCooldown,
  formatResponse,
  generateScanId
};
