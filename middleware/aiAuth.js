// AI Authentication middleware for Neo Card™ Demo Backend

const db = require('../database');
const { validateAiRequest } = require('../utils/aiHelpers');

/**
 * Middleware to authenticate AI requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function authenticateAiRequest(req, res, next) {
  try {
    // Check for API key in headers
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({
        status: 'error',
        message: 'API key required for AI endpoints',
        timestamp: new Date().toISOString(),
        error: {
          code: 'MISSING_API_KEY',
          message: 'x-api-key header is required'
        }
      });
    }
    
    // Validate API key
    const keyData = await db.validateApiKey(apiKey);
    
    if (!keyData) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid API key',
        timestamp: new Date().toISOString(),
        error: {
          code: 'INVALID_API_KEY',
          message: 'The provided API key is invalid or inactive'
        }
      });
    }
    
    // Check if API key has AI permissions
    if (!keyData.permissions || !keyData.permissions.includes('admin')) {
      return res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions for AI endpoints',
        timestamp: new Date().toISOString(),
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin permissions required for AI endpoints'
        }
      });
    }
    
    // Add API key info to request
    req.apiKey = keyData;
    next();
    
  } catch (error) {
    console.error('AI authentication error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Authentication error',
      timestamp: new Date().toISOString(),
      error: {
        code: 'AUTH_ERROR',
        message: 'Internal authentication error'
      }
    });
  }
}

/**
 * Middleware to validate AI request data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function validateAiRequestData(req, res, next) {
  try {
    // Validate request body
    const validation = validateAiRequest(req.body);
    
    if (!validation.isValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request data',
        timestamp: new Date().toISOString(),
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: validation.errors
        }
      });
    }
    
    // Add validated data to request
    req.validatedData = req.body;
    next();
    
  } catch (error) {
    console.error('AI request validation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Request validation error',
      timestamp: new Date().toISOString(),
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Internal validation error'
      }
    });
  }
}

/**
 * Middleware to check AI mode and provider availability
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function checkAiMode(req, res, next) {
  try {
    const config = require('../config/ai');
    
    // Check if AI mode is properly configured
    if (!config.mode || !['mock', 'live'].includes(config.mode)) {
      return res.status(500).json({
        status: 'error',
        message: 'AI mode not properly configured',
        timestamp: new Date().toISOString(),
        error: {
          code: 'AI_MODE_ERROR',
          message: 'AI mode must be either "mock" or "live"'
        }
      });
    }
    
    // For live mode, check if provider is configured
    if (config.mode === 'live') {
      if (!config.provider.apiKey || !config.provider.url) {
        return res.status(500).json({
          status: 'error',
          message: 'AI provider not properly configured for live mode',
          timestamp: new Date().toISOString(),
          error: {
            code: 'AI_PROVIDER_ERROR',
            message: 'AI provider API key and URL must be configured for live mode'
          }
        });
      }
    }
    
    // Add AI mode info to request
    req.aiMode = config.mode;
    req.aiConfig = config;
    next();
    
  } catch (error) {
    console.error('AI mode check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'AI mode check error',
      timestamp: new Date().toISOString(),
      error: {
        code: 'AI_MODE_ERROR',
        message: 'Internal AI mode check error'
      }
    });
  }
}

/**
 * Middleware to log AI requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function logAiRequest(req, res, next) {
  try {
    // Log the AI request
    console.log(`[AI Request] ${req.method} ${req.path}`, {
      timestamp: new Date().toISOString(),
      tab_id: req.body?.tab_id,
      ai_mode: req.aiMode,
      api_key: req.apiKey?.key_name,
      ip: req.ip,
      user_agent: req.get('User-Agent')
    });
    
    next();
    
  } catch (error) {
    console.error('AI request logging error:', error);
    // Don't fail the request for logging errors
    next();
  }
}

/**
 * Middleware to handle AI request rate limiting
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function aiRateLimit(req, res, next) {
  try {
    // Simple rate limiting based on API key
    const apiKey = req.apiKey?.api_key;
    
    if (!apiKey) {
      return next();
    }
    
    // Check if we have rate limiting data for this API key
    // This is a simple implementation - in production, you'd use Redis or similar
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = 10; // 10 requests per minute per API key
    
    // For now, we'll just pass through - proper rate limiting would be implemented here
    // In a real implementation, you'd check against a rate limiting store
    
    next();
    
  } catch (error) {
    console.error('AI rate limiting error:', error);
    // Don't fail the request for rate limiting errors
    next();
  }
}

module.exports = {
  authenticateAiRequest,
  validateAiRequestData,
  checkAiMode,
  logAiRequest,
  aiRateLimit
};







