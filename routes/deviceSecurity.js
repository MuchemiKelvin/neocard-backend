const express = require('express');
const router = express.Router();

const { authenticateApiKey, authenticateDeviceApiKey } = require('../middleware');
const deviceSecurity = require('../services/deviceSecurity');

function sendError(res, error) {
  return res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Device security request failed',
    ...(error.code && { code: error.code })
  });
}

/**
 * GET /v1/device-security/status
 * Essential read. Evaluates the 24-hour rule for the authenticated device.
 */
router.get('/status', authenticateDeviceApiKey, async (req, res) => {
  try {
    const data = await deviceSecurity.evaluate(req.deviceId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * POST /v1/device-security/verification
 * Records a valid verification checkpoint for this device.
 */
router.post('/verification', authenticateDeviceApiKey, async (req, res) => {
  try {
    const data = await deviceSecurity.recordVerification(req.deviceId);
    return res.status(201).json({
      success: true,
      message: 'Valid verification recorded',
      data
    });
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * POST /v1/device-security/support/unlock
 * Helpdesk issues a one-time token for one Device ID. Admin key only.
 */
router.post('/support/unlock', authenticateApiKey, async (req, res) => {
  try {
    if (req.apiKeyData?.permissions !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Support unlock requires an admin authorization.',
        code: 'SUPPORT_NOT_AUTHORIZED'
      });
    }

    const data = await deviceSecurity.issueUnlock(
      req.body.device_id || req.body.deviceId,
      req.body.authorized_by || req.body.authorizedBy
    );

    return res.status(201).json({
      success: true,
      message: 'One-time unlock token issued',
      data
    });
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * POST /v1/device-security/unlock
 * Device presents its one-time token. The token cannot unlock a different device.
 */
router.post('/unlock', authenticateDeviceApiKey, async (req, res) => {
  try {
    const data = await deviceSecurity.redeemUnlock(req.deviceId, req.body.token);
    return res.json({
      success: true,
      message: 'Device unlocked',
      data
    });
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * POST /v1/device-security/sync
 * Records synchronization status. Does not clear Restricted Mode.
 */
router.post('/sync', authenticateDeviceApiKey, async (req, res) => {
  try {
    const data = await deviceSecurity.recordSync(req.deviceId);
    return res.json({
      success: true,
      message: 'Synchronization recorded',
      data
    });
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * GET /v1/device-security/audit
 * Proof/Audit events for the authenticated device.
 */
router.get('/audit', authenticateDeviceApiKey, async (req, res) => {
  try {
    const data = await deviceSecurity.listAudit(req.deviceId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
