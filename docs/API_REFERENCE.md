# Neo Card™ Backend — API Reference

**Repository:** `neocard-backend`  
**Base URL (local):** `http://localhost:3000`  
**Phase 2 status:** Complete  

This document lists **every HTTP endpoint** currently registered by the backend.

---

## Authentication

| Auth type | Header | Keys | Used by |
|-----------|--------|------|---------|
| **None** | — | — | Health, scan ingest, some fingerprint reads |
| **Admin API key** | `x-api-key: <key>` | Seeded: `neocard_admin_demo_key_2024` | Users, roles, hardware admin, NeoCare, scan logs |
| **Device API key** | `x-api-key: kdvc_...` | Per-device key from `hardware_devices.api_key` | Raspberry Pi (`/v1/device/me`, enroll) |
| **AI (admin)** | `x-api-key` only | Admin key with `admin` permission | `/ai/*` (except `/ai/health`) |

`Authorization: Bearer <key>` is also accepted for admin and device middleware (not AI).

---

## Quick index (all endpoints)

| # | Method | Path | Auth |
|---|--------|------|------|
| 1 | GET | `/health` | none |
| 2 | POST | `/v1/scan` | none* |
| 3 | GET | `/v1/logs` | admin |
| 4 | GET | `/v1/export/csv` | admin |
| 5 | GET | `/v1/stats` | admin |
| 6 | POST | `/v1/users` | admin |
| 7 | GET | `/v1/users` | admin |
| 8 | GET | `/v1/users/:userId` | admin |
| 9 | PUT | `/v1/users/:userId` | admin |
| 10 | DELETE | `/v1/users/:userId` | admin |
| 11 | POST | `/v1/users/:userId/role` | admin |
| 12 | GET | `/v1/roles` | admin |
| 13 | GET | `/v1/roles/:roleId` | admin |
| 14 | GET | `/v1/roles/code/:roleCode` | admin |
| 15 | POST | `/v1/hardware/devices` | admin |
| 16 | GET | `/v1/hardware/devices` | admin |
| 17 | GET | `/v1/hardware/devices/:deviceId` | admin |
| 18 | POST | `/v1/hardware/assign` | admin |
| 19 | POST | `/v1/hardware/unassign` | admin |
| 20 | GET | `/v1/hardware/users/:userId` | admin |
| 21 | GET | `/v1/hardware/me` | device |
| 22 | GET | `/v1/device/me` | device |
| 23 | POST | `/v1/fingerprints/enroll` | device |
| 24 | GET | `/v1/fingerprints` | none |
| 25 | GET | `/v1/fingerprints/:enrollmentId` | none |
| 26 | PUT | `/v1/fingerprints/:enrollmentId` | none |
| 27 | DELETE | `/v1/fingerprints/:enrollmentId` | none |
| 28 | GET | `/neocare/sync/users` | admin |
| 29 | POST | `/neocare/sync/users/:userId` | admin |
| 30 | GET | `/neocare/sync/logs` | admin |
| 31 | GET | `/neocare/users` | admin |
| 32 | GET | `/neocare/users/:userId` | admin |
| 33 | GET | `/neocare/roles` | admin |
| 34 | GET | `/neocare/hardware` | admin |
| 35–47 | GET | `/neocare/tabs/1` … `/neocare/tabs/13` | admin |
| 48 | POST | `/ai/analyze` | AI admin |
| 49 | GET | `/ai/tabs` | AI admin |
| 50 | GET | `/ai/tabs/:id` | AI admin |
| 51 | POST | `/ai/tabs/:id/print` | AI admin |
| 52 | POST | `/ai/tabs/:id/proof` | AI admin |
| 53 | GET | `/ai/requests` | AI admin |
| 54 | GET | `/ai/health` | none |

\* `POST /v1/scan` uses request validation / anti-fraud middleware, not API-key auth.

**Total: 54 endpoints** (13 NeoCare tabs counted individually as 35–47).

---

## 1. Health

### `GET /health`

No authentication.

**Response `200`:**
```json
{
  "status": "OK",
  "message": "Neo Card™ Demo Backend is running",
  "timestamp": "2026-07-14T18:00:00.000Z",
  "version": "1.0.0",
  "environment": "development"
}
```

---

## 2. Scan / AEI (`/v1`)

### `POST /v1/scan`

Register a card scan (UID + campaign). Validated by scan middleware (not admin key).

**Body:**
| Field | Required | Description |
|-------|----------|-------------|
| `uid` | yes | NeoCard UID |
| `campaign_id` | yes | Campaign identifier |

**Success:** `201`

### `GET /v1/logs`

Admin key. Recent scan logs.

**Query:** `limit`, `offset`, `uid`, `campaign_id`, `start_date`, `end_date`

### `GET /v1/export/csv`

