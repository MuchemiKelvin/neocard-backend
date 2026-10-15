const request = require('supertest');
const app = require('./app');
const db = require('../database');

const ADMIN_KEY = 'neocard_admin_demo_key_2024';
const SPONSOR_KEY = 'neocard_sponsor_demo_key_2024';

describe('Homework Review through the Ultra AI Core', () => {
  let deviceKey;

  beforeAll(async () => {
    await db.connect();
    const device = await db.createHardwareDevice({
      device_id: `hw_reader_${Date.now()}`,
      device_type: 'other',
      device_name: 'Homework reader',
      status: 'active'
    });
    deviceKey = device.api_key;
    const now = new Date().toISOString();
    await db.saveCampusLicense({
      tenant_id: 'SCHOOL-HW-A',
      school_name: 'Homework School',
      license_status: 'ACTIVE',
      seat_limit: 10,
      storage_quota_gb: 200,
      storage_used_gb: 0,
      expires_at: '2027-12-31T00:00:00.000Z',
      renewed_at: null,
      suspended_at: null,
      created_at: now,
      updated_at: now
    });
    await db.saveCampusLicense({
      tenant_id: 'SCHOOL-HW-B',
      school_name: 'Other School',
      license_status: 'ACTIVE',
      seat_limit: 10,
      storage_quota_gb: 200,
      storage_used_gb: 0,
      expires_at: '2027-12-31T00:00:00.000Z',
      renewed_at: null,
      suspended_at: null,
      created_at: now,
      updated_at: now
    });
    await db.replaceCampusDevices('SCHOOL-HW-A', [device.device_id]);
  });

  afterAll(async () => {
    await db.runSql("DELETE FROM ai_usage_logs WHERE tenant_id LIKE 'SCHOOL-HW-%'");
    await db.runSql("DELETE FROM campus_license_devices WHERE tenant_id LIKE 'SCHOOL-HW-%'");
    await db.runSql("DELETE FROM campus_licenses WHERE tenant_id LIKE 'SCHOOL-HW-%'");
    await db.runSql("DELETE FROM hardware_devices WHERE device_id LIKE 'hw_reader_%'");
    await db.close();
  });

  test('a review uses the shared core and records the homework module', async () => {
    const response = await request(app)
      .post('/v1/homework/review')
      .set('x-api-key', ADMIN_KEY)
      .send({
        tenant_id: 'SCHOOL-HW-A',
        user_id: 'student-1',
        role: 'student',
        subject: 'Mathematics',
        lesson: 'Addition',
        submission: '2 + 2 = 4'
      });
    expect(response.status).toBe(200);
    expect(response.body.data.module).toBe('homework');
    expect(response.body.data.use_case).toBe('homework');
    expect(response.body.data.source).toBe('mock');
    expect(response.body.data.tenant_id).toBe('SCHOOL-HW-A');

    const usage = await request(app)
      .get('/v1/ai/usage')
      .query({ tenant_id: 'SCHOOL-HW-A' })
      .set('x-api-key', ADMIN_KEY);
    expect(usage.body.data[0].module).toBe('homework');
  });

  test('a missing submission, the wrong school, and a sponsor key are rejected', async () => {
    const missing = await request(app)
      .post('/v1/homework/review')
      .set('x-api-key', ADMIN_KEY)
      .send({ tenant_id: 'SCHOOL-HW-A', user_id: 'student-1', role: 'student' });
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe('MISSING_FIELD');

    const otherSchool = await request(app)
      .post('/v1/homework/review')
      .set('x-api-key', deviceKey)
      .send({
        tenant_id: 'SCHOOL-HW-B',
        user_id: 'student-1',
        role: 'student',
        submission: '2 + 2 = 4'
      });
    expect(otherSchool.status).toBe(403);

    const sponsor = await request(app)
      .post('/v1/homework/review')
      .set('x-api-key', SPONSOR_KEY)
      .send({
        tenant_id: 'SCHOOL-HW-A',
        user_id: 'student-1',
        role: 'student',
        submission: '2 + 2 = 4'
      });
    expect(sponsor.status).toBe(401);
  });
});
