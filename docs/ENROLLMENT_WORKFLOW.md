# Fingerprint Enrollment Workflow — Phase 2

End-to-end enrollment from the R503 sensor to NeoCard SQLite.

---

## Sequence

```
Admin (laptop)                 Raspberry Pi                    NeoCard Backend
     │                              │                               │
     │  POST /v1/users              │                               │
     │  POST /v1/hardware/devices   │                               │
     │  POST /v1/hardware/assign    │                               │
     │                              │                               │
     │                              │  GET /health                  │
     │                              │──────────────────────────────►│
     │                              │  GET /v1/device/me            │
     │                              │──────────────────────────────►│
     │                              │  device_id                    │
     │                              │◄──────────────────────────────│
     │                              │                               │
     │                              │  Place / remove / place finger│
     │                              │  R503: capture → model → slot │
     │                              │                               │
     │                              │  POST /v1/fingerprints/enroll │
     │                              │──────────────────────────────►│
     │                              │  validate + store mapping     │
     │                              │◄──────────────────────────────│
     │                              │  ✓ Enrollment Complete        │
```

---

## Pi application flow

```
python -m app.main
        │
        ▼
EnrollmentWorkflow.run(enrollment_id, user_id, fingerprint_slot)
        │
        ▼
EnrollmentService.enroll(...)
        │
        ├── ApiService.get_device()     → device_id
        ├── Fingerprint.enroll(slot)    → R503 template
        └── ApiService.enroll(...)      → POST /v1/fingerprints/enroll
```

---

## API calls (enrollment path)

| Order | Call | Auth |
|-------|------|------|
| 1 | `GET /health` | none |
| 2 | `GET /v1/device/me` | device `kdvc_...` |
| 3 | `POST /v1/fingerprints/enroll` | device `kdvc_...` |

### Enroll payload

```json
{
  "enrollment_id": "ENR-PI-002",
  "user_id": "user_...",
  "device_id": "device_...",
  "fingerprint_slot": 2,
  "created_by": "raspberry-pi"
}
```

`device_id` **must** come from `/v1/device/me`, not a hardcoded constant.

---

## Validation steps (backend)

Before insert, `FingerprintValidation.validateEnrollment` checks:

1. Required fields present  
2. Slot is integer **1–199**  
3. User exists and is active  
4. Device exists, active, type `fingerprint_device`  
5. `device_id` matches the authenticated terminal  
6. Device is **assigned** to the user  
7. User has no **active** enrollment on that device (`DUPLICATE_ENROLLMENT`)  
8. Slot is not already occupied on that device  

---

## Verified hardware test (Milestone 2)

| Field | Example value |
|-------|----------------|
| Enrollment ID | `ENR-PI-002` |
| User | Kelvin Muchemi (`user_1784053930781_e82767e8`) |
| Slot | `2` |
| Result | `✓ Enrollment Complete` / Fingerprint enrolled successfully |

Verify:

```bash
curl http://localhost:3000/v1/fingerprints/ENR-PI-002
```

---

## Related

- Full endpoint catalog: [API_REFERENCE.md](./API_REFERENCE.md)
- Architecture: [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)
- Install: [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md)
