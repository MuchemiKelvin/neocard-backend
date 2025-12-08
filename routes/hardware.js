// Hardware Management Routes for Neo Card™ Backend

const express = require('express');
const router = express.Router();
const { authenticateApiKey } = require('../middleware');
const { formatResponse } = require('../utils');
const db = require('../database');
const crypto = require('crypto');

/**
 * Generate unique device ID
 */
function generateDeviceId() {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `device_${timestamp}_${random}`;
}

/**
 * POST /v1/hardware/devices
 * Create a new hardware device
 */
router.post('/devices', authenticateApiKey, async (req, res) => {
  try {
    const { device_type, device_name, serial_number, firmware_version } = req.body;

    if (!device_type || !device_name) {
      return res.status(400).json(formatResponse(
        false,
        'Device type and name are required',
        null,
        { code: 'MISSING_REQUIRED_FIELDS' }
      ));
    }

    // Validate device type
    const validTypes = ['neocam_v1', 'fall_alarm_v1', 'fingerprint_device', 'other'];
    if (!validTypes.includes(device_type)) {
      return res.status(400).json(formatResponse(
        false,
        'Invalid device type',
        null,
        { code: 'INVALID_DEVICE_TYPE', valid_types: validTypes }
      ));
    }

    const deviceId = generateDeviceId();
    const deviceData = {
      device_id: deviceId,
      device_type,
      device_name,
      serial_number: serial_number || null,
      firmware_version: firmware_version || null,
      status: 'active'
    };

    await db.createHardwareDevice(deviceData);
    const device = await db.getHardwareDevice(deviceId);

    res.status(201).json(formatResponse(
      true,
      'Hardware device created successfully',
      device
    ));

  } catch (error) {
    console.error('Create hardware device error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to create hardware device',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /v1/hardware/devices
 * Get all hardware devices
 */
router.get('/devices', authenticateApiKey, async (req, res) => {
  try {
    const { device_type, status, limit } = req.query;

    const filters = {};
    if (device_type) filters.device_type = device_type;
    if (status) filters.status = status;
    if (limit) filters.limit = parseInt(limit);

    const devices = await db.getAllHardwareDevices(filters);

    res.json(formatResponse(
      true,
      'Hardware devices retrieved successfully',
      {
        devices,
        total: devices.length,
        filters_applied: filters
      }
    ));

  } catch (error) {
    console.error('Get hardware devices error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve hardware devices',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /v1/hardware/devices/:deviceId
 * Get specific hardware device
 */
router.get('/devices/:deviceId', authenticateApiKey, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await db.getHardwareDevice(deviceId);

    if (!device) {
      return res.status(404).json(formatResponse(
        false,
        'Hardware device not found',
        null,
        { code: 'DEVICE_NOT_FOUND' }
      ));
    }

    // Get users assigned to this device
    const users = await db.getHardwareUsers(deviceId);
    device.assigned_users = users;

    res.json(formatResponse(
      true,
      'Hardware device retrieved successfully',
      device
    ));

  } catch (error) {
    console.error('Get hardware device error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve hardware device',
      null,
      { error: error.message }
    ));
  }
});

/**
 * POST /v1/hardware/assign
 * Assign hardware device to user
 */
router.post('/assign', authenticateApiKey, async (req, res) => {
  try {
    const { user_id, device_id } = req.body;

    if (!user_id || !device_id) {
      return res.status(400).json(formatResponse(
        false,
        'User ID and device ID are required',
        null,
        { code: 'MISSING_REQUIRED_FIELDS' }
      ));
    }

    // Verify user exists
    const user = await db.getUser(user_id);
    if (!user) {
      return res.status(404).json(formatResponse(
        false,
        'User not found',
        null,
        { code: 'USER_NOT_FOUND' }
      ));
    }

    // Verify device exists
    const device = await db.getHardwareDevice(device_id);
    if (!device) {
      return res.status(404).json(formatResponse(
        false,
        'Hardware device not found',
        null,
        { code: 'DEVICE_NOT_FOUND' }
      ));
    }

    await db.assignHardwareToUser(user_id, device_id);

    // Log sync for NeoCare
    await db.logSync({
      sync_type: 'hardware_assigned',
      entity_type: 'hardware_mapping',
      entity_id: `${user_id}_${device_id}`,
      sync_status: 'pending',
      sync_data: { user_id, device_id, device_type: device.device_type }
    });

    const userHardware = await db.getUserHardware(user_id);

    res.json(formatResponse(
      true,
      'Hardware assigned successfully',
      {
        user_id,
        device_id,
        hardware: userHardware
      }
    ));

  } catch (error) {
    console.error('Assign hardware error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to assign hardware',
      null,
      { error: error.message }
    ));
  }
});

/**
 * POST /v1/hardware/unassign
 * Unassign hardware device from user
 */
router.post('/unassign', authenticateApiKey, async (req, res) => {
  try {
    const { user_id, device_id } = req.body;

    if (!user_id || !device_id) {
      return res.status(400).json(formatResponse(
        false,
        'User ID and device ID are required',
        null,
        { code: 'MISSING_REQUIRED_FIELDS' }
      ));
    }

    await db.unassignHardwareFromUser(user_id, device_id);

    // Log sync for NeoCare
    await db.logSync({
      sync_type: 'hardware_unassigned',
      entity_type: 'hardware_mapping',
      entity_id: `${user_id}_${device_id}`,
      sync_status: 'pending'
    });

    res.json(formatResponse(
      true,
      'Hardware unassigned successfully'
    ));

  } catch (error) {
    console.error('Unassign hardware error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to unassign hardware',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /v1/hardware/users/:userId
 * Get all hardware assigned to a user
 */
router.get('/users/:userId', authenticateApiKey, async (req, res) => {
  try {
    const { userId } = req.params;
    const hardware = await db.getUserHardware(userId);

    res.json(formatResponse(
      true,
      'User hardware retrieved successfully',
      {
        user_id: userId,
        hardware,
        total: hardware.length
      }
    ));

  } catch (error) {
    console.error('Get user hardware error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve user hardware',
      null,
      { error: error.message }
    ));
  }
});

module.exports = router;

