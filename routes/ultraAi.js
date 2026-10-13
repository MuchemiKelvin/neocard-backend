const express = require('express');
const router = express.Router();
const db = require('../database');
const ultraAi = require('../services/ultraAi');
const licenseServer = require('../services/licenseServer');

async function authenticateCaller(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!apiKey) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'API key required.' });
  }
  try {
    const device = await db.getHardwareDeviceByApiKey(apiKey);
    if (device) {
      req.aiAuth = { admin: false, deviceId: device.device_id };
      return next();
    }
    const keyData = await db.validateApiKey(apiKey);
    if (!keyData) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Invalid API key.' });
    }
    req.aiAuth = { admin: keyData.permissions === 'admin', deviceId: null };
    return next();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

router.post('/complete', authenticateCaller, async (req, res) => {
  try {
    const data = await ultraAi.complete(req.body || {}, req.aiAuth);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      code: error.code || 'AI_ERROR',
      message: error.message
    });
  }
});

router.get('/usage', authenticateCaller, async (req, res) => {
  try {
    const tenantId = String(req.query.tenant_id || '').trim();
    await licenseServer.validate({ tenant_id: tenantId, action: 'check' }, req.aiAuth);
    const data = await db.listAiUsageLogs(tenantId);
    return res.json({
      success: true,
      data: data.map((row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        user_id: row.user_id,
        role: row.role,
        module: row.module,
        use_case: row.use_case,
        provider_status: row.provider_status,
        cost: row.cost,
        error: row.error,
        created_at: row.created_at
      }))
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      code: error.code || 'AI_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
