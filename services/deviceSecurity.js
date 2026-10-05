const crypto = require('crypto');
const config = require('../config');
const database = require('../database');
const { sha256, generateId } = require('../config/neocareAi');

/**
 * Reusable Device Security Module V1.
 *
 * Keyed only by hardware device_id. NeoCard is the first caller.
 * Another campus device uses the same functions with its own device_id.
 *
 * The 24-hour rule applies to the reader/device, not to a student card.
 * last_valid_at is the last successful verification or in-policy synchronization.
 * A device with no checkpoint yet is not restricted, so existing terminals keep
 * working until they record a verification. After that, 24 hours without a new
 * checkpoint enters Restricted Mode. Only a one-time support token clears it.
 */

const OFFLINE_REASON = 'OFFLINE_24H';
const PROOF_ACTION = {
  verification: 'device_security.verification',
  restricted: 'device_security.restricted',
  support: 'device_security.support_authorized',
  unlocked: 'device_security.unlocked',
  sync: 'device_security.sync'
};

class DeviceSecurityError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'DeviceSecurityError';
    this.status = status;
    this.code = code;
  }
}

function offlineLimitMs() {
  return config.deviceSecurity.offlineLimitHours * 60 * 60 * 1000;
}

function unlockTtlMs() {
  return config.deviceSecurity.unlockTtlMinutes * 60 * 1000;
}

function hashToken(token) {
  return sha256(String(token));
}

function publicState(device, now) {
  const last = device.last_valid_at ? new Date(device.last_valid_at) : null;
  const hours = last ? (now.getTime() - last.getTime()) / 3600000 : null;
  const securityStatus = device.security_status || 'ACTIVE';

  let offlineState = 'UNVERIFIED';
  if (securityStatus === 'RESTRICTED') {
    offlineState = 'OFFLINE_RESTRICTED';
  } else if (last) {
    offlineState = 'WITHIN_WINDOW';
  }

  return {
    device_id: device.device_id,
    security_status: securityStatus,
    offline_state: offlineState,
    last_valid_at: device.last_valid_at || null,
    restricted_at: device.restricted_at || null,
    restriction_reason: device.restriction_reason || null,
    offline_limit_hours: config.deviceSecurity.offlineLimitHours,
    hours_since_valid: hours === null ? null : Math.round(hours * 100) / 100
  };
}

async function requireDevice(deviceId) {
  if (!deviceId) {
    throw new DeviceSecurityError(400, 'Device ID is required.', 'MISSING_DEVICE_ID');
  }

  const device = await database.getHardwareDevice(deviceId);
  if (!device) {
    throw new DeviceSecurityError(404, 'Device not found.', 'DEVICE_NOT_FOUND');
  }

  return device;
}

async function writeProof({
  deviceId,
  action,
  event,
  reason,
  status,
  supportAuthorization = null,
  syncStatus = null,
  tokenId = null,
  timestamp
}) {
  const id = generateId('dsec');
  const hash = sha256(`${id}|${action}|${deviceId}|${timestamp}|${crypto.randomBytes(4).toString('hex')}`);

  await database.createProofEvent({
    id,
    tab_id: 1,
    action,
    user_uid: deviceId,
    session_id: tokenId,
    input_json: {
      device_id: deviceId,
      reason,
      status,
      support_authorization: supportAuthorization
    },
    output_json: {
      event,
      timestamp,
      sync_status: syncStatus,
      token_id: tokenId
    },
    hash,
    audit_status: 'RECORDED'
  });
}

class DeviceSecurityService {
  async evaluate(deviceId, now = new Date()) {
    const device = await requireDevice(deviceId);

    if ((device.security_status || 'ACTIVE') === 'RESTRICTED') {
      return publicState(device, now);
    }

    if (device.last_valid_at) {
      const elapsed = now.getTime() - new Date(device.last_valid_at).getTime();
      if (elapsed >= offlineLimitMs()) {
        const restrictedAt = now.toISOString();
        const updated = await database.markDeviceRestricted(
          deviceId,
          OFFLINE_REASON,
          restrictedAt
        );

        if (updated.changes === 1) {
          await writeProof({
            deviceId,
            action: PROOF_ACTION.restricted,
            event: 'restricted',
            reason: OFFLINE_REASON,
            status: 'RESTRICTED',
            timestamp: restrictedAt
          });
        }

        const fresh = await database.getHardwareDevice(deviceId);
        return publicState(fresh, now);
      }
    }

    return publicState(device, now);
  }

  /**
   * Blocks check-in, enrollment, verification, and other risk-bearing actions.
   * Status, one-time unlock, sync reporting, and reads stay available.
   */
  async assertRiskBearingAllowed(deviceId, now = new Date()) {
    const state = await this.evaluate(deviceId, now);

    if (state.security_status === 'RESTRICTED') {
      throw new DeviceSecurityError(
        403,
        'Device is in Restricted Mode. Risk-bearing actions are blocked until support unlock.',
        'DEVICE_RESTRICTED'
      );
    }

    return state;
  }

  async recordVerification(deviceId, now = new Date()) {
    const state = await this.evaluate(deviceId, now);
    if (state.security_status === 'RESTRICTED') {
      throw new DeviceSecurityError(
        403,
        'Device is in Restricted Mode. A new verification cannot clear it.',
        'DEVICE_RESTRICTED'
      );
    }

    const at = now.toISOString();
    const updated = await database.recordDeviceCheckpoint(deviceId, at);
    if (updated.changes !== 1) {
      throw new DeviceSecurityError(
        409,
        'Verification was not recorded because the device is restricted.',
        'DEVICE_RESTRICTED'
      );
    }

    await writeProof({
      deviceId,
      action: PROOF_ACTION.verification,
      event: 'verification',
      reason: 'VALID_VERIFICATION',
      status: 'ACTIVE',
      timestamp: at
    });

    const fresh = await database.getHardwareDevice(deviceId);
    return publicState(fresh, now);
  }

