# Device Identity & Database Protection

Stage 5 reference for how NeoCard device identity and SQLite are configured.  
**Never put real API keys or passwords in this document.**

## Live database

| Item | Value |
|------|--------|
| Default path | `./database/neocard.db` (relative to `neocard-backend`) |
| Override | `DB_PATH` in `.env` |
| Init behavior | `CREATE TABLE IF NOT EXISTS` + additive migrations + `INSERT OR IGNORE` seeds |
| Destructive startup? | **No** — the live file is never deleted or recreated on normal start |

### Backups

```bash
npm run db:backup
```

Copies the live DB to `database/backups/neocard_<timestamp>.db` and prints a SHA-256.  
Backup directory is gitignored.

Restore (manual):

```bash
cp database/backups/neocard_<timestamp>.db database/neocard.db
```

## Test database

| Item | Value |
|------|--------|
| Path | `./database/test_neocard.db` |
| Forced by | `tests/setupEnv.js` (`NODE_ENV=test`, `DB_PATH=…`) |
| Guard | `database.connect()` refuses `neocard.db` when `NODE_ENV=test` |

Test suites may `DELETE FROM` rows in the **test** DB only. They must never open the live file.

## Device identity (Raspberry Pi)

| Item | Storage | Survives restart/reboot? |
|------|---------|---------------------------|
| Device API key | `kdvc-fingerprint/.env` → `DEVICE_API_KEY` | Yes (file on disk) |
| Device ID | Backend SQLite `hardware_devices.device_id` | Yes (DB on laptop/server) |
| Resolved at runtime | `GET /v1/device/me` with `x-api-key` | Yes, if key + DB row still match |

The Pi does **not** hardcode `DEVICE_ID`. Identity is:

```
Pi .env DEVICE_API_KEY
        ↓
Backend hardware_devices.api_key lookup
        ↓
device_id + device_name returned (api_key stripped from response)
```

### Configuration (placeholders only)

**Backend `.env`:**

```bash
DB_PATH=./database/neocard.db
```

**Pi `.env`:**

```bash
API_BASE_URL=http://<BACKEND_HOST>:3000
DEVICE_API_KEY=<DEVICE_API_KEY>
```

After creating a device via admin API, copy the response `api_key` into the Pi `.env` only — never into git or markdown.

## Admin vs device keys

| Key type | Example shape | Used for |
|----------|---------------|----------|
| Admin demo key | Seeded `neocard_admin_demo_key_2024` | Users, hardware admin |
| Device key | `kdvc_…` per device | Pi terminal endpoints |

## Recovery if live DB loses the KDVC device

If `/v1/device/me` returns invalid key:

1. `npm run db:backup`
2. Prefer restoring a known-good backup when available
3. Otherwise recreate device via admin API (see `docs/tests.bash`)
4. Re-assign user + re-enroll fingerprint slot if needed
5. Update Pi `.env` with the **new** key from the create/rotate response

## Credential rotation (device_id stays stable)

Verified procedure (do not skip backup):

```
npm run db:backup
        ↓
Admin: POST /v1/hardware/devices/:deviceId/rotate-api-key
        ↓
Copy api_key from response into Pi .env as DEVICE_API_KEY
        ↓
Restart Pi app (or reboot after systemd)
        ↓
GET /v1/device/me  → 200, same device_id, no api_key in body
        ↓
Old key returns 401 (revoked by replacement)
```

Shell helpers use `${DEVICE_API_KEY}` / `${DEVICE_ID}` — see `docs/tests.bash`.  
Git history is **not** rewritten; revoke exposed keys by rotation instead.

## Credential hygiene

- Do not commit `.env`
- Do not paste real `kdvc_…` keys into `docs/`
- Do not log `DEVICE_API_KEY` or `x-api-key` header values
- Any device key that appeared in git history is **compromised** — rotate after the live device row exists and matches the Pi
