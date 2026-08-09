#!/usr/bin/env node
/**
 * Copy the live SQLite database to database/backups/ with a timestamp.
 * Does not modify or delete the source file.
 *
 * Usage: npm run db:backup
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const config = require('../config');

const src = path.resolve(config.getDatabasePath());
const backupsDir = path.resolve(__dirname, '../database/backups');

if (!fs.existsSync(src)) {
  console.error(`Source database not found: ${src}`);
  process.exit(1);
}

if (path.basename(src) !== 'neocard.db' && process.env.ALLOW_BACKUP_NON_LIVE !== '1') {
  console.error(
    `Refusing to backup non-live path "${src}". ` +
      'Set ALLOW_BACKUP_NON_LIVE=1 to override, or point DB_PATH at the live file.'
  );
  process.exit(1);
}

fs.mkdirSync(backupsDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dest = path.join(backupsDir, `neocard_${stamp}.db`);
fs.copyFileSync(src, dest);

const hash = crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex');
const srcStat = fs.statSync(src);
const destStat = fs.statSync(dest);

console.log('Backup complete');
console.log(`  source : ${src} (${srcStat.size} bytes)`);
console.log(`  backup : ${dest} (${destStat.size} bytes)`);
console.log(`  sha256 : ${hash}`);
