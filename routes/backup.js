const express = require('express');
const router = express.Router();
const db = require('../database');
const backupRestore = require('../services/backupRestore');

async function authenticateCaller(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!apiKey) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'API key required.' });
  }
  try {
    const device = await db.getHardwareDeviceByApiKey(apiKey);
    if (device) {
      req.backupAuth = { admin: false, deviceId: device.device_id };
      return next();
    }
    const keyData = await db.validateApiKey(apiKey);
    if (!keyData) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Invalid API key.' });
    }
    req.backupAuth = { admin: keyData.permissions === 'admin', deviceId: null };
    return next();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

function sendError(res, error) {
  return res.status(error.status || 500).json({
    success: false,
    code: error.code || 'BACKUP_ERROR',
    message: error.message
  });
}

router.post('/backups', authenticateCaller, async (req, res) => {
  try {
    const data = await backupRestore.createBackup(req.body.tenant_id, req.backupAuth);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/backups', authenticateCaller, async (req, res) => {
  try {
    const data = await backupRestore.listBackups(req.query.tenant_id, req.backupAuth);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/backups/:backupId', authenticateCaller, async (req, res) => {
  try {
    const data = await backupRestore.getBackup(req.params.backupId, req.backupAuth);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/backups/:backupId/restore', authenticateCaller, async (req, res) => {
  try {
    const data = await backupRestore.restoreBackup(req.params.backupId, req.backupAuth);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/storage/quota/:studentId', authenticateCaller, async (req, res) => {
  try {
    const data = await backupRestore.getQuota(req.query.tenant_id, req.params.studentId, req.backupAuth);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/storage/files', authenticateCaller, async (req, res) => {
  try {
    const content = Buffer.from(String(req.body.content_base64 || ''), 'base64');
    const data = await backupRestore.storeFile(
      req.body.tenant_id,
      req.body.student_id,
      req.body.filename,
      content,
      req.backupAuth
    );
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/storage/usage', authenticateCaller, async (req, res) => {
  try {
    const data = await backupRestore.addUsage(
      req.body.tenant_id,
      req.body.student_id,
      req.body.bytes,
      req.backupAuth
    );
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
