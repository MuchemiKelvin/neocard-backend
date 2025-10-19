// Database module for Neo Card™ Demo Backend

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('../config');

class Database {
  constructor() {
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const dbPath = path.resolve(config.database.path);
      
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Database connection error:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.initializeTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async initializeTables() {
    const createTables = `
      -- Scans table
      CREATE TABLE IF NOT EXISTS scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_id TEXT UNIQUE NOT NULL,
        uid TEXT NOT NULL,
        campaign_id TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        checksum TEXT NOT NULL,
        verified BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Campaigns table
      CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Admin API keys table
      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_name TEXT NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        permissions TEXT DEFAULT 'admin',
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Anti-fraud tracking table
      CREATE TABLE IF NOT EXISTS fraud_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT NOT NULL,
        last_scan_time DATETIME,
        daily_scan_count INTEGER DEFAULT 0,
        last_reset_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_scans_uid ON scans(uid);
      CREATE INDEX IF NOT EXISTS idx_scans_campaign ON scans(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_scans_timestamp ON scans(timestamp);
      CREATE INDEX IF NOT EXISTS idx_fraud_uid ON fraud_tracking(uid);
    `;

    return new Promise((resolve, reject) => {
      this.db.exec(createTables, (err) => {
        if (err) {
          console.error('Table creation error:', err);
          reject(err);
        } else {
          console.log('Database tables initialized');
          this.seedInitialData().then(resolve).catch(reject);
        }
      });
    });
  }

  async seedInitialData() {
    // Insert default API keys
    const insertApiKeys = `
      INSERT OR IGNORE INTO api_keys (key_name, api_key, permissions) VALUES
      ('Admin Demo Key', 'neocard_admin_demo_key_2024', 'admin'),
      ('Sponsor Demo Key', 'neocard_sponsor_demo_key_2024', 'sponsor');
    `;

    // Insert sample campaigns
    const insertCampaigns = `
      INSERT OR IGNORE INTO campaigns (campaign_id, name, description) VALUES
      ('DEMO01', 'Demo Campaign 1', 'Sample campaign for testing'),
      ('DEMO02', 'Demo Campaign 2', 'Another sample campaign');
    `;

    return new Promise((resolve, reject) => {
      this.db.exec(insertApiKeys + insertCampaigns, (err) => {
        if (err) {
          console.error('Data seeding error:', err);
          reject(err);
        } else {
          console.log('Initial data seeded');
          resolve();
        }
      });
    });
  }

  async insertScan(scanData) {
    const sql = `
      INSERT INTO scans (scan_id, uid, campaign_id, timestamp, checksum, verified)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        scanData.scan_id,
        scanData.uid,
        scanData.campaign_id,
        scanData.timestamp,
        scanData.checksum,
        scanData.verified
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async getScans(filters = {}) {
    let sql = 'SELECT * FROM scans WHERE 1=1';
    const params = [];

    if (filters.uid) {
      sql += ' AND uid = ?';
      params.push(filters.uid);
    }

    if (filters.campaign_id) {
      sql += ' AND campaign_id = ?';
      params.push(filters.campaign_id);
    }

    if (filters.start_date) {
      sql += ' AND timestamp >= ?';
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      sql += ' AND timestamp <= ?';
      params.push(filters.end_date);
    }

    sql += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getLastScanTime(uid) {
    const sql = 'SELECT timestamp FROM scans WHERE uid = ? ORDER BY timestamp DESC LIMIT 1';
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [uid], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.timestamp : null);
        }
      });
    });
  }

  async getDailyScanCount(uid, date) {
    const sql = 'SELECT COUNT(*) as count FROM scans WHERE uid = ? AND DATE(timestamp) = ?';
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [uid, date], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.count : 0);
        }
      });
    });
  }

  async validateApiKey(apiKey) {
    const sql = 'SELECT * FROM api_keys WHERE api_key = ? AND active = 1';
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [apiKey], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getStats() {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const queries = {
      totalScans: 'SELECT COUNT(*) as count FROM scans',
      todayScans: 'SELECT COUNT(*) as count FROM scans WHERE DATE(timestamp) = ?',
      yesterdayScans: 'SELECT COUNT(*) as count FROM scans WHERE DATE(timestamp) = ?',
      uniqueUids: 'SELECT COUNT(DISTINCT uid) as count FROM scans',
      lastScan: 'SELECT timestamp FROM scans ORDER BY timestamp DESC LIMIT 1'
    };

    const results = {};
    
    for (const [key, sql] of Object.entries(queries)) {
      try {
        const result = await new Promise((resolve, reject) => {
          const params = key.includes('today') ? [today] : key.includes('yesterday') ? [yesterday] : [];
          this.db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        
        if (key === 'lastScan') {
          results[key] = result ? result.timestamp : null;
        } else {
          results[key] = result ? result.count : 0;
        }
      } catch (error) {
        console.error(`Error getting ${key}:`, error);
        results[key] = key === 'lastScan' ? null : 0;
      }
    }

    return results;
  }

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Database close error:', err);
          } else {
            console.log('Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = new Database();
