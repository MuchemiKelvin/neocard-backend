const crypto = require('crypto');
const database = require('../database');
const { FingerprintValidationError } = require('./fingerprintValidation');

const TRANSACTION_TYPES = Object.freeze([
  'CHECK_IN',
  'CHECK_OUT',
  'ATTENDANCE',
  'LIBRARY',
  'HOSTEL',
  'CAFETERIA',
  'EXAM',
  'VISITOR'
]);

/**
 * Stage 4 NeoCard terminal transactions.
 * Identity stays on /v1/fingerprints/verify; this records business actions.
 */
class NeoCardTransactionService {
  get allowedTypes() {
    return TRANSACTION_TYPES;
  }

  generateTransactionId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(3).toString('hex');
    return `TXN-${timestamp}-${random}`;
  }

  /**
   * @param {object} payload
   * @param {object} authenticatedDevice - req.device
   */
  async checkIn(payload, authenticatedDevice) {
    return this.recordTransaction(
      { ...payload, transaction_type: payload.transaction_type || 'CHECK_IN' },
      authenticatedDevice
    );
  }

  async recordTransaction(payload, authenticatedDevice) {
    const device_id = payload.device_id || payload.deviceId;
    const fingerprint_slot = payload.fingerprint_slot ?? payload.fingerprintSlot;
    const transaction_type = (
      payload.transaction_type ||
      payload.transactionType ||
      'CHECK_IN'
    ).toUpperCase();
    const verification_id = payload.verification_id || payload.verificationId || null;
    const user_id_hint = payload.user_id || payload.userId || null;
    const timestamp = payload.timestamp || payload.occurred_at || null;

    if (!device_id) {
      throw new FingerprintValidationError(
        400,
        'Missing required fields.',
        'MISSING_REQUIRED_FIELDS'
      );
    }

    if (!authenticatedDevice || authenticatedDevice.device_id !== device_id) {
      throw new FingerprintValidationError(
        403,
        'Device ID does not match authenticated terminal.',
        'DEVICE_ID_MISMATCH'
      );
    }

    if (authenticatedDevice.status !== 'active') {
      throw new FingerprintValidationError(
        401,
        'Invalid or inactive device.',
        'DEVICE_INACTIVE'
      );
    }

    if (!TRANSACTION_TYPES.includes(transaction_type)) {
      throw new FingerprintValidationError(
        400,
        `Invalid transaction_type. Allowed: ${TRANSACTION_TYPES.join(', ')}`,
        'INVALID_TRANSACTION_TYPE'
      );
    }

    let user_id = user_id_hint;
    let first_name = null;
    let last_name = null;
    let slot = fingerprint_slot != null ? Number(fingerprint_slot) : null;

    if (verification_id) {
      const logs = await database.getVerificationLogs({
        device_id,
        limit: 50
      });
      const match = logs.find((row) => row.verification_id === verification_id);
      if (!match || match.result !== 'SUCCESS') {
        throw new FingerprintValidationError(
          404,
          'Verification not found or not successful.',
          'VERIFICATION_NOT_FOUND'
        );
      }
      user_id = match.user_id;
      slot = match.fingerprint_slot ?? slot;
    }

    if (!user_id && slot != null) {
      if (!Number.isInteger(slot) || slot < 1 || slot > 199) {
        throw new FingerprintValidationError(
          400,
          'Fingerprint slot must be an integer between 1 and 199.',
          'INVALID_FINGERPRINT_SLOT'
        );
      }

      const enrollment = await database.getActiveEnrollmentWithUserByDeviceSlot(
        device_id,
        slot
      );

      if (!enrollment) {
        throw new FingerprintValidationError(
          404,
          'Fingerprint not recognized',
          'FINGERPRINT_NOT_RECOGNIZED'
        );
      }

      const userActive = enrollment.user_active === 1 || enrollment.user_active === true;
      if (!userActive) {
        throw new FingerprintValidationError(
          403,
          'User inactive',
          'USER_INACTIVE'
        );
      }

      user_id = enrollment.user_id;
      first_name = enrollment.first_name;
      last_name = enrollment.last_name;
    }

    if (!user_id) {
      throw new FingerprintValidationError(
        400,
        'Provide verification_id or fingerprint_slot to resolve user.',
        'MISSING_USER_REFERENCE'
      );
    }

    if (!first_name || !last_name) {
      const user = await database.getUser(user_id);
      if (!user) {
        throw new FingerprintValidationError(404, 'User not found.', 'USER_NOT_FOUND');
      }
      if (!(user.active === 1 || user.active === true)) {
        throw new FingerprintValidationError(403, 'User inactive', 'USER_INACTIVE');
      }
      first_name = user.first_name;
      last_name = user.last_name;
    }

    const transaction_id = this.generateTransactionId();
    const created = await database.createNeocardTransaction({
      transaction_id,
      transaction_type,
      device_id,
      user_id,
      verification_id,
      fingerprint_slot: slot,
      occurred_at: timestamp
    });

    const stored = await database.getNeocardTransaction(transaction_id);

    return {
      success: true,
      user: {
        id: user_id,
        name: `${first_name || ''} ${last_name || ''}`.trim(),
        first_name,
        last_name,
        type: 'User'
      },
      transaction: {
        id: transaction_id,
        type: transaction_type,
        time: stored?.occurred_at || stored?.created_at || new Date().toISOString(),
        device_id,
        fingerprint_slot: slot,
        verification_id
      },
      data: created
    };
  }
}

module.exports = new NeoCardTransactionService();
module.exports.TRANSACTION_TYPES = TRANSACTION_TYPES;