  async issueUnlock(deviceId, authorizedBy, now = new Date()) {
    const supportAuthorization = String(authorizedBy || '').trim();
    if (!supportAuthorization || supportAuthorization.length > 120) {
      throw new DeviceSecurityError(
        400,
        'Support authorization (authorized_by) is required.',
        'MISSING_SUPPORT_AUTHORIZATION'
      );
    }

    const state = await this.evaluate(deviceId, now);
    if (state.security_status !== 'RESTRICTED') {
      throw new DeviceSecurityError(
        409,
        'Device is not in Restricted Mode.',
        'DEVICE_NOT_RESTRICTED'
      );
    }

    const issuedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + unlockTtlMs()).toISOString();
    const token = crypto.randomBytes(16).toString('hex');
    const tokenId = generateId('unlock');

    await database.supersedeDeviceUnlockTokens(deviceId);
    await database.createDeviceUnlockToken({
      token_id: tokenId,
      device_id: deviceId,
      token_hash: hashToken(token),
      authorized_by: supportAuthorization,
      issued_at: issuedAt,
      expires_at: expiresAt
    });

    await writeProof({
      deviceId,
      action: PROOF_ACTION.support,
      event: 'support_authorized',
      reason: 'SUPPORT_UNLOCK_ISSUED',
      status: 'RESTRICTED',
      supportAuthorization,
      tokenId,
      timestamp: issuedAt
    });

    return {
      device_id: deviceId,
      token,
      token_id: tokenId,
      expires_at: expiresAt,
      ttl_minutes: config.deviceSecurity.unlockTtlMinutes,
      security_status: 'RESTRICTED'
    };
  }

  async redeemUnlock(deviceId, rawToken, now = new Date()) {
    await requireDevice(deviceId);

    const token = String(rawToken || '').trim();
    if (!token) {
      throw new DeviceSecurityError(400, 'Unlock token is required.', 'MISSING_UNLOCK_TOKEN');
    }

    const row = await database.getDeviceUnlockTokenByHash(hashToken(token));
    if (!row) {
      throw new DeviceSecurityError(401, 'Unlock token is invalid.', 'INVALID_UNLOCK_TOKEN');
    }

    if (row.device_id !== deviceId) {
      throw new DeviceSecurityError(
        403,
        'Unlock token belongs to a different device.',
        'TOKEN_DEVICE_MISMATCH'
      );
    }

    if (row.status === 'USED' || row.status === 'SUPERSEDED') {
      throw new DeviceSecurityError(
        409,
        'Unlock token has already been used.',
        'TOKEN_ALREADY_USED'
      );
    }

    if (row.status === 'EXPIRED' || new Date(row.expires_at).getTime() <= now.getTime()) {
      if (row.status === 'ISSUED') {
        await database.markDeviceUnlockTokenExpired(row.token_id);
      }
      throw new DeviceSecurityError(410, 'Unlock token has expired.', 'TOKEN_EXPIRED');
    }

    const usedAt = now.toISOString();
    const consumed = await database.markDeviceUnlockTokenUsed(row.token_id, usedAt);
    if (consumed.changes !== 1) {
      throw new DeviceSecurityError(
        409,
        'Unlock token has already been used.',
        'TOKEN_ALREADY_USED'
      );
    }

    await database.unlockDeviceSecurity(deviceId, usedAt);
    await writeProof({
      deviceId,
      action: PROOF_ACTION.unlocked,
      event: 'unlocked',
      reason: 'ONE_TIME_UNLOCK',
      status: 'ACTIVE',
      supportAuthorization: row.authorized_by,
      tokenId: row.token_id,
      timestamp: usedAt
    });

    const fresh = await database.getHardwareDevice(deviceId);
    return publicState(fresh, now);
  }

  /**
   * Synchronization after unlock refreshes the checkpoint.
   * A sync while restricted is recorded and does not clear Restricted Mode.
   */
  async recordSync(deviceId, now = new Date()) {
    const state = await this.evaluate(deviceId, now);
    const at = now.toISOString();

    if (state.security_status === 'RESTRICTED') {
      await writeProof({
        deviceId,
        action: PROOF_ACTION.sync,
        event: 'sync',
        reason: 'SYNC_WHILE_RESTRICTED',
        status: 'RESTRICTED',
        syncStatus: 'HELD',
        timestamp: at
      });

      return {
        ...state,
        sync_status: 'HELD'
      };
    }

    await database.recordDeviceCheckpoint(deviceId, at);
    await writeProof({
      deviceId,
      action: PROOF_ACTION.sync,
      event: 'sync',
      reason: 'SYNCHRONIZED',
      status: 'ACTIVE',
      syncStatus: 'SYNCED',
      timestamp: at
    });

    const fresh = await database.getHardwareDevice(deviceId);
    return {
      ...publicState(fresh, now),
      sync_status: 'SYNCED'
    };
  }

  async listAudit(deviceId) {
    await requireDevice(deviceId);
    const rows = await database.getDeviceSecurityEvents(deviceId);

    return rows.map((row) => {
      const input = row.input_json || {};
      const output = row.output_json || {};
      return {
        device_id: input.device_id || deviceId,
        event: output.event || row.action,
        timestamp: output.timestamp || row.created_at,
        reason: input.reason || null,
        status: input.status || null,
        support_authorization: input.support_authorization || null,
        sync_status: output.sync_status || null,
        audit_status: row.audit_status
      };
    });
  }
}

module.exports = new DeviceSecurityService();
module.exports.DeviceSecurityError = DeviceSecurityError;
module.exports.OFFLINE_REASON = OFFLINE_REASON;
