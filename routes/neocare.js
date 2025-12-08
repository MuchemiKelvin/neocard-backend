// NeoCare Dashboard Routes - Backend endpoints for tabs 1-13

const express = require('express');
const router = express.Router();
const { authenticateApiKey } = require('../middleware');
const { formatResponse } = require('../utils');
const db = require('../database');

/**
 * GET /neocare/sync/users
 * Get users that need to be synced to NeoCare
 */
router.get('/sync/users', authenticateApiKey, async (req, res) => {
  try {
    const unsyncedUsers = await db.getUnsyncedUsers();

    res.json(formatResponse(
      true,
      'Unsynced users retrieved successfully',
      {
        users: unsyncedUsers,
        total: unsyncedUsers.length
      }
    ));

  } catch (error) {
    console.error('Get unsynced users error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve unsynced users',
      null,
      { error: error.message }
    ));
  }
});

/**
 * POST /neocare/sync/users/:userId
 * Mark user as synced to NeoCare
 */
router.post('/sync/users/:userId', authenticateApiKey, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await db.getUser(userId);

    if (!user) {
      return res.status(404).json(formatResponse(
        false,
        'User not found',
        null,
        { code: 'USER_NOT_FOUND' }
      ));
    }

    await db.markUserSynced(userId, true);

    // Log successful sync
    await db.logSync({
      sync_type: 'user_synced',
      entity_type: 'user',
      entity_id: userId,
      sync_status: 'success',
      sync_data: user
    });

    res.json(formatResponse(
      true,
      'User marked as synced successfully'
    ));

  } catch (error) {
    console.error('Mark user synced error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to mark user as synced',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /neocare/sync/logs
 * Get sync logs
 */
router.get('/sync/logs', authenticateApiKey, async (req, res) => {
  try {
    const { entity_type, sync_status, entity_id, limit } = req.query;

    const filters = {};
    if (entity_type) filters.entity_type = entity_type;
    if (sync_status) filters.sync_status = sync_status;
    if (entity_id) filters.entity_id = entity_id;
    if (limit) filters.limit = parseInt(limit);

    const logs = await db.getSyncLogs(filters);

    res.json(formatResponse(
      true,
      'Sync logs retrieved successfully',
      {
        logs,
        total: logs.length,
        filters_applied: filters
      }
    ));

  } catch (error) {
    console.error('Get sync logs error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve sync logs',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /neocare/users
 * Get all users with roles and hardware (for NeoCare Dashboard)
 */
router.get('/users', authenticateApiKey, async (req, res) => {
  try {
    const { role_id, role_code, active, search, limit, offset } = req.query;

    const filters = {};
    if (role_id) filters.role_id = parseInt(role_id);
    if (active !== undefined) filters.active = active === 'true';
    if (search) filters.search = search;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);

    let users = await db.getAllUsers(filters);

    // If filtering by role_code, filter in memory
    if (role_code) {
      users = users.filter(u => u.role_code === role_code);
    }

    // Enrich users with hardware and clients
    for (const user of users) {
      user.hardware = await db.getUserHardware(user.user_id);
      user.clients = await db.getUserClients(user.user_id);
    }

    res.json(formatResponse(
      true,
      'Users retrieved successfully for NeoCare',
      {
        users,
        total: users.length,
        filters_applied: filters
      }
    ));

  } catch (error) {
    console.error('Get NeoCare users error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve users',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /neocare/users/:userId
 * Get specific user with full details (for NeoCare Dashboard)
 */
router.get('/users/:userId', authenticateApiKey, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await db.getUser(userId);

    if (!user) {
      return res.status(404).json(formatResponse(
        false,
        'User not found',
        null,
        { code: 'USER_NOT_FOUND' }
      ));
    }

    // Get user's hardware assignments
    user.hardware = await db.getUserHardware(userId);

    // Get user's client assignments
    user.clients = await db.getUserClients(userId);

    res.json(formatResponse(
      true,
      'User retrieved successfully',
      user
    ));

  } catch (error) {
    console.error('Get NeoCare user error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve user',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /neocare/roles
 * Get all roles (for NeoCare Dashboard)
 */
router.get('/roles', authenticateApiKey, async (req, res) => {
  try {
    const roles = await db.getAllRoles();

    res.json(formatResponse(
      true,
      'Roles retrieved successfully',
      {
        roles,
        total: roles.length
      }
    ));

  } catch (error) {
    console.error('Get NeoCare roles error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve roles',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /neocare/hardware
 * Get all hardware devices (for NeoCare Dashboard)
 */
router.get('/hardware', authenticateApiKey, async (req, res) => {
  try {
    const { device_type, status } = req.query;

    const filters = {};
    if (device_type) filters.device_type = device_type;
    if (status) filters.status = status;

    const devices = await db.getAllHardwareDevices(filters);

    // Enrich devices with assigned users
    for (const device of devices) {
      device.assigned_users = await db.getHardwareUsers(device.device_id);
    }

    res.json(formatResponse(
      true,
      'Hardware devices retrieved successfully',
      {
        devices,
        total: devices.length
      }
    ));

  } catch (error) {
    console.error('Get NeoCare hardware error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve hardware devices',
      null,
      { error: error.message }
    ));
  }
});

// ==================== NEOCARE DASHBOARD TABS 1-13 ====================

/**
 * GET /neocare/tabs/1 - Overview Dashboard
 */
router.get('/tabs/1', authenticateApiKey, async (req, res) => {
  try {
    const users = await db.getAllUsers({ active: true });
    const devices = await db.getAllHardwareDevices({ status: 'active' });
    const roles = await db.getAllRoles();

    // Get statistics
    const stats = {
      total_users: users.length,
      total_devices: devices.length,
      total_roles: roles.length,
      active_assignments: 0,
      unsynced_users: (await db.getUnsyncedUsers()).length
    };

    // Count active hardware assignments
    for (const user of users) {
      const hardware = await db.getUserHardware(user.user_id);
      stats.active_assignments += hardware.length;
    }

    res.json(formatResponse(
      true,
      'Overview dashboard data retrieved successfully',
      {
        stats,
        recent_activity: [],
        alerts: []
      }
    ));

  } catch (error) {
    console.error('Get overview dashboard error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve overview data',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /neocare/tabs/2 - Clients Dashboard
 */
router.get('/tabs/2', authenticateApiKey, async (req, res) => {
  try {
    // This would typically fetch from clients table
    // For now, return structure
    res.json(formatResponse(
      true,
      'Clients dashboard data retrieved successfully',
      {
        clients: [],
        total: 0
      }
    ));

  } catch (error) {
    console.error('Get clients dashboard error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve clients data',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /neocare/tabs/3 - Tasks Dashboard
 */
router.get('/tabs/3', authenticateApiKey, async (req, res) => {
  try {
    res.json(formatResponse(
      true,
      'Tasks dashboard data retrieved successfully',
      {
        tasks: [],
        total: 0
      }
    ));

  } catch (error) {
    console.error('Get tasks dashboard error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve tasks data',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /neocare/tabs/4 - Scheduling Dashboard
 */
router.get('/tabs/4', authenticateApiKey, async (req, res) => {
  try {
    const users = await db.getAllUsers({ active: true });
    
    // Get users with their roles for scheduling
    const scheduleData = users.map(user => ({
      user_id: user.user_id,
      name: `${user.first_name} ${user.last_name}`,
      role: user.role_name || 'No Role',
      role_code: user.role_code,
      available: true
    }));

    res.json(formatResponse(
      true,
      'Scheduling dashboard data retrieved successfully',
      {
        schedule: scheduleData,
        total_users: scheduleData.length
      }
    ));

  } catch (error) {
    console.error('Get scheduling dashboard error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve scheduling data',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /neocare/tabs/5 - Reporting Dashboard
 */
router.get('/tabs/5', authenticateApiKey, async (req, res) => {
  try {
    const users = await db.getAllUsers({ active: true });
    const roles = await db.getAllRoles();

    // Generate role-based reports
    const roleReports = roles.map(role => {
      const usersWithRole = users.filter(u => u.role_id === role.id);
      return {
        role_code: role.role_code,
        role_name: role.role_name,
        total_users: usersWithRole.length,
        users: usersWithRole.map(u => ({
          user_id: u.user_id,
          name: `${u.first_name} ${u.last_name}`,
          email: u.email
        }))
      };
    });

    res.json(formatResponse(
      true,
      'Reporting dashboard data retrieved successfully',
      {
        reports: {
          by_role: roleReports,
          total_users: users.length,
          total_roles: roles.length
        }
      }
    ));

  } catch (error) {
    console.error('Get reporting dashboard error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve reporting data',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /neocare/tabs/6 - Medication Dashboard
 */
router.get('/tabs/6', authenticateApiKey, async (req, res) => {
  try {
    res.json(formatResponse(
      true,
      'Medication dashboard data retrieved successfully',
      {
        medications: [],
        total: 0
      }
    ));

  } catch (error) {
    console.error('Get medication dashboard error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve medication data',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /neocare/tabs/7 - 7D Proof Dashboard
 */
router.get('/tabs/7', authenticateApiKey, async (req, res) => {
  try {
    res.json(formatResponse(
      true,
      '7D Proof dashboard data retrieved successfully',
      {
        proofs: [],
        total: 0
      }
    ));

  } catch (error) {
    console.error('Get 7D Proof dashboard error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve 7D Proof data',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /neocare/tabs/8 - Emergency Center Dashboard
 */
router.get('/tabs/8', authenticateApiKey, async (req, res) => {
  try {
    // Get ambulance crew and emergency personnel
    const ambulanceRole = await db.getRoleByCode('ambulance_crew');
    const users = ambulanceRole 
      ? await db.getAllUsers({ role_id: ambulanceRole.id, active: true })
      : [];

    res.json(formatResponse(
      true,
      'Emergency Center dashboard data retrieved successfully',
      {
        emergency_personnel: users.map(u => ({
          user_id: u.user_id,
          name: `${u.first_name} ${u.last_name}`,
          role: u.role_name,
          available: true
        })),
        total: users.length
      }
    ));

  } catch (error) {
    console.error('Get emergency center dashboard error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve emergency center data',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /neocare/tabs/9 - Reward Ladder Dashboard
 */
router.get('/tabs/9', authenticateApiKey, async (req, res) => {
  try {
    res.json(formatResponse(
      true,
      'Reward Ladder dashboard data retrieved successfully',
      {
        rewards: [],
        total: 0
      }
    ));

  } catch (error) {
    console.error('Get reward ladder dashboard error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve reward ladder data',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /neocare/tabs/10 - NeoPay Dashboard
 */
router.get('/tabs/10', authenticateApiKey, async (req, res) => {
  try {
    res.json(formatResponse(
      true,
      'NeoPay dashboard data retrieved successfully',
      {
        transactions: [],
        total: 0
      }
    ));

  } catch (error) {
    console.error('Get NeoPay dashboard error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve NeoPay data',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /neocare/tabs/11 - Invoice Generator Dashboard
 */
router.get('/tabs/11', authenticateApiKey, async (req, res) => {
  try {
    res.json(formatResponse(
      true,
      'Invoice Generator dashboard data retrieved successfully',
      {
        invoices: [],
        total: 0
      }
    ));

  } catch (error) {
    console.error('Get invoice generator dashboard error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve invoice generator data',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /neocare/tabs/12 - Sponsor Wallet Dashboard
 */
router.get('/tabs/12', authenticateApiKey, async (req, res) => {
  try {
    res.json(formatResponse(
      true,
      'Sponsor Wallet dashboard data retrieved successfully',
      {
        wallets: [],
        total: 0
      }
    ));

  } catch (error) {
    console.error('Get sponsor wallet dashboard error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve sponsor wallet data',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /neocare/tabs/13 - NeoChain Explorer Dashboard
 */
router.get('/tabs/13', authenticateApiKey, async (req, res) => {
  try {
    res.json(formatResponse(
      true,
      'NeoChain Explorer dashboard data retrieved successfully',
      {
        blocks: [],
        total: 0
      }
    ));

  } catch (error) {
    console.error('Get NeoChain Explorer dashboard error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve NeoChain Explorer data',
      null,
      { error: error.message }
    ));
  }
});

module.exports = router;

