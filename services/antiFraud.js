const config = require('../config');
const db = require('../database');
const { isWithinCooldown } = require('../utils');

/**
 * Existing Anti-Fraud Layer V1 (cooldown + daily scan limit).
 * Shared by NFC scan middleware and the NeoCard device-security adapter.
 */
class AntiFraudError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'AntiFraudError';
    this.status = 429;
    this.code = code;
    this.details = details;
  }
}

async function assertScanAllowed(uid) {
  if (!uid) {
    return;
  }

  const { antifraud } = config;
  const lastScanTime = await db.getLastScanTime(uid);

  if (lastScanTime && isWithinCooldown(lastScanTime, antifraud.cooldownMinutes)) {
    throw new AntiFraudError(
      'Scan blocked: within cooldown period',
      'COOLDOWN_ACTIVE',
      {
        cooldownMinutes: antifraud.cooldownMinutes,
        lastScanTime
      }
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const dailyScanCount = await db.getDailyScanCount(uid, today);

  if (dailyScanCount >= antifraud.dailyScanLimit) {
    throw new AntiFraudError(
      'Daily scan limit exceeded',
      'DAILY_LIMIT_EXCEEDED',
      {
        dailyLimit: antifraud.dailyScanLimit,
        currentCount: dailyScanCount
      }
    );
  }
}

module.exports = {
  assertScanAllowed,
  AntiFraudError
};
