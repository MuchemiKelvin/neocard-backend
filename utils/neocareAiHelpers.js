// NeoCare AI Helper Utilities

const crypto = require('crypto');
const { sha256, generateId } = require('../config/neocareAi');

/**
 * Generate SHA256 hash for proof
 */
function generateProofHash(data) {
  return sha256(JSON.stringify(data));
}

/**
 * Generate unique event ID
 */
function generateEventId() {
  return generateId('event');
}

/**
 * Generate unique certificate ID
 */
function generateCertificateId() {
  return generateId('cert');
}

/**
 * Generate unique video asset ID
 */
function generateVideoAssetId() {
  return generateId('video');
}

/**
 * Generate unique sponsor block ID
 */
function generateSponsorBlockId() {
  return generateId('block');
}

/**
 * Safe string helper
 */
function safeStr(v, maxLen = 500) {
  const s = String(v ?? '').trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/**
 * Convert to array helper
 */
function toArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  return [String(v)];
}

/**
 * Normalize string (lowercase, trim spaces)
 */
function norm(s) {
  return safeStr(s, 200).toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Safe integer parser
 */
function safeInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

/**
 * Parse ISO date
 */
function parseIsoDate(v) {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Minutes between two dates
 */
function minutesBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

/**
 * Safe object helper
 */
function safeObj(v) {
  return v && typeof v === 'object' ? v : {};
}

/**
 * Get current ISO timestamp
 */
function nowIso() {
  return new Date().toISOString();
}

module.exports = {
  generateProofHash,
  generateEventId,
  generateCertificateId,
  generateVideoAssetId,
  generateSponsorBlockId,
  safeStr,
  toArray,
  norm,
  safeInt,
  parseIsoDate,
  minutesBetween,
  safeObj,
  nowIso
};