Admin key. Export daily scans as CSV.

**Query:** `date` (default today), `campaign_id`

### `GET /v1/stats`

Admin key. Aggregate scan statistics.

---

## 3. Users (`/v1/users`)

All require **admin API key**.

### `POST /v1/users` → `201`

Create user.

**Body:**
| Field | Required |
|-------|----------|
| `first_name` | yes |
| `last_name` | yes |
| `email` | no |
| `phone` | no |
| `role_id` | no |
| `neocard_uid` | no |

**Example:**
```bash
curl -X POST http://localhost:3000/v1/users \
  -H "Content-Type: application/json" \
  -H "x-api-key: neocard_admin_demo_key_2024" \
  -d '{"first_name":"Kelvin","last_name":"Muchemi","email":"kelvin@kardiverse.com"}'
```

### `GET /v1/users`

List users. **Query:** `role_id`, `active`, `search`, `limit`, `offset`

### `GET /v1/users/:userId`

Get user (includes hardware / client details).

### `PUT /v1/users/:userId`

Update user fields from body.

### `DELETE /v1/users/:userId`

Soft-deactivate user (`active = 0`).

### `POST /v1/users/:userId/role`

**Body:** `{ "role_id": <number> }`

---

## 4. Roles (`/v1/roles`)

All require **admin API key**.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/roles` | List care roles |
| GET | `/v1/roles/:roleId` | Role by numeric ID |
| GET | `/v1/roles/code/:roleCode` | Role by code (e.g. `nurse`) |

> **Note:** `/:roleId` is registered before `/code/:roleCode`. Prefer numeric IDs for `/:roleId` routes.

---

## 5. Hardware — admin (`/v1/hardware`)

Admin key unless noted.

### `POST /v1/hardware/devices` → `201`

Create device. Auto-generates `device_id` and device `api_key` (`kdvc_...`).

**Body:**
| Field | Required | Notes |
|-------|----------|-------|
| `device_type` | yes | `neocam_v1` \| `fall_alarm_v1` \| `fingerprint_device` \| `other` |
| `device_name` | yes | e.g. `KDVC-RPI-001` |
| `serial_number` | no | |
| `firmware_version` | no | |

### `GET /v1/hardware/devices`

**Query:** `device_type`, `status`, `limit`

### `GET /v1/hardware/devices/:deviceId`

Device plus assigned users.

### `POST /v1/hardware/assign`

**Body:** `{ "user_id": "...", "device_id": "..." }`

Required before fingerprint enrollment for that user+device pair.

### `POST /v1/hardware/unassign`

**Body:** `{ "user_id": "...", "device_id": "..." }`

### `GET /v1/hardware/users/:userId`

Hardware assigned to a user.

### `GET /v1/hardware/me`

**Device API key.** Returns the authenticated terminal (same purpose family as `/v1/device/me`). Prefer **`GET /v1/device/me`** for Pi clients.

---

## 6. Device terminal (`/v1/device`) — Phase 2

### `GET /v1/device/me`

**Device API key** (`kdvc_...`).

Returns the Pi’s own device record. Used by `kdvc-fingerprint` Sprint 1 / enrollment to resolve `device_id` without hardcoding.

**Example:**
```bash
curl http://localhost:3000/v1/device/me \
  -H "x-api-key: kdvc_b801e7bdac5afb6ab8c90ae163648e58"
```

**Response `200` (shape):**
```json
{
  "status": "success",
  "message": "Device identity retrieved successfully",
  "data": {
    "device_id": "device_...",
    "device_name": "KDVC-RPI-001",
    "device_type": "fingerprint_device",
    "firmware_version": "1.0.0",
    "status": "active"
  }
}
```

(`api_key` is stripped from the response.)

---

## 7. Fingerprints (`/v1/fingerprints`) — Phase 2

### `POST /v1/fingerprints/enroll` → `201`

**Device API key.** Creates a backend enrollment after the R503 stores a template in a slot.

**Body:**
| Field | Required | Notes |
|-------|----------|-------|
| `enrollment_id` | yes | Client-chosen ID, e.g. `ENR-PI-002` |
| `user_id` | yes | Must exist and be assigned to device |
| `device_id` | yes | Must match authenticated device |
| `fingerprint_slot` | yes | Integer **1–199** |
| `created_by` | no | e.g. `raspberry-pi` |
| `notes` | no | |

**Validation failures (examples):**
| Code / message | HTTP |
|----------------|------|
| Missing fields | 400 |
| Slot out of range | 400 |
| Device not assigned to user | 400 |
| `DUPLICATE_ENROLLMENT` | 409 |
| Slot already occupied on device | 409 |
| Auth failure | 401 |

**Example:**
```bash
curl -X POST http://localhost:3000/v1/fingerprints/enroll \
  -H "Content-Type: application/json" \
  -H "x-api-key: kdvc_..." \
  -d '{
    "enrollment_id": "ENR-PI-002",
    "user_id": "user_...",
    "device_id": "device_...",
    "fingerprint_slot": 2,
    "created_by": "raspberry-pi"
  }'
