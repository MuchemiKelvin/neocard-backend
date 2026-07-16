# System Architecture — Phase 2 Fingerprint Enrollment

**Repositories:**
- `neocard-backend` — Node.js / Express / SQLite API
- `kdvc-fingerprint` — Python application on Raspberry Pi + R503

---

## High-level view

```
┌─────────────────────────────────────────────────────────────┐
│                     Raspberry Pi (KDVC)                     │
│                                                             │
│  app/main.py                                                │
│       │                                                     │
│       ▼                                                     │
│  EnrollmentWorkflow                                         │
│       │                                                     │
│       ▼                                                     │
│  EnrollmentService                                          │
│       ├── Fingerprint Driver  ──► R503 (UART /dev/serial0)  │
│       └── ApiService          ──► HTTP (x-api-key: kdvc_…)  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   NeoCard Backend                           │
│                                                             │
│  GET  /health                                               │
│  GET  /v1/device/me              (device API key)           │
│  POST /v1/fingerprints/enroll    (device API key)           │
│                                                             │
│  Admin (setup):                                             │
│  POST /v1/users                                             │
│  POST /v1/hardware/devices                                  │
│  POST /v1/hardware/assign                                   │
│                                                             │
│  SQLite: users, hardware_devices, hardware_mappings,        │
│          fingerprint_enrollments                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Components

### Backend (`neocard-backend`)

| Layer | Responsibility |
|-------|----------------|
| `routes/` | HTTP endpoints |
| `middleware/` | Admin vs device API-key auth |
| `services/fingerprintValidation.js` | Enrollment rules |
| `database/index.js` | SQLite schema + CRUD |

**Design rule:** Backend stores enrollment **metadata** (user ↔ device ↔ slot). Biometric templates remain on the R503.

### Raspberry Pi (`kdvc-fingerprint`)

| Layer | Path | Responsibility |
|-------|------|----------------|
| Entry | `app/main.py` | Console prompts |
| Workflow | `app/workflows/enrollment_workflow.py` | Coordinator only |
| Service | `app/services/enrollment_service.py` | Orchestrate sensor + API |
| API | `app/services/api_service.py` | HTTP only |
| Driver | `drivers/fingerprint.py` | R503 UART (frozen for Phase 2) |

---

## Communication flow

```
1. Pi: GET /health
2. Pi: GET /v1/device/me          → device_id
3. Pi: R503 enroll(slot)          → template on sensor
4. Pi: POST /v1/fingerprints/enroll
5. Backend: validate + insert fingerprint_enrollments
6. Pi: print success
```

---

## Authentication model

| Actor | Credential | Endpoints |
|-------|------------|-----------|
| Admin / dashboard | `neocard_admin_demo_key_2024` | Users, hardware admin, NeoCare |
| Fingerprint terminal | Device `kdvc_...` key | `/v1/device/me`, `/v1/fingerprints/enroll` |

Header: `x-api-key`.

---

## Data ownership

| Data | Where stored |
|------|--------------|
| Fingerprint template | R503 sensor flash (slot 1–199) |
| User profile | SQLite `users` |
| Device registry + API key | SQLite `hardware_devices` |
| User ↔ device assignment | SQLite `hardware_mappings` |
| Enrollment mapping | SQLite `fingerprint_enrollments` |

---

## Full API list

See **[API_REFERENCE.md](./API_REFERENCE.md)** for all **54** endpoints across health, scan, users, roles, hardware, device, fingerprints, NeoCare, and AI.
