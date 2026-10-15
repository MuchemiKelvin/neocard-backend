const request = require('supertest');
const app = require('./app');
const db = require('../database');

const ADMIN_KEY = 'neocard_admin_demo_key_2024';
const SPONSOR_KEY = 'neocard_sponsor_demo_key_2024';
const SECRET = 'test-secret-must-stay-on-server';

function license(tenantId) {
  const now = new Date().toISOString();
  return {
    tenant_id: tenantId,
    school_name: tenantId,
    license_status: 'ACTIVE',
    seat_limit: 10,
    storage_quota_gb: 200,
    storage_used_gb: 0,
    expires_at: '2027-12-31T00:00:00.000Z',
    renewed_at: null,
    suspended_at: null,
    created_at: now,
    updated_at: now
  };
}

describe('Master template backup and device delivery', () => {
  let deviceKey;
  const previous = {};

  beforeAll(async () => {
    ['B2_KEY_ID', 'B2_APPLICATION_KEY', 'B2_BUCKET_ID', 'B2_BUCKET_NAME'].forEach((name) => {
      previous[name] = process.env[name];
    });
    process.env.B2_KEY_ID = 'test-key';
    process.env.B2_APPLICATION_KEY = SECRET;
    process.env.B2_BUCKET_ID = 'bucket-test';
    process.env.B2_BUCKET_NAME = 'neocampus-test';
    await db.connect();
    const device = await db.createHardwareDevice({
      device_id: `tpl_reader_${Date.now()}`,
      device_type: 'other',
      device_name: 'Template reader',
      status: 'active'
    });
    deviceKey = device.api_key;
    await db.saveCampusLicense(license('SCHOOL-TPL-A'));
    await db.saveCampusLicense(license('SCHOOL-TPL-B'));
    await db.replaceCampusDevices('SCHOOL-TPL-A', [device.device_id]);
  });

  afterAll(async () => {
    Object.entries(previous).forEach(([name, value]) => {
      if (value == null) delete process.env[name];
      else process.env[name] = value;
    });
    await db.runSql("DELETE FROM template_deliveries WHERE tenant_id LIKE 'SCHOOL-TPL-%'");
    await db.runSql("DELETE FROM template_versions WHERE tenant_id LIKE 'SCHOOL-TPL-%'");
    await db.runSql("DELETE FROM campus_license_devices WHERE tenant_id LIKE 'SCHOOL-TPL-%'");
    await db.runSql("DELETE FROM campus_licenses WHERE tenant_id LIKE 'SCHOOL-TPL-%'");
    await db.runSql("DELETE FROM hardware_devices WHERE device_id LIKE 'tpl_reader_%'");
    await db.close();
  });

  test('a template is versioned, delivered to the school device, and restored', async () => {
    const content = Buffer.from('master-template-v1').toString('base64');
    const created = await request(app)
      .post('/v1/storage/templates')
      .set('x-api-key', ADMIN_KEY)
      .send({ tenant_id: 'SCHOOL-TPL-A', name: 'Grade 2 Addition', content_base64: content });
    expect(created.status).toBe(201);
    expect(created.body.data.version).toBe(1);
    expect(JSON.stringify(created.body)).not.toContain(SECRET);

    const next = await request(app)
      .post('/v1/storage/templates')
      .set('x-api-key', ADMIN_KEY)
      .send({
        tenant_id: 'SCHOOL-TPL-A',
        template_id: created.body.data.template_id,
        name: 'Grade 2 Addition',
        content_base64: Buffer.from('master-template-v2').toString('base64')
      });
    expect(next.body.data.version).toBe(2);

    const delivered = await request(app)
      .get(`/v1/storage/templates/${created.body.data.template_id}/sync`)
      .set('x-api-key', deviceKey);
    expect(delivered.status).toBe(200);
    expect(delivered.body.data.version).toBe(2);
    expect(Buffer.from(delivered.body.data.content_base64, 'base64').toString()).toBe('master-template-v2');
    expect(JSON.stringify(delivered.body)).not.toContain(SECRET);
    expect(delivered.body.data.b2_file_id).toBeUndefined();

    const restored = await request(app)
      .post(`/v1/storage/templates/${created.body.data.template_id}/restore`)
      .set('x-api-key', ADMIN_KEY)
      .send({ version: 1 });
    expect(restored.status).toBe(200);
    expect(restored.body.data.version).toBe(1);
    expect(Buffer.from(restored.body.data.content_base64, 'base64').toString()).toBe('master-template-v1');
  });

  test('a sponsor key and another school device cannot take the template', async () => {
    const created = await request(app)
      .post('/v1/storage/templates')
      .set('x-api-key', ADMIN_KEY)
      .send({
        tenant_id: 'SCHOOL-TPL-A',
        name: 'Private',
        content_base64: Buffer.from('school-a-only').toString('base64')
      });
    const sponsor = await request(app)
      .get(`/v1/storage/templates/${created.body.data.template_id}/sync`)
      .set('x-api-key', SPONSOR_KEY);
    expect(sponsor.status).toBe(403);

    const outsider = await db.createHardwareDevice({
      device_id: `tpl_other_${Date.now()}`,
      device_type: 'other',
      device_name: 'Other reader',
      status: 'active'
    });
    await db.replaceCampusDevices('SCHOOL-TPL-B', [outsider.device_id]);
    const blocked = await request(app)
      .get(`/v1/storage/templates/${created.body.data.template_id}/sync`)
      .set('x-api-key', outsider.api_key);
    expect(blocked.status).toBe(403);
  });
});
