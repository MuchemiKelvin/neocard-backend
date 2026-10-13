const express = require('express');
const router = express.Router();
const db = require('../database');
const analytics = require('../services/analytics');

async function authenticateAnalyticsCaller(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!apiKey) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'API key required.' });
  }
  try {
    const device = await db.getHardwareDeviceByApiKey(apiKey);
    if (device) {
      req.analyticsAuth = { admin: false, deviceId: device.device_id };
      return next();
    }
    const keyData = await db.validateApiKey(apiKey);
    if (!keyData) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Invalid API key.' });
    }
    req.analyticsAuth = { admin: keyData.permissions === 'admin', deviceId: null };
    return next();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

function sendError(res, error) {
  return res.status(error.status || 500).json({
    success: false,
    code: error.code || 'ANALYTICS_ERROR',
    message: error.message
  });
}

router.get('/proof-layers', authenticateAnalyticsCaller, async (req, res) => {
  try {
    const layers = await analytics.proofLayers();
    return res.json({ success: true, layers });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/events', authenticateAnalyticsCaller, async (req, res) => {
  try {
    const data = await analytics.recordEvent(req.body, req.analyticsAuth);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/summary', authenticateAnalyticsCaller, async (req, res) => {
  try {
    const data = await analytics.summarize(
      String(req.query.tenant_id || '').trim(),
      req.analyticsAuth,
      req.query.from,
      req.query.to
    );
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
