// AI Routes for Neo Card™ Demo Backend

const express = require('express');
const router = express.Router();
const db = require('../database');
const config = require('../config/ai');
const {
  generateAiRequestId,
  generateAiChecksum,
  getMockAiResponse,
  simulateAiProcessingDelay,
  formatAiResponse,
  formatAiError,
  getTabSpecialFeatures,
  generatePrintReadyData,
  generateProofData
} = require('../utils/aiHelpers');
const {
  authenticateAiRequest,
  validateAiRequestData,
  checkAiMode,
  logAiRequest,
  aiRateLimit
} = require('../middleware/aiAuth');

/**
 * POST /ai/analyze - Main AI analysis endpoint
 * Analyzes data for any of the 13 dashboard tabs
 */
router.post('/analyze', 
  authenticateAiRequest,
  validateAiRequestData,
  checkAiMode,
  logAiRequest,
  aiRateLimit,
  async (req, res) => {
    try {
      const startTime = Date.now();
      const { tab_id, request_data } = req.validatedData;
      const requestId = generateAiRequestId();
      const timestamp = new Date().toISOString();
      
      // Get tab information
      const tab = await db.getAiTab(tab_id);
      if (!tab) {
        return res.status(400).json(formatAiError(
          `Invalid tab ID: ${tab_id}`,
          'INVALID_TAB_ID'
        ));
      }
      
      // Get config tab for response type
      const configTab = config.tabs[tab_id];
      if (!configTab) {
        return res.status(400).json(formatAiError(
          `Tab configuration not found: ${tab_id}`,
          'TAB_CONFIG_NOT_FOUND'
        ));
      }
      
      console.log('Debug - Tab ID:', tab_id);
      console.log('Debug - Config Tab:', configTab);
      console.log('Debug - Response Type:', configTab.responseType);
      
      // Log AI request to database
      await db.insertAiRequest({
        request_id: requestId,
        tab_id: tab_id,
        request_data: JSON.stringify(request_data),
        ai_mode: req.aiMode,
        status: 'processing',
        processed_at: timestamp
      });
      
      let responseData;
      let processingTime;
      
      if (req.aiMode === 'mock') {
        // Mock mode - use pre-configured responses
        console.log('Debug - Tab ID:', tab_id);
        console.log('Debug - Config Tab:', config.tabs[tab_id]);
        console.log('Debug - Response Type:', config.tabs[tab_id]?.responseType);
        responseData = getMockAiResponse(tab_id, request_data, config.tabs[tab_id]);
        
        // Simulate processing delay
        await simulateAiProcessingDelay(100, 500);
        processingTime = Date.now() - startTime;
        
      } else {
        // Live mode - call actual AI provider
        // This would be implemented with actual AI provider integration
        responseData = getMockAiResponse(tab_id, request_data); // Fallback to mock for now
        processingTime = Date.now() - startTime;
      }
      
      // Generate AEI checksum
      const aeiProof = generateAiChecksum(requestId, tab_id, JSON.stringify(request_data), timestamp);
      
      // Log AI response to database
      await db.insertAiResponse({
        request_id: requestId,
        tab_id: tab_id,
        response_data: JSON.stringify(responseData),
        confidence_score: responseData.confidence,
        risk_level: responseData.risk_level,
        processing_time_ms: processingTime
      });
      
      // Log AEI proof
      await db.insertAiProofLog({
        request_id: requestId,
        tab_id: tab_id,
        aei_checksum: aeiProof,
        proof_type: 'ai_analysis',
        verification_status: true,
        print_triggered: false,
        proof_generated: false
      });
      
      // Update request status
      await db.updateAiRequestStatus(requestId, 'completed', timestamp);
      
      // Format response
      const formattedResponse = formatAiResponse(responseData, requestId, tab_id, processingTime, aeiProof);
      
      res.json(formattedResponse);
      
    } catch (error) {
      console.error('AI analysis error:', error);
      
      // Update request status to failed
      if (req.validatedData?.tab_id) {
        try {
          const requestId = generateAiRequestId();
          await db.updateAiRequestStatus(requestId, 'failed', new Date().toISOString());
        } catch (dbError) {
          console.error('Failed to update request status:', dbError);
        }
      }
      
      res.status(500).json(formatAiError(
        'AI analysis failed',
        'AI_ANALYSIS_ERROR',
        { error: error.message }
      ));
    }
  }
);

/**
 * GET /ai/tabs - Get all available AI tabs
 */
router.get('/tabs',
  authenticateAiRequest,
  async (req, res) => {
    try {
      const tabs = await db.getAllAiTabs();
      
      res.json({
        status: 'success',
        message: 'AI tabs retrieved successfully',
        timestamp: new Date().toISOString(),
        data: {
          tabs: tabs.map(tab => ({
            id: tab.id,
            name: tab.name,
            description: tab.description,
            response_type: tab.response_type,
            requires_aei: Boolean(tab.requires_aei),
            has_print_trigger: Boolean(tab.has_print_trigger),
            has_proof_trigger: Boolean(tab.has_proof_trigger)
          })),
          total: tabs.length
        }
      });
      
    } catch (error) {
      console.error('Get AI tabs error:', error);
      res.status(500).json(formatAiError(
        'Failed to retrieve AI tabs',
        'GET_TABS_ERROR',
        { error: error.message }
      ));
    }
  }
);

/**
 * GET /ai/tabs/:id - Get specific AI tab information
 */
