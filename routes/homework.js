const express = require('express');
const router = express.Router();
const db = require('../database');
const ultraAi = require('../services/ultraAi');

async function authenticateCaller(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!apiKey) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'API key required.' });
  }
  try {
    const device = await db.getHardwareDeviceByApiKey(apiKey);
    if (device) {
      req.homeworkAuth = { admin: false, deviceId: device.device_id };
      return next();
    }
    const keyData = await db.validateApiKey(apiKey);
    if (!keyData) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Invalid API key.' });
    }
    req.homeworkAuth = { admin: keyData.permissions === 'admin', deviceId: null };
    return next();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

router.post('/review', authenticateCaller, async (req, res) => {
  try {
    const body = req.body || {};
    const submission = String(body.submission || body.prompt || '').trim();
    if (!submission) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_FIELD',
        message: 'submission is required.'
      });
    }
    const prompt = [body.subject, body.lesson, submission].filter(Boolean).join('\n');
    const data = await ultraAi.complete({
      tenant_id: body.tenant_id,
      user_id: body.user_id,
      role: body.role,
      module: 'homework',
      prompt
    }, req.homeworkAuth);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      code: error.code || 'HOMEWORK_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
