const express = require('express');
const router = express.Router();
const db = require('../database');
const templates = require('../services/templateDistribution');

async function authenticateCaller(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!apiKey) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'API key required.' });
  }
  try {
    const device = await db.getHardwareDeviceByApiKey(apiKey);
    if (device) {
      req.templateAuth = { admin: false, deviceId: device.device_id };
      return next();
    }
    const keyData = await db.validateApiKey(apiKey);
    if (!keyData) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Invalid API key.' });
    }
    req.templateAuth = { admin: keyData.permissions === 'admin', deviceId: null };
    return next();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

function sendError(res, error) {
  return res.status(error.status || 500).json({
    success: false,
    code: error.code || 'TEMPLATE_ERROR',
    message: error.message
  });
}

router.post('/storage/templates', authenticateCaller, async (req, res) => {
  try {
    const data = await templates.storeTemplate(req.body || {}, req.templateAuth);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/storage/templates/:templateId', authenticateCaller, async (req, res) => {
  try {
    const data = await templates.latest(req.params.templateId, req.templateAuth);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/storage/templates/:templateId/sync', authenticateCaller, async (req, res) => {
  try {
    const data = await templates.deliver(req.params.templateId, req.templateAuth);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/storage/templates/:templateId/restore', authenticateCaller, async (req, res) => {
  try {
    const data = await templates.restore(
      req.params.templateId,
      req.body?.version,
      req.templateAuth
    );
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
