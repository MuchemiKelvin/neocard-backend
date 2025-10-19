// API routes for Neo Card™ Demo Backend

const express = require('express');
const router = express.Router();
const { authenticateApiKey, validateScanRequest, antiFraudCheck } = require('../middleware');
const { formatResponse, generateAEIChecksum, generateScanId } = require('../utils');
const config = require('../config');
const db = require('../database');

/**
 * POST /v1/scan
 * Register UID, timestamp, and campaign ID
 */
router.post('/scan', validateScanRequest, antiFraudCheck, async (req, res) => {
  try {
    const { uid, campaign_id } = req.body;
    const timestamp = new Date().toISOString();
    
    // Generate AEI checksum
    const checksum = generateAEIChecksum(uid, timestamp, campaign_id, config.security.aeiSecretKey);
    
    // Create scan record
    const scanId = generateScanId();
    const scanRecord = {
      scan_id: scanId,
      uid,
      campaign_id,
      timestamp,
      checksum,
      verified: true
    };
    
    // Store scan in database
    await db.insertScan(scanRecord);
    
    // Get updated counts
    const totalScans = await db.getScans({ limit: 1000 });
    const todayScans = await db.getScans({ 
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0] + 'T23:59:59.999Z'
    });
    
    // Response
    res.status(201).json(formatResponse(
      true,
      'Scan registered successfully',
      {
        scan_id: scanId,
        uid,
        campaign_id,
        timestamp,
        checksum,
        verified: true
      },
      {
        total_scans: totalScans.length,
        daily_scans: todayScans.length
      }
    ));
    
  } catch (error) {
    console.error('Scan registration error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to register scan',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /v1/logs
 * Display recent scans (admin only)
 */
router.get('/logs', authenticateApiKey, async (req, res) => {
  try {
    const { limit = 50, offset = 0, uid, campaign_id, start_date, end_date } = req.query;
    
    const filters = {};
    if (uid) filters.uid = uid;
    if (campaign_id) filters.campaign_id = campaign_id;
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;
    
    filters.limit = parseInt(limit);
    filters.offset = parseInt(offset);
    
    const scans = await db.getScans(filters);
    
    // Get total count for pagination
    const totalFilters = { ...filters };
    delete totalFilters.limit;
    delete totalFilters.offset;
    const totalScans = await db.getScans(totalFilters);
    
    res.json(formatResponse(
      true,
      'Logs retrieved successfully',
      {
        scans,
        pagination: {
          total: totalScans.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
          has_more: totalScans.length > parseInt(offset) + parseInt(limit)
        }
      },
      {
        filters_applied: {
          uid: !!uid,
          campaign_id: !!campaign_id,
          start_date: !!start_date,
          end_date: !!end_date
        }
      }
    ));
    
  } catch (error) {
    console.error('Logs retrieval error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve logs',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /v1/export/csv
 * Export daily scan data for sponsors
 */
router.get('/export/csv', authenticateApiKey, async (req, res) => {
  try {
    const { date, campaign_id } = req.query;
    
    const filters = {};
    const targetDate = date || new Date().toISOString().split('T')[0];
    filters.start_date = targetDate + 'T00:00:00.000Z';
    filters.end_date = targetDate + 'T23:59:59.999Z';
    
    if (campaign_id) {
      filters.campaign_id = campaign_id;
    }
    
    const scans = await db.getScans(filters);
    
    // Generate CSV content
    const csvHeader = 'Scan ID,UID,Campaign ID,Timestamp,Checksum,Verified\n';
    const csvRows = scans.map(scan => 
      `${scan.scan_id},${scan.uid},${scan.campaign_id},${scan.timestamp},${scan.checksum},${scan.verified}`
    ).join('\n');
    
    const csvContent = csvHeader + csvRows;
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="neocard_scans_${targetDate}.csv"`);
    
    res.send(csvContent);
    
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to export CSV',
      null,
      { error: error.message }
    ));
  }
});

/**
 * GET /v1/stats
 * Get scan statistics (admin only)
 */
router.get('/stats', authenticateApiKey, async (req, res) => {
  try {
    const stats = await db.getStats();
    
    res.json(formatResponse(
      true,
      'Statistics retrieved successfully',
      stats
    ));
    
  } catch (error) {
    console.error('Stats retrieval error:', error);
    res.status(500).json(formatResponse(
      false,
      'Failed to retrieve statistics',
      null,
      { error: error.message }
    ));
  }
});

module.exports = router;
