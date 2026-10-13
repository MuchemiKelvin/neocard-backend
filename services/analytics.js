const crypto = require('crypto');
const database = require('../database');
const { sha256, generateId } = require('../config/neocareAi');

const MISSING_LAYERS = Object.freeze({
  cross_channel_journey: ['channel', 'shared_person_id'],
  educational_engagement: ['lesson_id', 'channel'],
  offline_to_online_impact: ['channel', 'offline_source'],
  verified_outcomes: ['outcome_type', 'verified_result'],
  long_term_sponsor_impact: ['sponsor_id', 'period', 'shared_person_id']
});

class AnalyticsError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'AnalyticsError';
    this.status = status;
    this.code = code;
  }
}

async function writeAudit(tenantId, event, details) {
  const id = generateId('an');
  const timestamp = new Date().toISOString();
  await database.createProofEvent({
    id,
    tab_id: 1,
    action: `analytics.${event}`,
    user_uid: tenantId || 'analytics',
    session_id: details.user_id || null,
    input_json: details,
    output_json: { event, timestamp, code: details.code || null },
    hash: sha256(`${id}|${tenantId}|${event}|${timestamp}|${crypto.randomBytes(4).toString('hex')}`),
    audit_status: 'RECORDED'
  });
}

function readMeta(row) {
  if (!row.metadata_json) return {};
  try {
    const value = JSON.parse(row.metadata_json);
    return value && typeof value === 'object' ? value : {};
  } catch (error) {
    return {};
  }
}

function hasFields(row, fields) {
  const meta = readMeta(row);
  return fields.every((field) => meta[field] != null && String(meta[field]).trim() !== '');
}

function layerFrom(rows, fields, countOf) {
  const ready = rows.filter((row) => hasFields(row, fields));
  if (!ready.length) {
    return { supported: false, count: 0, missing: fields };
  }
  return { supported: true, count: countOf(ready), source: 'analytics_events' };
}

function countCrossChannel(rows) {
  const channels = new Map();
  rows.forEach((row) => {
    const meta = readMeta(row);
    const person = String(meta.shared_person_id);
    const set = channels.get(person) || new Set();
    set.add(String(meta.channel));
    channels.set(person, set);
  });
  return [...channels.values()].filter((set) => set.size > 1).length;
}

class AnalyticsService {
  async assertTenantAccess(tenantId, auth) {
    if (!tenantId) {
      throw new AnalyticsError(400, 'tenant_id is required.', 'MISSING_FIELD');
    }
    if (auth.admin) return;
    if (!auth.deviceId) {
      throw new AnalyticsError(403, 'This credential cannot read that school.', 'TENANT_FORBIDDEN');
    }
    const linked = await database.campusDeviceBelongsToTenant(tenantId, auth.deviceId);
    if (!linked) {
      throw new AnalyticsError(403, 'This credential cannot read that school.', 'TENANT_FORBIDDEN');
    }
  }

  async recordEvent(input, auth) {
    const tenantId = String(input.tenant_id || '').trim();
    const eventType = String(input.event_type || '').trim();
    const moduleName = String(input.module || '').trim();
    const timestamp = input.timestamp || new Date().toISOString();
    if (!tenantId || !eventType || !moduleName) {
      throw new AnalyticsError(400, 'tenant_id, event_type, module, and timestamp are required.', 'MISSING_FIELD');
    }
    await this.assertTenantAccess(tenantId, auth);
    const eventId = input.event_id || generateId('evt');
    const inserted = await database.insertAnalyticsEvent({
      event_id: eventId,
      tenant_id: tenantId,
      user_id: input.user_id || null,
      school_id: input.school_id || tenantId,
      module: moduleName,
      event_type: eventType,
      campaign_id: input.campaign_id || null,
      content_id: input.content_id || null,
      session_id: input.session_id || null,
      device_id: input.device_id || auth.deviceId || null,
      metadata_json: input.metadata ? JSON.stringify(input.metadata) : null,
      created_at: timestamp
    });
    if (!inserted) {
      throw new AnalyticsError(409, 'This event_id was already recorded.', 'DUPLICATE_EVENT');
    }
    await writeAudit(tenantId, 'event', {
      user_id: input.user_id || null,
      code: 'RECORDED',
      event_type: eventType,
      module: moduleName
    });
    return { event_id: eventId, tenant_id: tenantId, event_type: eventType, module: moduleName, timestamp };
  }

  async summarize(tenantId, auth, from, to) {
    await this.assertTenantAccess(tenantId, auth);
    const rows = await database.summarizeAnalyticsEvents(tenantId, from, to);
    const users = new Set(rows.map((row) => row.user_id).filter(Boolean));
    const modules = {};
    const countType = (type) => rows.filter((row) => row.event_type === type).length;
    rows.forEach((row) => {
      modules[row.module] = (modules[row.module] || 0) + 1;
    });
    return {
      period: { from: from || null, to: to || null },
      tenant_id: tenantId,
      active_users: users.size,
      events: rows.length,
      lessons_opened: countType('lesson_opened'),
      lessons_completed: countType('lesson_completed'),
      submissions: countType('submission'),
      content_generated: countType('content_generated'),
      sponsor_interactions: countType('sponsor_interaction'),
      module_breakdown: modules
    };
  }

  async proofLayers() {
    const verified = await database.countVerifiedScans();
    const repeats = await database.countRepeatEngagement();
    const events = await database.listAnalyticsEvents();
    return {
      verified_participation: { supported: true, count: verified, source: 'scans.verified' },
      repeat_engagement: { supported: true, count: repeats, source: 'scans.uid+campaign_id' },
      cross_channel_journey: layerFrom(events, MISSING_LAYERS.cross_channel_journey, countCrossChannel),
      educational_engagement: layerFrom(events, MISSING_LAYERS.educational_engagement, (rows) => rows.length),
      offline_to_online_impact: layerFrom(events, MISSING_LAYERS.offline_to_online_impact, (rows) => rows.length),
      verified_outcomes: layerFrom(events, MISSING_LAYERS.verified_outcomes, (rows) => rows.length),
      long_term_sponsor_impact: layerFrom(events, MISSING_LAYERS.long_term_sponsor_impact, (rows) => rows.length)
    };
  }
}

module.exports = new AnalyticsService();
module.exports.AnalyticsError = AnalyticsError;
