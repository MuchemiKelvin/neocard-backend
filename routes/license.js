const express = require('express');
const router = express.Router();
const db = require('../database');
const licenseServer = require('../services/licenseServer');

async function authenticateLicenseCaller(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      decision: 'DENY',
      code: 'UNAUTHORIZED',
      message: 'API key required.'
    });
  }
  try {
    const device = await db.getHardwareDeviceByApiKey(apiKey);
    if (device) {
      req.licenseAuth = { admin: false, deviceId: device.device_id };
      return next();
    }
    const keyData = await db.validateApiKey(apiKey);
    if (!keyData) {
      return res.status(401).json({
        success: false,
        decision: 'DENY',
        code: 'UNAUTHORIZED',
        message: 'Invalid API key.'
      });
    }
    req.licenseAuth = {
      admin: keyData.permissions === 'admin',
      deviceId: null,
      permissions: keyData.permissions
    };
    return next();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

function requireAdmin(req, res, next) {
  if (!req.licenseAuth?.admin) {
    return res.status(403).json({
      success: false,
      decision: 'DENY',
      code: 'UNAUTHORIZED',
      message: 'Admin permission is required for license changes.'
    });
  }
  return next();
}

function sendError(res, error) {
  const body = {
    success: false,
    decision: 'DENY',
    code: error.code || 'LICENSE_DENIED',
    message: error.message,
    ...(error.details || {})
  };
  return res.status(error.status || 500).json(body);
}

router.post('/', authenticateLicenseCaller, requireAdmin, async (req, res) => {
  try {
    const data = await licenseServer.saveLicense(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/validate', authenticateLicenseCaller, async (req, res) => {
  try {
    const data = await licenseServer.validate(req.body, req.licenseAuth);
    return res.json({ success: true, ...data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/device/validate', authenticateLicenseCaller, async (req, res) => {
  try {
    const data = await licenseServer.validate(
      { ...req.body, device_id: req.body.device_id },
      req.licenseAuth
    );
    return res.json({ success: true, ...data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/:tenantId', authenticateLicenseCaller, async (req, res) => {
  try {
    await licenseServer.assertTenantAccess(req.params.tenantId, req.licenseAuth);
    const data = await licenseServer.getLicenseView(req.params.tenantId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/:tenantId/seats', authenticateLicenseCaller, async (req, res) => {
  try {
    await licenseServer.assertTenantAccess(req.params.tenantId, req.licenseAuth);
    const data = await licenseServer.getLicenseView(req.params.tenantId);
    return res.json({
      success: true,
      tenant_id: data.tenant_id,
      seat_limit: data.seat_limit,
      active_seats: data.active_seats
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/:tenantId/entitlements', authenticateLicenseCaller, async (req, res) => {
  try {
    await licenseServer.assertTenantAccess(req.params.tenantId, req.licenseAuth);
    const data = await licenseServer.getLicenseView(req.params.tenantId);
    return res.json({
      success: true,
      tenant_id: data.tenant_id,
      products: data.products
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/:tenantId/status', authenticateLicenseCaller, requireAdmin, async (req, res) => {
  try {
    const data = await licenseServer.setStatus(
      req.params.tenantId,
      req.body.license_status,
      req.body.expires_at
    );
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
