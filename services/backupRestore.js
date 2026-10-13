const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const database = require('../database');
const config = require('../config');
const { sha256, generateId } = require('../config/neocareAi');

const QUOTA_BYTES = 20 * 1024 * 1024 * 1024;

class BackupError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'BackupError';
    this.status = status;
    this.code = code;
  }
}

function warningLevel(used, quota) {
  if (used >= quota) return 'FULL';
  if (used >= quota * 0.9) return 'WARNING_90';
  if (used >= quota * 0.8) return 'WARNING_80';
  return 'NORMAL';
}

function quotaView(row) {
  const remaining = Math.max(row.quota_bytes - row.used_bytes, 0);
  return {
    student_id: row.student_id,
    tenant_id: row.tenant_id,
    quota_bytes: row.quota_bytes,
    used_bytes: row.used_bytes,
    remaining_bytes: remaining,
    usage_percent: Math.round((row.used_bytes / row.quota_bytes) * 1000) / 10,
    warning_level: warningLevel(row.used_bytes, row.quota_bytes)
  };
}

async function writeAudit(tenantId, event, details) {
  const id = generateId('bak');
  const timestamp = new Date().toISOString();
  await database.createProofEvent({
    id,
    tab_id: 1,
    action: `backup.${event}`,
    user_uid: tenantId,
    session_id: details.student_id || null,
    input_json: details,
    output_json: { event, timestamp, code: details.code || null },
    hash: sha256(`${id}|${tenantId}|${event}|${timestamp}`),
    audit_status: 'RECORDED'
  });
}

class BackupRestore {
  async assertTenant(tenantId, auth) {
    if (!tenantId) throw new BackupError(400, 'tenant_id is required.', 'MISSING_FIELD');
    if (auth.admin) return;
    if (!auth.deviceId) {
      throw new BackupError(403, 'This credential cannot access that school.', 'UNAUTHORIZED');
    }
    const linked = await database.campusDeviceBelongsToTenant(tenantId, auth.deviceId);
    if (!linked) throw new BackupError(403, 'This credential cannot access that school.', 'UNAUTHORIZED');
  }

  requireAdmin(auth) {
    if (!auth.admin) throw new BackupError(403, 'Admin permission is required.', 'UNAUTHORIZED');
  }

  async createBackup(tenantId, auth) {
    this.requireAdmin(auth);
    const license = await database.getCampusLicense(tenantId);
    if (!license) throw new BackupError(404, 'School license not found.', 'TENANT_NOT_FOUND');
    const backupId = generateId('bak');
    const createdAt = new Date().toISOString();
    const version = await database.nextBackupVersion(tenantId);
    try {
      const source = path.resolve(config.getDatabasePath());
      const directory = path.resolve(__dirname, '../database/backups');
      fs.mkdirSync(directory, { recursive: true });
      const fileName = `${backupId}.db`;
      const destination = path.join(directory, fileName);
      fs.copyFileSync(source, destination);
      const checksum = crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex');
      const size = fs.statSync(destination).size;
      const record = {
        backup_id: backupId,
        tenant_id: tenantId,
        backup_type: 'MANUAL',
        status: 'SUCCESS',
        size_bytes: size,
        version,
        repository_ref: `database/backups/${fileName}`,
        checksum,
        created_at: createdAt
      };
      await database.insertCampusBackup(record);
      await writeAudit(tenantId, 'created', { code: 'SUCCESS', backup_id: backupId });
      return record;
    } catch (error) {
      const record = {
        backup_id: backupId,
        tenant_id: tenantId,
        backup_type: 'MANUAL',
        status: 'FAILED',
        size_bytes: 0,
        version,
        repository_ref: null,
        checksum: null,
        created_at: createdAt,
        error: error.message
      };
      await database.insertCampusBackup(record);
      await writeAudit(tenantId, 'failed', { code: 'FAILED', backup_id: backupId });
      throw new BackupError(500, 'Backup failed.', 'BACKUP_FAILED');
    }
  }

  async listBackups(tenantId, auth) {
    await this.assertTenant(tenantId, auth);
    return database.listCampusBackups(tenantId);
  }

  async getBackup(backupId, auth) {
    const backup = await database.getCampusBackup(backupId);
    if (!backup) throw new BackupError(404, 'Backup not found.', 'BACKUP_NOT_FOUND');
    await this.assertTenant(backup.tenant_id, auth);
    return backup;
  }

