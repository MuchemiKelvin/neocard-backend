// Device terminal routes (Raspberry Pi) — authenticated via device API key (kdvc_...)

const express = require('express');
const router = express.Router();
const { authenticateDeviceApiKey } = require('../middleware');
const { formatResponse } = require('../utils');

/**
 * GET /v1/device/me
 * Return the authenticated terminal's own device record.
 * Pi only needs API_BASE_URL + DEVICE_API_KEY; no DEVICE_ID in config.
 */
router.get('/me', authenticateDeviceApiKey, async (req, res) => {
  try {
    const { api_key, ...device } = req.device;

    res.status(200).json(formatResponse(
      true,
      'Device identity retrieved successfully',
      device
    ));
  } catch (error) {
    console.error('Get device me error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve device identity',
      null,
      { error: error.message }
    ));
  }
});

module.exports = router;
