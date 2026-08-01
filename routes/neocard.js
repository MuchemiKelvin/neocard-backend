const express = require('express');
const router = express.Router();

const { authenticateDeviceApiKey } = require('../middleware');
const NeoCardTransactions = require('../services/neocardTransactions');
const database = require('../database');

/**
 * POST /v1/neocard/checkin
 * Record a NeoCard transaction after fingerprint identity (device API key).
 */
router.post('/checkin', authenticateDeviceApiKey, async (req, res) => {
  try {
    const result = await NeoCardTransactions.checkIn(req.body, req.device);

    return res.status(201).json({
      success: true,
      message: 'NeoCard check-in recorded',
      user: result.user,
      transaction: result.transaction
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Check-in failed',
      ...(error.code && { code: error.code })
    });
  }
});

/**
 * POST /v1/neocard/transactions
 * Generic transaction create (same rules; any allowed transaction_type).
 */
router.post('/transactions', authenticateDeviceApiKey, async (req, res) => {
  try {
    const result = await NeoCardTransactions.recordTransaction(req.body, req.device);

    return res.status(201).json({
      success: true,
      message: 'NeoCard transaction recorded',
      user: result.user,
      transaction: result.transaction
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Transaction failed',
      ...(error.code && { code: error.code })
    });
  }
});

/**
 * GET /v1/neocard/transactions
 * List recent transactions (device-scoped by default).
 */
router.get('/transactions', authenticateDeviceApiKey, async (req, res) => {
  try {
    const rows = await database.getNeocardTransactions({
      device_id: req.query.device_id || req.device.device_id,
      user_id: req.query.user_id,
      transaction_type: req.query.transaction_type,
      limit: req.query.limit || 50
    });

    return res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
