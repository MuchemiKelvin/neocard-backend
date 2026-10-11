const crypto = require('crypto');
const database = require('../database');
const { sha256, generateId } = require('../config/neocareAi');

const LICENSE_STATUSES = Object.freeze(['ACTIVE', 'EXPIRED', 'SUSPENDED', 'DENIED']);
const PRODUCTS = Object.freeze([
  'NEOSCHOOL',
  'APP_BUILDER',
  'SPONSOR_ENGINE',
  'NEOCARD',
  'NEOGLASS'
]);

class LicenseError extends Error {
  constructor(status, message, code, details = {}) {
    super(message);
    this.name = 'LicenseError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function effectiveStatus(license, now) {
  if (license.license_status === 'SUSPENDED') return 'SUSPENDED';
  if (license.license_status === 'DENIED') return 'DENIED';
  if (license.license_status === 'EXPIRED') return 'EXPIRED';
  if (license.expires_at && new Date(license.expires_at).getTime() <= now.getTime()) {
    return 'EXPIRED';
  }
  return 'ACTIVE';
}

async function writeAudit(tenantId, event, details) {
  const id = generateId('lic');
  const timestamp = new Date().toISOString();
  await database.createProofEvent({
    id,
    tab_id: 1,
    action: `license.${event}`,
    user_uid: tenantId,
    session_id: details.user_id || null,
    input_json: {
      tenant_id: tenantId,
      event,
      ...details
    },
    output_json: {
      event,
      timestamp,
      decision: details.decision || null,
      code: details.code || null
    },
    hash: sha256(`${id}|${tenantId}|${event}|${timestamp}|${crypto.randomBytes(4).toString('hex')}`),
    audit_status: 'RECORDED'
  });
}

class LicenseServer {
  get products() {
    return PRODUCTS;
  }

  async assertTenantAccess(tenantId, auth) {
    if (auth.admin) return;
    if (!auth.deviceId) {
      throw new LicenseError(401, 'Authentication required.', 'UNAUTHORIZED');
    }
    const linked = await database.campusDeviceBelongsToTenant(tenantId, auth.deviceId);
    if (!linked) {
      throw new LicenseError(
        403,
        'This credential cannot access that school license.',
        'TENANT_NOT_FOUND'
      );
    }
  }

  async getLicenseView(tenantId) {
    const license = await database.getCampusLicense(tenantId);
    if (!license) {
      throw new LicenseError(404, 'School license not found.', 'TENANT_NOT_FOUND');
    }
    const entitlements = await database.listCampusEntitlements(tenantId);
    const activeSeats = await database.countCampusSeats(tenantId);
    const devices = await database.listCampusDevices(tenantId);
    return {
      tenant_id: license.tenant_id,
      school_name: license.school_name,
      license_status: effectiveStatus(license, new Date()),
      stored_status: license.license_status,
      seat_limit: license.seat_limit,
      active_seats: activeSeats,
      storage_quota_gb: license.storage_quota_gb,
      storage_used_gb: license.storage_used_gb,
      expires_at: license.expires_at,
      renewed_at: license.renewed_at,
      products: entitlements.map((row) => row.product),
      devices: devices.map((row) => row.device_id)
    };
  }

  async saveLicense(input) {
    const tenantId = String(input.tenant_id || '').trim();
    if (!tenantId) {
      throw new LicenseError(400, 'tenant_id is required.', 'TENANT_NOT_FOUND');
    }
    const status = String(input.license_status || 'ACTIVE').toUpperCase();
    if (!LICENSE_STATUSES.includes(status)) {
      throw new LicenseError(400, 'Invalid license status.', 'LICENSE_DENIED');
    }
    const seatLimit = Number(input.seat_limit);
    if (!Number.isInteger(seatLimit) || seatLimit < 1) {
      throw new LicenseError(400, 'seat_limit must be a positive integer.', 'SEAT_LIMIT_REACHED');
    }
    const products = (input.products || []).map((product) => String(product).toUpperCase());
    for (const product of products) {
      if (!PRODUCTS.includes(product)) {
        throw new LicenseError(400, `Unknown product ${product}.`, 'PRODUCT_NOT_ENTITLED');
      }
    }
    const now = new Date().toISOString();
    const existing = await database.getCampusLicense(tenantId);
    await database.saveCampusLicense({
      tenant_id: tenantId,
      school_name: input.school_name || existing?.school_name || null,
      license_status: status,
      seat_limit: seatLimit,
      storage_quota_gb: input.storage_quota_gb ?? existing?.storage_quota_gb ?? null,
      storage_used_gb: input.storage_used_gb ?? existing?.storage_used_gb ?? 0,
      expires_at: input.expires_at ?? existing?.expires_at ?? null,
      renewed_at: status === 'ACTIVE' ? (input.renewed_at || existing?.renewed_at || null) : existing?.renewed_at || null,
      suspended_at: status === 'SUSPENDED' ? now : null,
      created_at: existing?.created_at || now,
      updated_at: now
    });
    if (input.products) {
      await database.replaceCampusEntitlements(tenantId, products);
    }
    if (input.device_ids) {
      await database.replaceCampusDevices(tenantId, input.device_ids);
    }
    await writeAudit(tenantId, 'admin_update', {
      decision: status,
      code: 'LICENSE_SAVED'
    });
    return this.getLicenseView(tenantId);
  }

