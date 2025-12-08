// Role Management Routes for Neo Card™ Backend

const express = require('express');
const router = express.Router();
const { authenticateApiKey } = require('../middleware');
const { formatResponse } = require('../utils');
const db = require('../database');

/**
 * GET /v1/roles
 * Get all available care roles
 */
router.get('/', authenticateApiKey, async (req, res) => {
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
    console.error('Get roles error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve roles',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /v1/roles/:roleId
 * Get specific role by ID
 */
router.get('/:roleId', authenticateApiKey, async (req, res) => {
  try {
    const { roleId } = req.params;
    const role = await db.getRole(parseInt(roleId));

    if (!role) {
      return res.status(404).json(formatResponse(
        false,
        'Role not found',
        null,
        { code: 'ROLE_NOT_FOUND' }
      ));
    }

    res.json(formatResponse(
      true,
      'Role retrieved successfully',
      role
    ));

  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve role',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /v1/roles/code/:roleCode
 * Get role by code (e.g., 'nurse', 'caregiver')
 */
router.get('/code/:roleCode', authenticateApiKey, async (req, res) => {
  try {
    const { roleCode } = req.params;
    const role = await db.getRoleByCode(roleCode);

    if (!role) {
      return res.status(404).json(formatResponse(
        false,
        'Role not found',
        null,
        { code: 'ROLE_NOT_FOUND' }
      ));
    }

    res.json(formatResponse(
      true,
      'Role retrieved successfully',
      role
    ));

  } catch (error) {
    console.error('Get role by code error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve role',
      null,
      { error: error.message }
    ));
  }
});

module.exports = router;

