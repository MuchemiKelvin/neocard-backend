const request = require('supertest');
const app = require('./app');
const db = require('../database');

const ADMIN_KEY = 'neocard_admin_demo_key_2024';
const SPONSOR_KEY = 'neocard_sponsor_demo_key_2024';

describe('Central License Server V1', () => {
  let deviceId;
  let deviceKey;
  let otherDeviceId;

  beforeAll(async () => {
    await db.connect();
    const device = await db.createHardwareDevice({
      device_id: `lic_neocard_${Date.now()}`,
      device_type: 'neocard',
      device_name: 'License test NeoCard',
      status: 'active'
    });
    const other = await db.createHardwareDevice({
      device_id: `lic_other_${Date.now()}`,
      device_type: 'neoglass',
      device_name: 'Unlinked device',
      status: 'active'
    });
    deviceId = device.device_id;
    deviceKey = device.api_key;
    otherDeviceId = other.device_id;
  });

  afterAll(async () => {
    await db.runSql(`DELETE FROM campus_license_seats WHERE tenant_id LIKE 'SCHOOL-TEST-%'`);
    await db.runSql(`DELETE FROM campus_license_entitlements WHERE tenant_id LIKE 'SCHOOL-TEST-%'`);
    await db.runSql(`DELETE FROM campus_license_devices WHERE tenant_id LIKE 'SCHOOL-TEST-%'`);
    await db.runSql(`DELETE FROM campus_licenses WHERE tenant_id LIKE 'SCHOOL-TEST-%'`);
    await db.runSql(`DELETE FROM neocare_proof_events WHERE user_uid LIKE 'SCHOOL-TEST-%'`);
    await db.runSql(`DELETE FROM hardware_devices WHERE device_id LIKE 'lic_%'`);
    await db.close();
  });

  async function createLicense(overrides = {}) {
    const tenantId = overrides.tenant_id || `SCHOOL-TEST-${Date.now()}`;
    const response = await request(app)
      .post('/v1/license')
      .set('x-api-key', ADMIN_KEY)
      .send({
        tenant_id: tenantId,
        school_name: 'Greenfield School',
        license_status: 'ACTIVE',
        seat_limit: 100,
        storage_quota_gb: 2000,
        storage_used_gb: 0,
        expires_at: '2027-12-31T00:00:00.000Z',
        products: ['NEOSCHOOL', 'NEOCARD'],
        device_ids: [deviceId],
        ...overrides,
        tenant_id: tenantId
      });
    expect(response.status).toBe(201);
    return response.body.data;
  }

  test('active license allows access and matches the license read', async () => {
    const license = await createLicense();
    const decision = await request(app)
      .post('/v1/license/validate')
      .set('x-api-key', ADMIN_KEY)
      .send({
        tenant_id: license.tenant_id,
        user_id: 'student-1',
        product: 'NEOSCHOOL',
        device_id: deviceId
      });

    expect(decision.status).toBe(200);
    expect(decision.body.decision).toBe('ALLOW');
    expect(decision.body.license_status).toBe('ACTIVE');
    expect(decision.body.entitled).toBe(true);
    expect(decision.body.device_authorized).toBe(true);

    const same = await request(app)
      .get(`/v1/license/${license.tenant_id}`)
      .set('x-api-key', ADMIN_KEY);
    expect(same.body.data.seat_limit).toBe(decision.body.seat_limit);
    expect(same.body.data.license_status).toBe('ACTIVE');
    expect(same.body.data.products).toEqual(expect.arrayContaining(['NEOSCHOOL', 'NEOCARD']));
    expect(same.body.data.devices).toEqual([deviceId]);
  });

  test('expired and suspended licenses are denied', async () => {
    const license = await createLicense();
    const expired = await request(app)
      .post(`/v1/license/${license.tenant_id}/status`)
      .set('x-api-key', ADMIN_KEY)
      .send({ license_status: 'EXPIRED' });
    expect(expired.status).toBe(200);

    const denied = await request(app)
      .post('/v1/license/validate')
      .set('x-api-key', ADMIN_KEY)
      .send({ tenant_id: license.tenant_id, product: 'NEOSCHOOL' });
    expect(denied.status).toBe(403);
    expect(denied.body.decision).toBe('DENY');
    expect(denied.body.code).toBe('LICENSE_EXPIRED');

    await request(app)
      .post(`/v1/license/${license.tenant_id}/status`)
      .set('x-api-key', ADMIN_KEY)
      .send({ license_status: 'SUSPENDED', expires_at: '2027-12-31T00:00:00.000Z' });
    const suspended = await request(app)
      .post('/v1/license/validate')
      .set('x-api-key', ADMIN_KEY)
      .send({ tenant_id: license.tenant_id, product: 'NEOSCHOOL' });
    expect(suspended.body.code).toBe('LICENSE_SUSPENDED');
  });

  test('seat 101 is rejected on a 100-seat license', async () => {
    const license = await createLicense({ seat_limit: 100 });
    for (let i = 1; i <= 100; i += 1) {
      const ok = await request(app)
        .post('/v1/license/validate')
        .set('x-api-key', ADMIN_KEY)
        .send({
          tenant_id: license.tenant_id,
          user_id: `student-${i}`,
          product: 'NEOSCHOOL',
          action: 'activate'
        });
      expect(ok.status).toBe(200);
    }

    const blocked = await request(app)
      .post('/v1/license/validate')
      .set('x-api-key', ADMIN_KEY)
      .send({
        tenant_id: license.tenant_id,
        user_id: 'student-101',
        product: 'NEOSCHOOL',
        action: 'activate'
      });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('SEAT_LIMIT_REACHED');
    expect(blocked.body.active_seats).toBe(100);
  });

  test('a product outside the entitlement is denied', async () => {
    const license = await createLicense();
    const response = await request(app)
      .post('/v1/license/validate')
      .set('x-api-key', ADMIN_KEY)
      .send({ tenant_id: license.tenant_id, product: 'NEOGLASS' });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('PRODUCT_NOT_ENTITLED');
  });

  test('device authorization and tenant isolation', async () => {
    const license = await createLicense();
    const allowed = await request(app)
      .post('/v1/license/device/validate')
      .set('x-api-key', deviceKey)
      .send({ tenant_id: license.tenant_id, device_id: deviceId, product: 'NEOCARD' });
    expect(allowed.status).toBe(200);
    expect(allowed.body.device_authorized).toBe(true);

    const rejected = await request(app)
      .post('/v1/license/device/validate')
      .set('x-api-key', ADMIN_KEY)
      .send({ tenant_id: license.tenant_id, device_id: otherDeviceId, product: 'NEOCARD' });
    expect(rejected.status).toBe(403);
    expect(rejected.body.code).toBe('DEVICE_NOT_AUTHORIZED');

    const otherSchool = await createLicense({ products: ['NEOSCHOOL'], device_ids: [] });
    const isolated = await request(app)
      .get(`/v1/license/${otherSchool.tenant_id}`)
      .set('x-api-key', deviceKey);
    expect(isolated.status).toBe(403);

    const sponsor = await request(app)
      .post('/v1/license')
      .set('x-api-key', SPONSOR_KEY)
      .send({ tenant_id: 'SCHOOL-TEST-NOPE', seat_limit: 1, products: ['NEOSCHOOL'] });
    expect(sponsor.status).toBe(403);
    expect(sponsor.body.code).toBe('UNAUTHORIZED');
  });

  test('a past expiry date denies an otherwise active license', async () => {
    const license = await createLicense({ expires_at: '2020-01-01T00:00:00.000Z' });
    const response = await request(app)
      .post('/v1/license/validate')
      .set('x-api-key', ADMIN_KEY)
      .send({ tenant_id: license.tenant_id, product: 'NEOSCHOOL' });
    expect(response.status).toBe(403);
    expect(response.body.decision).toBe('DENY');
    expect(response.body.code).toBe('LICENSE_EXPIRED');
  });

  test('storage above the quota is denied and a request inside the quota is allowed', async () => {
    const license = await createLicense({ storage_quota_gb: 20, storage_used_gb: 18 });
    const blocked = await request(app)
      .post('/v1/license/validate')
      .set('x-api-key', ADMIN_KEY)
      .send({ tenant_id: license.tenant_id, product: 'NEOSCHOOL', storage_gb: 5 });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('STORAGE_QUOTA_EXCEEDED');

    const allowed = await request(app)
      .post('/v1/license/validate')
      .set('x-api-key', ADMIN_KEY)
      .send({ tenant_id: license.tenant_id, product: 'NEOSCHOOL', storage_gb: 2 });
    expect(allowed.status).toBe(200);
    expect(allowed.body.decision).toBe('ALLOW');
  });

  test('activating the same user twice does not consume a second seat', async () => {
    const license = await createLicense({ seat_limit: 1 });
    const first = await request(app)
      .post('/v1/license/validate')
      .set('x-api-key', ADMIN_KEY)
      .send({
        tenant_id: license.tenant_id,
        user_id: 'student-1',
        product: 'NEOSCHOOL',
        action: 'activate'
      });
    expect(first.status).toBe(200);
    expect(first.body.active_seats).toBe(1);

    const again = await request(app)
      .post('/v1/license/validate')
      .set('x-api-key', ADMIN_KEY)
      .send({
        tenant_id: license.tenant_id,
        user_id: 'student-1',
        product: 'NEOSCHOOL',
        action: 'activate'
      });
    expect(again.status).toBe(200);
    expect(again.body.active_seats).toBe(1);
  });

  test('a missing key is unauthorized and an unknown school is not found', async () => {
    const missingKey = await request(app)
      .post('/v1/license/validate')
      .send({ tenant_id: 'SCHOOL-TEST-NONE', product: 'NEOSCHOOL' });
    expect(missingKey.status).toBe(401);
    expect(missingKey.body.code).toBe('UNAUTHORIZED');

    const missingSchool = await request(app)
      .post('/v1/license/validate')
      .set('x-api-key', ADMIN_KEY)
      .send({ tenant_id: 'SCHOOL-TEST-MISSING', product: 'NEOSCHOOL' });
    expect(missingSchool.status).toBe(404);
    expect(missingSchool.body.code).toBe('TENANT_NOT_FOUND');
  });

  test('license decisions are written to the existing proof log', async () => {
    const license = await createLicense();
    await request(app)
      .post('/v1/license/validate')
      .set('x-api-key', ADMIN_KEY)
      .send({ tenant_id: license.tenant_id, product: 'NEOSCHOOL' });

    const events = await db.getProofEvents({ user_uid: license.tenant_id });
    expect(events.some((event) => event.action === 'license.validate')).toBe(true);
    expect(events.some((event) => event.action === 'license.admin_update')).toBe(true);
  });
});
