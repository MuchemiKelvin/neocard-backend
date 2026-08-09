# Manual NeoCard / KDVC helper commands (Stage 5)
# Never paste real device API keys into this file.
#
# Usage:
#   export DEVICE_API_KEY='…'   # from create/rotate response or Pi .env (local shell only)
#   export DEVICE_ID='device_…'
#   export USER_ID='user_…'
#   source docs/tests.bash   # or copy individual commands

ADMIN_API_KEY="${ADMIN_API_KEY:-neocard_admin_demo_key_2024}"
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"

# ---------------------------------------------------------------------------
# Create a user (admin demo key)
# ---------------------------------------------------------------------------
curl -s -X POST "${API_BASE_URL}/v1/users" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${ADMIN_API_KEY}" \
  -d '{
    "first_name":"Kevo",
    "last_name":"Kely",
    "email":"kev.kel@example.com",
    "phone":"+254700111111"
  }'

# ---------------------------------------------------------------------------
# Create a fingerprint device
# NOTE: API auto-generates device_id. Save device_id + api_key from JSON
# into the Pi .env as DEVICE_API_KEY (never commit .env).
# ---------------------------------------------------------------------------
curl -s -X POST "${API_BASE_URL}/v1/hardware/devices" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${ADMIN_API_KEY}" \
  -d '{
    "device_type": "fingerprint_device",
    "device_name": "KDVC-RPI-001",
    "status": "active"
  }'

# ---------------------------------------------------------------------------
# Assign hardware to a user
# ---------------------------------------------------------------------------
curl -s -X POST "${API_BASE_URL}/v1/hardware/assign" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${ADMIN_API_KEY}" \
  -d "{
    \"user_id\": \"${USER_ID}\",
    \"device_id\": \"${DEVICE_ID}\"
  }"

# ---------------------------------------------------------------------------
# Rotate device API key (device_id stays stable; old key invalidated)
# Copy api_key from response into Pi .env DEVICE_API_KEY, then verify /me.
# ---------------------------------------------------------------------------
curl -s -X POST "${API_BASE_URL}/v1/hardware/devices/${DEVICE_ID}/rotate-api-key" \
  -H "x-api-key: ${ADMIN_API_KEY}"

# ---------------------------------------------------------------------------
# Device identity check (uses shell env — do not hardcode secrets here)
# ---------------------------------------------------------------------------
curl -s "${API_BASE_URL}/v1/device/me" \
  -H "x-api-key: ${DEVICE_API_KEY}"

# Historical notes (IDs only — not secrets):
# Enrollment ID : ENR-PI-003
# User ID       : user_1784055628338_77a5c1e4
# Fingerprint Slot : 3
