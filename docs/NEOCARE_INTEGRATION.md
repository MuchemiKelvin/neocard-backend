# 🏥 NeoCare Dashboard Backend Integration - API Documentation

**Version:** 1.0.0  
**Base URL:** `http://localhost:3000` (Development) / `https://neocard-backend.onrender.com` (Production)  
**Authentication:** API Key required for all endpoints

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [User Management](#user-management)
4. [Role Management](#role-management)
5. [Hardware Management](#hardware-management)
6. [NeoCare Sync](#neocare-sync)
7. [NeoCare Dashboard Tabs](#neocare-dashboard-tabs)
8. [Error Codes](#error-codes)

---

## 🎯 Overview

The NeoCare Dashboard Backend Integration provides:

- **Multi-Role Workforce System**: 11 care roles (Nurse, Caregiver, Helper, etc.)
- **Hardware Mapping**: Assign NeoCam V1, Fall Alarm V1, Fingerprint Device to users
- **Automatic Synchronization**: NeoCard → NeoCare sync for users, roles, and hardware
- **Dashboard Endpoints**: Backend support for all 13 NeoCare dashboard tabs

---

## 🔑 Authentication

All endpoints require an API key in the `x-api-key` header:

```bash
curl -H "x-api-key: neocard_admin_demo_key_2024" \
     http://localhost:3000/v1/users
```

**Available API Keys:**
- `neocard_admin_demo_key_2024` - Admin access (all endpoints)
- `neocard_sponsor_demo_key_2024` - Sponsor access (limited)

---

## 👥 User Management

### Create User

**`POST /v1/users`**

Create a new user in the NeoCard system.

**Request:**
```json
{
  "email": "nurse.john@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+31612345678",
  "role_id": 1,
  "neocard_uid": "CARD123456"
}
```

**Response (201):**
```json
{
  "status": "success",
  "message": "User created successfully",
  "timestamp": "2025-01-20T10:00:00.000Z",
  "data": {
    "id": 1,
    "user_id": "user_1737360000000_abc123",
    "email": "nurse.john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+31612345678",
    "role_id": 1,
    "role_code": "nurse",
    "role_name": "Nurse",
    "role_name_nl": "Verpleegkundige",
    "neocard_uid": "CARD123456",
    "active": true,
    "created_at": "2025-01-20T10:00:00.000Z"
  }
}
```

### Get All Users

**`GET /v1/users`**

Retrieve all users with optional filters.

**Query Parameters:**
- `role_id` (optional): Filter by role ID
- `active` (optional): Filter by active status (`true`/`false`)
- `search` (optional): Search by name or email
- `limit` (optional): Limit results
- `offset` (optional): Offset for pagination

**Response:**
```json
{
  "status": "success",
  "message": "Users retrieved successfully",
  "timestamp": "2025-01-20T10:00:00.000Z",
  "data": {
    "users": [
      {
        "user_id": "user_1737360000000_abc123",
        "first_name": "John",
        "last_name": "Doe",
        "email": "nurse.john@example.com",
        "role_code": "nurse",
        "role_name": "Nurse",
        "active": true
      }
    ],
    "total": 1,
    "filters_applied": {}
  }
}
```

### Get User by ID

**`GET /v1/users/:userId`**

Get specific user with hardware and client assignments.

**Response:**
```json
{
  "status": "success",
  "message": "User retrieved successfully",
  "timestamp": "2025-01-20T10:00:00.000Z",
  "data": {
    "user_id": "user_1737360000000_abc123",
    "first_name": "John",
    "last_name": "Doe",
    "email": "nurse.john@example.com",
    "role_code": "nurse",
    "role_name": "Nurse",
    "hardware": [
      {
        "device_id": "device_1737360000000_xyz789",
        "device_type": "neocam_v1",
        "device_name": "NeoCam V1 - Room 101"
      }
    ],
    "clients": []
  }
}
```

### Update User

**`PUT /v1/users/:userId`**

Update user information.

**Request:**
```json
{
  "first_name": "Jane",
  "role_id": 2
}
```

### Assign Role to User

**`POST /v1/users/:userId/role`**

Assign or update user's role.

**Request:**
```json
{
  "role_id": 1
}
```

---

## 🎭 Role Management

### Get All Roles

**`GET /v1/roles`**

Get all available care roles.

**Response:**
```json
{
  "status": "success",
  "message": "Roles retrieved successfully",
  "timestamp": "2025-01-20T10:00:00.000Z",
  "data": {
    "roles": [
      {
        "id": 1,
        "role_code": "nurse",
        "role_name": "Nurse",
        "role_name_nl": "Verpleegkundige",
        "description": "Registered nurse providing medical care",
        "active": true
      },
      {
        "id": 2,
        "role_code": "caregiver",
        "role_name": "Caregiver",
        "role_name_nl": "Verzorgende IG",
        "description": "Certified caregiver providing personal care",
        "active": true
      }
    ],
    "total": 11
  }
}
```

### Available Roles

1. **Nurse** (`nurse`) - Verpleegkundige
2. **Caregiver** (`caregiver`) - Verzorgende IG
3. **Helper** (`helper`) - Homecare Assistant
4. **Household Assistant** (`household_assistant`) - Huishoudelijke Hulp
5. **Midwife** (`midwife`) - Kraamzorg
6. **Palliative Care Worker** (`palliative_care`) - Palliatieve Zorg
7. **Homecare Nurse** (`homecare_nurse`) - Thuiszorg
8. **Ambulance Crew** (`ambulance_crew`) - Ambulance Personeel
9. **Funeral Team** (`funeral_team`) - Uitvaartteam
10. **Care Farm Staff** (`care_farm_staff`) - Zorgboerderij
11. **Home Chef** (`home_chef`) - Thuiskok

---

## 🔧 Hardware Management

### Create Hardware Device

**`POST /v1/hardware/devices`**

Register a new hardware device.

**Request:**
```json
{
  "device_type": "neocam_v1",
  "device_name": "NeoCam V1 - Room 101",
  "serial_number": "NC001234",
  "firmware_version": "1.0.0"
}
```

**Device Types:**
- `neocam_v1` - NeoCam V1 camera device
- `fall_alarm_v1` - Fall Alarm V1 device
- `fingerprint_device` - Fingerprint authentication device
- `other` - Other hardware devices

### Assign Hardware to User

**`POST /v1/hardware/assign`**

Assign hardware device to a user.

**Request:**
```json
{
  "user_id": "user_1737360000000_abc123",
  "device_id": "device_1737360000000_xyz789"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Hardware assigned successfully",
  "timestamp": "2025-01-20T10:00:00.000Z",
  "data": {
    "user_id": "user_1737360000000_abc123",
    "device_id": "device_1737360000000_xyz789",
    "hardware": [
      {
        "device_id": "device_1737360000000_xyz789",
        "device_type": "neocam_v1",
        "device_name": "NeoCam V1 - Room 101"
      }
    ]
  }
}
```

### Get User Hardware

**`GET /v1/hardware/users/:userId`**

Get all hardware assigned to a user.

---

## 🔄 NeoCare Sync

### Get Unsynced Users

**`GET /neocare/sync/users`**

Get users that need to be synced to NeoCare Dashboard.

**Response:**
```json
{
  "status": "success",
  "message": "Unsynced users retrieved successfully",
  "timestamp": "2025-01-20T10:00:00.000Z",
  "data": {
    "users": [
      {
        "user_id": "user_1737360000000_abc123",
        "first_name": "John",
        "last_name": "Doe",
        "role_code": "nurse",
        "role_name": "Nurse"
      }
    ],
    "total": 1
  }
}
```

### Mark User as Synced

**`POST /neocare/sync/users/:userId`**

Mark user as successfully synced to NeoCare.

### Get Sync Logs

**`GET /neocare/sync/logs`**

Get synchronization logs.

**Query Parameters:**
- `entity_type` (optional): Filter by entity type (`user`, `hardware_mapping`)
- `sync_status` (optional): Filter by status (`success`, `error`, `pending`)
- `entity_id` (optional): Filter by entity ID
- `limit` (optional): Limit results

---

## 📊 NeoCare Dashboard Tabs

### Tab 1: Overview Dashboard

**`GET /neocare/tabs/1`**

Get overview statistics and data.

**Response:**
```json
{
  "status": "success",
  "message": "Overview dashboard data retrieved successfully",
  "timestamp": "2025-01-20T10:00:00.000Z",
  "data": {
    "stats": {
      "total_users": 50,
      "total_devices": 30,
      "total_roles": 11,
      "active_assignments": 25,
      "unsynced_users": 5
    },
    "recent_activity": [],
    "alerts": []
  }
}
```

### Tab 2: Clients Dashboard

**`GET /neocare/tabs/2`**

Get clients data.

### Tab 3: Tasks Dashboard

**`GET /neocare/tabs/3`**

Get tasks data.

### Tab 4: Scheduling Dashboard

**`GET /neocare/tabs/4`**

Get scheduling data with users and their roles.

**Response:**
```json
{
  "status": "success",
  "message": "Scheduling dashboard data retrieved successfully",
  "timestamp": "2025-01-20T10:00:00.000Z",
  "data": {
    "schedule": [
      {
        "user_id": "user_1737360000000_abc123",
        "name": "John Doe",
        "role": "Nurse",
        "role_code": "nurse",
        "available": true
      }
    ],
    "total_users": 50
  }
}
```

### Tab 5: Reporting Dashboard

**`GET /neocare/tabs/5`**

Get reporting data organized by roles.

**Response:**
```json
{
  "status": "success",
  "message": "Reporting dashboard data retrieved successfully",
  "timestamp": "2025-01-20T10:00:00.000Z",
  "data": {
    "reports": {
      "by_role": [
        {
          "role_code": "nurse",
          "role_name": "Nurse",
          "total_users": 15,
          "users": [
            {
              "user_id": "user_1737360000000_abc123",
              "name": "John Doe",
              "email": "nurse.john@example.com"
            }
          ]
        }
      ],
      "total_users": 50,
      "total_roles": 11
    }
  }
}
```

### Tab 6: Medication Dashboard

**`GET /neocare/tabs/6`**

Get medication data.

### Tab 7: 7D Proof Dashboard

**`GET /neocare/tabs/7`**

Get 7D proof data.

### Tab 8: Emergency Center Dashboard

**`GET /neocare/tabs/8`**

Get emergency center data with ambulance crew.

**Response:**
```json
{
  "status": "success",
  "message": "Emergency Center dashboard data retrieved successfully",
  "timestamp": "2025-01-20T10:00:00.000Z",
  "data": {
    "emergency_personnel": [
      {
        "user_id": "user_1737360000000_def456",
        "name": "Jane Smith",
        "role": "Ambulance Crew",
        "available": true
      }
    ],
    "total": 5
  }
}
```

### Tab 9: Reward Ladder Dashboard

**`GET /neocare/tabs/9`**

Get reward ladder data.

### Tab 10: NeoPay Dashboard

**`GET /neocare/tabs/10`**

Get NeoPay transaction data.

### Tab 11: Invoice Generator Dashboard

**`GET /neocare/tabs/11`**

Get invoice data.

### Tab 12: Sponsor Wallet Dashboard

**`GET /neocare/tabs/12`**

Get sponsor wallet data.

### Tab 13: NeoChain Explorer Dashboard

**`GET /neocare/tabs/13`**

Get NeoChain blockchain data.

---

## 🚨 Error Codes

| Code | Description |
|------|-------------|
| `MISSING_API_KEY` | API key required |
| `INVALID_API_KEY` | Invalid API key |
| `MISSING_REQUIRED_FIELDS` | Required fields missing |
| `USER_NOT_FOUND` | User not found |
| `ROLE_NOT_FOUND` | Role not found |
| `DEVICE_NOT_FOUND` | Hardware device not found |
| `INVALID_DEVICE_TYPE` | Invalid device type |
| `MISSING_ROLE_ID` | Role ID required |

---

## 📝 Example Usage

### Complete Workflow: Create User, Assign Role, Assign Hardware

```bash
# 1. Create user
curl -X POST http://localhost:3000/v1/users \
  -H "x-api-key: neocard_admin_demo_key_2024" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nurse.john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+31612345678",
    "role_id": 1
  }'

# 2. Assign role (if not done during creation)
curl -X POST http://localhost:3000/v1/users/user_1737360000000_abc123/role \
  -H "x-api-key: neocard_admin_demo_key_2024" \
  -H "Content-Type: application/json" \
  -d '{"role_id": 1}'

# 3. Create hardware device
curl -X POST http://localhost:3000/v1/hardware/devices \
  -H "x-api-key: neocard_admin_demo_key_2024" \
  -H "Content-Type: application/json" \
  -d '{
    "device_type": "neocam_v1",
    "device_name": "NeoCam V1 - Room 101",
    "serial_number": "NC001234"
  }'

# 4. Assign hardware to user
curl -X POST http://localhost:3000/v1/hardware/assign \
  -H "x-api-key: neocard_admin_demo_key_2024" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_1737360000000_abc123",
    "device_id": "device_1737360000000_xyz789"
  }'

# 5. Get user with all details (for NeoCare Dashboard)
curl -X GET http://localhost:3000/neocare/users/user_1737360000000_abc123 \
  -H "x-api-key: neocard_admin_demo_key_2024"
```

---

## 🔄 Synchronization Flow

1. **User Created** → Automatically logged for sync
2. **Role Assigned** → User marked for re-sync
3. **Hardware Assigned** → User marked for re-sync
4. **NeoCare Dashboard** → Fetches unsynced users via `/neocare/sync/users`
5. **Sync Complete** → Mark user as synced via `/neocare/sync/users/:userId`

---

**NeoCare Dashboard Backend Integration** - Complete API Reference 🚀

