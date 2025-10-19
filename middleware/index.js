// Middleware for Neo Card™ Demo Backend

const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../database');

/**
 * API Key authentication middleware
 * Validates API key for admin endpoints
 */
const authenticateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey) {
    return res.status(401).json({
      status: 'error',
      message: 'API key required',
      code: 'MISSING_API_KEY'
    });
  }
  
  try {
    const keyData = await db.validateApiKey(apiKey);
    
    if (!keyData) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
    }
    
    req.apiKey = apiKey;
    req.apiKeyData = keyData;
    next();
  } catch (error) {
    console.error('API key validation error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'API key validation failed',
      code: 'VALIDATION_ERROR'
    });
  }
};

/**
 * Request validation middleware
 * Validates request body for required fields
 */
const validateScanRequest = (req, res, next) => {
  const { uid, campaign_id } = req.body;
  
  if (!uid) {
    return res.status(400).json({
      status: 'error',
      message: 'UID is required',
      code: 'MISSING_UID'
    });
  }
  
  if (!campaign_id) {
    return res.status(400).json({
      status: 'error',
      message: 'Campaign ID is required',
      code: 'MISSING_CAMPAIGN_ID'
    });
  }
  
  // Validate UID format
  const { isValidUID } = require('../utils');
  if (!isValidUID(uid)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid UID format',
      code: 'INVALID_UID_FORMAT'
    });
  }
  
  next();
};

/**
 * Anti-fraud middleware
 * Checks cooldown and daily limits
 */
const antiFraudCheck = async (req, res, next) => {
  const { uid } = req.body;
  
  try {
    const { antifraud } = config;
    
    // Get last scan time for this UID
    const lastScanTime = await db.getLastScanTime(uid);
    
    // Check cooldown
    if (lastScanTime) {
      const { isWithinCooldown } = require('../utils');
      if (isWithinCooldown(lastScanTime, antifraud.cooldownMinutes)) {
        return res.status(429).json({
          status: 'error',
          message: 'Scan blocked: within cooldown period',
          code: 'COOLDOWN_ACTIVE',
          cooldownMinutes: antifraud.cooldownMinutes,
          lastScanTime
        });
      }
    }
    
    // Check daily limit
    const today = new Date().toISOString().split('T')[0];
    const dailyScanCount = await db.getDailyScanCount(uid, today);
    
    if (dailyScanCount >= antifraud.dailyScanLimit) {
      return res.status(429).json({
        status: 'error',
        message: 'Daily scan limit exceeded',
        code: 'DAILY_LIMIT_EXCEEDED',
        dailyLimit: antifraud.dailyScanLimit,
        currentCount: dailyScanCount
      });
    }
    
    next();
  } catch (error) {
    console.error('Anti-fraud check error:', error);
    next(error);
  }
};

/**
 * Error logging middleware
 */
const errorLogger = (err, req, res, next) => {
  console.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString()
  });
  next(err);
};

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
};

module.exports = {
  authenticateApiKey,
  validateScanRequest,
  antiFraudCheck,
  errorLogger,
  requestLogger
};
