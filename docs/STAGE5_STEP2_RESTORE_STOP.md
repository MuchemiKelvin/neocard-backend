# Stage 5 — Step 2 Restore Attempt: STOPPED

**Date:** 2026-08-09  
**Decision:** Stopped before creating a live `hardware_devices` row or rotating the Pi credential.

No API key values are included in this document.

---

## Final report (required fields)

| # | Item | Result |
|---|------|--------|
| 1 | Restored device identity | **no** |
| 2 | Device ID status | **Ambiguous** — multiple legitimate historical IDs found; none present in `hardware_devices` |
| 3 | New credential provisioned | **no** |
| 4 | Old credential revoked | **no** (still orphaned; not bound to any live row) |
| 5 | `/v1/device/me` result | **not run** (no restored identity) |
| 6 | Database integrity | **ok** (`PRAGMA integrity_check`) |
| 7 | Backend tests | **45/45 passed** |
| 8 | Pi tests | **24/24 passed** |
| 9 | Remaining risks | See below |

---

## What was inspected

### Live `hardware_devices`
Only `fp_test_device_1786229209503` (test leftover). Not treated as the production KDVC terminal.

### Backups under `database/backups/`
All three backups contain the same test-only device row. **No pre-wipe KDVC device row available to restore from backup.**

### Seed / migration code
No seeded KDVC device registration. Devices are created via admin API / `createHardwareDevice` only.

### Legitimate non-secret evidence in the **live** DB (`sync_logs`)
`hardware_assigned` events (chronological) for Kelvin demo user `user_1784053930781_e82767e8`:

| Order | device_id | Notes |
|------|-----------|--------|
| earlier | `device_1783962666378_8d478192` | Also appears in docs/tests history; multi-user assignments |
| | `device_1784655755138_f30e1d8f` | Assigned twice to Kelvin |
| | `device_1785610434817_37f6add4` | Assigned to Kelvin |
| **latest** | `device_1785684997828_6a4680a3` | Most recent Kelvin assignment in sync_logs |

Other fingerprint devices also appear historically (early demo / Stage3 prepush). None exist in `hardware_devices` now.

### Git history (non-secret only)
- Device name pattern: `KDVC-RPI-001`
- Documented ID: `device_1783962666378_8d478192`
- No single authoritative “current” ID for the Pi `.env` binding

### Pi local storage
No persisted `device_id` under `data/` (identity always came from `/v1/device/me`).

---

## Why restore was stopped

The original KDVC `device_id` **cannot be uniquely recovered** with honesty:

1. Live `hardware_devices` row is missing.  
2. Available DB backups do not contain the pre-wipe device.  
3. `sync_logs` prove **several** successive device IDs were used for the same Kelvin user (recreate cycles after prior wipes).  
4. The Pi does not store `device_id`, so `.env` cannot tell us which historical ID it last used.  
5. Choosing any one ID without your confirmation would invent/guess production identity.

Per Step 2 instructions: **stop before creating a replacement.**

---

## What is missing (human decision required)

Pick **one** restore target (recommended default if you agree):

- **Recommended:** `device_1785684997828_6a4680a3` — latest Kelvin assignment in live `sync_logs`  
- **Alternative:** `device_1783962666378_8d478192` — earliest durable demo ID also referenced in docs history  

Also confirm:

- Demo user to re-assign: `user_1784053930781_e82767e8` (Kelvin)  
- Device name: `KDVC-RPI-001`  
- Re-enrollment of fingerprint slot on R503 after restore (enrollments table has no KDVC rows)

---

## Safe provisioning method now available (not executed)

1. `npm run db:backup`  
2. Admin create with **explicit** `device_id` (supported as of this change):

   `POST /v1/hardware/devices`  
   body includes recovered `device_id` + `device_type=fingerprint_device` + `device_name=KDVC-RPI-001`  
   → server generates a **new** `api_key` (never from git history)

3. `POST /v1/hardware/assign` to Kelvin user  
4. Optionally `POST .../rotate-api-key` if you want a second fresh key after create  
5. Write new key to Pi `.env` as `DEVICE_API_KEY` (local only)  
6. `GET /v1/device/me` → expect same `device_id`  
7. Old compromised Pi key → `401`  
8. Re-enroll fingerprint on device for slot used in demo  

---

## Security cleanup done in this pass (without restoring)

- Admin `GET /v1/hardware/devices/:deviceId` no longer returns `api_key`  
- List endpoint already stripped keys  
- Create may accept optional `device_id` for legitimate restore; still returns key **only** at create/rotate  
- Client-supplied `api_key` is not accepted on create  

---

## Remaining risks

1. Pi `.env` key remains compromised/orphaned until restore+rotate.  
2. Choosing the wrong historical `device_id` could diverge from client expectations — needs your confirmation.  
3. Fingerprint enrollments for KDVC are gone — physical re-enroll required after restore.  
4. Git history still contains old key literals (rewrite deferred; revoke-by-rotation still required).  
5. Step 3 (systemd) must wait until identity restore is confirmed.

---

## Next action for Kelvin

Reply with the `device_id` to restore (or approve the recommended latest ID).  
Only then will Step 2 proceed to: restore row → new credential → Pi `.env` → `/v1/device/me` → revoke old → mark Step 2 complete.
