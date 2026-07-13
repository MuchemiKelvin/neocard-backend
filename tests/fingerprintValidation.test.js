// Fingerprint enrollment validation tests

const request = require('supertest');
const app = require('./app');
const db = require('../database');
const FingerprintValidation = require('../services/fingerprintValidation');
const { FingerprintValidationError } = require('../services/fingerprintValidation');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = './database/test_neocard.db';

describe('Fingerprint Validation Service', () => {
  let userId;
  let deviceId;
  let apiKey;
  let authDevice;

  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await db.runSql('DELETE FROM fingerprint_enrollments');
    await db.runSql('DELETE FROM hardware_mappings');
    await db.runSql('DELETE FROM hardware_devices');
    await db.runSql("DELETE FROM users WHERE user_id LIKE 'fp_test_%'");

    userId = `fp_test_user_${Date.now()}`;
    await db.createUser({
      user_id: userId,
      first_name: 'Fingerprint',
      last_name: 'Tester',
      active: true
    });

    const created = await db.createHardwareDevice({
      device_id: `fp_test_device_${Date.now()}`,
      device_type: 'fingerprint_device',
      device_name: 'Test R503 Terminal',
      status: 'active'
    });

    deviceId = created.device_id;
    apiKey = created.api_key;
    authDevice = await db.getHardwareDevice(deviceId);
    await db.assignHardwareToUser(userId, deviceId);
  });

  const validPayload = () => ({
    enrollment_id: `ENR_TEST_${Date.now()}`,
    user_id: userId,
    device_id: deviceId,
    fingerprint_slot: 10
  });

  describe('validateEnrollment()', () => {
    test('passes when all rules are satisfied', async () => {
      const result = await FingerprintValidation.validateEnrollment(
        validPayload(),
        authDevice
      );

      expect(result.user.user_id).toBe(userId);
      expect(result.device.device_id).toBe(deviceId);
    });

    test('rejects missing required fields', async () => {
      await expect(
        FingerprintValidation.validateEnrollment(
          { user_id: userId },
          authDevice
        )
      ).rejects.toMatchObject({
        status: 400,
        code: 'MISSING_REQUIRED_FIELDS'
      });
    });

    test('rejects invalid fingerprint slot', async () => {
      await expect(
        FingerprintValidation.validateEnrollment(
          { ...validPayload(), fingerprint_slot: 0 },
          authDevice
        )
      ).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_FINGERPRINT_SLOT'
      });
    });

    test('rejects unknown user', async () => {
      await expect(
        FingerprintValidation.validateEnrollment(
          { ...validPayload(), user_id: 'fp_test_missing_user' },
          authDevice
        )
      ).rejects.toMatchObject({
        status: 404,
        code: 'USER_NOT_FOUND'
      });
    });

    test('rejects unknown device', async () => {
      await expect(
        FingerprintValidation.validateEnrollment(
          { ...validPayload(), device_id: 'fp_test_missing_device' },
          authDevice
        )
      ).rejects.toMatchObject({
        status: 404,
        code: 'DEVICE_NOT_FOUND'
      });
    });

    test('rejects inactive device', async () => {
      await db.runSql(
        "UPDATE hardware_devices SET status = 'inactive' WHERE device_id = ?",
        [deviceId]
      );
      const inactiveDevice = await db.getHardwareDevice(deviceId);

      await expect(
        FingerprintValidation.validateEnrollment(
          validPayload(),
          inactiveDevice
        )
      ).rejects.toMatchObject({
        status: 403,
        code: 'DEVICE_INACTIVE'
      });
    });

    test('rejects non-fingerprint device type', async () => {
      const other = await db.createHardwareDevice({
        device_id: `fp_test_neocam_${Date.now()}`,
        device_type: 'neocam_v1',
        device_name: 'NeoCam',
        status: 'active'
      });
      const otherDevice = await db.getHardwareDevice(other.device_id);
      await db.assignHardwareToUser(userId, other.device_id);

      await expect(
        FingerprintValidation.validateEnrollment(
          { ...validPayload(), device_id: other.device_id },
          otherDevice
        )
      ).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_DEVICE_TYPE'
      });
    });

    test('rejects device id mismatch with authenticated terminal', async () => {
      const other = await db.createHardwareDevice({
        device_id: `fp_test_device_other_${Date.now()}`,
        device_type: 'fingerprint_device',
        device_name: 'Other Terminal',
        status: 'active'
      });

      await expect(
        FingerprintValidation.validateEnrollment(
          { ...validPayload(), device_id: other.device_id },
          authDevice
        )
      ).rejects.toMatchObject({
        status: 403,
        code: 'DEVICE_ID_MISMATCH'
      });
    });

    test('rejects unassigned device', async () => {
      await db.unassignHardwareFromUser(userId, deviceId);

      await expect(
        FingerprintValidation.validateEnrollment(validPayload(), authDevice)
      ).rejects.toMatchObject({
        status: 403,
        code: 'DEVICE_NOT_ASSIGNED'
      });
    });

    test('rejects duplicate active enrollment for user', async () => {
      await db.createFingerprintEnrollment({
        enrollment_id: `ENR_EXISTING_${Date.now()}`,
        user_id: userId,
        device_id: deviceId,
        fingerprint_slot: 5,
        status: 'ACTIVE'
      });

      await expect(
        FingerprintValidation.validateEnrollment(validPayload(), authDevice)
      ).rejects.toMatchObject({
        status: 409,
        code: 'DUPLICATE_ENROLLMENT'
      });
    });

    test('rejects occupied device slot', async () => {
      const otherUserId = `fp_test_user_other_${Date.now()}`;
      await db.createUser({
        user_id: otherUserId,
        first_name: 'Other',
        last_name: 'User',
        active: true
      });

      await db.createFingerprintEnrollment({
        enrollment_id: `ENR_SLOT_${Date.now()}`,
        user_id: otherUserId,
        device_id: deviceId,
        fingerprint_slot: 10,
        status: 'ACTIVE'
      });

      await expect(
        FingerprintValidation.validateEnrollment(validPayload(), authDevice)
      ).rejects.toMatchObject({
        status: 409,
        code: 'FINGERPRINT_SLOT_OCCUPIED'
      });
    });
  });

  describe('POST /v1/fingerprints/enroll', () => {
    test('requires device API key', async () => {
      const response = await request(app)
        .post('/v1/fingerprints/enroll')
        .send(validPayload())
        .expect(401);

      expect(response.body.code).toBe('MISSING_DEVICE_API_KEY');
    });

    test('returns validation error from service', async () => {
      const response = await request(app)
        .post('/v1/fingerprints/enroll')
        .set('x-api-key', apiKey)
        .send({ ...validPayload(), user_id: 'fp_test_missing_user' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('USER_NOT_FOUND');
    });

    test('creates enrollment when validation passes', async () => {
      const payload = validPayload();

      const response = await request(app)
        .post('/v1/fingerprints/enroll')
        .set('x-api-key', apiKey)
        .send(payload)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.enrollment_id).toBe(payload.enrollment_id);

      const stored = await db.getFingerprintEnrollment(payload.enrollment_id);
      expect(stored.fingerprint_slot).toBe(10);
      expect(stored.user_id).toBe(userId);
    });
  });
});
