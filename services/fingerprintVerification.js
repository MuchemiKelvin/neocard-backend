const crypto = require('crypto');
const database = require('../database');
const { FingerprintValidationError } = require('./fingerprintValidation');

/**
 * Stage 3 fingerprint verification business logic.
 * Routes call this — no SQL or HTTP in the route handler beyond coordination.
 */
class FingerprintVerificationService {
  generateVerificationId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(3).toString('hex');
    return `VER-${timestamp}-${random}`;
  }

  async logAttempt({
    device_id,
    user_id = null,
    fingerprint_slot = null,
    confidence = null,
    result
  }) {
    const verification_id = this.generateVerificationId();

    await database.createVerificationLog({
      verification_id,
      device_id,
      user_id,
      fingerprint_slot,
      confidence,
      result
    });

    return verification_id;
  }

  /**
   * Verify a fingerprint match reported by the terminal.
   *
   * @param {{ device_id: string, fingerprint_slot: number, confidence?: number }} payload
   * @param {object} authenticatedDevice - req.device from authenticateDeviceApiKey
   */
  async verify(payload, authenticatedDevice) {
    const { device_id, fingerprint_slot, confidence } = payload;

    if (!device_id || fingerprint_slot === undefined || fingerprint_slot === null) {
      throw new FingerprintValidationError(
        400,
        'Missing required fields.',
        'MISSING_REQUIRED_FIELDS'
      );
    }

    const slot = Number(fingerprint_slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > 199) {
      throw new FingerprintValidationError(
        400,
        'Fingerprint slot must be an integer between 1 and 199.',
        'INVALID_FINGERPRINT_SLOT'
      );
    }

    if (!authenticatedDevice || authenticatedDevice.device_id !== device_id) {
      await this.logAttempt({
        device_id: authenticatedDevice?.device_id || device_id,
        fingerprint_slot: slot,
        confidence: confidence ?? null,
        result: 'FAILED'
      });

      throw new FingerprintValidationError(
        403,
        'Device ID does not match authenticated terminal.',
        'DEVICE_ID_MISMATCH'
      );
    }

    if (authenticatedDevice.status !== 'active') {
      await this.logAttempt({
        device_id,
        fingerprint_slot: slot,
        confidence: confidence ?? null,
        result: 'FAILED'
      });

      throw new FingerprintValidationError(
        401,
        'Invalid or inactive device.',
        'DEVICE_INACTIVE'
      );
    }

    const enrollment = await database.getActiveEnrollmentWithUserByDeviceSlot(
      device_id,
      slot
    );

    if (!enrollment) {
      await this.logAttempt({
        device_id,
        fingerprint_slot: slot,
        confidence: confidence ?? null,
        result: 'UNKNOWN'
      });

      throw new FingerprintValidationError(
        404,
        'Fingerprint not recognized',
        'FINGERPRINT_NOT_RECOGNIZED'
      );
    }

    const userActive = enrollment.user_active === 1 || enrollment.user_active === true;
    if (!userActive) {
      await this.logAttempt({
        device_id,
        user_id: enrollment.user_id,
        fingerprint_slot: slot,
        confidence: confidence ?? null,
        result: 'FAILED'
      });

      throw new FingerprintValidationError(
        403,
        'User inactive',
        'USER_INACTIVE'
      );
    }

    await database.incrementVerificationCount(enrollment.enrollment_id);

    const verification_id = await this.logAttempt({
      device_id,
      user_id: enrollment.user_id,
      fingerprint_slot: slot,
      confidence: confidence ?? null,
      result: 'SUCCESS'
    });

    return {
      verification_id,
      user_id: enrollment.user_id,
      first_name: enrollment.first_name,
      last_name: enrollment.last_name,
      status: enrollment.status,
      fingerprint_slot: slot,
      confidence: confidence ?? null,
      enrollment_id: enrollment.enrollment_id
    };
  }
}

module.exports = new FingerprintVerificationService();
