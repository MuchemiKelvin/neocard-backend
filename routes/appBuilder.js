const express = require('express');
const router = express.Router();
const db = require('../database');
const appBuilder = require('../services/appBuilder');

async function authenticateCaller(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!apiKey) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'API key required.' });
  }
  try {
    const device = await db.getHardwareDeviceByApiKey(apiKey);
    if (device) {
      req.builderAuth = { admin: false, deviceId: device.device_id };
      return next();
    }
    const keyData = await db.validateApiKey(apiKey);
    if (!keyData) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Invalid API key.' });
    }
    req.builderAuth = { admin: keyData.permissions === 'admin', deviceId: null };
    return next();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

function sendError(res, error) {
  return res.status(error.status || 500).json({
    success: false,
    code: error.code || 'APP_BUILDER_ERROR',
    message: error.message
  });
}

router.post('/lessons', authenticateCaller, async (req, res) => {
  try {
    const data = await appBuilder.createLesson(req.body || {}, req.builderAuth);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/lessons/:lessonId', authenticateCaller, async (req, res) => {
  try {
    const data = await appBuilder.getLesson(req.params.lessonId, req.builderAuth);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/lessons/:lessonId/save', authenticateCaller, async (req, res) => {
  try {
    const data = await appBuilder.setStatus(req.params.lessonId, 'SAVED', req.builderAuth);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/lessons/:lessonId/publish', authenticateCaller, async (req, res) => {
  try {
    const data = await appBuilder.setStatus(req.params.lessonId, 'PUBLISHED', req.builderAuth);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
