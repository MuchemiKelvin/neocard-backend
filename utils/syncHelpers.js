// Sync Helper utilities for NeoCard → NeoCare synchronization

const db = require('../database');

/**
 * Sync user to NeoCare Dashboard
 * @param {string} userId - User ID to sync
 * @returns {Promise<Object>} Sync result
 */
async function syncUserToNeoCare(userId) {
  try {
    const user = await db.getUser(userId);
    
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Get user's hardware assignments
    const hardware = await db.getUserHardware(userId);
    
    // Get user's client assignments
    const clients = await db.getUserClients(userId);

    // Prepare sync data
    const syncData = {
      user: {
        user_id: user.user_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        role: {
          role_id: user.role_id,
          role_code: user.role_code,
          role_name: user.role_name,
          role_name_nl: user.role_name_nl
        },
        neocard_uid: user.neocard_uid,
        active: user.active
      },
      hardware: hardware.map(h => ({
        device_id: h.device_id,
        device_type: h.device_type,
        device_name: h.device_name,
        serial_number: h.serial_number
      })),
      clients: clients.map(c => ({
        client_id: c.client_id,
        first_name: c.first_name,
        last_name: c.last_name
      }))
    };

    // Log sync
    await db.logSync({
      sync_type: 'user_sync',
      entity_type: 'user',
      entity_id: userId,
      sync_status: 'success',
      sync_data: syncData
    });

    // Mark user as synced
    await db.markUserSynced(userId, true);

    return {
      success: true,
      user_id: userId,
      synced_at: new Date().toISOString(),
      data: syncData
    };

  } catch (error) {
    // Log sync error
    await db.logSync({
      sync_type: 'user_sync',
      entity_type: 'user',
      entity_id: userId,
      sync_status: 'error',
      error_message: error.message
    });

    throw error;
  }
}

/**
 * Sync all unsynced users to NeoCare
 * @returns {Promise<Object>} Sync results
 */
async function syncAllUnsyncedUsers() {
  try {
    const unsyncedUsers = await db.getUnsyncedUsers();
    const results = {
      total: unsyncedUsers.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const user of unsyncedUsers) {
      try {
        await syncUserToNeoCare(user.user_id);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          user_id: user.user_id,
          error: error.message
        });
      }
    }

    return results;

  } catch (error) {
    throw error;
  }
}

/**
 * Sync role changes to NeoCare
 * @param {string} userId - User ID
 * @param {number} roleId - New role ID
 * @returns {Promise<Object>} Sync result
 */
async function syncRoleChangeToNeoCare(userId, roleId) {
  try {
    const user = await db.getUser(userId);
    const role = await db.getRole(roleId);

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    if (!role) {
      throw new Error(`Role not found: ${roleId}`);
    }

    // Log role change sync
    await db.logSync({
      sync_type: 'role_change',
      entity_type: 'user',
      entity_id: userId,
      sync_status: 'success',
      sync_data: {
        user_id: userId,
        old_role: {
          role_id: user.role_id,
          role_code: user.role_code,
          role_name: user.role_name
        },
        new_role: {
          role_id: role.id,
          role_code: role.role_code,
          role_name: role.role_name
        }
      }
    });

    // Mark user for re-sync
    await db.markUserSynced(userId, false);

    return {
      success: true,
      user_id: userId,
      role_change: {
        from: user.role_code,
        to: role.role_code
      }
    };

  } catch (error) {
    await db.logSync({
      sync_type: 'role_change',
      entity_type: 'user',
      entity_id: userId,
      sync_status: 'error',
      error_message: error.message
    });

    throw error;
  }
}

/**
 * Sync hardware assignment to NeoCare
 * @param {string} userId - User ID
 * @param {string} deviceId - Device ID
 * @returns {Promise<Object>} Sync result
 */
async function syncHardwareAssignmentToNeoCare(userId, deviceId) {
  try {
    const user = await db.getUser(userId);
    const device = await db.getHardwareDevice(deviceId);

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    // Log hardware assignment sync
    await db.logSync({
      sync_type: 'hardware_assignment',
      entity_type: 'hardware_mapping',
      entity_id: `${userId}_${deviceId}`,
      sync_status: 'success',
      sync_data: {
        user_id: userId,
        user_name: `${user.first_name} ${user.last_name}`,
        device_id: deviceId,
        device_type: device.device_type,
        device_name: device.device_name
      }
    });

    // Mark user for re-sync
    await db.markUserSynced(userId, false);

    return {
      success: true,
      user_id: userId,
      device_id: deviceId,
      device_type: device.device_type
    };

  } catch (error) {
    await db.logSync({
      sync_type: 'hardware_assignment',
      entity_type: 'hardware_mapping',
      entity_id: `${userId}_${deviceId}`,
      sync_status: 'error',
      error_message: error.message
    });

    throw error;
  }
}

module.exports = {
  syncUserToNeoCare,
  syncAllUnsyncedUsers,
  syncRoleChangeToNeoCare,
  syncHardwareAssignmentToNeoCare
};

