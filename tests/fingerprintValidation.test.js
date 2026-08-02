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
    await db.runSql('DELETE FROM neocard_transactions');
    await db.runSql('DELETE FROM verification_logs');
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

  describe('GET /v1/device/me', () => {
    test('requires device API key', async () => {
      const response = await request(app)
        .get('/v1/device/me')
        .expect(401);

      expect(response.body.code).toBe('MISSING_DEVICE_API_KEY');
    });

    test('returns authenticated device without api_key in response', async () => {
      const response = await request(app)
        .get('/v1/device/me')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.device_id).toBe(deviceId);
      expect(response.body.data.device_name).toBe('Test R503 Terminal');
      expect(response.body.data.device_type).toBe('fingerprint_device');
      expect(response.body.data.api_key).toBeUndefined();
    });
  });

  describe('POST /v1/fingerprints/verify', () => {
    const enrollSlot = async (slot = 2) => {
      const enrollmentId = `ENR_VERIFY_${Date.now()}_${slot}`;
      await db.createFingerprintEnrollment({
        enrollment_id: enrollmentId,
        user_id: userId,
        device_id: deviceId,
        fingerprint_slot: slot,
        status: 'ACTIVE'
      });
      return enrollmentId;
    };

    test('requires device API key', async () => {
      const response = await request(app)
        .post('/v1/fingerprints/verify')
        .send({ device_id: deviceId, fingerprint_slot: 2 })
        .expect(401);

      expect(response.body.code).toBe('MISSING_DEVICE_API_KEY');
    });

    test('returns 404 when fingerprint slot is unknown', async () => {
      const response = await request(app)
        .post('/v1/fingerprints/verify')
        .set('x-api-key', apiKey)
        .send({
          device_id: deviceId,
          fingerprint_slot: 99,
          confidence: 100
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Fingerprint not recognized');
      expect(response.body.code).toBe('FINGERPRINT_NOT_RECOGNIZED');

      const logs = await db.getVerificationLogs({ device_id: deviceId });
      expect(logs[0].result).toBe('UNKNOWN');
    });

    test('returns user and increments verification_count on success', async () => {
      const enrollmentId = await enrollSlot(2);

      const response = await request(app)
        .post('/v1/fingerprints/verify')
        .set('x-api-key', apiKey)
        .send({
          device_id: deviceId,
          fingerprint_slot: 2,
          confidence: 167
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Verification successful');
      expect(response.body.data.user_id).toBe(userId);
      expect(response.body.data.first_name).toBe('Fingerprint');
      expect(response.body.data.last_name).toBe('Tester');
      expect(response.body.data.status).toBe('ACTIVE');
      expect(response.body.data.fingerprint_slot).toBe(2);

      const stored = await db.getFingerprintEnrollment(enrollmentId);
      expect(stored.verification_count).toBe(1);
      expect(stored.last_verified_at).toBeTruthy();

      const logs = await db.getVerificationLogs({ device_id: deviceId });
      expect(logs[0].result).toBe('SUCCESS');
      expect(logs[0].user_id).toBe(userId);
      expect(logs[0].confidence).toBe(167);
    });

    test('returns 403 when user is inactive', async () => {
      await enrollSlot(2);
      await db.runSql('UPDATE users SET active = 0 WHERE user_id = ?', [userId]);

      const response = await request(app)
        .post('/v1/fingerprints/verify')
        .set('x-api-key', apiKey)
        .send({
          device_id: deviceId,
          fingerprint_slot: 2,
          confidence: 120
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User inactive');
      expect(response.body.code).toBe('USER_INACTIVE');

      const logs = await db.getVerificationLogs({ device_id: deviceId });
      expect(logs[0].result).toBe('FAILED');
    });

    test('rejects device_id mismatch', async () => {
      await enrollSlot(2);

      const response = await request(app)
        .post('/v1/fingerprints/verify')
        .set('x-api-key', apiKey)
        .send({
          device_id: 'fp_test_other_device',
          fingerprint_slot: 2
        })
        .expect(403);

      expect(response.body.code).toBe('DEVICE_ID_MISMATCH');
    });
  });

  describe('POST /v1/neocard/checkin', () => {
    const enrollSlot = async (slot = 2) => {
      await db.createFingerprintEnrollment({
        enrollment_id: `ENR_CHECKIN_${Date.now()}_${slot}`,
        user_id: userId,
        device_id: deviceId,
        fingerprint_slot: slot,
        status: 'ACTIVE'
      });
    };

    test('records CHECK_IN transaction for enrolled slot', async () => {
      await enrollSlot(2);

      const response = await request(app)
        .post('/v1/neocard/checkin')
        .set('x-api-key', apiKey)
        .send({
          device_id: deviceId,
          fingerprint_slot: 2,
          transaction_type: 'CHECK_IN',
          metadata: { deviceName: 'KDVC-RPI-001', firmware: '1.0.0' }
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.user.id).toBe(userId);
      expect(response.body.user.name).toContain('Fingerprint');
      expect(response.body.transaction.type).toBe('CHECK_IN');
      expect(response.body.transaction.status).toBe('SUCCESS');
      expect(response.body.transaction.verification_method).toBe('FINGERPRINT');
      expect(response.body.transaction.id).toBeTruthy();

      const rows = await db.getNeocardTransactions({ device_id: deviceId });
      expect(rows).toHaveLength(1);
      expect(rows[0].user_id).toBe(userId);
      expect(rows[0].status).toBe('SUCCESS');
    });

    test('is idempotent when the same transaction_id is retried', async () => {
      await enrollSlot(2);
      const transactionId = '11111111-2222-3333-4444-555555555555';

      const first = await request(app)
        .post('/v1/neocard/checkin')
        .set('x-api-key', apiKey)
        .send({
          device_id: deviceId,
          fingerprint_slot: 2,
          transaction_id: transactionId
        })
        .expect(201);

      const second = await request(app)
        .post('/v1/neocard/checkin')
        .set('x-api-key', apiKey)
        .send({
          device_id: deviceId,
          fingerprint_slot: 2,
          transaction_id: transactionId
        })
        .expect(201);

      expect(first.body.transaction.id).toBe(transactionId);
      expect(second.body.transaction.id).toBe(transactionId);

      const rows = await db.getNeocardTransactions({ device_id: deviceId });
      expect(rows).toHaveLength(1);
    });

    test('rejects unknown slot', async () => {
      const response = await request(app)
        .post('/v1/neocard/checkin')
        .set('x-api-key', apiKey)
        .send({
          device_id: deviceId,
          fingerprint_slot: 99
        })
        .expect(404);

      expect(response.body.code).toBe('FINGERPRINT_NOT_RECOGNIZED');
    });

    test('rejects invalid transaction_type', async () => {
      await enrollSlot(2);

      const response = await request(app)
        .post('/v1/neocard/checkin')
        .set('x-api-key', apiKey)
        .send({
          device_id: deviceId,
          fingerprint_slot: 2,
          transaction_type: 'INVALID'
        })
        .expect(400);

      expect(response.body.code).toBe('INVALID_TRANSACTION_TYPE');
    });
  });
});
