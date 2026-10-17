const request = require('supertest');
const app = require('./app');
const db = require('../database');

const ADMIN_KEY = 'neocard_admin_demo_key_2024';

describe('NeoCard NFC check-in', () => {
  const stamp = Date.now();
  const tenantId = `SCHOOL-NFC-${stamp}`;
  const otherTenantId = `SCHOOL-NFC-OTHER-${stamp}`;
  const suspendedTenantId = `SCHOOL-NFC-STOP-${stamp}`;
  let deviceId;
  let deviceKey;
  let stoppedDeviceId;
  let stoppedDeviceKey;

  beforeAll(async () => {
    await db.connect();
    await db.runSql(`DELETE FROM scans WHERE lower(uid) IN ('teacher1', 'student1', 'idlecard', 'nursecard', 'noseat01', 'unknown1')`);
    const device = await db.createHardwareDevice({
      device_id: `nfc_reader_${stamp}`,
      device_type: 'other',
      device_name: 'Pocket Reader test',
      status: 'active'
    });
    const stopped = await db.createHardwareDevice({
      device_id: `nfc_stopped_${stamp}`,
      device_type: 'other',
      device_name: 'Stopped reader',
      status: 'active'
    });
    deviceId = device.device_id;
    deviceKey = device.api_key;
    stoppedDeviceId = stopped.device_id;
    stoppedDeviceKey = stopped.api_key;

    const teacher = await db.getRoleByCode('teacher');
    const student = await db.getRoleByCode('student');
    const nurse = await db.getRoleByCode('nurse');
    await db.createUser({
      user_id: `nfc-teacher-${stamp}`,
      email: `nfc-teacher-${stamp}@example.test`,
      first_name: 'Ada',
      last_name: 'Teacher',
      role_id: teacher.id,
      neocard_uid: 'TEACHER1',
      active: 1
    });
    await db.createUser({
      user_id: `nfc-student-${stamp}`,
      email: `nfc-student-${stamp}@example.test`,
      first_name: 'Ben',
      last_name: 'Student',
      role_id: student.id,
      neocard_uid: 'STUDENT1',
      active: 1
    });
    await db.createUser({
      user_id: `nfc-idle-${stamp}`,
      email: `nfc-idle-${stamp}@example.test`,
      first_name: 'Ida',
      last_name: 'Idle',
      role_id: student.id,
      neocard_uid: 'IDLECARD',
      active: 0
    });
    await db.createUser({
      user_id: `nfc-nurse-${stamp}`,
      email: `nfc-nurse-${stamp}@example.test`,
      first_name: 'Nia',
      last_name: 'Nurse',
      role_id: nurse.id,
      neocard_uid: 'NURSECARD',
      active: 1
    });
    await db.createUser({
      user_id: `nfc-noseat-${stamp}`,
      email: `nfc-noseat-${stamp}@example.test`,
      first_name: 'Noa',
      last_name: 'Seat',
      role_id: student.id,
      neocard_uid: 'NOSEAT01',
      active: 1
    });

    await createLicense(tenantId, [deviceId]);
    await createLicense(otherTenantId, []);
    await createLicense(suspendedTenantId, [stoppedDeviceId]);
    await request(app)
      .post(`/v1/license/${suspendedTenantId}/status`)
      .set('x-api-key', ADMIN_KEY)
      .send({ license_status: 'SUSPENDED' });

    const now = new Date().toISOString();
    await db.insertCampusSeat(tenantId, `nfc-teacher-${stamp}`, now);
    await db.insertCampusSeat(tenantId, `nfc-student-${stamp}`, now);
    await db.insertCampusSeat(tenantId, `nfc-idle-${stamp}`, now);
    await db.insertCampusSeat(tenantId, `nfc-nurse-${stamp}`, now);
    await db.insertCampusSeat(suspendedTenantId, `nfc-teacher-${stamp}`, now);
  });

  afterAll(async () => {
    await db.runSql(`DELETE FROM scans WHERE lower(uid) IN ('teacher1', 'student1', 'idlecard', 'nursecard', 'noseat01', 'unknown1')`);
    await db.runSql(`DELETE FROM neocard_transactions WHERE device_id LIKE 'nfc_%${stamp}'`);
    await db.runSql(`DELETE FROM campus_license_seats WHERE tenant_id LIKE 'SCHOOL-NFC-%${stamp}'`);
    await db.runSql(`DELETE FROM campus_license_entitlements WHERE tenant_id LIKE 'SCHOOL-NFC-%${stamp}'`);
    await db.runSql(`DELETE FROM campus_license_devices WHERE tenant_id LIKE 'SCHOOL-NFC-%${stamp}'`);
    await db.runSql(`DELETE FROM campus_licenses WHERE tenant_id LIKE 'SCHOOL-NFC-%${stamp}'`);
    await db.runSql(`DELETE FROM neocare_proof_events WHERE user_uid LIKE 'SCHOOL-NFC-%${stamp}'`);
    await db.runSql(`DELETE FROM users WHERE user_id LIKE 'nfc-%${stamp}'`);
    await db.runSql(`DELETE FROM hardware_devices WHERE device_id LIKE 'nfc_%${stamp}'`);
    await db.close();
  });

  async function createLicense(id, deviceIds) {
    const response = await request(app)
      .post('/v1/license')
      .set('x-api-key', ADMIN_KEY)
      .send({
        tenant_id: id,
        school_name: 'NFC Test School',
        license_status: 'ACTIVE',
        seat_limit: 100,
        storage_quota_gb: 2000,
        storage_used_gb: 0,
        expires_at: '2027-12-31T00:00:00.000Z',
        products: ['NEOCARD'],
        device_ids: deviceIds
      });
    expect(response.status).toBe(201);
  }

  function checkIn(key, body) {
    const call = request(app).post('/v1/neocard/checkin');
    if (key) call.set('x-api-key', key);
    return call.send({ device_id: deviceId, tenant_id: tenantId, ...body });
  }

  test('a teacher card and a student card check in', async () => {
    const teacher = await checkIn(deviceKey, {
      uid: 'TEACHER1',
      transaction_id: `nfc-teacher-${stamp}`
    });
    expect(teacher.status).toBe(201);
    expect(teacher.body.user.id).toBe(`nfc-teacher-${stamp}`);
    expect(teacher.body.user.role).toBe('teacher');
    expect(teacher.body.transaction.type).toBe('CHECK_IN');
    expect(teacher.body.transaction.verification_method).toBe('NFC');
    expect(JSON.stringify(teacher.body)).not.toContain(deviceKey);

    const student = await checkIn(deviceKey, {
      uid: 'student1',
      transaction_id: `nfc-student-${stamp}`
    });
    expect(student.status).toBe(201);
    expect(student.body.user.id).toBe(`nfc-student-${stamp}`);
    expect(student.body.user.role).toBe('student');
  });

  test('an unknown card, an inactive user, a missing seat, and another role are rejected', async () => {
    const unknown = await checkIn(deviceKey, { uid: 'UNKNOWN1', transaction_id: `nfc-unknown-${stamp}` });
    expect(unknown.status).toBe(404);
    expect(unknown.body.code).toBe('CARD_NOT_ASSIGNED');

    const idle = await checkIn(deviceKey, { uid: 'IDLECARD', transaction_id: `nfc-idle-${stamp}` });
    expect(idle.status).toBe(403);
    expect(idle.body.code).toBe('USER_INACTIVE');

    const noSeat = await checkIn(deviceKey, { uid: 'NOSEAT01', transaction_id: `nfc-noseat-${stamp}` });
    expect(noSeat.status).toBe(403);
    expect(noSeat.body.code).toBe('SEAT_NOT_ACTIVE');

    const nurse = await checkIn(deviceKey, { uid: 'NURSECARD', transaction_id: `nfc-nurse-${stamp}` });
    expect(nurse.status).toBe(403);
    expect(nurse.body.code).toBe('ROLE_NOT_AUTHORIZED');
  });

  test('a bad device key, the wrong school, and a suspended licence are rejected', async () => {
    const missing = await checkIn(null, { uid: 'TEACHER1', transaction_id: `nfc-nokey-${stamp}` });
    expect(missing.status).toBe(401);

    const badKey = await checkIn('not-a-device-key', { uid: 'TEACHER1', transaction_id: `nfc-badkey-${stamp}` });
    expect(badKey.status).toBe(401);
    expect(badKey.body.code).toBe('INVALID_DEVICE_API_KEY');

    const wrongSchool = await checkIn(deviceKey, {
      uid: 'TEACHER1',
      tenant_id: otherTenantId,
      transaction_id: `nfc-wrong-${stamp}`
    });
    expect(wrongSchool.status).toBe(403);

    const suspended = await request(app)
      .post('/v1/neocard/checkin')
      .set('x-api-key', stoppedDeviceKey)
      .send({
        device_id: stoppedDeviceId,
        tenant_id: suspendedTenantId,
        uid: 'TEACHER1',
        transaction_id: `nfc-suspended-${stamp}`
      });
    expect(suspended.status).toBe(403);
    expect(suspended.body.code).toBe('LICENSE_SUSPENDED');
  });

  test('the same event is returned once and a later scan is blocked by the cooldown', async () => {
    const again = await checkIn(deviceKey, {
      uid: 'TEACHER1',
      transaction_id: `nfc-teacher-${stamp}`
    });
    expect(again.status).toBe(201);
    expect(again.body.transaction.id).toBe(`nfc-teacher-${stamp}`);

    const repeat = await checkIn(deviceKey, {
      uid: 'TEACHER1',
      transaction_id: `nfc-teacher-again-${stamp}`
    });
    expect(repeat.status).toBe(429);
    expect(repeat.body.code).toBe('COOLDOWN_ACTIVE');

    const rows = await db.getNeocardTransactions({ device_id: deviceId, user_id: `nfc-teacher-${stamp}` });
    expect(rows).toHaveLength(1);
  });
});