  async restoreBackup(backupId, auth) {
    this.requireAdmin(auth);
    const backup = await database.getCampusBackup(backupId);
    if (!backup) throw new BackupError(404, 'Backup not found.', 'BACKUP_NOT_FOUND');
    await writeAudit(backup.tenant_id, 'restore_requested', { code: 'REQUESTED', backup_id: backupId });
    if (backup.status !== 'SUCCESS' || !backup.repository_ref) {
      await writeAudit(backup.tenant_id, 'restore_failed', { code: 'FAILED', backup_id: backupId });
      throw new BackupError(409, 'This backup cannot be restored.', 'RESTORE_FAILED');
    }
    const source = path.resolve(__dirname, '..', backup.repository_ref);
    if (!fs.existsSync(source)) {
      await writeAudit(backup.tenant_id, 'restore_failed', { code: 'FAILED', backup_id: backupId });
      throw new BackupError(409, 'Backup file is missing.', 'RESTORE_FAILED');
    }
    const directory = path.resolve(__dirname, '../database/restores');
    fs.mkdirSync(directory, { recursive: true });
    const destination = path.join(directory, `${backup.backup_id}.db`);
    fs.copyFileSync(source, destination);
    const checksum = crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex');
    if (checksum !== backup.checksum) {
      await writeAudit(backup.tenant_id, 'restore_failed', { code: 'FAILED', backup_id: backupId });
      throw new BackupError(409, 'Restored file did not match the backup checksum.', 'RESTORE_FAILED');
    }
    await writeAudit(backup.tenant_id, 'restore_completed', { code: 'SUCCESS', backup_id: backupId });
    return {
      restore_id: generateId('rst'),
      backup_id: backup.backup_id,
      tenant_id: backup.tenant_id,
      status: 'SUCCESS',
      repository_ref: `database/restores/${backup.backup_id}.db`,
      checksum
    };
  }

  async getQuota(tenantId, studentId, auth) {
    await this.assertTenant(tenantId, auth);
    const row = await database.ensureStudentStorage(tenantId, studentId, QUOTA_BYTES);
    return quotaView(row);
  }

  async addUsage(tenantId, studentId, bytes, auth) {
    this.requireAdmin(auth);
    const amount = Number(bytes);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BackupError(400, 'bytes must be a positive number.', 'MISSING_FIELD');
    }
    const row = await database.ensureStudentStorage(tenantId, studentId, QUOTA_BYTES);
    if (row.used_bytes + amount > row.quota_bytes) {
      await writeAudit(tenantId, 'quota_blocked', { code: 'FULL', student_id: studentId });
      throw new BackupError(403, 'Student storage quota is full.', 'QUOTA_FULL');
    }
    await database.setStudentUsage(tenantId, studentId, row.used_bytes + amount);
    return this.getQuota(tenantId, studentId, auth);
  }

  async storeFile(tenantId, studentId, filename, content, auth) {
    this.requireAdmin(auth);
    const safeTenant = String(tenantId || '').trim();
    const safeStudent = String(studentId || '').trim();
    const safeName = path.basename(String(filename || '').trim());
    if (!safeTenant || !safeStudent || !safeName || safeTenant.includes('..') || safeStudent.includes('..')) {
      throw new BackupError(400, 'tenant_id, student_id, and filename are required.', 'MISSING_FIELD');
    }
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content || '');
    if (!buffer.length) {
      throw new BackupError(400, 'File content is required.', 'MISSING_FIELD');
    }
    const row = await database.ensureStudentStorage(safeTenant, safeStudent, QUOTA_BYTES);
    if (row.used_bytes + buffer.length > row.quota_bytes) {
      await writeAudit(safeTenant, 'quota_blocked', { code: 'FULL', student_id: safeStudent });
      throw new BackupError(403, 'Student storage quota is full.', 'QUOTA_FULL');
    }
    const fileId = generateId('fil');
    const directory = path.resolve(__dirname, '../database/student-files', safeTenant, safeStudent);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, fileId), buffer);
    const createdAt = new Date().toISOString();
    await database.insertStudentFile({
      file_id: fileId,
      tenant_id: safeTenant,
      student_id: safeStudent,
      filename: safeName,
      size_bytes: buffer.length,
      repository_ref: path.join('database/student-files', safeTenant, safeStudent, fileId),
      created_at: createdAt
    });
    await database.setStudentUsage(safeTenant, safeStudent, row.used_bytes + buffer.length);
    await writeAudit(safeTenant, 'file_stored', { code: 'SUCCESS', student_id: safeStudent });
    const quota = await this.getQuota(safeTenant, safeStudent, auth);
    return { file_id: fileId, filename: safeName, size_bytes: buffer.length, quota };
  }
}

module.exports = new BackupRestore();
module.exports.BackupError = BackupError;
module.exports.QUOTA_BYTES = QUOTA_BYTES;
