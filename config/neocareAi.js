// NeoCare AI Configuration

const crypto = require('crypto');

// NeoCare Tab Definitions (13 tabs)
const NEOCARE_TABS = {
  1: {
    name: 'Overview Dashboard',
    action: 'triage',
    description: 'Triage and urgency assessment'
  },
  2: {
    name: 'Clients Dashboard',
    action: 'symptom_check',
    description: 'Symptom check and pattern flags'
  },
  3: {
    name: 'Tasks Dashboard',
    action: 'episode_gate',
    description: 'Episode gate and sponsor block management'
  },
  4: {
    name: 'Scheduling Dashboard',
    action: 'certify_proof',
    description: 'Certification and proof generation'
  },
  5: {
    name: 'Reporting Dashboard',
    action: 'proof_playback',
    description: 'Proof playback and audit viewer'
  },
  6: {
    name: 'Medication Dashboard',
    action: 'ai_video_recommend',
    description: 'AI micro-video selector'
  },
  7: {
    name: '7D Proof Dashboard',
    action: 'med_double_check',
    description: 'Medication double-check AI'
  },
  8: {
    name: 'Emergency Center Dashboard',
    action: 'emergency_triage',
    description: 'Emergency triage and dispatch'
  },
  9: {
    name: 'Reward Ladder Dashboard',
    action: 'reward_calculation',
    description: 'Reward calculation and tracking'
  },
  10: {
    name: 'NeoPay Dashboard',
    action: 'payment_verification',
    description: 'Payment verification and processing'
  },
  11: {
    name: 'Invoice Generator Dashboard',
    action: 'invoice_generation',
    description: 'AI-powered invoice generation'
  },
  12: {
    name: 'Sponsor Wallet Dashboard',
    action: 'sponsor_analytics',
    description: 'Sponsor analytics and insights'
  },
  13: {
    name: 'NeoChain Explorer Dashboard',
    action: 'blockchain_verification',
    description: 'Blockchain verification and audit'
  }
};

// Helper function to generate SHA256 hash
function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

// Helper function to generate unique ID
function generateId(prefix = 'neocare') {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
}

module.exports = {
  NEOCARE_TABS,
  sha256,
  generateId
};
