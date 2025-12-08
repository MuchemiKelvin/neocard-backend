// AI Helper utilities for Neo Card™ Demo Backend

const crypto = require('crypto');
const config = require('../config/ai');

/**
 * Generate a unique AI request ID
 * @returns {string} Unique request ID
 */
function generateAiRequestId() {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `ai_req_${timestamp}_${random}`;
}

/**
 * Generate AEI checksum for AI request
 * @param {string} requestId - AI request ID
 * @param {number} tabId - Tab ID
 * @param {string} requestData - Request data
 * @param {string} timestamp - Timestamp
 * @returns {string} AEI checksum
 */
function generateAiChecksum(requestId, tabId, requestData, timestamp) {
  const secretKey = process.env.AEI_SECRET_KEY || 'neocard-aei-hmac-secret-key-2024';
  const data = `${requestId}:${tabId}:${requestData}:${timestamp}`;
  return crypto.createHmac('sha256', secretKey).update(data).digest('hex');
}

/**
 * Validate AI request data
 * @param {Object} requestData - Request data to validate
 * @returns {Object} Validation result
 */
function validateAiRequest(requestData) {
  const errors = [];
  
  // Check required fields
  if (!requestData.tab_id) {
    errors.push('tab_id is required');
  } else if (!Number.isInteger(requestData.tab_id) || requestData.tab_id < 1 || requestData.tab_id > 13) {
    errors.push('tab_id must be an integer between 1 and 13');
  }
  
  if (!requestData.request_data) {
    errors.push('request_data is required');
  } else if (typeof requestData.request_data !== 'object') {
    errors.push('request_data must be an object');
  }
  
  // Check request size
  const requestSize = JSON.stringify(requestData).length;
  if (requestSize > config.validation.maxRequestSize) {
    errors.push(`request_data too large (${requestSize} bytes, max ${config.validation.maxRequestSize})`);
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Get AI response for specific tab (mock mode)
 * @param {number} tabId - Tab ID
 * @param {Object} requestData - Request data
 * @param {Object} configTab - Config tab object (optional)
 * @returns {Object} Mock AI response
 */
function getMockAiResponse(tabId, requestData, configTab = null) {
  // Use configTab if provided, otherwise get from config
  const tab = configTab || config.tabs[tabId];
  if (!tab) {
    throw new Error(`Invalid tab ID: ${tabId}`);
  }
  
  // Debug logging
  console.log('getMockAiResponse - Tab:', tab);
  console.log('getMockAiResponse - ResponseType:', tab.responseType);
  console.log('getMockAiResponse - Available responses:', Object.keys(config.mockResponses));
  
  const baseResponse = config.mockResponses[tab.responseType];
  if (!baseResponse) {
    throw new Error(`No mock response for response type: ${tab.responseType}`);
  }
  
  return {
    ...baseResponse,
    tab_id: tabId,
    tab_name: tab.name,
    response_type: tab.responseType,
    has_print_trigger: tab.has_print_trigger || false,
    has_proof_trigger: tab.has_proof_trigger || false,
    request_data: requestData
  };
}

/**
 * Simulate AI processing delay
 * @param {number} minMs - Minimum delay in milliseconds
 * @param {number} maxMs - Maximum delay in milliseconds
 * @returns {Promise} Promise that resolves after delay
 */
function simulateAiProcessingDelay(minMs = 100, maxMs = 1000) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Format AI response according to template
 * @param {Object} responseData - Response data
 * @param {string} requestId - Request ID
 * @param {number} tabId - Tab ID
 * @param {number} processingTime - Processing time in milliseconds
 * @param {string} aeiProof - AEI proof checksum
 * @returns {Object} Formatted response
 */
function formatAiResponse(responseData, requestId, tabId, processingTime, aeiProof) {
  const tab = config.tabs[tabId];
  const timestamp = new Date().toISOString();
  
  return {
    status: 'success',
    message: 'AI analysis completed successfully',
    timestamp: timestamp,
    data: {
      request_id: requestId,
      tab_id: tabId,
      tab_name: tab.name,
      analysis: responseData.analysis,
      confidence: responseData.confidence,
      recommendations: responseData.recommendations,
      risk_level: responseData.risk_level,
      aei_proof: aeiProof,
      print_ready: responseData.print_ready || false,
      proof_generated: responseData.proof_generated || false,
      response_type: tab.responseType,
      has_print_trigger: tab.has_print_trigger || false,
      has_proof_trigger: tab.has_proof_trigger || false
    },
    meta: {
      processing_time: processingTime,
      ai_mode: config.mode,
      tab_specific_features: {
        print_trigger: tab.has_print_trigger || false,
        proof_trigger: tab.has_proof_trigger || false
      }
    }
  };
}

/**
 * Format AI error response
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {Object} details - Error details
 * @returns {Object} Formatted error response
 */
function formatAiError(message, code = 'AI_ERROR', details = null) {
  return {
    status: 'error',
    message: message,
    timestamp: new Date().toISOString(),
    error: {
      code: code,
      message: message,
      details: details
    }
  };
}

/**
 * Check if tab has special features
 * @param {number} tabId - Tab ID
 * @returns {Object} Special features
 */
function getTabSpecialFeatures(tabId) {
  const tab = config.tabs[tabId];
  if (!tab) {
    return { has_print_trigger: false, has_proof_trigger: false };
  }
  
  return {
    has_print_trigger: tab.has_print_trigger || false,
    has_proof_trigger: tab.has_proof_trigger || false
  };
}

/**
 * Generate print-ready data for Tab 9
 * @param {Object} responseData - AI response data
 * @param {string} requestId - Request ID
 * @returns {Object} Print-ready data
 */
function generatePrintReadyData(responseData, requestId) {
  return {
    request_id: requestId,
    print_timestamp: new Date().toISOString(),
    print_data: {
      analysis: responseData.analysis,
      confidence: responseData.confidence,
      risk_level: responseData.risk_level,
      recommendations: responseData.recommendations,
      aei_proof: responseData.aei_proof
    },
    print_metadata: {
      generated_at: new Date().toISOString(),
      print_ready: true,
      format: 'sponsor_neocard_dashboard'
    }
  };
}

/**
 * Generate proof data for Tab 9
 * @param {Object} responseData - AI response data
 * @param {string} requestId - Request ID
 * @returns {Object} Proof data
 */
function generateProofData(responseData, requestId) {
  return {
    request_id: requestId,
    proof_timestamp: new Date().toISOString(),
    proof_data: {
      analysis: responseData.analysis,
      confidence: responseData.confidence,
      verification_status: true,
      aei_checksum: responseData.aei_proof
    },
    proof_metadata: {
      generated_at: new Date().toISOString(),
      proof_generated: true,
      verification_type: 'ai_analysis_proof'
    }
  };
}

module.exports = {
  generateAiRequestId,
  generateAiChecksum,
  validateAiRequest,
  getMockAiResponse,
  simulateAiProcessingDelay,
  formatAiResponse,
  formatAiError,
  getTabSpecialFeatures,
  generatePrintReadyData,
  generateProofData
};
