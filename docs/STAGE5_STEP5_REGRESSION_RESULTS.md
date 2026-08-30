# Stage 5 — Step 5 Regression / E2E Results (Complete First Pass)

**Date:** 2026-08-09  
**Mode:** Step 5 complete; **Step 6 defect fixes applied** (2026-08-09)  
**Functional baseline:** `stage5-step4-baseline` → `24c9d77` (tag not moved)  
**HEAD at execution:** `f8400fe`  
**Lab environment:** Laptop; backend not listening on `:3000` during startup probe; **no** Raspberry Pi / R503 / TFT attached.

> **Phase B update (2026-08-12):** Physical Pi E2E core path is **PASS**.  
> See `docs/STAGE5_PHASE_B_PHYSICAL_RESULTS.md` and `docs/STAGE5_DEMO_VIDEO.md`.  
> Open: DEFECT-003 (systemd stop SIGKILL); P-14 not re-run.

### Proof layers (read carefully)

| Layer | What it proves | What it does not prove |
|-------|----------------|------------------------|
| **Software proof** | Automated unit/integration logic on laptop | Physical R503/TFT/boot appliance behavior |
| **Product proof** | Full device MOU chain on hardware | Requires PENDING_HARDWARE / PENDING_PI items below |

This report marks physical product workflows **PENDING_HARDWARE** even when related software tests PASS.

---

## 1. Git baseline

| Check | Result | Evidence |
|-------|--------|----------|
| Tag → commit | **PASS** | `stage5-step4-baseline` → `24c9d77d0fd5dca19245ba0ed7e339ab6f0db6f1` |
| Tag moved | **No** | `git show stage5-step4-baseline --no-patch` |

---

## 2. Automated suites

| ID | Test | Expected | Actual | Status |
|----|------|----------|--------|--------|
| A-01 | Backend `npm test` | 50/50 | **50/50** | **PASS** |
| A-02 | Pi software discover | all green | **67/67** | **PASS** |

Focused re-runs also PASS: verification + offline_sync + step5 e2e + systemd unit + NeoCardService (48 tests); dbProtection + fingerprintValidation (33 tests).

---

## 3. Complete product / workflow matrix

| ID | Workflow | Software evidence | Product / hardware | Status (scorecard) |
|----|----------|-------------------|--------------------|--------------------|
| 1 | Backend automated tests | `npm test` 50/50 | N/A | **PASS** |
| 2 | Application startup | Config/auth/offline→HOME; no UART when `--no-hardware` | Full appliance boot | **PASS** (software; DEFECT-001 fixed); Pi boot **PENDING_PI** |
| 3 | Enrollment workflow | CLI/workflow code present; needs R503 two-capture | Physical enroll | **PENDING_HARDWARE** |
| 4 | Known fingerprint verification | Mocked VERIFIED path PASS in units/e2e | Live R503→slot→verify | **PENDING_HARDWARE** |
| 5 | Unknown fingerprint rejection | Units: no-match / 404 → UNKNOWN; no check-in | Live unknown finger on R503 | **PENDING_HARDWARE** |
| 6 | NeoCard check-in | Backend `POST /v1/neocard/checkin` suite PASS; software e2e online check-in PASS | Live check-in from Pi after verify | **PASS** (API/software); live device **PENDING_HARDWARE** |
| 7 | Transaction persistence | Backend SQLite persistence in check-in tests; local offline SQLite queue persist tests PASS | Pi durable path | **PASS** (software/API) |
| 8 | Duplicate transaction / idempotency | Backend test `is idempotent when the same transaction_id is retried` PASS; Pi UUID reuse tests PASS | Live double-submit on Pi | **PASS** |
| 9 | Offline transaction queue | offline_sync + e2e queue tests PASS; no biometric fields stored | Live network pull on Pi | **PASS** (software) |
| 10 | Queue persistence across restart | `test_queue_survives_service_restart_then_syncs` + e2e restart PASS | Pi app/systemd restart | **PASS** (software); Pi **PENDING_PI** |
| 11 | Network recovery | Startup recovery + flush-when-online tests PASS | Live backend restore on Pi | **PASS** (software); Pi **PENDING_PI** |
| 12 | Synchronization | Flush → SYNCED; same `transaction_id` PASS | Live sync on Pi | **PASS** (software); Pi **PENDING_PI** |
| 13 | Multiple queued transactions | A/B/C sync test PASS | Live multi offline on Pi | **PASS** (software) |
| 14 | Partial synchronization failure | A success / B fail / C success test PASS | Live partial on Pi | **PASS** (software) |
| 15 | Security regression | DB isolation; api_key stripped; `.env` untracked; no biometrics in queue; no key in startup logs | Pi `.env` mode 600 at deploy | **PASS** with DEFECT-002 note |
| 16 | Systemd static validation | Unit directives PASS; no `DEVICE_API_KEY=` in unit; analyze path missing locally | Power-on enable on Pi | **PASS** (static); boot **PENDING_PI** |

