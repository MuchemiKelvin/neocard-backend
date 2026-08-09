# Stage 5 — Software Release Candidate Freeze (post–Step 4)

**Date:** 2026-08-09  
**Status:** FROZEN for Step 5 local regression / E2E preparation  
**Rule:** Do **not** change application functionality unless the Step 5 matrix finds a defect.

This freeze captures the accepted local completion of Steps 1–4. It is the software candidate that will later be deployed unchanged (except defect fixes) to the Raspberry Pi for physical validation.

Stage 5 is **not** fully production-ready until physical deployment/validation succeeds.

---

## Frozen HEADs

| Repository | Branch | HEAD | Commit |
|------------|--------|------|--------|
| `kdvc-fingerprint` | `main` | `24c9d77` (`24c9d77d0fd5dca19245ba0ed7e339ab6f0db6f1`) | `feat(stage5): add offline resilience and transaction synchronization` |
| `neocard-backend` | `main` | `9a67fe4` (`9a67fe4c6c0779e0ec1dc1e7f771e2f86357a929`) | `docs(stage5): record Step 2 test discovery verification` |

---

## Local automated baseline at freeze

| Suite | Result |
|-------|--------|
| Backend `npm test` | **50/50 PASS** |
| Pi software `python -m unittest discover -s tests -p 'test*.py' -v` | **64/64 PASS** at Step 4 freeze |
| Hardware tests in default suite | **Excluded** (`tests/hardware/` only) |

Note: An earlier interim Step 4 report cited 56/56 Pi tests; the accepted Step 4 freeze count is **64/64**. Step 5 may add orchestration/regression tests without changing production code (see `STAGE5_STEP5_LOCAL_GATE.md`).

---

## Steps closed locally

| Step | Status |
|------|--------|
| 1. Freeze baseline | ✅ |
| 2. DB / device identity protection | ✅ (Pi credential sync at deploy) |
| 3. systemd auto-start (local) | ✅ (`SYSTEMD_VALIDATION=PENDING_PI`) |
| 4. Resilience / offline recovery (local) | ✅ (physical offline/sync PENDING_PI) |

---

## Intentionally deferred to physical deploy

- systemd install/enable on the Pi
- Power-on → READY boot chain
- R503 / TFT / touch / buzzer / RTC physical E2E
- Offline queue + sync on real hardware/network
- Fresh-device first auth (no cached identity) on Pi

---

## Next

See `docs/STAGE5_STEP5_REGRESSION.md` for the Step 5 matrix (local software first, then physical Pi with this same candidate).
