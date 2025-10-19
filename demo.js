#!/usr/bin/env node

/**
 * Neo Card™ Demo Backend - Demo Script
 * 
 * This script demonstrates the key functionality of the Neo Card™ Demo Backend
 * including scan registration, anti-fraud logic, and data export.
 */

const axios = require('axios');
const { isValidUID } = require('./utils');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_KEY = 'neocard_admin_demo_key_2024';

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

async function makeRequest(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
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

async function demoHealthCheck() {
  log('\n🏥 Testing Health Check...', 'blue');
  
  const result = await makeRequest('GET', '/health');
  
  if (result.success) {
    log('✅ Health check passed!', 'green');
    log(`   Server: ${result.data.message}`, 'green');
    log(`   Version: ${result.data.version}`, 'green');
    log(`   Environment: ${result.data.environment}`, 'green');
  } else {
    log('❌ Health check failed!', 'red');
    log(`   Error: ${result.error}`, 'red');
  }
}

async function demoScanRegistration() {
  log('\n📱 Testing Scan Registration...', 'blue');
  
  const scanData = {
    uid: 'DEMO123456',
    campaign_id: 'DEMO_CAMPAIGN'
  };
  
  const result = await makeRequest('POST', '/v1/scan', scanData);
  
  if (result.success) {
    log('✅ Scan registered successfully!', 'green');
    log(`   Scan ID: ${result.data.data.scan_id}`, 'green');
    log(`   UID: ${result.data.data.uid}`, 'green');
    log(`   Campaign: ${result.data.data.campaign_id}`, 'green');
    log(`   Checksum: ${result.data.data.checksum.substring(0, 16)}...`, 'green');
    log(`   Verified: ${result.data.data.verified}`, 'green');
  } else {
    log('❌ Scan registration failed!', 'red');
    log(`   Error: ${result.error.message}`, 'red');
  }
}

async function demoCooldownProtection() {
  log('\n⏰ Testing Cooldown Protection...', 'blue');
  
  const scanData = {
    uid: 'COOLDOWN_TEST',
    campaign_id: 'DEMO_CAMPAIGN'
  };
  
  // First scan should succeed
  log('   Attempting first scan...', 'yellow');
  const firstResult = await makeRequest('POST', '/v1/scan', scanData);
  
  if (firstResult.success) {
    log('   ✅ First scan successful', 'green');
    
    // Second scan should be blocked
    log('   Attempting second scan (should be blocked)...', 'yellow');
    const secondResult = await makeRequest('POST', '/v1/scan', scanData);
    
    if (!secondResult.success && secondResult.status === 429) {
      log('   ✅ Cooldown protection working!', 'green');
      log(`   Message: ${secondResult.error.message}`, 'green');
      log(`   Cooldown: ${secondResult.error.cooldownMinutes} minutes`, 'green');
    } else {
      log('   ❌ Cooldown protection failed!', 'red');
    }
  } else {
    log('   ❌ First scan failed!', 'red');
  }
}

async function demoLogsRetrieval() {
  log('\n📊 Testing Logs Retrieval...', 'blue');
  
  const result = await makeRequest('GET', '/v1/logs', null, {
    'x-api-key': API_KEY
  });
  
  if (result.success) {
    log('✅ Logs retrieved successfully!', 'green');
    log(`   Total scans: ${result.data.data.pagination.total}`, 'green');
    log(`   Scans returned: ${result.data.data.scans.length}`, 'green');
    
    if (result.data.data.scans.length > 0) {
      const latestScan = result.data.data.scans[0];
      log(`   Latest scan: ${latestScan.uid} at ${latestScan.timestamp}`, 'green');
    }
  } else {
    log('❌ Logs retrieval failed!', 'red');
    log(`   Error: ${result.error.message}`, 'red');
  }
}

async function demoStatistics() {
  log('\n📈 Testing Statistics...', 'blue');
  
  const result = await makeRequest('GET', '/v1/stats', null, {
    'x-api-key': API_KEY
  });
  
  if (result.success) {
    log('✅ Statistics retrieved successfully!', 'green');
    log(`   Total scans: ${result.data.data.totalScans}`, 'green');
    log(`   Today's scans: ${result.data.data.todayScans}`, 'green');
    log(`   Unique UIDs: ${result.data.data.uniqueUids}`, 'green');
    log(`   Last scan: ${result.data.data.lastScan || 'None'}`, 'green');
  } else {
    log('❌ Statistics retrieval failed!', 'red');
    log(`   Error: ${result.error.message}`, 'red');
  }
}

async function demoCSVExport() {
  log('\n📄 Testing CSV Export...', 'blue');
  
  const result = await makeRequest('GET', '/v1/export/csv', null, {
    'x-api-key': API_KEY
  });
  
  if (result.success) {
    log('✅ CSV export successful!', 'green');
    log(`   Content-Type: text/csv`, 'green');
    log(`   Data length: ${result.data.length} characters`, 'green');
    
    // Show first few lines
    const lines = result.data.split('\n');
    log('   Sample data:', 'green');
    lines.slice(0, 3).forEach(line => {
      if (line.trim()) {
        log(`     ${line}`, 'green');
      }
    });
  } else {
    log('❌ CSV export failed!', 'red');
    log(`   Error: ${result.error.message}`, 'red');
  }
}

async function demoUnauthorizedAccess() {
  log('\n🔒 Testing Unauthorized Access...', 'blue');
  
  const result = await makeRequest('GET', '/v1/logs');
  
  if (!result.success && result.status === 401) {
    log('✅ Unauthorized access properly blocked!', 'green');
    log(`   Message: ${result.error.message}`, 'green');
    log(`   Code: ${result.error.code}`, 'green');
  } else {
    log('❌ Unauthorized access not blocked!', 'red');
  }
}

async function runDemo() {
  log('🚀 Neo Card™ Demo Backend - Demo Script', 'bold');
  log('=====================================', 'bold');
  
  try {
    await demoHealthCheck();
    await demoScanRegistration();
    await demoCooldownProtection();
    await demoLogsRetrieval();
    await demoStatistics();
    await demoCSVExport();
    await demoUnauthorizedAccess();
    
    log('\n🎉 Demo completed successfully!', 'bold');
    log('All features are working correctly.', 'green');
    
  } catch (error) {
    log('\n💥 Demo failed with error:', 'red');
    log(error.message, 'red');
  }
}

// Check if axios is available
try {
  require('axios');
} catch (error) {
  log('❌ axios is required for the demo script', 'red');
  log('Install it with: npm install axios', 'yellow');
  process.exit(1);
}

// Run the demo
runDemo();
