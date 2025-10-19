// Test suite for Neo Card™ Demo Backend

const request = require('supertest');
const app = require('./app');
const db = require('../database');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Use random available port for tests
process.env.DB_PATH = './database/test_neocard.db'; // Use test database

describe('Neo Card™ Demo Backend API Tests', () => {
  beforeAll(async () => {
    // Ensure database is connected
    await db.connect();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    // Clear scans table before each test
    await new Promise((resolve, reject) => {
      db.db.run('DELETE FROM scans', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  describe('Health Check', () => {
    test('GET /health should return server status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body.message).toBe('Neo Card™ Demo Backend is running');
      expect(response.body.version).toBe('1.0.0');
    });
  });

  describe('Scan Endpoint', () => {
    test('POST /v1/scan should register a valid scan', async () => {
      const scanData = {
        uid: 'TEST123456',
        campaign_id: 'DEMO01'
      };

      const response = await request(app)
        .post('/v1/scan')
        .send(scanData)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Scan registered successfully');
      expect(response.body.data.uid).toBe(scanData.uid);
      expect(response.body.data.campaign_id).toBe(scanData.campaign_id);
      expect(response.body.data.checksum).toBeDefined();
      expect(response.body.data.verified).toBe(true);
    });

    test('POST /v1/scan should reject scan without UID', async () => {
      const response = await request(app)
        .post('/v1/scan')
        .send({ campaign_id: 'DEMO01' })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('UID is required');
      expect(response.body.code).toBe('MISSING_UID');
    });

    test('POST /v1/scan should reject scan without campaign_id', async () => {
      const response = await request(app)
        .post('/v1/scan')
        .send({ uid: 'TEST123456' })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Campaign ID is required');
      expect(response.body.code).toBe('MISSING_CAMPAIGN_ID');
    });

    test('POST /v1/scan should reject invalid UID format', async () => {
      const response = await request(app)
        .post('/v1/scan')
        .send({ uid: 'INVALID', campaign_id: 'DEMO01' })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Invalid UID format');
      expect(response.body.code).toBe('INVALID_UID_FORMAT');
    });

    test('POST /v1/scan should enforce cooldown period', async () => {
      const scanData = {
        uid: 'COOLDOWN123456', // Valid UID format
        campaign_id: 'DEMO01'
      };

      // First scan should succeed
      await request(app)
        .post('/v1/scan')
        .send(scanData)
        .expect(201);

      // Second scan should be blocked by cooldown
      const response = await request(app)
        .post('/v1/scan')
        .send(scanData)
        .expect(429);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Scan blocked: within cooldown period');
      expect(response.body.code).toBe('COOLDOWN_ACTIVE');
      expect(response.body.cooldownMinutes).toBe(5);
    });
  });

  describe('Logs Endpoint', () => {
    test('GET /v1/logs should require API key', async () => {
      const response = await request(app)
        .get('/v1/logs')
        .expect(401);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('API key required');
      expect(response.body.code).toBe('MISSING_API_KEY');
    });

    test('GET /v1/logs should reject invalid API key', async () => {
      const response = await request(app)
        .get('/v1/logs')
        .set('x-api-key', 'invalid_key')
        .expect(401);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Invalid API key');
      expect(response.body.code).toBe('INVALID_API_KEY');
    });

    test('GET /v1/logs should return scans with valid API key', async () => {
      const response = await request(app)
        .get('/v1/logs')
        .set('x-api-key', 'neocard_admin_demo_key_2024')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Logs retrieved successfully');
      expect(response.body.data.scans).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
    });

    test('GET /v1/logs should support filtering by UID', async () => {
      const response = await request(app)
        .get('/v1/logs?uid=TEST123456')
        .set('x-api-key', 'neocard_admin_demo_key_2024')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.scans).toBeDefined();
    });
  });

  describe('CSV Export Endpoint', () => {
    test('GET /v1/export/csv should require API key', async () => {
      const response = await request(app)
        .get('/v1/export/csv')
        .expect(401);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('API key required');
    });

    test('GET /v1/export/csv should return CSV with valid API key', async () => {
      const response = await request(app)
        .get('/v1/export/csv')
        .set('x-api-key', 'neocard_admin_demo_key_2024')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain('Scan ID,UID,Campaign ID,Timestamp,Checksum,Verified');
    });
  });

  describe('Stats Endpoint', () => {
    test('GET /v1/stats should require API key', async () => {
      const response = await request(app)
        .get('/v1/stats')
        .expect(401);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('API key required');
    });

    test('GET /v1/stats should return statistics with valid API key', async () => {
      const response = await request(app)
        .get('/v1/stats')
        .set('x-api-key', 'neocard_admin_demo_key_2024')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Statistics retrieved successfully');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalScans).toBeDefined();
      expect(response.body.data.todayScans).toBeDefined();
      expect(response.body.data.uniqueUids).toBeDefined();
    });
  });

  describe('AEI Security', () => {
    test('AEI checksum should be consistent for same input', async () => {
      const { generateAEIChecksum } = require('../utils');
      const config = require('../config');

      const uid = 'TEST123456';
      const timestamp = '2025-10-19T10:00:00.000Z';
      const campaignId = 'DEMO01';

      const checksum1 = generateAEIChecksum(uid, timestamp, campaignId, config.security.aeiSecretKey);
      const checksum2 = generateAEIChecksum(uid, timestamp, campaignId, config.security.aeiSecretKey);

      expect(checksum1).toBe(checksum2);
    });

    test('AEI checksum should be different for different inputs', async () => {
      const { generateAEIChecksum } = require('../utils');
      const config = require('../config');

      const uid1 = 'TEST123456';
      const uid2 = 'TEST123457';
      const timestamp = '2025-10-19T10:00:00.000Z';
      const campaignId = 'DEMO01';

      const checksum1 = generateAEIChecksum(uid1, timestamp, campaignId, config.security.aeiSecretKey);
      const checksum2 = generateAEIChecksum(uid2, timestamp, campaignId, config.security.aeiSecretKey);

      expect(checksum1).not.toBe(checksum2);
    });
  });

  describe('Error Handling', () => {
    test('Should handle 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/non-existent-endpoint')
        .expect(404);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Endpoint not found');
    });
  });
});