```

**Success `201`:**
```json
{
  "success": true,
  "message": "Fingerprint enrolled successfully.",
  "data": {
    "id": 15,
    "enrollment_id": "ENR-PI-002"
  }
}
```

> Templates stay on the R503. The backend stores the **mapping** (`user_id` + `device_id` + `fingerprint_slot`), not biometric image data.

### `GET /v1/fingerprints`

No auth. List enrollments. **Query:** `status`, `device_id`, `limit` (and other filters passed through).

### `GET /v1/fingerprints/:enrollmentId`

No auth. Fetch one enrollment.

### `PUT /v1/fingerprints/:enrollmentId`

No auth. Update fields (e.g. `status`, `notes`).

### `DELETE /v1/fingerprints/:enrollmentId`

No auth. Soft-deactivate enrollment (clears duplicate block for that user).

**Example:**
```bash
curl -X DELETE http://localhost:3000/v1/fingerprints/ENR-RPI-001 \
  -H "x-api-key: neocard_admin_demo_key_2024"
```

---

## 8. NeoCare Dashboard (`/neocare`)

All require **admin API key**.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/neocare/sync/users` | Users pending NeoCare sync |
| POST | `/neocare/sync/users/:userId` | Mark user synced |
| GET | `/neocare/sync/logs` | Sync logs (`entity_type`, `sync_status`, `entity_id`, `limit`) |
| GET | `/neocare/users` | Dashboard user list |
| GET | `/neocare/users/:userId` | User detail |
| GET | `/neocare/roles` | Roles for dashboard |
| GET | `/neocare/hardware` | Hardware + assignments |
| GET | `/neocare/tabs/1` | Overview |
| GET | `/neocare/tabs/2` | Clients |
| GET | `/neocare/tabs/3` | Tasks |
| GET | `/neocare/tabs/4` | Scheduling |
| GET | `/neocare/tabs/5` | Reporting |
| GET | `/neocare/tabs/6` | Medication |
| GET | `/neocare/tabs/7` | 7D Proof |
| GET | `/neocare/tabs/8` | Emergency Center |
| GET | `/neocare/tabs/9` | Reward Ladder |
| GET | `/neocare/tabs/10` | NeoPay |
| GET | `/neocare/tabs/11` | Invoice Generator |
| GET | `/neocare/tabs/12` | Sponsor Wallet |
| GET | `/neocare/tabs/13` | NeoChain Explorer |

---

## 9. AI Integration (`/ai`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/ai/analyze` | AI admin | Analyze for tab 1–13 (`tab_id`, `request_data`) |
| GET | `/ai/tabs` | AI admin | List AI tabs |
| GET | `/ai/tabs/:id` | AI admin | Tab metadata |
| POST | `/ai/tabs/:id/print` | AI admin | Print (tab **9** only) |
| POST | `/ai/tabs/:id/proof` | AI admin | Proof (tab **9** only) |
| GET | `/ai/requests` | AI admin | List AI requests |
| GET | `/ai/health` | none | AI service health |

---

## Phase 2 — Raspberry Pi contract

Minimum endpoints used by `kdvc-fingerprint`:

| Step | Endpoint | Auth |
|------|----------|------|
| Connectivity | `GET /health` | none |
| Identity | `GET /v1/device/me` | device |
| Enroll | `POST /v1/fingerprints/enroll` | device |

Admin setup before enrollment:

| Step | Endpoint | Auth |
|------|----------|------|
| Create user | `POST /v1/users` | admin |
| Create device | `POST /v1/hardware/devices` | admin |
| Assign | `POST /v1/hardware/assign` | admin |
| Verify | `GET /v1/fingerprints/:enrollmentId` | none |

---

## Error response shape (typical)

```json
{
  "success": false,
  "message": "User already has a fingerprint enrolled.",
  "code": "DUPLICATE_ENROLLMENT"
}
```

Or via `formatResponse`:

```json
{
  "status": "error",
  "message": "...",
  "timestamp": "...",
  "data": null
}
```

---

## Related docs

- [System Architecture](./SYSTEM_ARCHITECTURE.md)
- [Enrollment Workflow](./ENROLLMENT_WORKFLOW.md)
- [Installation Guide](./INSTALLATION_GUIDE.md)
- NeoCare detail: [NEOCARE_INTEGRATION.md](./NEOCARE_INTEGRATION.md)
- AI detail: [AI_API_DOCUMENTATION.md](./AI_API_DOCUMENTATION.md)
