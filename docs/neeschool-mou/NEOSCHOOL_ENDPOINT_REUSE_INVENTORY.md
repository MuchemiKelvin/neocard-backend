# NeoSchool MOU — KDVC System Inventory (Reuse-First)

**MOU rule:** Review / map / reuse existing KDVC endpoints only. No new NeoSchool backend.  
**Date started:** 2026-09-16  
**Local scan root:** `/home/kelvin/Projects/Kardiverse Technologies LTD/`  
**NeoSchool UI found:** `frontend/school dashboard/dashboard-perfection`  
**Reuse wiring:** client-side `src/lib/kdvc/` (see `NEOSCHOOL_ENDPOINT_REUSE_REPORT.md`)  
**Status:** Inventory + mapping + minimal frontend reuse adapter complete. Smoke tests need running NeoCard + API keys.

---

## Systems found locally

| KDVC system (MOU) | Local path | API surface found | Auth (as coded) | Notes |
|-------------------|------------|-------------------|-----------------|-------|
| Taxi App / Taxi backend | `taxi-backend/` | Express `/api/*` modules | Role headers / module-specific | Includes NeoCard scan, proof-logs, audit-logs, VoiceSlogan bridge, bookings |
| NeoPay | `neo-pay-backend/` | `/api/mpesa/*` | API key | M-Pesa STK/B2B — **only if pilot needs payments** |
| VoiceSlogan | `voiceslogan/` + taxi `modules/voiceslogan.js` | `/api` voiceslogan + device posts | API key | Slogan/tokens/device events — **only if pilot needs voice/slogan** |
| User Dashboard | `Dashboards/Neo User Dashboard` + `Dashboards/backend` | `/api/user/*` | Dashboard auth | Overview, scans, rewards, audit proofs |
| Sponsor Dashboard | `Dashboards/Neo Sponsor Dashboard` (+ Standard) + backend | `/api/sponsor/*` | Dashboard auth | Overview, campaigns, escrow, monitor |
| Shared / Core API | *No separate “core API” repo found* | Closest: `neocard-backend` `/v1/*` + taxi `/api/*` | Device API key / admin API key | Treat NeoCard + Taxi as shared platform APIs for this pilot |
| Proof & Audit | Taxi logs + Dashboard Audit + NeoCard AI proof | `/api/audit-logs`, `/api/proof-logs`, `/api/audit/*`, `/ai/.../proof` | Various | Reusable for event integrity trails |

### Related local assets (not MOU reuse targets unless Nice confirms)

| Asset | Path | Why noted |
|-------|------|-----------|
| NeoCard / Fingerprint backend | `neocard-backend/` | Strongest fit for Student ID, Attendance, Device/Event |
| kdvc-fingerprint | `kdvc-fingerprint/` | Device client (already validated Stage 5) — not a backend to rebuild |
| LMS / Frappe | `/home/kelvin/Projects/LMS/lms` | Possible SkillLab-adjacent; **not** listed in MOU reuse systems → treat as **GAP** unless Nice maps it in |
| NeoSchool app repo | *Not found locally* | Wiring target unknown — config/client glue cannot start until Nice points to the NeoSchool codebase |

---

## A. Taxi backend (`taxi-backend`) — key endpoints

Base: `/api` (see `server.js`)

| Method | Path | Candidate reuse for |
|--------|------|---------------------|
| GET | `/api/health` | Health |
| POST | `/api/login` | Auth (taxi roles) |
| GET | `/api/whoami` | Identity check |
| POST | `/api/neocard/scan` | Event / scan log (UID + timestamp) |
| GET | `/api/neocard/logs` | Event history |
| GET | `/api/neocard/stats` | Aggregates |
| GET | `/api/proof-logs` | Proof trail (bookings module) |
| GET | `/api/audit-logs` | Audit trail |
| GET | `/api/hack-logs` | Security/error trail |
| GET/POST | `/api/voiceslogan/...` | VoiceSlogan bridge (if relevant) |
| POST | `/api/neofly/session` | Session-like pattern (not school SkillLab) |