### Scorecard mapping (strict)

For scorecard fields that can only be proven with R503/TFT/Pi, the status is **PENDING_HARDWARE** (not PASS), even if software tests covering the same logic are green.

| Scorecard field | Status | Rationale |
|-----------------|--------|-----------|
| STARTUP | **FAIL** | Laptop `--no-hardware` crashes on `/dev/serial0` (DEFECT-001). Reached HOME before crash. |
| ENROLLMENT | **PENDING_HARDWARE** | Requires R503 two-capture; not faked. |
| KNOWN_FINGER | **PENDING_HARDWARE** | Requires live R503 + backend identity; mocks not counted as product PASS. |
| UNKNOWN_FINGER | **PENDING_HARDWARE** | Software UNKNOWN path PASS in units; product rejection on sensor not run. |
| NEOCARD_CHECKIN | **PASS** | Backend check-in API + software workflow evidence complete; device-live still pending separately. |
| TRANSACTION_PERSISTENCE | **PASS** | Backend + offline SQLite persistence proven in automated tests. |
| DUPLICATE_TRANSACTION | **PASS** | Backend idempotency test + Pi UUID reuse tests. |
| OFFLINE | **PASS** | Software offline queue/UX/no-biometrics proven. |
| RESTART_RECOVERY | **PASS** | Software queue survives service restart. |
| NETWORK_RECOVERY | **PASS** | Software recover/flush when online. |
| SYNC | **PASS** | Software SYNCED path + idempotent UUID. |
| MULTI_TRANSACTION | **PASS** | Software A/B/C. |
| PARTIAL_FAILURE | **PASS** | Software A/B/C partial. |
| SECURITY | **PASS** | Automated security suite; see DEFECT-002 isolation hygiene. |
| SYSTEMD_STATIC | **PASS** | Unit structure/secrets/logging/SIGTERM; Pi path missing expected. |

---

## 4. Startup evidence (S-01 / item 2)

**Command:** `.venv/bin/python -m app.main --no-hardware`

| Step | Result |
|------|--------|
| Configuration loads | PASS (`api_key_configured=true`, key not printed) |
| Services initialize | PASS (scheduler; hardware skipped) |
| Authentication path | PASS (attempted; backend down → OFFLINE) |
| Home / waiting | PASS briefly |
| Clean continuous operation | **FAIL** — `SerialException` `/dev/serial0` |
| Shutdown after failure | Log shows shutdown complete |

Cached device observed during offline startup: `device_id=device_x` (see DEFECT-002).

---

## 5. Defects (Step 5 discovery)
---

## Step 6 defect resolution (2026-08-09)

