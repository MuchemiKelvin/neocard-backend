const crypto = require('crypto');
const database = require('../database');
const { client } = require('./b2Storage');
const { sha256, generateId } = require('../config/neocareAi');

class TemplateError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'TemplateError';
    this.status = status;
    this.code = code;
  }
}

async function writeAudit(tenantId, event, details) {
  const id = generateId('tpl');
  const timestamp = new Date().toISOString();
  await database.createProofEvent({
    id,
    tab_id: 1,
    action: `template.${event}`,
    user_uid: tenantId,
    session_id: details.device_id || null,
    input_json: details,
    output_json: { event, timestamp, code: details.code || null },
    hash: sha256(`${id}|${tenantId}|${event}|${timestamp}`),
    audit_status: 'RECORDED'
  });
}

function publicVersion(row) {
  return {
    template_id: row.template_id,
    tenant_id: row.tenant_id,
    name: row.name,
    version: row.version,
    checksum: row.checksum,
    size_bytes: row.size_bytes,
    created_at: row.created_at
  };
}

class TemplateDistribution {
  async assertTenant(tenantId, auth) {
    if (!tenantId) throw new TemplateError(400, 'tenant_id is required.', 'MISSING_FIELD');
    if (auth.admin) return;
    if (!auth.deviceId) throw new TemplateError(403, 'This credential cannot access that school.', 'UNAUTHORIZED');
    const linked = await database.campusDeviceBelongsToTenant(tenantId, auth.deviceId);
    if (!linked) throw new TemplateError(403, 'This credential cannot access that school.', 'UNAUTHORIZED');
  }

  requireAdmin(auth) {
    if (!auth.admin) throw new TemplateError(403, 'Admin permission is required.', 'UNAUTHORIZED');
  }

  async storeTemplate(input, auth) {
    this.requireAdmin(auth);
    const tenantId = String(input.tenant_id || '').trim();
    const name = String(input.name || '').trim();
    const license = await database.getCampusLicense(tenantId);
    if (!license) throw new TemplateError(404, 'School license not found.', 'TENANT_NOT_FOUND');
    if (!name || !input.content_base64) {
      throw new TemplateError(400, 'name and content_base64 are required.', 'MISSING_FIELD');
    }
    const body = Buffer.from(String(input.content_base64), 'base64');
    if (!body.length) throw new TemplateError(400, 'Template content is required.', 'MISSING_FIELD');
    const templateId = input.template_id || generateId('tpl');
    const version = await database.nextTemplateVersion(templateId);
    const fileName = `templates/${tenantId}/${templateId}/v${version}.bin`;
    let stored;
    try {
      stored = await client().upload({ fileName, body });
    } catch (error) {
      throw new TemplateError(error.status || 502, error.message, error.code || 'B2_UNAVAILABLE');
    }
    const checksum = crypto.createHash('sha1').update(body).digest('hex');
    if (stored.sha1 !== checksum) {
      throw new TemplateError(502, 'Stored backup did not match the template checksum.', 'B2_UNAVAILABLE');
    }
    const record = {
      template_id: templateId,
      version,
      tenant_id: tenantId,
      name,
      checksum,
      size_bytes: body.length,
      b2_file_id: stored.fileId,
      b2_file_name: stored.fileName,
      created_at: new Date().toISOString()
    };
    await database.insertTemplateVersion(record);
    await writeAudit(tenantId, 'stored', { code: 'SUCCESS', template_id: templateId, version });
    return publicVersion(record);
  }

  async latest(templateId, auth) {
    const row = await database.getTemplateVersion(templateId);
    if (!row) throw new TemplateError(404, 'Template not found.', 'TEMPLATE_NOT_FOUND');
    await this.assertTenant(row.tenant_id, auth);
    return publicVersion(row);
  }

  async deliver(templateId, auth) {
    const row = await database.getTemplateVersion(templateId);
    if (!row) throw new TemplateError(404, 'Template not found.', 'TEMPLATE_NOT_FOUND');
    await this.assertTenant(row.tenant_id, auth);
    const file = await this.downloadVerified(row);
    await database.insertTemplateDelivery({
      delivery_id: generateId('del'),
      template_id: row.template_id,
      tenant_id: row.tenant_id,
      device_id: auth.deviceId || null,
      version: row.version,
      checksum: row.checksum,
      created_at: new Date().toISOString()
    });
    await writeAudit(row.tenant_id, 'delivered', {
      code: 'SUCCESS',
      template_id: row.template_id,
      version: row.version,
      device_id: auth.deviceId || null
    });
    return {
      ...publicVersion(row),
      content_base64: file.body.toString('base64')
    };
  }

  async restore(templateId, version, auth) {
    this.requireAdmin(auth);
    const row = await database.getTemplateVersion(templateId, version || null);
    if (!row) throw new TemplateError(404, 'Template not found.', 'TEMPLATE_NOT_FOUND');
    const file = await this.downloadVerified(row);
    await writeAudit(row.tenant_id, 'restored', {
      code: 'SUCCESS',
      template_id: row.template_id,
      version: row.version
    });
    return {
      ...publicVersion(row),
      content_base64: file.body.toString('base64')
    };
  }

  async downloadVerified(row) {
    let file;
    try {
      file = await client().download(row.b2_file_id);
    } catch (error) {
      throw new TemplateError(error.status || 502, error.message, error.code || 'B2_UNAVAILABLE');
    }
    const checksum = crypto.createHash('sha1').update(file.body).digest('hex');
    if (checksum !== row.checksum) {
      throw new TemplateError(409, 'Recovered template did not match the stored checksum.', 'RESTORE_FAILED');
    }
    return file;
  }
}

module.exports = new TemplateDistribution();
module.exports.TemplateError = TemplateError;
