# Stage 5 — Step 5 Regression / E2E Results (First Pass)

**Date:** 2026-08-09  
**Phase:** Testing only — **no fixes applied**  
**Functional baseline tag:** `stage5-step4-baseline` → `24c9d77`  
**HEAD at test time:** `889fd0a` (documentation after baseline; tag not moved)  
**Environment:** Laptop local lab — backend not listening on `:3000` during startup probe; no Raspberry Pi / R503 attached.

---

## Git baseline verification

| Check | Result |
|-------|--------|
| `stage5-step4-baseline` → `24c9d77` | **PASS** |
| Tag moved/recreated | **No** |
| Worktree dirty | **No** (clean before results commit) |

---

## Automated regression

| Suite | Command | Expected (Step 4 baseline) | Actual | Status |
|-------|---------|----------------------------|--------|--------|
| Backend | `npm test` | 50/50 | **50/50** | **PASS** |
| Pi software | `.venv/bin/python -m unittest discover -s tests -p 'test*.py' -v` | 64/64 at tag | **67/67** at HEAD | **PASS** |

Note: Pi count is **67** at HEAD because documentation/orchestration commits after `24c9d77` added tests. Functional baseline commit remains `24c9d77` with 64 tests. This is not treated as a regression failure.

---

## Results matrix

| ID | Test | Expected | Actual | Evidence / command | Status |
|----|------|----------|--------|--------------------|--------|
| G-01 | Baseline tag | Points to 24c9d77 | Confirmed | `git show stage5-step4-baseline --no-patch` | **PASS** |
| A-01 | Backend automated | 50/50 | 50/50 | `npm test` | **PASS** |
| A-02 | Pi automated | all pass | 67/67 | unittest discover | **PASS** |
| S-01 | Application startup (`python -m app.main --no-hardware`) | Config → services → auth → usable state → clean stop | Config/services/auth/offline-home OK; then crash opening `/dev/serial0` | `/tmp/s5_startup.log` | **FAIL** → DEFECT-001 |
| E-01 | Enrollment (two captures, template, slot, user link) | Completes on R503 | Not executable without R503 | Requires physical sensor + interactive CLI | **PENDING_HARDWARE** |
| K-01 | Known fingerprint → verify → check-in → SUCCESS | Full hardware+backend chain | Software mocked chain PASS; physical not run | unit/E2E mocks; no R503 | **PENDING_HARDWARE** (software evidence PASS) |
| U-01 | Unknown fingerprint → UNKNOWN → no txn → READY | Reject without check-in | Software: UNKNOWN, no check-in, returns HOME | `test_L13_unknown…`, verification unit | **PASS** (software); physical **PENDING_HARDWARE** |
| D-01 | Duplicate `transaction_id` → one backend row | Idempotent | Backend test PASS | `npm test -- --testNamePattern='idempotent'` | **PASS** |
| O-01 | Offline queue + UX + no biometrics | Alive, queued, no templates | Software PASS | offline_sync + e2e | **PASS** (software) |
| R-01 | Restart keeps queued txn | Persists | Software PASS | `test_queue_survives…`, e2e restart | **PASS** (software) |
| C-01 | Online recovery sync same UUID | SYNCED, no duplicate | Software PASS | e2e + UUID reuse tests | **PASS** (software) |
| M-01 | Multi offline A/B/C sync | Three unique syncs | Software PASS | `test_multiple_queued…` | **PASS** |
| P-01 | Partial failure A/B/C | A+C SYNCED, B recoverable | Software PASS | `test_partial_batch_failure` | **PASS** |
| X-01 | Security regression | DB isolation, no key leak, no biometrics in queue, .env untracked | PASS with storage pollution note | dbProtection + suite; `.env` untracked | **PASS** (see DEFECT-002) |
| Y-01 | systemd static unit | Entry/env/restart/user/journal/SIGTERM; no secrets | Structure PASS; `systemd-analyze` path missing locally | unit file + SystemdUnitTests | **PASS** (boot **PENDING_PI**) |

---

## Startup probe detail (S-01)

**Command:** `.venv/bin/python -m app.main --no-hardware`  
**Backend:** down (`localhost:3000` unreachable)

Observed sequence:

1. Config loaded (`api_key_configured=true`, no key printed) — OK  
2. Hardware init skipped (`use_hardware=False`) — OK  
3. Scheduler started — OK  
4. Splash → Authenticating — OK  
5. Backend unreachable → offline with cached device → HOME — OK  
6. Terminal loop → Place Finger → Verifying — OK  
7. **Crash:** `SerialException: could not open port /dev/serial0`  
8. Shutdown log emitted after failure  

**Status: FAIL** (see DEFECT-001)

---

## Defect list (no fixes in this pass)

### DEFECT-001

| Field | Value |
|-------|--------|
| Description | With `--no-hardware` / `use_hardware=False`, the production terminal loop still opens the R503 UART (`/dev/serial0`) during verification and crashes when the port is absent. |
| Expected | Laptop/no-hardware mode remains alive without requiring `/dev/serial0`, or fails the scan gracefully without killing the application process. |
| Actual | Process exits with `Application failed: [Errno 2] could not open port /dev/serial0`. |
| Severity | **Medium** (blocks laptop live smoke of full loop; Pi with UART present may be unaffected) |
| Likely component | `FingerprintService` / driver wiring vs `use_hardware=False`; `TerminalWorkflow` / `VerificationService` sensor path |
| Environment | Laptop, no R503, backend down |

### DEFECT-002

| Field | Value |
|-------|--------|
| Description | Shared runtime `data/store.json` contained `cached_device.device_id=device_x` (test fixture identity), indicating software tests wrote into the default app data path and polluted local runtime identity used by `python -m app.main`. |
| Expected | Automated tests use isolated temp storage; default `data/` is not contaminated by unit tests. |
| Actual | `data/store.json` cached_device_id=`device_x` after test runs; startup used that cache for offline mode. |
| Severity | **Low–Medium** (test isolation / local lab hygiene; not a production Pi secret leak) |
| Likely component | `ServiceRegistry`/`StorageService` default path usage in tests that call `cache_device` without always isolating storage |
| Environment | Laptop `kdvc-fingerprint/data/store.json` |

---

## Explicitly not executed (physical)

| Item | Status |
|------|--------|
| R503 enrollment two-capture | PENDING_HARDWARE |
| Live known-finger → backend check-in on device | PENDING_HARDWARE |
| systemd power-on boot on Pi | PENDING_PI |
| Physical offline/network pull on Pi | PENDING_PI |

---

## Scorecard

```
STEP_5_REGRESSION_STATUS=COMPLETE

AUTOMATED_BACKEND=50/50
AUTOMATED_PI=67/67

STARTUP=FAIL
ENROLLMENT=PENDING_HARDWARE
KNOWN_FINGER=PENDING_HARDWARE
UNKNOWN_FINGER=PASS
DUPLICATE_TRANSACTION=PASS
OFFLINE=PASS
RESTART_RECOVERY=PASS
ONLINE_RECOVERY=PASS
MULTI_TRANSACTION=PASS
PARTIAL_FAILURE=PASS
SECURITY=PASS
SYSTEMD_STATIC=PASS

DEFECT_COUNT=2
```

---

## Stop rule

This pass did **not** modify application code, systemd install state, or the Raspberry Pi.  
Step 6 (fix only listed defects) was **not** started.