  async setStatus(tenantId, status, expiresAt) {
    const license = await database.getCampusLicense(tenantId);
    if (!license) {
      throw new LicenseError(404, 'School license not found.', 'TENANT_NOT_FOUND');
    }
    const next = String(status).toUpperCase();
    if (!LICENSE_STATUSES.includes(next)) {
      throw new LicenseError(400, 'Invalid license status.', 'LICENSE_DENIED');
    }
    const now = new Date().toISOString();
    await database.setCampusLicenseStatus(tenantId, next, {
      expires_at: expiresAt === undefined ? license.expires_at : expiresAt,
      renewed_at: next === 'ACTIVE' ? now : license.renewed_at,
      suspended_at: next === 'SUSPENDED' ? now : null,
      updated_at: now
    });
    await writeAudit(tenantId, next === 'ACTIVE' ? 'renewed' : 'status_change', {
      decision: next,
      code: next === 'SUSPENDED' ? 'LICENSE_SUSPENDED' : next
    });
    return this.getLicenseView(tenantId);
  }

  async validate(input, auth, now = new Date()) {
    const tenantId = String(input.tenant_id || '').trim();
    const product = input.product ? String(input.product).toUpperCase() : null;
    const userId = input.user_id ? String(input.user_id) : null;
    const deviceId = input.device_id || auth.deviceId || null;
    const action = String(input.action || 'check').toLowerCase();
    const storageRequest = input.storage_gb == null ? null : Number(input.storage_gb);

    await this.assertTenantAccess(tenantId, auth);
    const license = await database.getCampusLicense(tenantId);
    if (!license) {
      throw new LicenseError(404, 'School license not found.', 'TENANT_NOT_FOUND');
    }

    const status = effectiveStatus(license, now);
    const activeSeats = await database.countCampusSeats(tenantId);
    const entitlements = await database.listCampusEntitlements(tenantId);
    const entitledNames = entitlements.map((row) => row.product);
    const base = {
      tenant_id: tenantId,
      license_status: status,
      seat_limit: license.seat_limit,
      active_seats: activeSeats,
      product,
      entitled: product ? entitledNames.includes(product) : null,
      device_authorized: null,
      decision: 'DENY'
    };

    const deny = async (statusCode, code, message) => {
      await writeAudit(tenantId, 'validate', {
        user_id: userId,
        product,
        device_id: deviceId,
        decision: 'DENY',
        code
      });
      throw new LicenseError(statusCode, message, code, { ...base, decision: 'DENY' });
    };

    if (status === 'EXPIRED') {
      await deny(403, 'LICENSE_EXPIRED', 'License has expired.');
    }
    if (status === 'SUSPENDED') {
      await deny(403, 'LICENSE_SUSPENDED', 'License is suspended.');
    }
    if (status === 'DENIED') {
      await deny(403, 'LICENSE_DENIED', 'License is denied.');
    }
    if (product && !entitledNames.includes(product)) {
      await deny(403, 'PRODUCT_NOT_ENTITLED', 'Product is not included in this license.');
    }
    if (deviceId) {
      const known = await database.getHardwareDevice(deviceId);
      const linked = known && await database.campusDeviceBelongsToTenant(tenantId, deviceId);
      base.device_authorized = Boolean(linked);
      if (!linked) {
        await deny(403, 'DEVICE_NOT_AUTHORIZED', 'Device is not authorized for this school.');
      }
    }
    if (storageRequest != null && license.storage_quota_gb != null) {
      if (license.storage_used_gb + storageRequest > license.storage_quota_gb) {
        await deny(403, 'STORAGE_QUOTA_EXCEEDED', 'Storage entitlement would be exceeded.');
      }
    }

    let seats = activeSeats;
    if (action === 'activate') {
      if (!userId) {
        throw new LicenseError(400, 'user_id is required to activate a seat.', 'UNAUTHORIZED');
      }
      const existingSeat = await database.getCampusSeat(tenantId, userId);
      if (!existingSeat && activeSeats >= license.seat_limit) {
        await deny(403, 'SEAT_LIMIT_REACHED', 'No licensed seats remain.');
      }
      if (!existingSeat) {
        await database.insertCampusSeat(tenantId, userId, now.toISOString());
        seats += 1;
      }
    }

    const result = {
      ...base,
      license_status: 'ACTIVE',
      active_seats: seats,
      entitled: product ? true : null,
      device_authorized: deviceId ? true : null,
      decision: 'ALLOW'
    };
    await writeAudit(tenantId, action === 'activate' ? 'activate' : 'validate', {
      user_id: userId,
      product,
      device_id: deviceId,
      decision: 'ALLOW',
      code: 'ALLOW'
    });
    return result;
  }
}

module.exports = new LicenseServer();
module.exports.LicenseError = LicenseError;
module.exports.PRODUCTS = PRODUCTS;
