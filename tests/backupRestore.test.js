const request = require('supertest');
const app = require('./app');
const db = require('../database');
const { QUOTA_BYTES } = require('../services/backupRestore');

const ADMIN_KEY = 'neocard_admin_demo_key_2024';
const SPONSOR_KEY = 'neocard_sponsor_demo_key_2024';

describe('Backup and 20 GB quota', () => {
  let deviceKey;

  beforeAll(async () => {
    await db.connect();
    const device = await db.createHardwareDevice({
      device_id: `bk_reader_${Date.now()}`,
      device_type: 'other',
      device_name: 'Backup reader',
      status: 'active'
    });
    deviceKey = device.api_key;
    const now = new Date().toISOString();
    await db.saveCampusLicense({
      tenant_id: 'SCHOOL-BK-A',
      school_name: 'Backup School',
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
    await db.replaceCampusDevices('SCHOOL-BK-A', [device.device_id]);
  });

  afterAll(async () => {
    await db.runSql("DELETE FROM campus_backups WHERE tenant_id LIKE 'SCHOOL-BK-%'");
    await db.runSql("DELETE FROM student_files WHERE tenant_id LIKE 'SCHOOL-BK-%'");
    await db.runSql("DELETE FROM student_storage WHERE tenant_id LIKE 'SCHOOL-BK-%'");
    await db.runSql("DELETE FROM campus_license_devices WHERE tenant_id LIKE 'SCHOOL-BK-%'");
    await db.runSql("DELETE FROM campus_licenses WHERE tenant_id LIKE 'SCHOOL-BK-%'");
    await db.runSql("DELETE FROM hardware_devices WHERE device_id LIKE 'bk_reader_%'");
    await db.close();
  });

  test('manual backup lists history and restore matches the checksum', async () => {
    const created = await request(app)
      .post('/v1/backups')
      .set('x-api-key', ADMIN_KEY)
      .send({ tenant_id: 'SCHOOL-BK-A' });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('SUCCESS');
    expect(created.body.data.version).toBeGreaterThan(0);
    expect(created.body.data.checksum).toHaveLength(64);

    const listed = await request(app)
      .get('/v1/backups')
      .query({ tenant_id: 'SCHOOL-BK-A' })
      .set('x-api-key', deviceKey);
    expect(listed.status).toBe(200);
    expect(listed.body.data[0].backup_id).toBe(created.body.data.backup_id);

    const restored = await request(app)
      .post(`/v1/backups/${created.body.data.backup_id}/restore`)
      .set('x-api-key', ADMIN_KEY);
    expect(restored.status).toBe(200);
    expect(restored.body.data.status).toBe('SUCCESS');
    expect(restored.body.data.checksum).toBe(created.body.data.checksum);
  });

  test('sponsor key and a missing school are rejected', async () => {
    const sponsor = await request(app)
      .post('/v1/backups')
      .set('x-api-key', SPONSOR_KEY)
      .send({ tenant_id: 'SCHOOL-BK-A' });
    expect(sponsor.status).toBe(403);
    expect(sponsor.body.code).toBe('UNAUTHORIZED');

    const missing = await request(app)
      .post('/v1/backups')
      .set('x-api-key', ADMIN_KEY)
      .send({ tenant_id: 'SCHOOL-BK-MISSING' });
    expect(missing.status).toBe(404);
  });

  test('20 GB quota warns at 80 and 90 percent and blocks at 100', async () => {
    const empty = await request(app)
      .get('/v1/storage/quota/STU-1')
      .query({ tenant_id: 'SCHOOL-BK-A' })
      .set('x-api-key', deviceKey);
    expect(empty.body.data.quota_bytes).toBe(QUOTA_BYTES);
    expect(empty.body.data.warning_level).toBe('NORMAL');

    const warning = await request(app)
      .post('/v1/storage/usage')
      .set('x-api-key', ADMIN_KEY)
      .send({ tenant_id: 'SCHOOL-BK-A', student_id: 'STU-1', bytes: QUOTA_BYTES * 0.8 });
    expect(warning.body.data.warning_level).toBe('WARNING_80');

    const high = await request(app)
      .post('/v1/storage/usage')
      .set('x-api-key', ADMIN_KEY)
      .send({ tenant_id: 'SCHOOL-BK-A', student_id: 'STU-1', bytes: QUOTA_BYTES * 0.1 });
    expect(high.body.data.warning_level).toBe('WARNING_90');

    const blocked = await request(app)
      .post('/v1/storage/usage')
      .set('x-api-key', ADMIN_KEY)
      .send({ tenant_id: 'SCHOOL-BK-A', student_id: 'STU-1', bytes: QUOTA_BYTES });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('QUOTA_FULL');

    const other = await request(app)
      .get('/v1/storage/quota/STU-2')
      .query({ tenant_id: 'SCHOOL-BK-A' })
      .set('x-api-key', deviceKey);
    expect(other.body.data.used_bytes).toBe(0);
  });

  test('a stored file counts its bytes against that student only', async () => {
    const content = Buffer.from('grade-2-notes').toString('base64');
    const stored = await request(app)
      .post('/v1/storage/files')
      .set('x-api-key', ADMIN_KEY)
      .send({
        tenant_id: 'SCHOOL-BK-A',
        student_id: 'STU-3',
        filename: 'notes.txt',
        content_base64: content
      });
    expect(stored.status).toBe(201);
    expect(stored.body.data.size_bytes).toBe(Buffer.from('grade-2-notes').length);
    expect(stored.body.data.quota.used_bytes).toBe(Buffer.from('grade-2-notes').length);

    const other = await request(app)
      .get('/v1/storage/quota/STU-4')
      .query({ tenant_id: 'SCHOOL-BK-A' })
      .set('x-api-key', deviceKey);
    expect(other.body.data.used_bytes).toBe(0);
  });
});
