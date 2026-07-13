const database = require('../database');

class FingerprintValidationError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'FingerprintValidationError';
    this.status = status;
    this.code = code;
  }
}

class FingerprintValidation {
  async validateEnrollment(enrollmentData, authenticatedDevice) {
    const {
      enrollment_id,
      user_id,
      device_id,
      fingerprint_slot
    } = enrollmentData;

    if (
      !enrollment_id ||
      !user_id ||
      !device_id ||
      fingerprint_slot === undefined
    ) {
      throw new FingerprintValidationError(
        400,
        'Missing required fields.',
        'MISSING_REQUIRED_FIELDS'
      );
    }

    if (
      !Number.isInteger(fingerprint_slot) ||
      fingerprint_slot < 1 ||
      fingerprint_slot > 199
    ) {
      throw new FingerprintValidationError(
        400,
        'Fingerprint slot must be an integer between 1 and 199.',
        'INVALID_FINGERPRINT_SLOT'
      );
    }

    const user = await database.getUser(user_id);

    if (!user) {
      throw new FingerprintValidationError(
        404,
        'User not found.',
        'USER_NOT_FOUND'
      );
    }

    const device = await database.getHardwareDevice(device_id);

    if (!device) {
      throw new FingerprintValidationError(
        404,
        'Hardware device not found.',
        'DEVICE_NOT_FOUND'
      );
    }

    if (device.status !== 'active') {
      throw new FingerprintValidationError(
        403,
        'Hardware device is not active.',
        'DEVICE_INACTIVE'
      );
    }

    if (device.device_type !== 'fingerprint_device') {
      throw new FingerprintValidationError(
        400,
        'Hardware device is not a fingerprint device.',
        'INVALID_DEVICE_TYPE'
      );
    }

    if (!authenticatedDevice || authenticatedDevice.device_id !== device_id) {
      throw new FingerprintValidationError(
        403,
        'Device ID does not match authenticated terminal.',
        'DEVICE_ID_MISMATCH'
      );
    }

    const assigned = await database.isHardwareAssignedToUser(
      user_id,
      device_id
    );

    if (!assigned) {
      throw new FingerprintValidationError(
        403,
        'Device is not assigned to this user.',
        'DEVICE_NOT_ASSIGNED'
      );
    }

    const existingEnrollments =
      await database.getFingerprintEnrollmentByUser(user_id);
    const activeEnrollment = existingEnrollments.find(
      (enrollment) => enrollment.status === 'ACTIVE'
    );

    if (activeEnrollment) {
      throw new FingerprintValidationError(
        409,
        'User already has a fingerprint enrolled.',
        'DUPLICATE_ENROLLMENT'
      );
    }

    const occupiedSlot =
      await database.getFingerprintEnrollmentByDeviceSlot(
        device_id,
        fingerprint_slot
      );

    if (occupiedSlot) {
      throw new FingerprintValidationError(
        409,
        'Fingerprint slot is already assigned on this device.',
        'FINGERPRINT_SLOT_OCCUPIED'
      );
    }

    return { user, device };
  }
}

module.exports = new FingerprintValidation();
module.exports.FingerprintValidationError = FingerprintValidationError;