**SOC/NOC taxi routes exist** (`/api/soc/*`, `/api/noc/*`) but MOU **excludes** SOC/NOC integration — do not use under this MOU.

---

## B. NeoCard / Shared device API (`neocard-backend`)

Base: `/v1` (and `/neocare`, `/ai`)

| Method | Path | Candidate reuse for |
|--------|------|---------------------|
| GET | `/health` (via server) | Health |
| POST | `/v1/users` / GET `/v1/users` / GET `/v1/users/:userId` | **Student ID** (map user ↔ student) |
| GET | `/v1/roles` | Role codes |
| POST/GET | `/v1/hardware/devices` | **Device** registry |
| GET | `/v1/device/me` | Device identity (device API key) |
| POST | `/v1/fingerprints/enroll` | Biometric enroll |
| POST | `/v1/fingerprints/verify` | Identity for attendance |
| POST | `/v1/neocard/checkin` | **Attendance** / CHECK_IN (`occurred_at` preserved) |
| POST | `/v1/neocard/transactions` | Generic typed events |
| GET | `/v1/neocard/transactions` | Event history |
| POST | `/ai/tabs/:id/proof` | Proof attachment |
| GET | `/neocare/sync/users` etc. | Care sync patterns (secondary) |

**Attendance timestamp note (already implemented):** client may send `timestamp` / `occurred_at`; backend stores as `occurred_at`; DB also has `created_at` for receive/sync time.

---

## C. NeoPay (`neo-pay-backend`)

Base: `/api/mpesa`

| Method | Path | Pilot relevance |
|--------|------|-----------------|
| GET | `/health` | Ops |
| POST | `/stk-push` | Payment — **only if NeoSchool pilot needs pay** |
| GET | `/transactions` | Payment history |
| POST | `/webhook/stk` | Provider callback |

**Default for this MOU:** mark **N/A unless Nice confirms payment in pilot**.

---

## D. VoiceSlogan (`voiceslogan`)

Base: `/api` (API key)

| Method | Path | Pilot relevance |
|--------|------|-----------------|
| POST | `/` (voiceslogan submit) | Slogan submit |
| GET | `/summary` | Summary |
| GET | `/tokens/:userId` | Token balance |
| POST | `/neotalk-lite`, `/neofall-mini`, … | Device event posts |

**Default:** **N/A unless pilot needs slogan/voice**. Fall device posts exist but School Safety backend rebuild is out of scope; reuse only if NeoSchool UI must show these events.

---

## E. Dashboards backend (`Dashboards/backend`)

Base: `/api`

| Area | Paths | NeoSchool fit |
|------|-------|---------------|
| Auth | `/api/auth/login`, `/register`, `/profile` | Dashboard login reuse |
| User | `/api/user/overview`, `/scan-history`, `/rewards`, `/audit`, `/notifications`, … | **User Dashboard** pilot views |
| Sponsor | `/api/sponsor/overview`, `/campaigns`, `/escrow`, `/monitor`, … | **Sponsor Dashboard** pilot views |
| Audit | `/api/audit/overview`, `/media/proofs`, `/scans/logs`, `/verify/chain`, … | **Proof & Audit** connectivity |

---

## F. SkillLab / Skill Session ID

| Finding | Result |
|---------|--------|
| Explicit SkillLab API in MOU-listed KDVC systems | **Not found** |
| LMS exists at `/home/kelvin/Projects/LMS` | Outside listed reuse systems |
| Taxi `neofly/session` | Transport session — not school SkillLab |

→ Recorded as **GAP** in the reuse report (stop; no new SkillLab API under this MOU).

---

## Working rules for remaining hours

1. Fill mapping table (done in companion report).  
2. Ask Nice for NeoSchool client/repo + which pilot screens are in scope.  
3. Wire **only** mapped endpoints (env + field mapping).  
4. Smoke-test each wired call; attach evidence.  
5. Stop at 8h; ship report with gaps.
