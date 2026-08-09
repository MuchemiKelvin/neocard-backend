# Stage 5 — Step 2 Security Report (Local Complete)

**Date:** 2026-08-09  
**Decision:** `STEP_2_STATUS=COMPLETE`  
**Environment:** Laptop / local only  
**Physical Pi:** Deferred until Stage 5 Steps 2–9 local release candidate (not a Step 2 blocker)

No API key values are included in this document. Git history was not rewritten. systemd was not started.

---

## Scorecard

| Gate | Result |
|------|--------|
| `STEP_2_STATUS` | **COMPLETE** |
| `DB_PROTECTION` | **PASS** |
| `TEST_DB_ISOLATION` | **PASS** |
| `DB_INTEGRITY` | **PASS** (`ok`) |
| `DEVICE_IDENTITY` | **PASS** (`device_1783962666378_8d478192` / `KDVC-RPI-001`) |
| `AUTH_VALID` | **PASS** |
| `AUTH_INVALID` | **PASS** |
| `OLD_KEY_REJECTED` | **PASS** |
| `API_KEY_EXPOSURE` | **PASS** |
| `TRANSACTION_IDEMPOTENCY` | **PASS** (covered by check-in tests) |
| `BACKEND_TESTS` | **PASS** (50/50) |
| `PI_TESTS` | **PASS** (24/24 via `python -m unittest discover -s tests -p "test*.py"`) |
| `TEST_DISCOVERY` | **PASS** |
| `VERIFICATION_COVERAGE` | **PASS** (moved to `tests/unit/`, content preserved) |

---

## 1. Database

| Item | Value |
|------|--------|
| Live DB | `database/neocard.db` |
| Test DB | `database/test_neocard.db` |
| Protection | `NODE_ENV=test` forces test path; live basename rejected by guard; Jest `setupFiles` |
| Backup tooling | `npm run db:backup` → `database/backups/` |
| Integrity | `PRAGMA integrity_check` = `ok` |
| Startup wipe | No — `CREATE TABLE IF NOT EXISTS` + additive migrations + `INSERT OR IGNORE` |

Regression: `tests/dbProtection.test.js`.

---

## 2. Device Identity

| Item | Value |
|------|--------|
| Device ID | `device_1783962666378_8d478192` (stable) |
| Device name | `KDVC-RPI-001` |
| Device type | `fingerprint_device` |
| HAS_KEY | `true` |
| Test device used as KDVC? | No |

---

## 3. Credential Security

| Item | Value |
|------|--------|
| Storage | Pi `.env` → `DEVICE_API_KEY` (gitignored, mode `600`) |
| Backend | `hardware_devices.api_key` |
| Hard-coded secrets in source | No |
| Docs placeholders | `<DEVICE_API_KEY>` / `${DEVICE_API_KEY}` |
| Logs print key? | No |
| Admin/device GET expose `api_key`? | No (`has_api_key` only) |
| Historical git literals | Treated as compromised; active old key rejected; history not rewritten |
| Re-rotation this pass | No (current credential valid) |

---

## 4. Live Authentication (local)

| Check | Result |
|-------|--------|
| Valid key → `/v1/device/me` | PASS (correct id/name) |
| Invalid key | PASS (401/403) |
| Old compromised key | REJECTED |
| Backend restart persistence | Previously verified; identity row remains |

Physical on-device auth is deferred to post–release-candidate Pi deployment.

---

## 5. API Security

- Create/rotate may return key once.  
- List/GET strip `api_key` and set `has_api_key`.  
- `/v1/device/me` strips `api_key`.  
- Tests assert exposure rules.

---

## 6. Tests

| Suite | Result |
|-------|--------|
| Backend `npm test` | 50 passed (3 suites) |
| Pi `python -m unittest discover -s tests/unit -p 'test_*.py'` | 24 passed |
| Hardware scripts | Moved to `tests/hardware/` (Pi-only; not in local software gate) |

---

## 7. Files Changed (summary)

**neocard-backend:** config/DB guards, backup script, hardware route security, Jest isolation, docs, `dbProtection` tests.  
**kdvc-fingerprint:** no-key-logging helpers, software/hardware test split, README test command, Stage 5 docs.

---

## 8. Remaining Risks (local-complete)

1. Physical Pi `.env` sync still required before hardware E2E.  
2. KDVC fingerprint enrollments must be re-created on R503 before demo check-in.  
3. Old key literals remain in git history (rewrite deferred).  
4. `fp_test_device_*` leftover row in live DB is non-production.

---

## Acceptance checklist

- [x] Production DB cannot be wiped by tests  
- [x] Test DB isolated  
- [x] DB integrity check passes  
- [x] Legitimate KDVC identity exists  
- [x] device_id stable  
- [x] Valid auth works locally  
- [x] Invalid auth fails  
- [x] Old credential rejected  
- [x] New credential works (no re-rotate needed)  
- [x] API responses never expose `api_key`  
- [x] Logs/tests never print keys  
- [x] `.env` untracked  
- [x] Transaction idempotency intact  
- [x] Backend tests pass  
- [x] Pi software tests pass  
- [x] No unrelated breakages observed  
- [x] Documentation reflects final Step 2 implementation  

**STOP — do not start Step 3 until this report is reviewed.**
