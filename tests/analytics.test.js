const request = require('supertest');
const app = require('./app');
const db = require('../database');

const ADMIN_KEY = 'neocard_admin_demo_key_2024';
const SPONSOR_KEY = 'neocard_sponsor_demo_key_2024';

describe('Sponsor Analytics and Analytics V1', () => {
  let deviceKey;
  let deviceId;

  beforeAll(async () => {
    await db.connect();
    await db.runSql(`DELETE FROM analytics_events WHERE event_id LIKE 'evt-%'`);
    const device = await db.createHardwareDevice({
      device_id: `an_reader_${Date.now()}`,
      device_type: 'other',
      device_name: 'Analytics reader',
      status: 'active'
    });
    deviceId = device.device_id;
    deviceKey = device.api_key;
    await db.saveCampusLicense({
      tenant_id: 'SCHOOL-AN-A',
      school_name: 'School A',
      license_status: 'ACTIVE',
      seat_limit: 10,
      storage_quota_gb: 200,
      storage_used_gb: 0,
      expires_at: '2027-12-31T00:00:00.000Z',
      renewed_at: null,
      suspended_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    await db.replaceCampusDevices('SCHOOL-AN-A', [deviceId]);
    await db.insertScan({
      scan_id: `scan_an_${Date.now()}_1`,
      uid: 'CARD-1',
      campaign_id: 'CAMP-1',
      timestamp: '2026-10-01T10:00:00.000Z',
      checksum: 'a',
      verified: 1
    });
    await db.insertScan({
      scan_id: `scan_an_${Date.now()}_2`,
      uid: 'CARD-1',
      campaign_id: 'CAMP-1',
      timestamp: '2026-10-02T10:00:00.000Z',
      checksum: 'b',
      verified: 1
    });
  });

  afterAll(async () => {
    await db.runSql(`DELETE FROM analytics_events WHERE tenant_id LIKE 'SCHOOL-AN-%'`);
    await db.runSql(`DELETE FROM campus_license_devices WHERE tenant_id LIKE 'SCHOOL-AN-%'`);
    await db.runSql(`DELETE FROM campus_licenses WHERE tenant_id LIKE 'SCHOOL-AN-%'`);
    await db.runSql(`DELETE FROM scans WHERE uid = 'CARD-1'`);
    await db.runSql(`DELETE FROM hardware_devices WHERE device_id LIKE 'an_reader_%'`);
    await db.close();
  });

  test('proof layers count verified scans and repeat engagement', async () => {
    const response = await request(app)
      .get('/v1/analytics/proof-layers')
      .set('x-api-key', ADMIN_KEY);
    expect(response.status).toBe(200);
    expect(response.body.layers.verified_participation.supported).toBe(true);
    expect(response.body.layers.verified_participation.count).toBeGreaterThanOrEqual(2);
    expect(response.body.layers.repeat_engagement.count).toBeGreaterThanOrEqual(1);
    expect(response.body.layers.cross_channel_journey.supported).toBe(false);
    expect(response.body.layers.cross_channel_journey.missing).toEqual(['channel', 'shared_person_id']);
  });

  test('proof layers count events that carry the required fields', async () => {
    const fields = {
      channel: 'school',
      shared_person_id: 'person-1',
      lesson_id: 'lesson-1',
      offline_source: 'card',
      outcome_type: 'attendance',
      verified_result: 'present',
      sponsor_id: 'sponsor-1',
      period: '2026-10'
    };
    await request(app)
      .post('/v1/analytics/events')
      .set('x-api-key', ADMIN_KEY)
      .send({
        event_id: 'evt-layers-1',
        tenant_id: 'SCHOOL-AN-A',
        user_id: 'student-1',
        module: 'sponsor',
        event_type: 'journey',
        timestamp: '2026-09-01T11:00:00.000Z',
        metadata: fields
      });
    await request(app)
      .post('/v1/analytics/events')
      .set('x-api-key', ADMIN_KEY)
      .send({
        event_id: 'evt-layers-2',
        tenant_id: 'SCHOOL-AN-A',
        user_id: 'student-1',
        module: 'sponsor',
        event_type: 'journey',
        timestamp: '2026-09-01T11:05:00.000Z',
        metadata: { ...fields, channel: 'card' }
      });

    const response = await request(app)
      .get('/v1/analytics/proof-layers')
      .set('x-api-key', ADMIN_KEY);
    expect(response.body.layers.cross_channel_journey.supported).toBe(true);
    expect(response.body.layers.cross_channel_journey.count).toBeGreaterThanOrEqual(1);
    expect(response.body.layers.educational_engagement.supported).toBe(true);
    expect(response.body.layers.offline_to_online_impact.count).toBeGreaterThanOrEqual(2);
    expect(response.body.layers.verified_outcomes.supported).toBe(true);
    expect(response.body.layers.long_term_sponsor_impact.supported).toBe(true);
  });

  test('an event is recorded and a duplicate or incomplete event is rejected', async () => {
    const created = await request(app)
      .post('/v1/analytics/events')
      .set('x-api-key', ADMIN_KEY)
      .send({
        event_id: 'evt-school-a-1',
        tenant_id: 'SCHOOL-AN-A',
        user_id: 'student-1',
        module: 'neocard',
        event_type: 'sponsor_interaction',
        timestamp: '2026-10-11T08:00:00.000Z'
      });
    expect(created.status).toBe(201);

    const duplicate = await request(app)
      .post('/v1/analytics/events')
      .set('x-api-key', ADMIN_KEY)
      .send({
        event_id: 'evt-school-a-1',
        tenant_id: 'SCHOOL-AN-A',
        module: 'neocard',
        event_type: 'sponsor_interaction'
      });
    expect(duplicate.status).toBe(409);

    const missing = await request(app)
      .post('/v1/analytics/events')
      .set('x-api-key', ADMIN_KEY)
      .send({ tenant_id: 'SCHOOL-AN-A' });
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe('MISSING_FIELD');
  });

  test('summary totals the school and hides another school', async () => {
    await request(app)
      .post('/v1/analytics/events')
      .set('x-api-key', ADMIN_KEY)
      .send({
        event_id: 'evt-school-a-2',
        tenant_id: 'SCHOOL-AN-A',
        user_id: 'student-2',
        module: 'neoschool',
        event_type: 'lesson_completed',
        timestamp: '2026-10-11T09:00:00.000Z'
      });

    const summary = await request(app)
      .get('/v1/analytics/summary')
      .query({ tenant_id: 'SCHOOL-AN-A', from: '2026-10-11T00:00:00.000Z', to: '2026-10-11T23:59:59.000Z' })
      .set('x-api-key', deviceKey);
    expect(summary.status).toBe(200);
    expect(summary.body.data.events).toBe(2);
    expect(summary.body.data.active_users).toBe(2);
    expect(summary.body.data.sponsor_interactions).toBe(1);
    expect(summary.body.data.lessons_completed).toBe(1);

    const outside = await request(app)
      .get('/v1/analytics/summary')
      .query({ tenant_id: 'SCHOOL-AN-A', from: '2026-10-12T00:00:00.000Z' })
      .set('x-api-key', ADMIN_KEY);
    expect(outside.body.data.events).toBe(0);

    const blocked = await request(app)
      .get('/v1/analytics/summary')
      .query({ tenant_id: 'SCHOOL-AN-B' })
      .set('x-api-key', deviceKey);
    expect(blocked.status).toBe(403);

    const sponsor = await request(app)
      .get('/v1/analytics/summary')
      .query({ tenant_id: 'SCHOOL-AN-A' })
      .set('x-api-key', SPONSOR_KEY);
    expect(sponsor.status).toBe(403);
  });
});
