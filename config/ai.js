// AI Integration Configuration for Neo Card™ Demo Backend
const config = require('./index');

// AI Tab Definitions
const AI_TABS = {
  1: {
    name: 'Audit Dashboard',
    description: 'Audit and verification dashboard',
    responseType: 'audit_data',
    requiresAEI: true
  },
  2: {
    name: 'Sponsor Dashboard',
    description: 'Sponsor management and analytics',
    responseType: 'sponsor_data',
    requiresAEI: true
  },
  3: {
    name: 'User NeoCard',
    description: 'User card management and tracking',
    responseType: 'user_card_data',
    requiresAEI: true
  },
  4: {
    name: 'Sponsor NeoCard',
    description: 'Sponsor card management',
    responseType: 'sponsor_card_data',
    requiresAEI: true
  },
  5: {
    name: 'Analytics Dashboard',
    description: 'Analytics and reporting',
    responseType: 'analytics_data',
    requiresAEI: true
  },
  6: {
    name: 'Campaign Management',
    description: 'Campaign creation and management',
    responseType: 'campaign_data',
    requiresAEI: true
  },
  7: {
    name: 'User Management',
    description: 'User account and profile management',
    responseType: 'user_data',
    requiresAEI: true
  },
  8: {
    name: 'Payment Processing',
    description: 'Payment and transaction management',
    responseType: 'payment_data',
    requiresAEI: true
  },
  9: {
    name: 'Sponsor NeoCard Dashboard',
    description: 'Special dashboard with print/proof functionality',
    responseType: 'sponsor_neocard_data',
    requiresAEI: true,
    hasPrintTrigger: true,
    hasProofTrigger: true
  },
  10: {
    name: 'Reports Dashboard',
    description: 'Reports and data export',
    responseType: 'reports_data',
    requiresAEI: true
  },
  11: {
    name: 'Settings Dashboard',
    description: 'System settings and configuration',
    responseType: 'settings_data',
    requiresAEI: true
  },
  12: {
    name: 'Notifications Dashboard',
    description: 'Notification management',
    responseType: 'notifications_data',
    requiresAEI: true
  },
  13: {
    name: 'System Monitoring',
    description: 'System health and monitoring',
    responseType: 'monitoring_data',
    requiresAEI: true
  }
};

// Mock AI Responses for each tab
const MOCK_RESPONSES = {
  audit_data: {
    status: 'verified',
    confidence: 0.95,
    analysis: 'Audit data verified successfully',
    recommendations: ['Continue monitoring', 'Update security protocols'],
    risk_level: 'low'
  },
  sponsor_data: {
    status: 'verified',
    confidence: 0.92,
    analysis: 'Sponsor data validated',
    recommendations: ['Optimize campaign targeting', 'Increase engagement'],
    risk_level: 'low'
  },
  user_card_data: {
    status: 'verified',
    confidence: 0.98,
    analysis: 'User card data authenticated',
    recommendations: ['Update user preferences', 'Enhance security'],
    risk_level: 'low'
  },
  sponsor_card_data: {
    status: 'verified',
    confidence: 0.94,
    analysis: 'Sponsor card data validated',
    recommendations: ['Refresh card designs', 'Update branding'],
    risk_level: 'low'
  },
  analytics_data: {
    status: 'verified',
    confidence: 0.91,
    analysis: 'Analytics data processed',
    recommendations: ['Focus on high-performing metrics', 'Optimize conversion rates'],
    risk_level: 'low'
  },
  campaign_data: {
    status: 'verified',
    confidence: 0.93,
    analysis: 'Campaign data validated',
    recommendations: ['A/B test new creatives', 'Expand target audience'],
    risk_level: 'low'
  },
  user_data: {
    status: 'verified',
    confidence: 0.96,
    analysis: 'User data authenticated',
    recommendations: ['Improve user experience', 'Add personalization'],
    risk_level: 'low'
  },
  payment_data: {
    status: 'verified',
    confidence: 0.97,
    analysis: 'Payment data secured',
    recommendations: ['Implement fraud detection', 'Add payment analytics'],
    risk_level: 'low'
  },
  sponsor_neocard_data: {
    status: 'verified',
    confidence: 0.99,
    analysis: 'Sponsor NeoCard data ready for print',
    recommendations: ['Generate print proof', 'Validate card design'],
    risk_level: 'low',
    print_ready: true,
    proof_generated: true
  },
  reports_data: {
    status: 'verified',
    confidence: 0.90,
    analysis: 'Reports data compiled',
    recommendations: ['Schedule automated reports', 'Add custom metrics'],
    risk_level: 'low'
  },
  settings_data: {
    status: 'verified',
    confidence: 0.88,
    analysis: 'Settings data validated',
    recommendations: ['Review security settings', 'Update configurations'],
    risk_level: 'low'
  },
  notifications_data: {
    status: 'verified',
    confidence: 0.92,
    analysis: 'Notifications data processed',
    recommendations: ['Optimize notification timing', 'Personalize content'],
    risk_level: 'low'
  },
  monitoring_data: {
    status: 'verified',
    confidence: 0.94,
    analysis: 'System monitoring data analyzed',
    recommendations: ['Scale resources', 'Optimize performance'],
    risk_level: 'low'
  }
};

// AI Configuration
const aiConfig = {
  // Basic configuration from main config
  ...config.ai,
  
  // Tab definitions
  tabs: AI_TABS,
  
  // Mock responses
  mockResponses: MOCK_RESPONSES,
  
  // Response templates
  responseTemplate: {
    success: {
      status: 'success',
      message: 'AI analysis completed successfully',
      timestamp: null, // Will be set dynamically
      data: {
        tab_id: null, // Will be set dynamically
        tab_name: null, // Will be set dynamically
        analysis: null, // Will be set dynamically
        confidence: null, // Will be set dynamically
        recommendations: null, // Will be set dynamically
        risk_level: null, // Will be set dynamically
        aei_proof: null, // Will be set dynamically
        print_ready: false, // Will be set dynamically
        proof_generated: false // Will be set dynamically
      },
      meta: {
        processing_time: null, // Will be set dynamically
        ai_mode: null, // Will be set dynamically
        tab_specific_features: null // Will be set dynamically
      }
    },
    error: {
      status: 'error',
      message: 'AI analysis failed',
      timestamp: null, // Will be set dynamically
      error: {
        code: null, // Will be set dynamically
        message: null, // Will be set dynamically
        details: null // Will be set dynamically
      }
    }
  },
  
  // Validation rules
  validation: {
    requiredFields: ['tab_id', 'request_data'],
    tabIdRange: { min: 1, max: 13 },
    maxRequestSize: 1024 * 1024, // 1MB
    timeoutMs: 30000
  },
  
  // AEI Integration settings
  aei: {
    enabled: true,
    algorithm: 'HMAC-SHA256',
    includeTimestamp: true,
    includeTabId: true
  }
};

module.exports = aiConfig;
