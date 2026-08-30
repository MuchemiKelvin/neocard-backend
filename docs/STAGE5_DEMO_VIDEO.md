# Stage 5 — Demonstration Video Guide

**Purpose:** One continuous (or lightly edited) recording of the **finished product** on the physical NeoCard fingerprint terminal. Audience: client / MOU handover — not a debug session.

**Companion evidence:** `docs/STAGE5_PHASE_B_PHYSICAL_RESULTS.md`

---

## Prep (before you hit record)

1. Backend running on laptop (`192.168.2.105:3000`); Pi on same LAN.
2. Service running: `sudo systemctl start kdvc-fingerprint.service` → TFT **Place Finger**.
3. Kelvin enrolled on **slot 1**; R503 library clean (only the demo template — avoid stale slots).
4. Offline queue: no pending FAILED spam (optional: delete `FAILED` rows after backup).
5. Camera: landscape, stable; show **TFT clearly**; second angle or brief cut to laptop for backend row is fine.
6. **Never** show `.env`, API keys, or admin rotate-key responses on camera or in narration.

Target length: **3–6 minutes**.

---

## Recommended shot list (MOU order)

| # | Shot | What to show / say | Pass criteria on camera |
|---|------|--------------------|-------------------------|
| 1 | Title card (optional) | “NeoCampus Fingerprint Terminal — Stage 5 demo” + date + device `KDVC-RPI-001` | — |
| 2 | Power / appliance start | Power on **or** `systemctl start` if already booted; wait for splash → home | Auto-start or service start → Place Finger |
| 3 | Ready state | Hold on TFT: Place Finger | Clear home/ready UI |
| 4 | Unknown finger | Place a finger that is **not** enrolled | Rejection / “Fingerprint Not Recognized”; returns to ready |
| 5 | Known finger | Place enrolled finger (slot 1) | Verifying → Welcome **Kelvin Muchemi** → **Check-In Successful** → ready |
| 6 | Backend proof | Laptop: show new check-in row (DB UI, sqlite one-liner, or API client) for slot 1 / Kelvin — **no secrets** | One SUCCESS check-in visible |
| 7 | Offline | Stop backend (or unplug LAN briefly); scan enrolled finger | Offline / queued UX; terminal stays alive |
| 8 | Offline proof (optional cut) | Pi: show queue row `OFFLINE` slot 1 (Python one-liner ok) | Status OFFLINE |
| 9 | Recovery | Start backend / restore network; wait for sync | Queue → SYNCED; or Welcome path works again online |
| 10 | Closing | Return to Place Finger; end card “Stage 5 physical demo complete” | Ready state |

### Optional extras (nice for handover, not required if time-limited)

- **Reboot:** `sudo reboot` → cold return to Place Finger without SSH (proves systemd).
- **Idempotency:** mention software-proven UUID reuse; only film if you can show one transaction_id once.

### Do **not** include

- Failed enrollments, sensor clear scripts, API key rotation
- Long journalctl dumps, IDE debugging, ChatGPT/Cursor screens
- Wrong-slot / FAILED queue archaeology
- systemd stop-timeout / SIGKILL (document separately; not for demo video)

---

## Narration script (short)

> This is the NeoCampus fingerprint terminal. After power-on, the app starts under systemd and reaches the ready screen.  
> An unknown finger is rejected.  
> The enrolled user is recognized, welcomed, and checked in to NeoCard.  
> Here is the matching successful transaction on the backend.  
> With the server unavailable, the check-in is queued on the device.  
> When connectivity returns, the queued transaction synchronizes.  
> The terminal returns to ready. End of Stage 5 physical demonstration.

---

## After recording

1. Save file as e.g. `NeoCampus_KDVC-RPI-001_Stage5_Demo_2026-08-12.mp4` (or client naming).
2. Note file path / share link in the completion report.
3. Cross-check shots 4–6 and 7–9 against `STAGE5_PHASE_B_PHYSICAL_RESULTS.md`.
