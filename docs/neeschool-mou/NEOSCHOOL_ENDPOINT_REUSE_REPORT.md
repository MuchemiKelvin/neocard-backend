# NeoSchool MOU — Endpoint Reuse Report

**Phase:** Connect NeoSchool (`frontend/school dashboard`) to existing KDVC ecosystem (reuse-first)  
**Date:** 2026-09-16 (updated after locating NeoSchool UI)  
**Hour cap:** 8h / €40  
**Rule:** No new NeoSchool backend / endpoints without Nice’s prior written approval  

**Companion inventory:** `NEOSCHOOL_ENDPOINT_REUSE_INVENTORY.md`  
**NeoSchool UI path:** `frontend/school dashboard/dashboard-perfection`

---

## 1. Executive status

| Item | Status |
|------|--------|
| KDVC systems reviewed (local repos) | **Done** |
| Requirement → endpoint mapping | **Done** |
| Minimal reuse wiring into NeoSchool app | **Done** — client-side KDVC adapter under `src/lib/kdvc/` |
| Basic validation of wired connections | **Done (API smoke 2026-09-16)** — see §4; UI `.env` still operator-local |
| Duplicate NeoSchool backend created? | **No** (did not expand mock `server/`; reuse is frontend→existing KDVC) |

---

## 2. Endpoint reuse matrix (MOU deliverable)

| NeoSchool requirement | Source KDVC system | Reused endpoint / service | Adaptation made | Test result / remaining gap |
|----------------------|--------------------|---------------------------|-----------------|-----------------------------|
| **Student ID** | NeoCard / Shared | `GET /v1/users` | Map `user_id` → student `id` in UI mappers | **PASS** smoke: HTTP 200, 6 users (6 active). |
| **Attendance** | NeoCard / Shared | `POST /v1/fingerprints/verify` + `POST /v1/neocard/checkin` (device); dashboard reads `GET /v1/neocard/transactions` | Preserve `occurred_at`; `created_at` = receive time | **PASS** read route with device key (HTTP 200). Write path = fingerprint terminal (Stage 5). |
| **Device / Event data** | NeoCard / Shared | `GET /v1/hardware/devices`, transactions | Devices → Admin tab; events → Overview/Proof | **PASS** devices HTTP 200 (2 active, incl. `KDVC-RPI-001` id). |
| **Skill Session ID** | — | — | — | **GAP** — `KdvcGapError`; UI falls back to live store. Stopped. |
| **SkillLab data** | — | — | — | **GAP** — same as above. Stopped. |
| **Proof & Audit** | NeoCard txns + Taxi + Dashboards | `/v1/neocard/transactions`, `/api/audit-logs`, `/api/user/audit` | Map to Proof tab logs / layers | **Wired** with fallback chain. |
| **User Dashboard flows** | Dashboards backend | `/api/user/*` (optional bearer) | Optional proof bridge | **Config ready**; full User Dashboard embed not required for pilot mapping. |
| **Sponsor Dashboard flows** | Dashboards backend | `/api/sponsor/*` | Env only | **N/A unless pilot screen needs sponsor KPIs** (overview uses NeoCard counts). |
| **NeoPay** | NeoPay | `/api/mpesa/*` | Env stubs only | **N/A** unless Nice confirms payments. |
| **VoiceSlogan** | VoiceSlogan / Taxi | VS APIs | Env stubs only | **N/A** unless Nice confirms; overview voice count stays 0 from KDVC. |
| **Exams & Results** | — | — | — | **GAP** — no KDVC exams API; falls back to live store. |

---

## 3. What was implemented (minimal adaptation)

Location: `frontend/school dashboard/dashboard-perfection/src/lib/kdvc/`

| File | Role |
|------|------|
| `config.ts` | Env for NeoCard / Taxi / Dashboards (and optional NeoPay/VS) |
| `client.ts` | Thin `fetch` to existing bases with `x-api-key` / Bearer |
| `mappers.ts` | Map KDVC JSON → existing school tab types |
| `schoolFromKdvc.ts` | Compose header/overview/analytics/proof/admin; throw gaps for SkillLab/Exams |
| `dataSource.ts` | Prefer KDVC when `VITE_USE_KDVC=true`, else mock/live store |

**Not done (on purpose):** expanding `server/index.js` into a NeoSchool API, new SkillLab endpoints, SOC/NOC.

---

## 4. Basic validation log (2026-09-16)

NeoCard backend running locally (`GET /health` → 200). Keys taken from existing DB seed / device rows (not printed). Scrubbed JSON evidence under `docs/neeschool-mou/_smoke/` (no secrets).

| # | Connection | Expected | Result |
|---|------------|----------|--------|
| V-01 | `GET /v1/users` | 200 + users | **PASS** — 6 users / 6 active |
| V-02 | `GET /v1/hardware/devices` | 200 + devices | **PASS** — 2 devices (`device_1783962666378_8d478192`, `fp_test_device_…`) |
| V-02b | `GET /v1/fingerprints` | 200 + enrollments | **PASS** — 2 enrollments |
| V-03a | `GET /v1/neocard/transactions` with **admin** key | Reject (device auth) | **PASS** — 401 `INVALID_DEVICE_API_KEY` |
| V-03b | `GET /v1/neocard/transactions` with **device** key | 200 | **PASS** — 200 (0 rows for that device key at test time; route reusable) |
| V-04 | SkillLab / Exams | Gap documented | **PASS (gap)** — no KDVC endpoint; UI falls back |

**Mapper readiness from live counts:** `studentsActive=6`, `totalEnrolled=6`, `fingerprintVerified=2`, `admin.devices=2`.

### Enable school dashboard UI against the same APIs

Create locally (do not commit):  
`frontend/school dashboard/dashboard-perfection/.env`

```bash
VITE_USE_KDVC=true
VITE_NEOCARD_API_URL=http://127.0.0.1:3000
VITE_NEOCARD_API_KEY=<from api_keys table / demo admin key>
VITE_NEOCARD_DEVICE_API_KEY=<from hardware_devices.api_key for KDVC-RPI-001>
```

Then `npm run dev` in `dashboard-perfection` → Overview / Analytics / Proof / Admin.

---

## 5. Gap register

| Gap ID | Requirement | Disposition |
|--------|-------------|-------------|
| G-01 | Skill Session ID | Documented; stop; needs Nice approval for new API |
| G-02 | SkillLab data | Documented; stop |
| G-03 | Exams & Results | Documented; stop |
| G-04 | Dedicated `student_id` column | Reuse `user_id` mapping only |

---

## 6. Timestamp policy (confirmed)

| Field | Meaning |
|-------|---------|
| `occurred_at` / client `timestamp` | Original event time (unchanged after sync) |
| `created_at` | Server receive / sync time |

---

## 7. Acceptance checklist (MOU §8)

| Criterion | Status |
|-----------|--------|
| Existing KDVC systems reviewed | **Yes** |
| Relevant functions mapped | **Yes** |
| Reuse integrations + basic validation | **Wiring done; API smoke PASS (V-01…V-03)** |
| Gaps documented (not replaced by new APIs) | **Yes** |
| No duplicate NeoSchool backend | **Yes** |
| Endpoint reuse report provided | **This document** |

---

## 8. Deliver to Nice

1. This report (+ inventory appendix)  
2. Note: NeoSchool UI connected via **client-side reuse** to NeoCard/Taxi/Dashboards  
3. Gaps: SkillLab, Skill Session ID, Exams  
4. Ask Nice only if they want **new** APIs for those gaps (separate written approval)