| Defect | Status | Root cause | Fix |
|--------|--------|------------|-----|
| DEFECT-001 | **FIXED** | `FingerprintService` always lazy-opened UART via `_ensure()` even when `use_hardware=False`; display/touch respected the flag but fingerprint did not. | `FingerprintService(enabled=…)`; `ServiceRegistry` passes `enabled=use_hardware`. Disabled mode never constructs `drivers.fingerprint.Fingerprint` / opens `/dev/serial0`. |
| DEFECT-002 | **FIXED** | Several unit tests constructed `ServiceRegistry()` with default `data/store.json`, and `cache_device()` wrote `device_x` into production storage. | `tests/unit/harness.make_registry()` forces temp storage + queue; all registry-using unit tests updated. Removed accidental `device_x` pollution from local `data/store.json` only. |

### Tests added

- `tests/unit/test_defect_fixes.py` — no-hardware never constructs driver; HOME without serial; production store untouched by isolated registry writes
- `tests/unit/harness.py` — shared isolated registry helper

### Regression after fix

| Suite | Result |
|-------|--------|
| Backend `npm test` | **50/50 PASS** |
| Pi software discover | **72/72 PASS** (67 + 5 defect/harness-related) |
| Live `--no-hardware` (isolated `KDVC_DATA_DIR` + cached device) | Reaches HOME; SENSOR_ERROR without serial; SIGTERM clean shutdown |
| Physical enrollment / known / unknown / systemd boot | Still **PENDING_HARDWARE** / **PENDING_PI** |


## 5b. Original defect records

### DEFECT-001

- **Description:** `--no-hardware` / `use_hardware=False` still opens R503 UART during the verify loop and crashes when `/dev/serial0` is absent.
- **Expected:** No-hardware mode does not require UART, or sensor absence is handled without killing the process.
- **Actual:** `Application failed: [Errno 2] could not open port /dev/serial0`.
- **Severity:** Medium
- **Component:** Fingerprint driver path vs `use_hardware` flag; VerificationService / TerminalWorkflow sensor access

### DEFECT-002

- **Description:** Default `data/store.json` was polluted with test `cached_device` identity (`device_x`), affecting live `python -m app.main` offline startup identity.
- **Expected:** Tests use isolated storage only; runtime `data/` not contaminated.
- **Actual:** `cached_device.device_id=device_x` present in shared store after test runs.
- **Severity:** Low–Medium
- **Component:** Test setup / StorageService default path / `cache_device` in tests

---

## 6. Explicitly deferred to physical Phase B

| Item | Status |
|------|--------|
| Enrollment on R503 | PENDING_HARDWARE |
| Known finger live verify + TFT SUCCESS | PENDING_HARDWARE |
| Unknown finger live rejection on sensor | PENDING_HARDWARE |
| systemd power-on → READY | PENDING_PI |
| Live offline network + sync on Pi | PENDING_PI |
| Reboot persistence on Pi | PENDING_PI |

---

## 7. Final scorecard

```
STEP_5_REGRESSION_STATUS=COMPLETE
STEP_6_STATUS=COMPLETE

BACKEND_TESTS=50/50
PI_TESTS=72/72

STARTUP=PASS
ENROLLMENT=PENDING_HARDWARE
KNOWN_FINGER=PENDING_HARDWARE
UNKNOWN_FINGER=PENDING_HARDWARE
NEOCARD_CHECKIN=PASS
TRANSACTION_PERSISTENCE=PASS
DUPLICATE_TRANSACTION=PASS
OFFLINE=PASS
RESTART_RECOVERY=PASS
NETWORK_RECOVERY=PASS
SYNC=PASS
MULTI_TRANSACTION=PASS
PARTIAL_FAILURE=PASS
SECURITY=PASS
SYSTEMD_STATIC=PASS

DEFECT_001=FIXED
DEFECT_002=FIXED
DEFECT_COUNT=0 open
```

Physical product workflows remain PENDING_HARDWARE / PENDING_PI.

---

## 8. Stop

Step 6 complete. No physical deployment started. Baseline tag `stage5-step4-baseline` unchanged at `24c9d77`.
