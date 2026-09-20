# NeoSchool ↔ KDVC Endpoint Reuse Report

**MOU deliverable** — Connect NeoSchool to the existing KDVC ecosystem (reuse-first)  
**Organization:** Kardiverse Technologies LTD  
**Prepared for:** Nice  
**Date:** 16 September 2026  
**Scope cap:** 8 hours / EUR 40  

**Rule:** No new NeoSchool backend or endpoints without prior written approval from Nice.

---

## Cover note

NeoSchool MOU — endpoint reuse complete within approved scope.

- Reviewed Taxi, NeoPay, VoiceSlogan, User/Sponsor Dashboards, NeoCard/shared API, and Proof & Audit.
- Mapped and minimally wired **Student ID**, **Attendance** (read), **Device/Event**, and **Proof** to existing NeoCard endpoints.
- Basic API validation: **PASS** (V-01…V-03).
- **Skill Session ID**, **SkillLab**, and **Exams**: gaps — no matching KDVC endpoint; stopped per reuse-first rule.
- NeoPay / VoiceSlogan: **N/A** unless confirmed for this pilot.
- **No duplicate NeoSchool backend was created.**

NeoSchool UI: `frontend/school dashboard/dashboard-perfection` (client-side KDVC adapter only).

---

## 1. Executive status

| Item | Status |
|------|--------|
| KDVC systems reviewed | **Done** |
| Requirement → endpoint mapping | **Done** |
| Minimal reuse wiring into NeoSchool UI | **Done** (client-side adapter; no new backend) |
| Basic validation | **Done** (API smoke 16 Sep 2026) |
| Duplicate NeoSchool backend created? | **No** |

---

## 2. Endpoint reuse matrix (MOU §7)

| NeoSchool requirement | Source KDVC system | Reused endpoint / service | Adaptation made | Test result / remaining gap |
|----------------------|--------------------|---------------------------|-----------------|-----------------------------|
| Student ID | NeoCard / Shared API | `GET /v1/users` | Map `user_id` → student id in UI | **PASS** — HTTP 200; 6 users (6 active) |
| Attendance | NeoCard / Shared API | Verify + `POST /v1/neocard/checkin`; dashboard reads `GET /v1/neocard/transactions` | Preserve `occurred_at`; `created_at` = receive/sync time | **PASS** — read route HTTP 200; write path = fingerprint terminal (Stage 5) |
| Device / Event data | NeoCard / Shared API | `GET /v1/hardware/devices`, transactions | Devices → Admin; events → Overview/Proof | **PASS** — HTTP 200; 2 active devices |
| Skill Session ID | — | — | — | **GAP** — stopped; needs written approval for any new API |
| SkillLab data | — | — | — | **GAP** — stopped |
| Proof & Audit | NeoCard + Taxi + Dashboards | `/v1/neocard/transactions`, `/api/audit-logs`, `/api/user/audit` | Map to Proof tab | **Wired** (fallback chain) |
| User Dashboard flows | Dashboards backend | `/api/user/*` | Optional bridge | Config ready; full embed not required for this mapping |
| Sponsor Dashboard flows | Dashboards backend | `/api/sponsor/*` | Env only | **N/A** unless pilot needs sponsor KPIs |
| NeoPay | NeoPay | `/api/mpesa/*` | — | **N/A** unless payments are in pilot |
| VoiceSlogan | VoiceSlogan / Taxi | VoiceSlogan APIs | — | **N/A** unless slogan/voice is in pilot |
| Exams & Results | — | — | — | **GAP** — no KDVC exams API |

---

## 3. Minimal adaptation (what was built)

Client-side reuse only, under the NeoSchool school dashboard:

| Component | Role |
|-----------|------|
| KDVC config | Env for NeoCard / Taxi / Dashboards (optional NeoPay / VoiceSlogan) |
| KDVC HTTP client | Calls existing bases with `x-api-key` / Bearer |
| Mappers | Map KDVC JSON → existing school dashboard view models |
| School data composer | Overview / Analytics / Proof / Admin from KDVC; SkillLab / Exams throw documented gaps |
| Data source switch | Prefer KDVC when `VITE_USE_KDVC=true` |

**Not done (on purpose):** new NeoSchool API server, new SkillLab endpoints, SOC/NOC integration.

---

## 4. Basic validation evidence (16 Sep 2026)

NeoCard backend health: **OK** (`GET /health` → 200). No API keys included in this report.

| ID | Connection | Result |
|----|------------|--------|
| V-01 | `GET /v1/users` | **PASS** — 6 users / 6 active |
| V-02 | `GET /v1/hardware/devices` | **PASS** — 2 devices (includes Stage 5 device) |
| V-02b | `GET /v1/fingerprints` | **PASS** — 2 enrollments |
| V-03a | Transactions with admin key | **PASS** — correctly rejected (401) |
| V-03b | Transactions with device key | **PASS** — HTTP 200 (route reusable) |
| V-04 | SkillLab / Exams | **PASS (gap)** — documented; no KDVC endpoint |

**Live mapper counts:** studentsActive = 6 · totalEnrolled = 6 · fingerprintVerified = 2 · admin.devices = 2

---

## 5. Gap register

| Gap ID | Requirement | Disposition |
|--------|-------------|-------------|
| G-01 | Skill Session ID | Documented; stop; new API needs Nice written approval |
| G-02 | SkillLab data | Documented; stop |
| G-03 | Exams & Results | Documented; stop |
| G-04 | Dedicated `student_id` schema | Reuse `user_id` mapping only |

---

## 6. Event timestamp policy (confirmed)

| Field | Meaning |
|-------|---------|
| `occurred_at` / client `timestamp` | Original event time — **unchanged** after synchronization |
| `created_at` | Server receive / sync time (stored separately) |

---

## 7. KDVC systems reviewed (summary)

| KDVC system (MOU) | Reuse outcome for this pilot |
|-------------------|------------------------------|
| Taxi / Taxi backend | Available (audit/proof/scan); NeoCard preferred for school identity/attendance |
| NeoPay | Reviewed; **N/A** unless payments required |
| VoiceSlogan | Reviewed; **N/A** unless voice/slogan required |
| User Dashboard | Available (`/api/user/*`) |
| Sponsor Dashboard | Available (`/api/sponsor/*`) |
| Shared / Core API | NeoCard `/v1/*` + Taxi `/api/*` used as shared platform APIs |
| Proof & Audit | NeoCard transactions + Taxi audit + Dashboard audit routes |

---

## 8. Acceptance checklist (MOU §8)

| Criterion | Status |
|-----------|--------|
| Existing KDVC systems reviewed within time cap | **Yes** |
| Relevant NeoSchool functions mapped to existing endpoints | **Yes** |
| Reuse integrations validated (basic) | **Yes** (API smoke PASS) |
| Gaps documented (not silently replaced by new APIs) | **Yes** |
| No duplicate NeoSchool backend | **Yes** |
| Endpoint reuse report provided | **This PDF** |

---

## 9. Closing

MOU core deliverable is complete: review → map → minimal reuse → basic tests → report, with gaps documented.

Any work on SkillLab, Skill Session ID, Exams, or **new** endpoints requires **separate prior written approval** from Nice and is outside the EUR 40 cap unless extended in writing.

---

*Prepared under the NeoSchool ↔ KDVC reuse-first MOU — Kardiverse Technologies LTD.*