router.get('/tabs/:id',
  authenticateAiRequest,
  async (req, res) => {
    try {
      const tabId = parseInt(req.params.id);
      
      if (isNaN(tabId) || tabId < 1 || tabId > 13) {
        return res.status(400).json(formatAiError(
          'Invalid tab ID',
          'INVALID_TAB_ID',
          { tab_id: tabId }
        ));
      }
      
      const tab = await db.getAiTab(tabId);
      
      if (!tab) {
        return res.status(404).json(formatAiError(
          'Tab not found',
          'TAB_NOT_FOUND',
          { tab_id: tabId }
        ));
      }
      
      res.json({
        status: 'success',
        message: 'AI tab retrieved successfully',
        timestamp: new Date().toISOString(),
        data: {
          id: tab.id,
          name: tab.name,
          description: tab.description,
          response_type: tab.response_type,
          requires_aei: Boolean(tab.requires_aei),
          has_print_trigger: Boolean(tab.has_print_trigger),
          has_proof_trigger: Boolean(tab.has_proof_trigger),
          special_features: getTabSpecialFeatures(tabId)
        }
      });
      
    } catch (error) {
      console.error('Get AI tab error:', error);
      res.status(500).json(formatAiError(
        'Failed to retrieve AI tab',
        'GET_TAB_ERROR',
        { error: error.message }
      ));
    }
  }
);

/**
 * POST /ai/tabs/:id/print - Trigger print functionality for Tab 9
 */
router.post('/tabs/:id/print',
  authenticateAiRequest,
  async (req, res) => {
    try {
      const tabId = parseInt(req.params.id);
      
      if (tabId !== 9) {
        return res.status(400).json(formatAiError(
          'Print functionality only available for Tab 9',
          'INVALID_TAB_FOR_PRINT',
          { tab_id: tabId }
        ));
      }
      
      const { request_id, response_data } = req.body;
      
      if (!request_id || !response_data) {
        return res.status(400).json(formatAiError(
          'request_id and response_data are required',
          'MISSING_PRINT_DATA'
        ));
      }
      
      // Generate print-ready data
      const printData = generatePrintReadyData(response_data, request_id);
      
      // Update proof log with print trigger
      await db.insertAiProofLog({
        request_id: request_id,
        tab_id: tabId,
        aei_checksum: response_data.aei_proof || 'print_triggered',
        proof_type: 'print_trigger',
        verification_status: true,
        print_triggered: true,
        proof_generated: false
      });
      
      res.json({
        status: 'success',
        message: 'Print data generated successfully',
        timestamp: new Date().toISOString(),
        data: printData
      });
      
    } catch (error) {
      console.error('Print trigger error:', error);
      res.status(500).json(formatAiError(
        'Print trigger failed',
        'PRINT_TRIGGER_ERROR',
        { error: error.message }
      ));
    }
  }
);

/**
 * POST /ai/tabs/:id/proof - Trigger proof generation for Tab 9
 */
router.post('/tabs/:id/proof',
  authenticateAiRequest,
  async (req, res) => {
    try {
      const tabId = parseInt(req.params.id);
      
      if (tabId !== 9) {
        return res.status(400).json(formatAiError(
          'Proof functionality only available for Tab 9',
          'INVALID_TAB_FOR_PROOF',
          { tab_id: tabId }
        ));
      }
      
      const { request_id, response_data } = req.body;
      
      if (!request_id || !response_data) {
        return res.status(400).json(formatAiError(
          'request_id and response_data are required',
          'MISSING_PROOF_DATA'
        ));
      }
      
      // Generate proof data
      const proofData = generateProofData(response_data, request_id);
      
      // Update proof log with proof generation
      await db.insertAiProofLog({
        request_id: request_id,
        tab_id: tabId,
        aei_checksum: response_data.aei_proof || 'proof_generated',
        proof_type: 'proof_generation',
        verification_status: true,
        print_triggered: false,
        proof_generated: true
      });
      
      res.json({
        status: 'success',
        message: 'Proof data generated successfully',
        timestamp: new Date().toISOString(),
        data: proofData
      });
      
    } catch (error) {
      console.error('Proof generation error:', error);
      res.status(500).json(formatAiError(
        'Proof generation failed',
        'PROOF_GENERATION_ERROR',
        { error: error.message }
      ));
    }
  }
);

/**
 * GET /ai/requests - Get AI requests with filtering
 */
router.get('/requests',
  authenticateAiRequest,
  async (req, res) => {
    try {
      const filters = {
        tab_id: req.query.tab_id ? parseInt(req.query.tab_id) : undefined,
        status: req.query.status,
        ai_mode: req.query.ai_mode,
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        limit: req.query.limit ? parseInt(req.query.limit) : 50
      };
      
      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });
      
      const requests = await db.getAiRequests(filters);
      
      res.json({
        status: 'success',
        message: 'AI requests retrieved successfully',
        timestamp: new Date().toISOString(),
        data: {
          requests: requests,
          total: requests.length,
          filters_applied: filters
        }
      });
      
    } catch (error) {
      console.error('Get AI requests error:', error);
      res.status(500).json(formatAiError(
        'Failed to retrieve AI requests',
        'GET_REQUESTS_ERROR',
        { error: error.message }
      ));
    }
  }
);

/**
 * GET /ai/health - AI service health check
 */
router.get('/health',
  async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        ai_mode: config.mode,
        tabs_available: Object.keys(config.tabs).length,
        provider_configured: config.mode === 'mock' || (config.provider.apiKey && config.provider.url)
      };
      
      res.json(health);
      
    } catch (error) {
      console.error('AI health check error:', error);
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }
);

module.exports = router;
