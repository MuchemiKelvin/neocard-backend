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

      -- AI Requests table
      CREATE TABLE IF NOT EXISTS ai_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT UNIQUE NOT NULL,
        tab_id INTEGER NOT NULL,
        request_data TEXT NOT NULL,
        ai_mode TEXT NOT NULL DEFAULT 'mock',
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME,
        FOREIGN KEY (tab_id) REFERENCES ai_tabs(id)
      );

      -- AI Responses table
      CREATE TABLE IF NOT EXISTS ai_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL,
        tab_id INTEGER NOT NULL,
        response_data TEXT NOT NULL,
        confidence_score REAL,
        risk_level TEXT,
        processing_time_ms INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES ai_requests(request_id),
        FOREIGN KEY (tab_id) REFERENCES ai_tabs(id)
      );

      -- AI Proof Logs table
      CREATE TABLE IF NOT EXISTS ai_proof_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL,
        tab_id INTEGER NOT NULL,
        aei_checksum TEXT NOT NULL,
        proof_type TEXT NOT NULL DEFAULT 'ai_analysis',
        verification_status BOOLEAN DEFAULT 0,
        print_triggered BOOLEAN DEFAULT 0,
        proof_generated BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES ai_requests(request_id),
        FOREIGN KEY (tab_id) REFERENCES ai_tabs(id)
      );

      -- AI Tabs reference table
      CREATE TABLE IF NOT EXISTS ai_tabs (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        response_type TEXT NOT NULL,
        requires_aei BOOLEAN DEFAULT 1,
        has_print_trigger BOOLEAN DEFAULT 0,
        has_proof_trigger BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Care Roles reference table
      CREATE TABLE IF NOT EXISTS care_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_code TEXT UNIQUE NOT NULL,
        role_name TEXT NOT NULL,
        role_name_nl TEXT,
        description TEXT,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Users table (NeoCard User Dashboard)
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        role_id INTEGER,
        neocard_uid TEXT,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced_to_neocare BOOLEAN DEFAULT 0,
        last_sync_at DATETIME,
        FOREIGN KEY (role_id) REFERENCES care_roles(id)
      );

      -- Hardware devices table
      CREATE TABLE IF NOT EXISTS hardware_devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT UNIQUE NOT NULL,
        device_type TEXT NOT NULL,
        device_name TEXT NOT NULL,
        serial_number TEXT,
        firmware_version TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Hardware mappings table (links users to hardware)
      CREATE TABLE IF NOT EXISTS hardware_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        unassigned_at DATETIME,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (device_id) REFERENCES hardware_devices(device_id)
      );

      -- Sync logs table (NeoCard → NeoCare synchronization)
      CREATE TABLE IF NOT EXISTS sync_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sync_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        sync_status TEXT NOT NULL,
        sync_data TEXT,
        error_message TEXT,
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entity_id) REFERENCES users(user_id)
      );

      -- Clients table (for NeoCare Dashboard)
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        date_of_birth DATE,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Client assignments (links care workers to clients)
      CREATE TABLE IF NOT EXISTS client_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        unassigned_at DATETIME,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (client_id) REFERENCES clients(client_id)
      );

      -- NeoCare AI Proof Events table (for all AI operations)
      CREATE TABLE IF NOT EXISTS neocare_proof_events (
        id TEXT PRIMARY KEY,
        tab_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        user_uid TEXT NOT NULL,
        session_id TEXT,
        input_json TEXT NOT NULL,
        output_json TEXT NOT NULL,
        hash TEXT UNIQUE NOT NULL,
        audit_status TEXT DEFAULT 'RECORDED',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- NeoCare Certificates table (for Tab 4)
      CREATE TABLE IF NOT EXISTS neocare_certificates (
        id TEXT PRIMARY KEY,
        certificate_type TEXT NOT NULL,
        user_uid TEXT NOT NULL,
        session_id TEXT,
        subject_id TEXT,
        procedure_code TEXT,
        status TEXT DEFAULT 'CERTIFIED',
        payload_json TEXT NOT NULL,
        proof_hash TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- NeoCare AI Video Assets table (for Tab 6)
      CREATE TABLE IF NOT EXISTS neocare_ai_video_assets (
        id TEXT PRIMARY KEY,
        procedure_code TEXT NOT NULL,
        title TEXT NOT NULL,
        duration_sec INTEGER,
        ref TEXT NOT NULL,
        language TEXT,
        context TEXT,
        priority INTEGER DEFAULT 0,
        risk_tags TEXT,
        tags TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Sponsor Blocks table (for Tab 3)
      CREATE TABLE IF NOT EXISTS sponsor_blocks (
        id TEXT PRIMARY KEY,
        status TEXT DEFAULT 'NOT_SOLD',
        starts_at DATETIME,
        ends_at DATETIME,
        sponsor_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Episode Gates table (for Tab 3)
      CREATE TABLE IF NOT EXISTS episode_gates (
        episode_id TEXT PRIMARY KEY,
        is_unlocked BOOLEAN DEFAULT 0,
        unlock_until DATETIME,
        block_target INTEGER DEFAULT 10000,
        block_progress INTEGER DEFAULT 0,
        buffer_count INTEGER DEFAULT 0,
        last_block_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_scans_uid ON scans(uid);
      CREATE INDEX IF NOT EXISTS idx_scans_campaign ON scans(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_scans_timestamp ON scans(timestamp);
      CREATE INDEX IF NOT EXISTS idx_fraud_uid ON fraud_tracking(uid);
      CREATE INDEX IF NOT EXISTS idx_ai_requests_tab_id ON ai_requests(tab_id);
      CREATE INDEX IF NOT EXISTS idx_ai_requests_status ON ai_requests(status);
      CREATE INDEX IF NOT EXISTS idx_ai_responses_request_id ON ai_responses(request_id);
      CREATE INDEX IF NOT EXISTS idx_ai_proof_logs_request_id ON ai_proof_logs(request_id);
      CREATE INDEX IF NOT EXISTS idx_ai_proof_logs_checksum ON ai_proof_logs(aei_checksum);
      CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
      CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_neocard_uid ON users(neocard_uid);
      CREATE INDEX IF NOT EXISTS idx_hardware_mappings_user_id ON hardware_mappings(user_id);
      CREATE INDEX IF NOT EXISTS idx_hardware_mappings_device_id ON hardware_mappings(device_id);
      CREATE INDEX IF NOT EXISTS idx_sync_logs_entity_id ON sync_logs(entity_id);
      CREATE INDEX IF NOT EXISTS idx_sync_logs_sync_type ON sync_logs(sync_type);
      CREATE INDEX IF NOT EXISTS idx_clients_client_id ON clients(client_id);
      CREATE INDEX IF NOT EXISTS idx_client_assignments_user_id ON client_assignments(user_id);
      CREATE INDEX IF NOT EXISTS idx_client_assignments_client_id ON client_assignments(client_id);
      CREATE INDEX IF NOT EXISTS idx_neocare_proof_events_user_uid ON neocare_proof_events(user_uid);
      CREATE INDEX IF NOT EXISTS idx_neocare_proof_events_tab_id ON neocare_proof_events(tab_id);
      CREATE INDEX IF NOT EXISTS idx_neocare_proof_events_hash ON neocare_proof_events(hash);
      CREATE INDEX IF NOT EXISTS idx_neocare_proof_events_created_at ON neocare_proof_events(created_at);
      CREATE INDEX IF NOT EXISTS idx_neocare_certificates_user_uid ON neocare_certificates(user_uid);
      CREATE INDEX IF NOT EXISTS idx_neocare_certificates_type ON neocare_certificates(certificate_type);
      CREATE INDEX IF NOT EXISTS idx_neocare_ai_video_assets_procedure ON neocare_ai_video_assets(procedure_code);
      CREATE INDEX IF NOT EXISTS idx_neocare_ai_video_assets_active ON neocare_ai_video_assets(is_active);
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

    // Insert AI tabs reference data
    const insertAiTabs = `
      INSERT OR IGNORE INTO ai_tabs (id, name, description, response_type, requires_aei, has_print_trigger, has_proof_trigger) VALUES
      (1, 'Audit Dashboard', 'Audit and verification dashboard', 'audit_data', 1, 0, 0),
      (2, 'Sponsor Dashboard', 'Sponsor management and analytics', 'sponsor_data', 1, 0, 0),
      (3, 'User NeoCard', 'User card management and tracking', 'user_card_data', 1, 0, 0),
      (4, 'Sponsor NeoCard', 'Sponsor card management', 'sponsor_card_data', 1, 0, 0),
      (5, 'Analytics Dashboard', 'Analytics and reporting', 'analytics_data', 1, 0, 0),
      (6, 'Campaign Management', 'Campaign creation and management', 'campaign_data', 1, 0, 0),
      (7, 'User Management', 'User account and profile management', 'user_data', 1, 0, 0),
      (8, 'Payment Processing', 'Payment and transaction management', 'payment_data', 1, 0, 0),
      (9, 'Sponsor NeoCard Dashboard', 'Special dashboard with print/proof functionality', 'sponsor_neocard_data', 1, 1, 1),
      (10, 'Reports Dashboard', 'Reports and data export', 'reports_data', 1, 0, 0),
      (11, 'Settings Dashboard', 'System settings and configuration', 'settings_data', 1, 0, 0),
      (12, 'Notifications Dashboard', 'Notification management', 'notifications_data', 1, 0, 0),
      (13, 'System Monitoring', 'System health and monitoring', 'monitoring_data', 1, 0, 0);
    `;

    // Insert Care Roles reference data
    const insertCareRoles = `
      INSERT OR IGNORE INTO care_roles (role_code, role_name, role_name_nl, description) VALUES
      ('nurse', 'Nurse', 'Verpleegkundige', 'Registered nurse providing medical care'),
      ('caregiver', 'Caregiver', 'Verzorgende IG', 'Certified caregiver providing personal care'),
      ('helper', 'Helper', 'Homecare Assistant', 'Homecare assistant providing support services'),
      ('household_assistant', 'Household Assistant', 'Huishoudelijke Hulp', 'Household assistance and domestic support'),
      ('midwife', 'Midwife', 'Kraamzorg', 'Midwife providing maternity and postnatal care'),
      ('palliative_care', 'Palliative Care Worker', 'Palliatieve Zorg', 'Specialized palliative care provider'),
      ('homecare_nurse', 'Homecare Nurse', 'Thuiszorg', 'Homecare nurse providing medical services at home'),
      ('ambulance_crew', 'Ambulance Crew', 'Ambulance Personeel', 'Emergency medical services personnel'),
      ('funeral_team', 'Funeral / House-of-Honor Team', 'Uitvaartteam', 'Funeral and end-of-life services team'),
      ('care_farm_staff', 'Care Farm Staff', 'Zorgboerderij', 'Care farm staff providing therapeutic activities'),
      ('home_chef', 'Home Chef', 'Thuiskok', 'Home chef providing meal preparation services');
    `;

    return new Promise((resolve, reject) => {
      this.db.exec(insertApiKeys + insertCampaigns + insertAiTabs + insertCareRoles, (err) => {
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

  // AI-related database methods
  async insertAiRequest(requestData) {
    const sql = `
      INSERT INTO ai_requests (request_id, tab_id, request_data, ai_mode, status, processed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        requestData.request_id,
        requestData.tab_id,
        requestData.request_data,
        requestData.ai_mode,
        requestData.status,
        requestData.processed_at
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async insertAiResponse(responseData) {
    const sql = `
      INSERT INTO ai_responses (request_id, tab_id, response_data, confidence_score, risk_level, processing_time_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        responseData.request_id,
        responseData.tab_id,
        responseData.response_data,
        responseData.confidence_score,
        responseData.risk_level,
        responseData.processing_time_ms
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async insertAiProofLog(proofData) {
    const sql = `
      INSERT INTO ai_proof_logs (request_id, tab_id, aei_checksum, proof_type, verification_status, print_triggered, proof_generated)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        proofData.request_id,
        proofData.tab_id,
        proofData.aei_checksum,
        proofData.proof_type,
        proofData.verification_status,
        proofData.print_triggered,
        proofData.proof_generated
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async getAiTab(tabId) {
    const sql = 'SELECT * FROM ai_tabs WHERE id = ?';
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [tabId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getAllAiTabs() {
    const sql = 'SELECT * FROM ai_tabs ORDER BY id';
    
    return new Promise((resolve, reject) => {
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getAiRequest(requestId) {
    const sql = 'SELECT * FROM ai_requests WHERE request_id = ?';
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [requestId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getAiResponse(requestId) {
    const sql = 'SELECT * FROM ai_responses WHERE request_id = ?';
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [requestId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getAiProofLog(requestId) {
    const sql = 'SELECT * FROM ai_proof_logs WHERE request_id = ?';
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [requestId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getAiRequests(filters = {}) {
    let sql = 'SELECT ar.*, at.name as tab_name FROM ai_requests ar JOIN ai_tabs at ON ar.tab_id = at.id WHERE 1=1';
    const params = [];

    if (filters.tab_id) {
      sql += ' AND ar.tab_id = ?';
      params.push(filters.tab_id);
    }

    if (filters.status) {
      sql += ' AND ar.status = ?';
      params.push(filters.status);
    }

    if (filters.ai_mode) {
      sql += ' AND ar.ai_mode = ?';
      params.push(filters.ai_mode);
    }

    if (filters.start_date) {
      sql += ' AND DATE(ar.created_at) >= ?';
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      sql += ' AND DATE(ar.created_at) <= ?';
      params.push(filters.end_date);
    }

    sql += ' ORDER BY ar.created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
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

  async updateAiRequestStatus(requestId, status, processedAt = null) {
    const sql = 'UPDATE ai_requests SET status = ?, processed_at = ? WHERE request_id = ?';
    
    return new Promise((resolve, reject) => {
      this.db.run(sql, [status, processedAt, requestId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // ==================== USER MANAGEMENT METHODS ====================

  async createUser(userData) {
    const sql = `
      INSERT INTO users (user_id, email, first_name, last_name, phone, role_id, neocard_uid, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        userData.user_id,
        userData.email || null,
        userData.first_name,
        userData.last_name,
        userData.phone || null,
        userData.role_id || null,
        userData.neocard_uid || null,
        userData.active !== undefined ? userData.active : 1
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, user_id: userData.user_id });
        }
      });
    });
  }

  async getUser(userId) {
    const sql = `
      SELECT u.*, cr.role_code, cr.role_name, cr.role_name_nl 
      FROM users u 
      LEFT JOIN care_roles cr ON u.role_id = cr.id 
      WHERE u.user_id = ?
    `;
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getUserByEmail(email) {
    const sql = `
      SELECT u.*, cr.role_code, cr.role_name, cr.role_name_nl 
      FROM users u 
      LEFT JOIN care_roles cr ON u.role_id = cr.id 
      WHERE u.email = ?
    `;
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [email], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getAllUsers(filters = {}) {
    let sql = `
      SELECT u.*, cr.role_code, cr.role_name, cr.role_name_nl 
      FROM users u 
      LEFT JOIN care_roles cr ON u.role_id = cr.id 
      WHERE 1=1
    `;
    const params = [];

    if (filters.role_id) {
      sql += ' AND u.role_id = ?';
      params.push(filters.role_id);
    }

    if (filters.active !== undefined) {
      sql += ' AND u.active = ?';
      params.push(filters.active ? 1 : 0);
    }

    if (filters.search) {
      sql += ' AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    sql += ' ORDER BY u.created_at DESC';

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

  async updateUser(userId, userData) {
    const updates = [];
    const params = [];

    if (userData.email !== undefined) {
      updates.push('email = ?');
      params.push(userData.email);
    }
    if (userData.first_name !== undefined) {
      updates.push('first_name = ?');
      params.push(userData.first_name);
    }
    if (userData.last_name !== undefined) {
      updates.push('last_name = ?');
      params.push(userData.last_name);
    }
    if (userData.phone !== undefined) {
      updates.push('phone = ?');
      params.push(userData.phone);
    }
    if (userData.role_id !== undefined) {
      updates.push('role_id = ?');
      params.push(userData.role_id);
    }
    if (userData.neocard_uid !== undefined) {
      updates.push('neocard_uid = ?');
      params.push(userData.neocard_uid);
    }
    if (userData.active !== undefined) {
      updates.push('active = ?');
      params.push(userData.active ? 1 : 0);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`;

    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  async deleteUser(userId) {
    const sql = 'UPDATE users SET active = 0 WHERE user_id = ?';
    
    return new Promise((resolve, reject) => {
      this.db.run(sql, [userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // ==================== ROLE MANAGEMENT METHODS ====================

  async getAllRoles() {
    const sql = 'SELECT * FROM care_roles WHERE active = 1 ORDER BY role_name';
    
    return new Promise((resolve, reject) => {
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getRole(roleId) {
    const sql = 'SELECT * FROM care_roles WHERE id = ?';
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [roleId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getRoleByCode(roleCode) {
    const sql = 'SELECT * FROM care_roles WHERE role_code = ?';
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [roleCode], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async assignRoleToUser(userId, roleId) {
    const sql = 'UPDATE users SET role_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?';
    
    return new Promise((resolve, reject) => {
      this.db.run(sql, [roleId, userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // ==================== HARDWARE MANAGEMENT METHODS ====================

  async createHardwareDevice(deviceData) {
    const sql = `
      INSERT INTO hardware_devices (device_id, device_type, device_name, serial_number, firmware_version, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        deviceData.device_id,
        deviceData.device_type,
        deviceData.device_name,
        deviceData.serial_number || null,
        deviceData.firmware_version || null,
        deviceData.status || 'active'
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, device_id: deviceData.device_id });
        }
      });
    });
  }

  async getHardwareDevice(deviceId) {
    const sql = 'SELECT * FROM hardware_devices WHERE device_id = ?';
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [deviceId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getAllHardwareDevices(filters = {}) {
    let sql = 'SELECT * FROM hardware_devices WHERE 1=1';
    const params = [];

    if (filters.device_type) {
      sql += ' AND device_type = ?';
      params.push(filters.device_type);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
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

  async assignHardwareToUser(userId, deviceId) {
    // First, unassign any existing active mappings for this device
    await this.unassignHardwareFromUser(null, deviceId);
    
    const sql = `
      INSERT INTO hardware_mappings (user_id, device_id, active)
      VALUES (?, ?, 1)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [userId, deviceId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      });
    });
  }

  async unassignHardwareFromUser(userId, deviceId) {
    let sql = 'UPDATE hardware_mappings SET active = 0, unassigned_at = CURRENT_TIMESTAMP WHERE active = 1';
    const params = [];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    if (deviceId) {
      sql += ' AND device_id = ?';
      params.push(deviceId);
    }

    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  async getUserHardware(userId) {
    const sql = `
      SELECT hm.*, hd.device_type, hd.device_name, hd.serial_number, hd.firmware_version, hd.status
      FROM hardware_mappings hm
      JOIN hardware_devices hd ON hm.device_id = hd.device_id
      WHERE hm.user_id = ? AND hm.active = 1
    `;
    
    return new Promise((resolve, reject) => {
      this.db.all(sql, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getHardwareUsers(deviceId) {
    const sql = `
      SELECT hm.*, u.user_id, u.first_name, u.last_name, u.email, cr.role_name
      FROM hardware_mappings hm
      JOIN users u ON hm.user_id = u.user_id
      LEFT JOIN care_roles cr ON u.role_id = cr.id
      WHERE hm.device_id = ? AND hm.active = 1
    `;
    
    return new Promise((resolve, reject) => {
      this.db.all(sql, [deviceId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // ==================== SYNC MANAGEMENT METHODS ====================

  async logSync(syncData) {
    const sql = `
      INSERT INTO sync_logs (sync_type, entity_type, entity_id, sync_status, sync_data, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        syncData.sync_type,
        syncData.entity_type,
        syncData.entity_id,
        syncData.sync_status,
        syncData.sync_data ? JSON.stringify(syncData.sync_data) : null,
        syncData.error_message || null
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      });
    });
  }

  async getSyncLogs(filters = {}) {
    let sql = 'SELECT * FROM sync_logs WHERE 1=1';
    const params = [];

    if (filters.entity_type) {
      sql += ' AND entity_type = ?';
      params.push(filters.entity_type);
    }

    if (filters.sync_status) {
      sql += ' AND sync_status = ?';
      params.push(filters.sync_status);
    }

    if (filters.entity_id) {
      sql += ' AND entity_id = ?';
      params.push(filters.entity_id);
    }

    sql += ' ORDER BY synced_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
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

  async markUserSynced(userId, synced = true) {
    const sql = 'UPDATE users SET synced_to_neocare = ?, last_sync_at = CURRENT_TIMESTAMP WHERE user_id = ?';
    
    return new Promise((resolve, reject) => {
      this.db.run(sql, [synced ? 1 : 0, userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  async getUnsyncedUsers() {
    const sql = `
      SELECT u.*, cr.role_code, cr.role_name, cr.role_name_nl 
      FROM users u 
      LEFT JOIN care_roles cr ON u.role_id = cr.id 
      WHERE u.synced_to_neocare = 0 AND u.active = 1
    `;
    
    return new Promise((resolve, reject) => {
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // ==================== CLIENT MANAGEMENT METHODS ====================

  async createClient(clientData) {
    const sql = `
      INSERT INTO clients (client_id, first_name, last_name, email, phone, address, date_of_birth, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        clientData.client_id,
        clientData.first_name,
        clientData.last_name,
        clientData.email || null,
        clientData.phone || null,
        clientData.address || null,
        clientData.date_of_birth || null,
        clientData.active !== undefined ? clientData.active : 1
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, client_id: clientData.client_id });
        }
      });
    });
  }

  async assignClientToUser(userId, clientId) {
    const sql = `
      INSERT INTO client_assignments (user_id, client_id, active)
      VALUES (?, ?, 1)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [userId, clientId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      });
    });
  }

  async getUserClients(userId) {
    const sql = `
      SELECT ca.*, c.client_id, c.first_name, c.last_name, c.email, c.phone, c.address
      FROM client_assignments ca
      JOIN clients c ON ca.client_id = c.client_id
      WHERE ca.user_id = ? AND ca.active = 1
    `;
    
    return new Promise((resolve, reject) => {
      this.db.all(sql, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getClientUsers(clientId) {
    const sql = `
      SELECT ca.*, u.user_id, u.first_name, u.last_name, u.email, cr.role_name
      FROM client_assignments ca
      JOIN users u ON ca.user_id = u.user_id
      LEFT JOIN care_roles cr ON u.role_id = cr.id
      WHERE ca.client_id = ? AND ca.active = 1
    `;
    
    return new Promise((resolve, reject) => {
      this.db.all(sql, [clientId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // ==================== NEOCARE AI METHODS ====================

  async createProofEvent(eventData) {
    const sql = `
      INSERT INTO neocare_proof_events (id, tab_id, action, user_uid, session_id, input_json, output_json, hash, audit_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        eventData.id,
        eventData.tab_id,
        eventData.action,
        eventData.user_uid,
        eventData.session_id || null,
        JSON.stringify(eventData.input_json),
        JSON.stringify(eventData.output_json),
        eventData.hash,
        eventData.audit_status || 'RECORDED'
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: eventData.id });
        }
      });
    });
  }

  async getProofEvents(filters = {}) {
    let sql = 'SELECT * FROM neocare_proof_events WHERE 1=1';
    const params = [];

    if (filters.user_uid) {
      sql += ' AND user_uid = ?';
      params.push(filters.user_uid);
    }

    if (filters.tab_id) {
      sql += ' AND tab_id = ?';
      params.push(filters.tab_id);
    }

    if (filters.session_id) {
      sql += ' AND session_id = ?';
      params.push(filters.session_id);
    }

    if (filters.from) {
      sql += ' AND created_at >= ?';
      params.push(filters.from);
    }

    if (filters.to) {
      sql += ' AND created_at <= ?';
      params.push(filters.to);
    }

    sql += ' ORDER BY created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const events = rows.map(row => ({
            ...row,
            input_json: JSON.parse(row.input_json),
            output_json: JSON.parse(row.output_json)
          }));
          resolve(events);
        }
      });
    });
  }

  async createCertificate(certData) {
    const sql = `
      INSERT INTO neocare_certificates (id, certificate_type, user_uid, session_id, subject_id, procedure_code, status, payload_json, proof_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        certData.id,
        certData.certificate_type,
        certData.user_uid,
        certData.session_id || null,
        certData.subject_id || null,
        certData.procedure_code || null,
        certData.status || 'CERTIFIED',
        JSON.stringify(certData.payload_json),
        certData.proof_hash
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: certData.id });
        }
      });
    });
  }

  async getCertificates(filters = {}) {
    let sql = 'SELECT * FROM neocare_certificates WHERE 1=1';
    const params = [];

    if (filters.user_uid) {
      sql += ' AND user_uid = ?';
      params.push(filters.user_uid);
    }

    if (filters.certificate_type) {
      sql += ' AND certificate_type = ?';
      params.push(filters.certificate_type);
    }

    if (filters.from) {
      sql += ' AND created_at >= ?';
      params.push(filters.from);
    }

    if (filters.to) {
      sql += ' AND created_at <= ?';
      params.push(filters.to);
    }

    sql += ' ORDER BY created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const certs = rows.map(row => ({
            ...row,
            payload_json: JSON.parse(row.payload_json)
          }));
          resolve(certs);
        }
      });
    });
  }

  async createAiVideoAsset(assetData) {
    const sql = `
      INSERT INTO neocare_ai_video_assets (id, procedure_code, title, duration_sec, ref, language, context, priority, risk_tags, tags, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        assetData.id,
        assetData.procedure_code,
        assetData.title,
        assetData.duration_sec || null,
        assetData.ref,
        assetData.language || null,
        assetData.context || null,
        assetData.priority || 0,
        assetData.risk_tags ? JSON.stringify(assetData.risk_tags) : null,
        assetData.tags ? JSON.stringify(assetData.tags) : null,
        assetData.is_active !== undefined ? assetData.is_active : 1
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: assetData.id });
        }
      });
    });
  }

  async getAiVideoAssets(filters = {}) {
    let sql = 'SELECT * FROM neocare_ai_video_assets WHERE 1=1';
    const params = [];

    if (filters.procedure_code) {
      sql += ' AND procedure_code = ?';
      params.push(filters.procedure_code);
    }

    if (filters.is_active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(filters.is_active ? 1 : 0);
    }

    if (filters.context) {
      sql += ' AND (context IS NULL OR context = ?)';
      params.push(filters.context);
    }

    sql += ' ORDER BY priority DESC, created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const assets = rows.map(row => ({
            ...row,
            risk_tags: row.risk_tags ? JSON.parse(row.risk_tags) : [],
            tags: row.tags ? JSON.parse(row.tags) : []
          }));
          resolve(assets);
        }
      });
    });
  }

  async createSponsorBlock(blockData) {
    const sql = `
      INSERT INTO sponsor_blocks (id, status, starts_at, ends_at, sponsor_id)
      VALUES (?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        blockData.id,
        blockData.status || 'NOT_SOLD',
        blockData.starts_at || null,
        blockData.ends_at || null,
        blockData.sponsor_id || null
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: blockData.id });
        }
      });
    });
  }

  async getSponsorBlocks(filters = {}) {
    let sql = 'SELECT * FROM sponsor_blocks WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY created_at DESC';

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

  async createEpisodeGate(gateData) {
    const sql = `
      INSERT INTO episode_gates (episode_id, is_unlocked, unlock_until, block_target, block_progress, buffer_count, last_block_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        gateData.episode_id,
        gateData.is_unlocked ? 1 : 0,
        gateData.unlock_until || null,
        gateData.block_target || 10000,
        gateData.block_progress || 0,
        gateData.buffer_count || 0,
        gateData.last_block_id || null
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ episode_id: gateData.episode_id });
        }
      });
    });
  }

  async getEpisodeGate(episodeId) {
    const sql = 'SELECT * FROM episode_gates WHERE episode_id = ?';
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [episodeId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async updateEpisodeGate(episodeId, updateData) {
    const updates = [];
    const params = [];

    if (updateData.is_unlocked !== undefined) {
      updates.push('is_unlocked = ?');
      params.push(updateData.is_unlocked ? 1 : 0);
    }

    if (updateData.unlock_until !== undefined) {
      updates.push('unlock_until = ?');
      params.push(updateData.unlock_until);
    }

    if (updateData.block_progress !== undefined) {
      updates.push('block_progress = ?');
      params.push(updateData.block_progress);
    }

    if (updateData.buffer_count !== undefined) {
      updates.push('buffer_count = ?');
      params.push(updateData.buffer_count);
    }

    if (updateData.last_block_id !== undefined) {
      updates.push('last_block_id = ?');
      params.push(updateData.last_block_id);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(episodeId);

    const sql = `UPDATE episode_gates SET ${updates.join(', ')} WHERE episode_id = ?`;

    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
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
