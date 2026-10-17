const request = require('supertest');
const app = require('./app');
const db = require('../database');

const ADMIN_KEY = 'neocard_admin_demo_key_2024';
const SPONSOR_KEY = 'neocard_sponsor_demo_key_2024';

function license(tenantId, schoolName) {
  const now = new Date().toISOString();
  return {
    tenant_id: tenantId,
    school_name: schoolName,
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

describe('Ultra AI and App Builder', () => {
  let deviceKey;

  beforeAll(async () => {
    await db.connect();
    const device = await db.createHardwareDevice({
      device_id: `ai_reader_${Date.now()}`,
      device_type: 'other',
      device_name: 'AI reader',
      status: 'active'
    });
    deviceKey = device.api_key;
    await db.saveCampusLicense(license('SCHOOL-AI-A', 'AI School A'));
    await db.saveCampusLicense(license('SCHOOL-AI-B', 'AI School B'));
    await db.replaceCampusDevices('SCHOOL-AI-A', [device.device_id]);
  });

  afterAll(async () => {
    await db.runSql("DELETE FROM app_lessons WHERE tenant_id LIKE 'SCHOOL-AI-%'");
    await db.runSql("DELETE FROM ai_usage_logs WHERE tenant_id LIKE 'SCHOOL-AI-%'");
    await db.runSql("DELETE FROM campus_license_devices WHERE tenant_id LIKE 'SCHOOL-AI-%'");
    await db.runSql("DELETE FROM campus_licenses WHERE tenant_id LIKE 'SCHOOL-AI-%'");
    await db.runSql("DELETE FROM hardware_devices WHERE device_id LIKE 'ai_reader_%'");
    await db.close();
  });

  test('a mock completion carries school, user, role, and module', async () => {
    const response = await request(app)
      .post('/v1/ai/complete')
      .set('x-api-key', ADMIN_KEY)
      .send({
        tenant_id: 'SCHOOL-AI-A',
        user_id: 'teacher-1',
        role: 'teacher',
        module: 'neoschool',
        prompt: 'Grade 2 addition'
      });
    expect(response.status).toBe(200);
    expect(response.body.data.source).toBe('mock');
    expect(response.body.data.use_case).toBe('lesson');
    expect(response.body.data.tenant_id).toBe('SCHOOL-AI-A');

    const usage = await request(app)
      .get('/v1/ai/usage')
      .query({ tenant_id: 'SCHOOL-AI-A' })
      .set('x-api-key', ADMIN_KEY);
    expect(usage.status).toBe(200);
    expect(usage.body.data[0].provider_status).toBe('MOCK');
    expect(usage.body.data[0].cost).toBe(0);
    expect(JSON.stringify(usage.body.data)).not.toMatch(/api_key|Bearer/i);
  });

  test('the wrong school and a sponsor key are rejected', async () => {
    const otherSchool = await request(app)
      .post('/v1/ai/complete')
      .set('x-api-key', deviceKey)
      .send({
        tenant_id: 'SCHOOL-AI-B',
        user_id: 'teacher-1',
        role: 'teacher',
        module: 'neoschool'
      });
    expect(otherSchool.status).toBe(403);

    const sponsor = await request(app)
      .post('/v1/ai/complete')
      .set('x-api-key', SPONSOR_KEY)
      .send({
        tenant_id: 'SCHOOL-AI-A',
        user_id: 'teacher-1',
        role: 'teacher',
        module: 'neoschool'
      });
    expect(sponsor.status).toBe(401);
  });

  test('live mode without a provider is logged as a failure', async () => {
    const previousMode = process.env.AI_MODE;
    process.env.AI_MODE = 'live';
    delete process.env.AI_PROVIDER_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const response = await request(app)
        .post('/v1/ai/complete')
        .set('x-api-key', ADMIN_KEY)
        .send({
          tenant_id: 'SCHOOL-AI-A',
          user_id: 'teacher-1',
          role: 'teacher',
          module: 'sponsor'
        });
      expect(response.status).toBe(502);
      expect(response.body.code).toBe('PROVIDER_UNAVAILABLE');
      const logs = await db.listAiUsageLogs('SCHOOL-AI-A');
      expect(logs[0].provider_status).toBe('FAILED');
      expect(logs[0].use_case).toBe('sponsor');
    } finally {
      if (previousMode == null) delete process.env.AI_MODE;
      else process.env.AI_MODE = previousMode;
    }
  });

  test('a live Gemini call records tokens and cost and stays off the client', async () => {
    const previousMode = process.env.AI_MODE;
    const previousKey = process.env.GEMINI_API_KEY;
    process.env.AI_MODE = 'live';
    process.env.GEMINI_API_KEY = 'test-key';
    try {
      const response = await request(app)
        .post('/v1/ai/complete')
        .set('x-api-key', ADMIN_KEY)
        .send({
          tenant_id: 'SCHOOL-AI-A',
          user_id: 'teacher-1',
          role: 'teacher',
          module: 'app_builder',
          prompt: 'Create a Mathematics Grade 2 lesson about addition.'
        });
      expect(response.status).toBe(200);
      expect(response.body.data.source).toBe('gemini');
      expect(response.body.data.input_tokens).toBe(12);
      expect(response.body.data.output_tokens).toBe(20);
      expect(response.body.data.cost).toBeGreaterThan(0);
      expect(JSON.stringify(response.body)).not.toContain('test-key');

      const lesson = await request(app)
        .post('/v1/app-builder/lessons')
        .set('x-api-key', ADMIN_KEY)
        .send({
          tenant_id: 'SCHOOL-AI-A',
          user_id: 'teacher-1',
          role: 'teacher',
          grade: '2',
          subject: 'Mathematics',
          topic: 'Addition'
        });
      expect(lesson.status).toBe(201);
      expect(lesson.body.data.source).toBe('gemini');
      expect(lesson.body.data.lesson.content).toContain('Gemini draft');
      expect(JSON.stringify(lesson.body)).not.toContain('test-key');
    } finally {
      if (previousMode == null) delete process.env.AI_MODE;
      else process.env.AI_MODE = previousMode;
      if (previousKey == null) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousKey;
    }
  });

  test('a grade 2 addition lesson can be previewed, saved, and published', async () => {
    const created = await request(app)
      .post('/v1/app-builder/lessons')
      .set('x-api-key', ADMIN_KEY)
      .send({
        tenant_id: 'SCHOOL-AI-A',
        user_id: 'teacher-1',
        role: 'teacher',
        grade: '2',
        subject: 'Mathematics',
        topic: 'Addition'
      });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('DRAFT');
    expect(created.body.data.source).toBe('mock');
    expect(created.body.data.lesson.topic).toBe('Addition');
    expect(created.body.data.lesson.grade).toBe('2');

    const preview = await request(app)
      .get(`/v1/app-builder/lessons/${created.body.data.lesson_id}`)
      .set('x-api-key', deviceKey);
    expect(preview.status).toBe(200);

    const saved = await request(app)
      .post(`/v1/app-builder/lessons/${created.body.data.lesson_id}/save`)
      .set('x-api-key', ADMIN_KEY);
    expect(saved.body.data.status).toBe('SAVED');

    const published = await request(app)
      .post(`/v1/app-builder/lessons/${created.body.data.lesson_id}/publish`)
      .set('x-api-key', ADMIN_KEY);
    expect(published.body.data.status).toBe('PUBLISHED');

    const blocked = await request(app)
      .get(`/v1/app-builder/lessons/${created.body.data.lesson_id}`)
      .set('x-api-key', SPONSOR_KEY);
    expect(blocked.status).toBe(401);
  });
});
