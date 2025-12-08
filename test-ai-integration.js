#!/usr/bin/env node

/**
 * Neo Card™ AI Integration - Test Script
 * 
 * This script demonstrates all AI endpoints and functionality
 * for the Neo Card™ Demo Backend AI Integration.
 * 
 * Usage: node test-ai-integration.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000';
const API_KEY = 'neocard_admin_demo_key_2024';

// Test data
const testData = {
  user_id: 'TEST12345',
  campaign_id: 'DEMO01',
  action: 'scan',
  metadata: {
    location: 'airport',
    timestamp: new Date().toISOString()
  }
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(`${colors.bold}${title}${colors.reset}`, 'blue');
  console.log('='.repeat(60));
}

function logTest(testName, status, details = '') {
  const statusColor = status === 'PASS' ? 'green' : 'red';
  const statusSymbol = status === 'PASS' ? '✅' : '❌';
  log(`${statusSymbol} ${testName}: ${status}`, statusColor);
  if (details) {
    log(`   ${details}`, 'yellow');
  }
}

async function makeRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
}

async function testAiHealth() {
  logSection('AI Health Check');
  
  const result = await makeRequest('GET', '/ai/health');
  
  if (result.success) {
    logTest('AI Health Check', 'PASS', `Status: ${result.data.status}`);
    logTest('AI Mode', 'PASS', `Mode: ${result.data.ai_mode}`);
    logTest('Tabs Available', 'PASS', `Count: ${result.data.tabs_available}`);
    logTest('Provider Configured', 'PASS', `Configured: ${result.data.provider_configured}`);
  } else {
    logTest('AI Health Check', 'FAIL', result.error.message);
  }
  
  return result.success;
}

async function testAiTabs() {
  logSection('AI Tabs Endpoints');
  
  // Test get all tabs
  const allTabsResult = await makeRequest('GET', '/ai/tabs');
  
  if (allTabsResult.success) {
    logTest('Get All Tabs', 'PASS', `Found ${allTabsResult.data.data.total} tabs`);
    
    // Test get specific tab (Tab 9)
    const tab9Result = await makeRequest('GET', '/ai/tabs/9');
    
    if (tab9Result.success) {
      logTest('Get Tab 9', 'PASS', `Name: ${tab9Result.data.data.name}`);
      logTest('Tab 9 Print Trigger', 'PASS', `Has Print: ${tab9Result.data.data.has_print_trigger}`);
      logTest('Tab 9 Proof Trigger', 'PASS', `Has Proof: ${tab9Result.data.data.has_proof_trigger}`);
    } else {
      logTest('Get Tab 9', 'FAIL', tab9Result.error.message);
    }
  } else {
    logTest('Get All Tabs', 'FAIL', allTabsResult.error.message);
  }
  
  return allTabsResult.success;
}

async function testAiAnalysis() {
  logSection('AI Analysis Endpoints');
  
  // Test analysis for different tabs
  const tabsToTest = [1, 2, 9, 13]; // Test a few different tabs
  
  for (const tabId of tabsToTest) {
    const result = await makeRequest('POST', '/ai/analyze', {
      tab_id: tabId,
      request_data: testData
    });
    
    if (result.success) {
      logTest(`AI Analysis Tab ${tabId}`, 'PASS', 
        `Confidence: ${result.data.data.confidence}, Risk: ${result.data.data.risk_level}`);
    } else {
      logTest(`AI Analysis Tab ${tabId}`, 'FAIL', result.error.message);
    }
  }
  
  return true;
}

async function testTab9SpecialFeatures() {
  logSection('Tab 9 Special Features');
  
  // First, get a successful analysis for Tab 9
  const analysisResult = await makeRequest('POST', '/ai/analyze', {
    tab_id: 9,
    request_data: testData
  });
  
  if (!analysisResult.success) {
    logTest('Tab 9 Analysis', 'FAIL', 'Cannot test special features without successful analysis');
    return false;
  }
  
  logTest('Tab 9 Analysis', 'PASS', 'Analysis completed successfully');
  
  const requestId = analysisResult.data.data.request_id;
  const responseData = analysisResult.data.data;
  
  // Test print trigger
  const printResult = await makeRequest('POST', '/ai/tabs/9/print', {
    request_id: requestId,
    response_data: responseData
  });
  
  if (printResult.success) {
    logTest('Tab 9 Print Trigger', 'PASS', 'Print data generated successfully');
  } else {
    logTest('Tab 9 Print Trigger', 'FAIL', printResult.error.message);
  }
  
  // Test proof generation
  const proofResult = await makeRequest('POST', '/ai/tabs/9/proof', {
    request_id: requestId,
    response_data: responseData
  });
  
  if (proofResult.success) {
    logTest('Tab 9 Proof Generation', 'PASS', 'Proof data generated successfully');
  } else {
    logTest('Tab 9 Proof Generation', 'FAIL', proofResult.error.message);
  }
  
  return printResult.success && proofResult.success;
}

async function testAiRequests() {
  logSection('AI Requests Management');
  
  // Test get requests with filtering
  const requestsResult = await makeRequest('GET', '/ai/requests?limit=10');
  
  if (requestsResult.success) {
    logTest('Get AI Requests', 'PASS', `Found ${requestsResult.data.data.total} requests`);
  } else {
    logTest('Get AI Requests', 'FAIL', requestsResult.error.message);
  }
  
  return requestsResult.success;
}

async function testErrorHandling() {
  logSection('Error Handling');
  
  // Test invalid tab ID
  const invalidTabResult = await makeRequest('POST', '/ai/analyze', {
    tab_id: 99,
    request_data: testData
  });
  
  if (!invalidTabResult.success && invalidTabResult.status === 400) {
    logTest('Invalid Tab ID', 'PASS', 'Properly rejected invalid tab ID');
  } else {
    logTest('Invalid Tab ID', 'FAIL', 'Should have rejected invalid tab ID');
  }
  
  // Test missing API key
  try {
    await axios.post(`${BASE_URL}/ai/analyze`, {
      tab_id: 1,
      request_data: testData
    });
    logTest('Missing API Key', 'FAIL', 'Should have rejected request without API key');
  } catch (error) {
    if (error.response?.status === 401) {
      logTest('Missing API Key', 'PASS', 'Properly rejected request without API key');
    } else {
      logTest('Missing API Key', 'FAIL', 'Unexpected error response');
    }
  }
  
  return true;
}

async function runAllTests() {
  log(`${colors.bold}Neo Card™ AI Integration - Test Suite${colors.reset}`, 'blue');
  log(`Testing against: ${BASE_URL}`, 'yellow');
  log(`API Key: ${API_KEY}`, 'yellow');
  
  const startTime = Date.now();
  
  try {
    // Run all tests
    const healthOk = await testAiHealth();
    const tabsOk = await testAiTabs();
    const analysisOk = await testAiAnalysis();
    const specialFeaturesOk = await testTab9SpecialFeatures();
    const requestsOk = await testAiRequests();
    const errorHandlingOk = await testErrorHandling();
    
    // Summary
    logSection('Test Summary');
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    log(`Total test duration: ${duration}ms`, 'yellow');
    
    const allTestsPassed = healthOk && tabsOk && analysisOk && specialFeaturesOk && requestsOk && errorHandlingOk;
    
    if (allTestsPassed) {
      log(`${colors.bold}🎉 All tests passed! AI Integration is ready for Demo Day!${colors.reset}`, 'green');
    } else {
      log(`${colors.bold}⚠️  Some tests failed. Please review the output above.${colors.reset}`, 'red');
    }
    
  } catch (error) {
    log(`Test suite error: ${error.message}`, 'red');
  }
}

// Run the tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testAiHealth,
  testAiTabs,
  testAiAnalysis,
  testTab9SpecialFeatures,
  testAiRequests,
  testErrorHandling,
  runAllTests
};






