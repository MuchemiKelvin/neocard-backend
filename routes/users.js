// User Management Routes for Neo Card™ Backend

const express = require('express');
const router = express.Router();
const { authenticateApiKey } = require('../middleware');
const { formatResponse } = require('../utils');
const db = require('../database');
const crypto = require('crypto');

/**
 * Generate unique user ID
 */
function generateUserId() {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `user_${timestamp}_${random}`;
}

/**
 * POST /v1/users
 * Create a new user
 */
router.post('/', authenticateApiKey, async (req, res) => {
  try {
    const { email, first_name, last_name, phone, role_id, neocard_uid } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json(formatResponse(
        false,
        'First name and last name are required',
        null,
        { code: 'MISSING_REQUIRED_FIELDS' }
      ));
    }

    const userId = generateUserId();
    const userData = {
      user_id: userId,
      email: email || null,
      first_name,
      last_name,
      phone: phone || null,
      role_id: role_id || null,
      neocard_uid: neocard_uid || null,
      active: true
    };

    await db.createUser(userData);
    const user = await db.getUser(userId);

    // Log sync for NeoCare
    await db.logSync({
      sync_type: 'user_created',
      entity_type: 'user',
      entity_id: userId,
      sync_status: 'pending',
      sync_data: user
    });

    res.status(201).json(formatResponse(
      true,
      'User created successfully',
      user
    ));

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to create user',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /v1/users
 * Get all users with optional filters
 */
router.get('/', authenticateApiKey, async (req, res) => {
  try {
    const { role_id, active, search, limit, offset } = req.query;

    const filters = {};
    if (role_id) filters.role_id = parseInt(role_id);
    if (active !== undefined) filters.active = active === 'true';
    if (search) filters.search = search;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);

    const users = await db.getAllUsers(filters);

    res.json(formatResponse(
      true,
      'Users retrieved successfully',
      {
        users,
        total: users.length,
        filters_applied: filters
      }
    ));

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve users',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /v1/users/:userId
 * Get specific user by ID
 */
router.get('/:userId', authenticateApiKey, async (req, res) => {
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
    const hardware = await db.getUserHardware(userId);
    user.hardware = hardware;

    // Get user's client assignments
    const clients = await db.getUserClients(userId);
    user.clients = clients;

    res.json(formatResponse(
      true,
      'User retrieved successfully',
      user
    ));

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve user',
      null,
      { error: error.message }
    ));
  }
});

/**
 * PUT /v1/users/:userId
 * Update user information
 */
router.put('/:userId', authenticateApiKey, async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    // Check if user exists
    const existingUser = await db.getUser(userId);
    if (!existingUser) {
      return res.status(404).json(formatResponse(
        false,
        'User not found',
        null,
        { code: 'USER_NOT_FOUND' }
      ));
    }

    await db.updateUser(userId, updateData);
    const updatedUser = await db.getUser(userId);

    // Log sync for NeoCare
    await db.logSync({
      sync_type: 'user_updated',
      entity_type: 'user',
      entity_id: userId,
      sync_status: 'pending',
      sync_data: updatedUser
    });

    res.json(formatResponse(
      true,
      'User updated successfully',
      updatedUser
    ));

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to update user',
      null,
      { error: error.message }
    ));
  }
});

/**
 * DELETE /v1/users/:userId
 * Deactivate user (soft delete)
 */
router.delete('/:userId', authenticateApiKey, async (req, res) => {
  try {
    const { userId } = req.params;

    await db.deleteUser(userId);

    // Log sync for NeoCare
    await db.logSync({
      sync_type: 'user_deleted',
      entity_type: 'user',
      entity_id: userId,
      sync_status: 'pending'
    });

    res.json(formatResponse(
      true,
      'User deactivated successfully'
    ));

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to deactivate user',
      null,
      { error: error.message }
    ));
  }
});

/**
 * POST /v1/users/:userId/role
 * Assign role to user
 */
router.post('/:userId/role', authenticateApiKey, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role_id } = req.body;

    if (!role_id) {
      return res.status(400).json(formatResponse(
        false,
        'Role ID is required',
        null,
        { code: 'MISSING_ROLE_ID' }
      ));
    }

    // Verify role exists
    const role = await db.getRole(role_id);
    if (!role) {
      return res.status(404).json(formatResponse(
        false,
        'Role not found',
        null,
        { code: 'ROLE_NOT_FOUND' }
      ));
    }

    await db.assignRoleToUser(userId, role_id);
    const user = await db.getUser(userId);

    // Log sync for NeoCare
    await db.logSync({
      sync_type: 'role_assigned',
      entity_type: 'user',
      entity_id: userId,
      sync_status: 'pending',
      sync_data: { role_id, role_code: role.role_code }
    });

    res.json(formatResponse(
      true,
      'Role assigned successfully',
      user
    ));

  } catch (error) {
    console.error('Assign role error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to assign role',
      null,
      { error: error.message }
    ));
  }
});

module.exports = router;

