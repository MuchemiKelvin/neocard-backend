# Stage 5 — Step 5: Final Regression / E2E Validation

**Status:** IN PROGRESS (local software phase)  
**Software RC freeze:** `docs/STAGE5_SOFTWARE_RC.md`  
**Functional change policy:** **No** production code changes unless this matrix identifies a defect.

Physical Pi validation uses the **same** frozen candidate after local software regression passes.

---

## Objective

Prove the complete NeoCard fingerprint terminal chain end-to-end:

```
boot → systemd → KDVC app → hardware init → device auth → TFT
  → enrollment → known fingerprint → verification → NeoCard check-in
  → transaction → unknown rejection → network loss → offline queue
  → network recovery → sync (no duplicate) → reboot → READY
```

---

## Phase A — Local software regression (laptop)

Run without modifying application code:

### A1. Automated suites (gate)

```bash
# Backend
cd neocard-backend && npm test
# Expected: 50/50

# Pi software only
cd kdvc-fingerprint
.venv/bin/python -m unittest discover -s tests -p 'test*.py' -v
# Expected: 64/64 (hardware excluded)
```

| ID | Check | Expected | Result |
|----|-------|----------|--------|
| L-01 | Backend unit/integration | 50/50 | **PASS 50/50** |
| L-02 | Pi software unit/integration | 64/64 (+ L-13) | **PASS 67/67** |
| L-03 | Production DB protected under `NODE_ENV=test` | PASS | **PASS** (existing suite) |
| L-04 | Test DB isolation (`test_neocard.db`) | PASS | **PASS** (existing suite) |
| L-05 | API key not exposed in admin GET | PASS | **PASS** (existing suite) |
| L-06 | Check-in `transaction_id` idempotency | PASS | **PASS** (existing suite) |
| L-07 | Online verify → check-in path (mocked/unit) | PASS | **PASS** |
| L-08 | Offline queue persist + restart | PASS | **PASS** |
| L-09 | Sync reuses same UUID (no duplicate) | PASS | **PASS** |
| L-10 | Error classification (network/5xx/401/400) | PASS | **PASS** |
| L-11 | Sync single-flight / clean shutdown | PASS | **PASS** |
| L-12 | systemd unit structure + no secrets in unit | PASS | **PASS** |
| L-13 | Software E2E orchestration (`test_step5_software_e2e`) | PASS | **PASS 3/3** |

### A2. Local live API smoke (optional if backend running)

Only when laptop backend is up and device key is configured in Pi `.env` (never print the key):

| ID | Check | Expected | Result |
|----|-------|----------|--------|
| S-01 | `GET /health` | 200 | |
| S-02 | `GET /v1/device/me` with device key | 200 + KDVC device | |
| S-03 | Reject invalid/old key | 401 | |
| S-04 | Verify known slot (if enrolled in local DB) | SUCCESS | |
| S-05 | Check-in with UUID then replay UUID | One transaction | |
| S-06 | Stop backend; app offline queue path (software/mock) | Queued | |
| S-07 | Start backend; flush; same UUID | SYNCED / idempotent | |

---

## Phase B — Physical Pi E2E (PENDING — deploy RC first)

**PHYSICAL PI = PENDING** until Step 10 deploy of this frozen candidate.

| ID | Check | Expected | Result |
|----|-------|----------|--------|
| P-01 | Power ON → Raspberry Pi OS | Boots | |
| P-02 | systemd starts `kdvc-fingerprint` | Active without SSH | |
| P-03 | App loads `.env` via EnvironmentFile | Auth configured | |
| P-04 | Hardware init (UART/SPI/I2C/GPIO) | Sensors/display ready | |
| P-05 | Device authentication | `/v1/device/me` OK | |
| P-06 | TFT splash → home READY | UI ready | |
| P-07 | Enrollment (admin path) | Slot enrolled | |
| P-08 | Known fingerprint | VERIFIED + check-in SUCCESS | |
| P-09 | NeoCard transaction visible in backend | One row | |
| P-10 | Unknown fingerprint | Rejected / UNKNOWN | |
| P-11 | Backend/network loss | Offline UX; queue persists | |
| P-12 | Network recovery | Sync; status SYNCED | |
| P-13 | Replay same `transaction_id` | No duplicate | |
| P-14 | Reboot | Returns READY; queue intact if unsynced | |
| P-15 | journalctl logs usable; no secrets | PASS | |

---

## Defect policy

1. Record defect against matrix ID.  
2. Fix **only** that defect (Step 6).  
3. Re-run affected local suites + full L-01/L-02.  
4. Do not add features, redesign architecture, or “drive-by” cleanup during Step 5.

---

## Out of scope for Step 5

- New product features (Face/QR/NFC/OTA/fleet/admin UI)
- systemd redesign
- Offline-queue redesign unless a matrix defect requires it
- Git history rewrite
- Declaring Stage 5 production-ready before Phase B

---

## Local Phase A execution log

Local Phase A gate executed 2026-08-09 — see `STAGE5_STEP5_LOCAL_GATE.md`. Phase B still PENDING_PI.
