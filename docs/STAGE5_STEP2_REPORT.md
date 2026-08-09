# Stage 5 — Step 2 Report: Protect DB / Device Identity

**Date:** 2026-08-09  
**Status:** Complete — do not start Step 3 until reviewed  
**Baseline HEADs (unchanged as restore points):** backend `8827039` · Pi `2648297`

---

## 1. Database location

| Role | Path |
|------|------|
| Live / demo | `neocard-backend/database/neocard.db` |
| Config | `DB_PATH` in `.env` (default `./database/neocard.db`) |
| Resolved by | `config.getDatabasePath()` at **connect time** (dynamic) |

Startup uses `CREATE TABLE IF NOT EXISTS`, additive migrations, and `INSERT OR IGNORE` seeds. It does **not** delete or recreate the DB file.

---

## 2. Backup location

| Backup | SHA-256 |
|--------|---------|
| `database/backups/neocard_20260809_015848.db` | `6e2bfad9adc9217b6497b6df878da015899258baf996bfd2651bfd218ad2cfe1` |
| `database/backups/neocard_2026-08-08T23-03-30-123Z.db` | same (post-`npm run db:backup`) |

Command: `npm run db:backup` → `scripts/backup-db.js`  
Directory is gitignored (`database/backups/`, `database/**/*.db`).

---

## 3. Database protection mechanism

1. **Dynamic path resolution** — `config.database.path` is a getter; tests can no longer be defeated by require-order races.
2. **Jest `setupFiles`** — `tests/setupEnv.js` sets `NODE_ENV=test` and `DB_PATH=./database/test_neocard.db` before test modules load.
3. **Hard guard** — `database.connect()` throws if `NODE_ENV=test` and basename is `neocard.db`.
4. **dotenv load order** — `server.js` and `config/index.js` load `.env` before reading DB path.
5. **Verified** — live DB SHA-256 identical before and after full `npm test` (`LIVE_DB_UNCHANGED=yes`).

---

## 4. Test database mechanism

| Item | Value |
|------|--------|
| File | `./database/test_neocard.db` |
| Forced by | `tests/setupEnv.js` + Jest config in `package.json` |
| Allowed resets | `DELETE FROM …` inside tests against **test DB only** |
| Live open in test | Blocked by guard |

---

## 5. Device ID storage

| Layer | Where |
|-------|--------|
| Source of truth | SQLite `hardware_devices.device_id` |
| Pi local config | **Not stored** — resolved via `GET /v1/device/me` |
| Survives Pi reboot | Yes, as long as backend DB row + Pi API key still match |
| Survives backend restart | Yes (SQLite file) |

---

## 6. API key storage

| Layer | Where |
|-------|--------|
| Backend | `hardware_devices.api_key` in SQLite |
| Pi | `kdvc-fingerprint/.env` → `DEVICE_API_KEY` (gitignored) |
| Source code | Must not contain real keys |
| Logs | Must not print raw key (`device_api_key_configured()` helper; auth logs `device_id` / name only) |

**No key rotation performed** in this step.

---

## 7. Credential exposure findings

| Finding | Severity | Action taken |
|---------|----------|--------------|
| `docs/tests.bash` unstaged edit contained a real-looking `kdvc_…` key | High if pushed | Redacted to `<DEVICE_API_KEY>`; file preserved with useful commands |
| That specific `tests.bash` key was **not** in `HEAD` / was **not** previously committed in that file | Important | Working tree exposure only — still treat as sensitive; do not push unredacted |
| `docs/API_REFERENCE.md` contained committed example `kdvc_b801e7bd…` (present in git history) | Medium | Replaced with `<DEVICE_API_KEY>` in working tree; **history still contains the old value** |
| Seeded admin demo key `neocard_admin_demo_key_2024` in docs/seeds | Expected for demo | Left as-is (intentional demo admin key) |
| Pi `.env` has a configured key (`api_key_configured=true`) | Normal | Not committed; not printed |

**Rotation recommendation (for later decision, not done now):**  
If the historically committed `API_REFERENCE` example key was ever a real production/demo device key in a shared remote, rotate that device after E2E re-registration. Do **not** rotate blindly before the live DB has a matching KDVC device again.

---

## 8. Files changed

### neocard-backend

- `config/index.js` — dotenv + dynamic `getDatabasePath()`
- `database/index.js` — connect-time path + live-DB test guard
- `server.js` — dotenv before DB require
- `package.json` — Jest `setupFiles`, `db:backup` script
- `.gitignore` — recursive DB / backups ignore
- `tests/setupEnv.js` — **new**
- `scripts/backup-db.js` — **new**
- `tests/fingerprintValidation.test.js` — removed late `DB_PATH` assignment
- `tests/api.test.js` — removed late `DB_PATH` assignment
- `docs/tests.bash` — redacted device key; kept commands
- `docs/API_REFERENCE.md` — placeholder for device key example
- `docs/DEVICE_IDENTITY.md` — **new**
- `docs/STAGE5_STEP2_REPORT.md` — **new** (this file)
- `database/backups/*` — local only (gitignored)

### kdvc-fingerprint

- `app/config/settings.py` — `device_api_key_configured()`; identity comments
- `app/services/device_service.py` — uses helper (no key exposure)
- `app/application.py` — no key logging
- `docs/DEVICE_IDENTITY.md` — mirrored reference

---

## 9. Tests run / results

| Suite | Result |
|-------|--------|
| Backend `npm test` | **42/42 passed** — connected to `test_neocard.db` |
| Live DB hash after tests | **Unchanged** |
| Guard probe (`NODE_ENV=test` + live path) | **Rejected** as designed |
| Pi unittest (verification + service + phase3) | **24/24 passed** |
| Pi identity read | `api_key_configured=true` (key not printed) |

---

## 10. Remaining risks

1. **Live demo identity already damaged before this step:** `neocard.db` currently contains only a leftover test device (`fp_test_device_…`). Real KDVC device/enrollment rows are missing. Protection prevents further accidental wipes; it does **not** restore prior demo data.
2. **Pi `.env` key likely orphaned** relative to current live DB — terminal auth will fail until device is recreated/restored and `.env` aligned (or a good backup with the real device is restored).
3. **No older clean backup** of the pre-wipe demo DB was found on disk — only the current (already damaged) file was backed up.
4. **Git history** still contains the old `API_REFERENCE.md` example device key string.
5. **Physical E2E** not run (Step 5). Backend process was not left running as part of this step.

---

## Explicitly not started

- Step 3 systemd auto-start  
- Step 4 resilience / offline recovery  
- Source cleanup, E2E matrix, video, handover  

---

## Recommended next action (human review)

1. Accept this Step 2 report.  
2. Decide whether to **restore** from a known-good external backup (if you have one) or **re-register** the KDVC device + update Pi `.env` before physical E2E.  
3. Only then proceed to **Step 3: systemd auto-start**.
