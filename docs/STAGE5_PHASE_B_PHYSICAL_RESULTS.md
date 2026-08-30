# Stage 5 — Phase B Physical Pi Results

**Date:** 2026-08-12  
**Site:** Lab LAN — Pi `kdvc-fingerprint` ↔ backend `192.168.2.105:3000`  
**Device:** `device_1783962666378_8d478192` / `KDVC-RPI-001`  
**User under test:** `user_1784053930781_e82767e8` (Kelvin Muchemi)  
**Fingerprint slot:** `1`  
**Pi software HEAD (deployed checkout):** `edf0cb2` — `fix(stage5): resolve no-hardware startup and test storage isolation`  
**Functional baseline tag (unchanged):** `stage5-step4-baseline` → `24c9d77`  
**Unit:** `/etc/systemd/system/kdvc-fingerprint.service` (enabled)

**Canonical copy also intended for:** `kdvc-fingerprint/docs/STAGE5_PHASE_B_PHYSICAL_RESULTS.md`  
**Demo video guide:** `kdvc-fingerprint/docs/STAGE5_DEMO_VIDEO.md` (and mirrored below if present)

This report records **product proof** on hardware. It does not replace the software regression report (`STAGE5_STEP5_REGRESSION_RESULTS.md`).

---

## Scorecard (physical)

| Field | Status | Evidence summary |
|-------|--------|------------------|
| SYSTEMD_BOOT / STARTUP | **PASS** | Service starts; hardware init; auth; TFT Place Finger |
| ENROLLMENT | **PASS** | R503 enroll slot 1; backend `ACTIVE` row |
| KNOWN_FINGER | **PASS** | `VERIFIED` slot 1; Welcome + Check-In Successful |
| UNKNOWN_FINGER | **PASS** | `UNKNOWN` slot=None; no check-in |
| NEOCARD_CHECKIN | **PASS** | Backend `CHECK_IN` / `SUCCESS` rows for slot 1 |
| OFFLINE | **PASS** | Queue `OFFLINE` while backend down |
| NETWORK_RECOVERY / SYNC | **PASS** | Rows → `SYNCED`; backend SUCCESS same UUIDs |
| REBOOT_UNSYNCED_QUEUE (P-14) | **NOT RE-RUN** | Optional close-out; software proven earlier |
| IDEMPOTENCY live replay (P-13) | **SOFTWARE PASS** | Live Pi replay not separately logged |
| SYSTEMD_CLEAN_STOP | **FAIL** | Stop often times out → SIGKILL (DEFECT-003) |

**Phase B core path:** **PASS** (with open DEFECT-003 and optional P-13/P-14).

---

## Environment

| Item | Value |
|------|--------|
| API base | `http://192.168.2.105:3000` |
| Sensor | R503 @ 57600 (`/dev/serial0`) |
| Display / touch / RTC / buzzer | Initialized (`Hardware status` all True) |
| Offline queue DB | `~/kdvc-fingerprint/data/offline_transactions.db` |
| Secrets | Device API key via `.env` / systemd `EnvironmentFile` only (never logged) |

---

## Matrix (P-01 … P-15)

| ID | Check | Result | Notes |
|----|-------|--------|-------|
| P-01 | Power ON → Raspberry Pi OS | **PASS** | Prior + this session |
| P-02 | systemd starts `kdvc-fingerprint` | **PASS** | `active (running)`; enabled |
| P-03 | App loads `.env` via EnvironmentFile | **PASS** | `api_key_configured=true` |
| P-04 | Hardware init | **PASS** | Display, touch, RTC, buzzer, fingerprint |
| P-05 | Device authentication | **PASS** | `Authenticated device_id=device_1783962666378_8d478192` |
| P-06 | TFT splash → home READY | **PASS** | Place Finger / VERIFYING wait |
| P-07 | Enrollment | **PASS** | `enroll_kelvin_slot1_20260812` → `ACTIVE` slot 1 |
| P-08 | Known fingerprint | **PASS** | e.g. `outcome=VERIFIED` … `slot=1 confidence=69` |
| P-09 | NeoCard transaction in backend | **PASS** | Multiple `CHECK_IN` / `SUCCESS` for slot 1 |
| P-10 | Unknown fingerprint | **PASS** | `outcome=UNKNOWN` … `slot=None`; no phantom txn |
| P-11 | Backend/network loss | **PASS** | Enrolled finger → queue `OFFLINE` slot 1 |
| P-12 | Network recovery | **PASS** | `OFFLINE` → `SYNCED`; backend SUCCESS |
| P-13 | Replay same `transaction_id` | **PASS (software)** | Live Pi double-submit not filmed/logged |
| P-14 | Reboot with unsynced queue | **NOT RE-RUN** | Recommend one filmed reboot for handover |
| P-15 | journalctl usable; no secrets | **PASS** | Keys not printed in journals reviewed |

