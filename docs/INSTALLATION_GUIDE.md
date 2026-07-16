# Installation Guide — Phase 2

Setup for **neocard-backend** and **kdvc-fingerprint** (Raspberry Pi + R503).

---

## 1. Backend setup (`neocard-backend`)

### Requirements

- Node.js 18+
- npm

### Install & run

```bash
cd neocard-backend
cp .env.example .env   # if present; adjust PORT, CORS, etc.
npm install
npm start
```

Health check:

```bash
curl http://localhost:3000/health
```

Expected: `"status":"OK"`

### Seeded admin API key

```
neocard_admin_demo_key_2024
```

Use this for `POST /v1/users`, `POST /v1/hardware/devices`, `POST /v1/hardware/assign`.

> `API_KEY_SECRET` in `.env` is **not** the `x-api-key` header value.

### First-time enrollment setup (admin)

```bash
# Create user
curl -X POST http://localhost:3000/v1/users \
  -H "Content-Type: application/json" \
  -H "x-api-key: neocard_admin_demo_key_2024" \
  -d '{"first_name":"Kelvin","last_name":"Muchemi","email":"kelvin@kardiverse.com"}'

# Create fingerprint device (save device_id + api_key from response)
curl -X POST http://localhost:3000/v1/hardware/devices \
  -H "Content-Type: application/json" \
  -H "x-api-key: neocard_admin_demo_key_2024" \
  -d '{
    "device_type":"fingerprint_device",
    "device_name":"KDVC-RPI-001",
    "serial_number":"RPI001",
    "firmware_version":"1.0.0"
  }'

# Assign device to user
curl -X POST http://localhost:3000/v1/hardware/assign \
  -H "Content-Type: application/json" \
  -H "x-api-key: neocard_admin_demo_key_2024" \
  -d '{"user_id":"<USER_ID>","device_id":"<DEVICE_ID>"}'
```

---

## 2. Raspberry Pi setup (`kdvc-fingerprint`)

### Requirements

- Raspberry Pi with UART enabled (`/dev/serial0`)
- R503 fingerprint sensor wired to UART
- Python 3.11+ recommended
- Network reachability to the backend host

### Install

```bash
cd kdvc-fingerprint
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Configuration

Edit `app/config/settings.py` (local/dev):

```python
API_BASE_URL = "http://<BACKEND_LAN_IP>:3000"  # not localhost if backend is on laptop
DEVICE_API_KEY = "kdvc_..."                    # from hardware device create response
API_TIMEOUT = 10
```

| Variable | Meaning |
|----------|---------|
| `API_BASE_URL` | NeoCard backend URL reachable from the Pi |
| `DEVICE_API_KEY` | Device key (`kdvc_...`) — **not** the admin key |
| `UART_PORT` | Default `/dev/serial0` |

`device_id` is **not** configured locally; it comes from `GET /v1/device/me`.

### Run enrollment demo

```bash
source .venv/bin/activate
python -m app.main
```

Prompts:

1. Enrollment ID (e.g. `ENR-PI-002`)  
2. User ID (from `POST /v1/users`)  
3. Fingerprint slot (1–199; unused on that device)  
4. Place / remove / place finger on R503  

Success:

```
✓ Enrollment Complete
Message : Fingerprint enrolled successfully.
```

---

## 3. Environment variables (backend)

Typical `.env` keys (names may vary by deployment):

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (default `3000`) |
| `NODE_ENV` | `development` / `production` |
| `CORS_ORIGIN` | Allowed CORS origin |
| `RATE_LIMIT_*` | Request rate limits |

Device and admin keys live in **SQLite** (`api_keys`, `hardware_devices`), not only in `.env`.

---

## 4. Verify enrollment

```bash
curl http://localhost:3000/v1/fingerprints/ENR-PI-002
```

---

## 5. Troubleshooting

| Symptom | Check |
|---------|--------|
| Backend unreachable from Pi | `API_BASE_URL` LAN IP; firewall; backend running |
| 401 on `/v1/device/me` | Wrong `DEVICE_API_KEY` |
| 409 `DUPLICATE_ENROLLMENT` | User already has active enrollment — DELETE old or use new user |
| Slot already assigned | Choose another slot |
| Device not assigned to user | `POST /v1/hardware/assign` |
| Serial / R503 errors | UART enabled, wiring, `/dev/serial0` permissions |

---

## Related

- [API_REFERENCE.md](./API_REFERENCE.md) — all endpoints  
- [ENROLLMENT_WORKFLOW.md](./ENROLLMENT_WORKFLOW.md)  
- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)  
