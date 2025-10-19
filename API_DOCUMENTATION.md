# Neo Card™ Demo Backend API Documentation

## Overview

The Neo Card™ Demo Backend is a secure, lightweight API system for the Neo Card™ demo-day presentation, including AEI encryption, anti-fraud logic, and sponsor data export.

## Base URL

- **Local Development**: `http://localhost:3000`
- **Production**: `https://neocard-backend.onrender.com`

## Authentication

All admin endpoints require an API key in the request header:

```
x-api-key: neocard_admin_demo_key_2024
```

## Endpoints

### Health Check

**GET** `/health`

Returns server status and version information.

**Response:**

```json
{
  "status": "OK",
  "message": "Neo Card™ Demo Backend is running",
  "timestamp": "2025-10-19T21:37:00.000Z",
  "version": "1.0.0",
  "environment": "development"
}
```

---

### Register Scan

**POST** `/v1/scan`

Registers a new scan with UID, timestamp, and campaign ID.

**Request Body:**

```json
{
  "uid": "TEST123456",
  "campaign_id": "DEMO01"
}
```

**Response (Success - 201):**

```json
{
  "status": "success",
  "message": "Scan registered successfully",
  "timestamp": "2025-10-19T21:37:00.000Z",
  "data": {
    "scan_id": "scan_1760908980101_986ff058",
    "uid": "TEST123456",
    "campaign_id": "DEMO01",
    "timestamp": "2025-10-19T21:37:00.000Z",
    "checksum": "7ab804fb496abbcb3579b4bc6d78290641f2f14125d43befd084490b39c6f697",
    "verified": true
  },
  "meta": {
    "total_scans": 1,
    "daily_scans": 1
  }
}
```

**Error Responses:**

- **400** - Missing UID or campaign_id
- **400** - Invalid UID format
- **429** - Cooldown active (5 minutes)
- **429** - Daily scan limit exceeded (100 scans)

---

### Get Logs

**GET** `/v1/logs`

Retrieves recent scans (admin only).

**Headers:**

```
x-api-key: neocard_admin_demo_key_2024
```

**Query Parameters:**

- `limit` (optional): Number of records to return (default: 50)
- `offset` (optional): Number of records to skip (default: 0)
- `uid` (optional): Filter by specific UID
- `campaign_id` (optional): Filter by campaign ID
- `start_date` (optional): Filter from date (ISO format)
- `end_date` (optional): Filter to date (ISO format)

**Response:**

```json
{
  "status": "success",
  "message": "Logs retrieved successfully",
  "timestamp": "2025-10-19T21:37:00.000Z",
  "data": {
    "scans": [
      {
        "id": 1,
        "scan_id": "scan_1760908980101_986ff058",
        "uid": "TEST123456",
        "campaign_id": "DEMO01",
        "timestamp": "2025-10-19T21:37:00.000Z",
        "checksum": "7ab804fb496abbcb3579b4bc6d78290641f2f14125d43befd084490b39c6f697",
        "verified": 1,
        "created_at": "2025-10-19 21:37:00"
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 50,
      "offset": 0,
      "has_more": false
    }
  },
  "meta": {
    "filters_applied": {
      "uid": false,
      "campaign_id": false,
      "start_date": false,
      "end_date": false
    }
  }
}
```

---

### Export CSV

**GET** `/v1/export/csv`

Exports daily scan data for sponsors (admin only).

**Headers:**

```
x-api-key: neocard_admin_demo_key_2024
```

**Query Parameters:**

- `date` (optional): Date to export (YYYY-MM-DD format, default: today)
- `campaign_id` (optional): Filter by campaign ID

**Response:**

- **Content-Type**: `text/csv`
- **Content-Disposition**: `attachment; filename="neocard_scans_2025-10-19.csv"`

**CSV Format:**

```csv
Scan ID,UID,Campaign ID,Timestamp,Checksum,Verified
scan_1760908980101_986ff058,TEST123456,DEMO01,2025-10-19T21:37:00.000Z,7ab804fb496abbcb3579b4bc6d78290641f2f14125d43befd084490b39c6f697,true
```

---

### Get Statistics

**GET** `/v1/stats`

Retrieves scan statistics (admin only).

**Headers:**

```
x-api-key: neocard_admin_demo_key_2024
```

**Response:**

```json
{
  "status": "success",
  "message": "Statistics retrieved successfully",
  "timestamp": "2025-10-19T21:37:00.000Z",
  "data": {
    "totalScans": 1,
    "todayScans": 1,
    "yesterdayScans": 0,
    "uniqueUids": 1,
    "lastScan": "2025-10-19T21:37:00.000Z"
  }
}
```

---

## Security Features

### AEI (Advanced Encryption & Integrity)

- **HMAC-SHA256** checksum validation
- **Formula**: `HMAC(secret_key, UID + timestamp + campaign_id)`
- **Purpose**: Ensures scan data integrity and prevents tampering

### Anti-Fraud Logic

- **Cooldown Period**: 5 minutes between scans for same UID
- **Daily Limit**: Maximum 100 scans per UID per day
- **UID Validation**: Alphanumeric format, 8-16 characters

### API Key Authentication

- Required for all admin endpoints (`/v1/logs`, `/v1/export/csv`, `/v1/stats`)
- Valid API keys:
  - `neocard_admin_demo_key_2024` (admin access)
  - `neocard_sponsor_demo_key_2024` (sponsor access)

---

## Error Codes

| Code                   | Description                          |
| ---------------------- | ------------------------------------ |
| `MISSING_API_KEY`      | API key required                     |
| `INVALID_API_KEY`      | Invalid API key                      |
| `MISSING_UID`          | UID is required                      |
| `MISSING_CAMPAIGN_ID`  | Campaign ID is required              |
| `INVALID_UID_FORMAT`   | Invalid UID format                   |
| `COOLDOWN_ACTIVE`      | Scan blocked: within cooldown period |
| `DAILY_LIMIT_EXCEEDED` | Daily scan limit exceeded            |

---

## Rate Limiting

- **Window**: 15 minutes
- **Limit**: 100 requests per IP
- **Disabled**: During testing

---

## Demo API Keys

For demo purposes, use these API keys:

- **Admin**: `neocard_admin_demo_key_2024`
- **Sponsor**: `neocard_sponsor_demo_key_2024`

**Note**: Change these keys for production deployment.

---

## Testing

Run the test suite:

```bash
npm test
```

All 17 tests should pass, covering:

- Health check
- Scan registration and validation
- Anti-fraud logic (cooldown, daily limits)
- API key authentication
- CSV export
- Statistics retrieval
- AEI security validation
- Error handling
