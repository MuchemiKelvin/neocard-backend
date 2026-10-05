const request = require('supertest');
const app = require('./app');
const db = require('../database');

const ADMIN_KEY = 'neocard_admin_demo_key_2024';
const SPONSOR_KEY = 'neocard_sponsor_demo_key_2024';

describe('Device Security Module V1 (NeoCard first device)', () => {
  let deviceA;
  let apiKeyA;
  let deviceB;
  let apiKeyB;

  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.runSql(`DELETE FROM device_unlock_tokens WHERE device_id LIKE 'sec_%'`);
    await db.runSql(`DELETE FROM neocare_proof_events WHERE user_uid LIKE 'sec_%'`);
    await db.runSql(`DELETE FROM hardware_devices WHERE device_id LIKE 'sec_%'`);
    await db.close();
  });

  async function createDevice(deviceType, name) {
    const created = await db.createHardwareDevice({
      device_id: `sec_${deviceType}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      device_type: deviceType,
      device_name: name,
      status: 'active'
    });
    return created;
  }

  test('acceptance: verification → offline → 24h restriction → unlock → audit → sync', async () => {
    const evidence = [];
    const note = (id, detail) => evidence.push({ id, result: 'PASS', detail });

    const neocard = await createDevice('neocard', 'NeoCard test reader');
    const other = await createDevice('campus_reader', 'Other campus reader');
    deviceA = neocard.device_id;
    apiKeyA = neocard.api_key;
    deviceB = other.device_id;
    apiKeyB = other.api_key;

    const verified = await request(app)
      .post('/v1/device-security/verification')
      .set('x-api-key', apiKeyA)
      .send({});
    expect(verified.status).toBe(201);
    expect(verified.body.data.device_id).toBe(deviceA);
    expect(verified.body.data.security_status).toBe('ACTIVE');
    expect(verified.body.data.last_valid_at).toBeTruthy();
    note('valid-verification', `device ${deviceA} ACTIVE`);

    const otherVerified = await request(app)
      .post('/v1/device-security/verification')
      .set('x-api-key', apiKeyB)
      .send({});
    expect(otherVerified.status).toBe(201);
    expect(otherVerified.body.data.device_id).toBe(deviceB);
    note('reusable-module', 'campus_reader used the same verification API');

    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    await db.runSql(
      'UPDATE hardware_devices SET last_valid_at = ? WHERE device_id = ?',
      [stale, deviceA]
    );
    const offlineRow = await db.getHardwareDevice(deviceA);
    expect(offlineRow.security_status).toBe('ACTIVE');
    expect(Date.now() - new Date(offlineRow.last_valid_at).getTime()).toBeGreaterThan(24 * 60 * 60 * 1000);
    note('offline-state', 'last valid checkpoint is older than 24 hours');

    const status = await request(app)
      .get('/v1/device-security/status')
      .set('x-api-key', apiKeyA);
    expect(status.status).toBe(200);
    expect(status.body.data.security_status).toBe('RESTRICTED');
    expect(status.body.data.restriction_reason).toBe('OFFLINE_24H');
    expect(status.body.data.offline_state).toBe('OFFLINE_RESTRICTED');
    note('restricted-mode', 'OFFLINE_24H');

    const selfClear = await request(app)
      .post('/v1/device-security/verification')
      .set('x-api-key', apiKeyA)
      .send({});
    expect(selfClear.status).toBe(403);
    expect(selfClear.body.code).toBe('DEVICE_RESTRICTED');

    const blocked = await request(app)
      .post('/v1/neocard/checkin')
      .set('x-api-key', apiKeyA)
      .send({ device_id: deviceA });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('DEVICE_RESTRICTED');
    note('risk-bearing-blocked', 'check-in 403 DEVICE_RESTRICTED');

    const reads = await request(app)
      .get('/v1/neocard/transactions')
      .set('x-api-key', apiKeyA);
    expect(reads.status).toBe(200);
    note('essential-read', 'transaction list remains available');

    const held = await request(app)
      .post('/v1/device-security/sync')
      .set('x-api-key', apiKeyA)
      .send({});
    expect(held.status).toBe(200);
    expect(held.body.data.sync_status).toBe('HELD');
    expect(held.body.data.security_status).toBe('RESTRICTED');
    note('sync-while-restricted', 'HELD, restriction unchanged');

    const sponsor = await request(app)
      .post('/v1/device-security/support/unlock')
      .set('x-api-key', SPONSOR_KEY)
      .send({ device_id: deviceA, authorized_by: 'sponsor' });
    expect(sponsor.status).toBe(403);
    expect(sponsor.body.code).toBe('SUPPORT_NOT_AUTHORIZED');

    const issued = await request(app)
      .post('/v1/device-security/support/unlock')
      .set('x-api-key', ADMIN_KEY)
      .send({ device_id: deviceA, authorized_by: 'helpdesk.nice' });
    expect(issued.status).toBe(201);
    expect(issued.body.data.device_id).toBe(deviceA);
    expect(issued.body.data.token).toBeTruthy();
    expect(issued.body.data.expires_at).toBeTruthy();
    const token = issued.body.data.token;
    note('support-verification', 'one-time token issued for this Device ID');

    const wrongDevice = await request(app)
      .post('/v1/device-security/unlock')
      .set('x-api-key', apiKeyB)
      .send({ token });
    expect(wrongDevice.status).toBe(403);
    expect(wrongDevice.body.code).toBe('TOKEN_DEVICE_MISMATCH');
    const stillRestricted = await request(app)
      .get('/v1/device-security/status')
      .set('x-api-key', apiKeyA);
    expect(stillRestricted.body.data.security_status).toBe('RESTRICTED');
    note('token-bound-to-device', 'other device rejected; NeoCard stays restricted');

    const unlocked = await request(app)
      .post('/v1/device-security/unlock')
      .set('x-api-key', apiKeyA)
      .send({ token });
    expect(unlocked.status).toBe(200);
    expect(unlocked.body.data.security_status).toBe('ACTIVE');
    expect(unlocked.body.data.device_id).toBe(deviceA);
    note('one-time-unlock', 'NeoCard ACTIVE');

    const reused = await request(app)
      .post('/v1/device-security/unlock')
      .set('x-api-key', apiKeyA)
      .send({ token });
    expect(reused.status).toBe(409);
    expect(reused.body.code).toBe('TOKEN_ALREADY_USED');
    note('token-not-reusable', 'second redeem rejected');

    const synced = await request(app)
      .post('/v1/device-security/sync')
      .set('x-api-key', apiKeyA)
      .send({});
    expect(synced.status).toBe(200);
    expect(synced.body.data.sync_status).toBe('SYNCED');
    expect(synced.body.data.security_status).toBe('ACTIVE');
    note('synchronization', 'SYNCED');

    const audit = await request(app)
      .get('/v1/device-security/audit')
      .set('x-api-key', apiKeyA);
    expect(audit.status).toBe(200);
    const events = audit.body.data;
    const restricted = events.find((event) => event.event === 'restricted');
    const support = events.find((event) => event.event === 'support_authorized');
    const unlock = events.find((event) => event.event === 'unlocked');
    const sync = events.filter((event) => event.event === 'sync');

    expect(restricted).toMatchObject({
      device_id: deviceA,
      reason: 'OFFLINE_24H',
      status: 'RESTRICTED'
    });
    expect(restricted.timestamp).toBeTruthy();
    expect(support).toMatchObject({
      device_id: deviceA,
      support_authorization: 'helpdesk.nice',
      status: 'RESTRICTED'
    });
    expect(unlock).toMatchObject({
      device_id: deviceA,
      status: 'ACTIVE',
      support_authorization: 'helpdesk.nice'
    });
    expect(sync.map((event) => event.sync_status)).toEqual(expect.arrayContaining(['HELD', 'SYNCED']));
    expect(events.every((event) => event.device_id === deviceA)).toBe(true);
    note('proof-audit', events.map((event) => event.event).join(' → '));

    console.log('DEVICE SECURITY V1 ACCEPTANCE');
    evidence.forEach((row) => {
      console.log(`${row.result}  ${row.id}  ${row.detail}`);
    });
  });

  test('expired unlock token does not clear Restricted Mode', async () => {
    const created = await createDevice('neocard', 'NeoCard expiry reader');
    const verified = await request(app)
      .post('/v1/device-security/verification')
      .set('x-api-key', created.api_key)
      .send({});
    expect(verified.status).toBe(201);

    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    await db.runSql(
      'UPDATE hardware_devices SET last_valid_at = ? WHERE device_id = ?',
      [stale, created.device_id]
    );

    const status = await request(app)
      .get('/v1/device-security/status')
      .set('x-api-key', created.api_key);
    expect(status.body.data.security_status).toBe('RESTRICTED');

    const issued = await request(app)
      .post('/v1/device-security/support/unlock')
      .set('x-api-key', ADMIN_KEY)
      .send({ device_id: created.device_id, authorized_by: 'helpdesk.nice' });
    expect(issued.status).toBe(201);

    await db.runSql(
      `UPDATE device_unlock_tokens SET expires_at = ? WHERE device_id = ? AND status = 'ISSUED'`,
      [new Date(Date.now() - 1000).toISOString(), created.device_id]
    );

    const expired = await request(app)
      .post('/v1/device-security/unlock')
      .set('x-api-key', created.api_key)
      .send({ token: issued.body.data.token });
    expect(expired.status).toBe(410);
    expect(expired.body.code).toBe('TOKEN_EXPIRED');

    const after = await request(app)
      .get('/v1/device-security/status')
      .set('x-api-key', created.api_key);
    expect(after.body.data.security_status).toBe('RESTRICTED');
  });

  test('a device with no checkpoint is not forced into Restricted Mode', async () => {
    const created = await createDevice('neocard', 'NeoCard unverified reader');
    const status = await request(app)
      .get('/v1/device-security/status')
      .set('x-api-key', created.api_key);
    expect(status.status).toBe(200);
    expect(status.body.data.security_status).toBe('ACTIVE');
    expect(status.body.data.offline_state).toBe('UNVERIFIED');

    const checkin = await request(app)
      .post('/v1/neocard/checkin')
      .set('x-api-key', created.api_key)
      .send({ device_id: created.device_id });
    expect(checkin.status).not.toBe(403);
    expect(checkin.body.code).not.toBe('DEVICE_RESTRICTED');
  });
});