---

## Chronology (lab evidence)

### 1. Stale R503 templates (blocking known-finger until cleared)

- Before clear: `template_count: 4`
- Verify matched wrong slots (`slot=2`, later `slot=5`) → backend `UNKNOWN` (only slot 1 enrolled)
- Cleared library: `empty_library: True`, `count: 0`
- Re-capture on sensor for slot 1; backend rejected duplicate enroll (`User already has a fingerprint enrolled`) — **acceptable**: prior `ACTIVE` row kept; sensor slot 1 rewritten
- **Lesson:** Sensor flash and backend enrollment can diverge; clear or align slots before demos

### 2. Known finger + check-in

- TFT: Welcome Kelvin Muchemi / Check-In Successful
- Journal: `Verification outcome=VERIFIED user=user_1784053930781_e82767e8 slot=1`
- Backend example: `transaction_id=355db5dd-…` `SUCCESS` slot 1 @ `2026-08-12 18:08:37` UTC

### 3. Unknown finger

- Journal: `Verification outcome=UNKNOWN user=None slot=None confidence=None`
- No new backend check-in for that attempt (subsequent SUCCESS rows remain slot 1 only)

### 4. Offline → sync

Queued while backend unavailable:

| transaction_id | status (queued) | slot |
|----------------|-----------------|------|
| `add9518c-298b-4de4-92bc-34b751f1e02f` | OFFLINE → SYNCED | 1 |
| `29dc9cdb-4f62-43dc-8888-422f0ce0752a` | OFFLINE → SYNCED | 1 |

Backend after recovery (both `SUCCESS` @ `2026-08-12 18:24:21` UTC).

### 5. Stale offline FAILED noise

- Pre-fix queue contained many `FAILED` rows (wrong slots 2/5, `Fingerprint not recognized`)
- `FAILED` is not in the syncable set (not retried)
- Operational: backup DB, delete `status='FAILED'`, keep SYNCED history as needed

---

## Defects discovered on hardware

### DEFECT-003 — systemd stop timeout → SIGKILL

- **Severity:** Medium (ops / lifecycle; does not block verify/check-in path)
- **Expected:** `systemctl stop` → clean SIGTERM shutdown within timeout
- **Actual:** Often `State 'stop-sigterm' timed out. Killing.` → status=9/KILL
- **Likely cause:** Verify loop blocked in `wait_for_finger` / UART; shutdown path does not interrupt promptly
- **Disposition:** Record for Stage 5 handover; fix only if closing requires clean stop

### DEFECT-004 — Enrollment CLI response display empty fields (cosmetic)

- Success message shown; printed User/Device/Slot/Status as `—` while DB row complete
- **Disposition:** Cosmetic; optional follow-up

### Note — GPIO “channel already in use”

- RuntimeWarnings after unclean stop/KILL; related to DEFECT-003
- App still reaches Display initialized

---

## Remaining close-out (not blocking core PASS)

1. ~~Film demo video~~ — **Completed** (2026-08-12)
2. Optional: P-14 reboot with one unsynced OFFLINE row
3. Optional: explicit live P-13 idempotency demo
4. Decide DEFECT-003: accept as known limitation vs minimal fix
5. Quarantine remaining FAILED queue rows on Pi
6. Completion report / PDF: `STAGE5_COMPLETION_REPORT.md` / `.pdf`

---

## Final physical scorecard block

```
PHASE_B_STATUS=CORE_PASS
DATE=2026-08-12
DEVICE=device_1783962666378_8d478192
SLOT=1

P-01..P-12=PASS
P-13=SOFTWARE_PASS_LIVE_OPTIONAL
P-14=NOT_RERUN
P-15=PASS

DEFECT_003=OPEN (systemd stop SIGKILL)
DEFECT_004=OPEN (enroll CLI display cosmetic)
```
