# 🤖 Neo Card™ AI Integration - API Documentation

**Version:** 1.0.0  
**Base URL:** `http://localhost:3000` (Development) / `https://neocard-backend.onrender.com` (Production)  
**Authentication:** API Key required for all AI endpoints

---

## 🔑 **Authentication**

All AI endpoints require an API key in the `x-api-key` header:

```bash
curl -H "x-api-key: neocard_admin_demo_key_2024" \
     http://localhost:3000/ai/analyze
```

**Available API Keys:**

- `neocard_admin_demo_key_2024` - Admin access (all endpoints)
- `neocard_sponsor_demo_key_2024` - Sponsor access (limited)

---

## 📊 **AI Endpoints**

### **1. AI Analysis - Main Endpoint**

**`POST /ai/analyze`**

Analyzes data for any of the 13 dashboard tabs.

**Request:**

```json
{
  "tab_id": 9,
  "request_data": {
    "user_id": "12345",
    "campaign_id": "DEMO01",
    "action": "scan",
    "metadata": {
      "location": "airport",
      "timestamp": "2025-10-23T09:30:00.000Z"
    }
  }
}
```

**Response (Success):**

```json
{
  "status": "success",
  "message": "AI analysis completed successfully",
  "timestamp": "2025-10-23T09:30:00.000Z",
  "data": {
    "request_id": "ai_req_1732278600000_abc123",
    "tab_id": 9,
    "tab_name": "Sponsor NeoCard Dashboard",
    "analysis": "Sponsor NeoCard data ready for print",
    "confidence": 0.99,
    "recommendations": ["Generate print proof", "Validate card design"],
    "risk_level": "low",
    "aei_proof": "a83f7b2c9d1e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5",
    "print_ready": true,
    "proof_generated": true,
    "response_type": "sponsor_neocard_data",
    "has_print_trigger": true,
    "has_proof_trigger": true
  },
  "meta": {
    "processing_time": 250,
    "ai_mode": "mock",
    "tab_specific_features": {
      "print_trigger": true,
      "proof_trigger": true
    }
  }
}
```

**Response (Error):**

```json
{
  "status": "error",
  "message": "AI analysis failed",
  "timestamp": "2025-10-23T09:30:00.000Z",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": ["tab_id must be an integer between 1 and 13"]
  }
}
```

---

### **2. Get All AI Tabs**

**`GET /ai/tabs`**

Retrieves information about all 13 dashboard tabs.

**Response:**

```json
{
  "status": "success",
  "message": "AI tabs retrieved successfully",
  "timestamp": "2025-10-23T09:30:00.000Z",
  "data": {
    "tabs": [
      {
        "id": 1,
        "name": "Audit Dashboard",
        "description": "Audit and verification dashboard",
        "response_type": "audit_data",
        "requires_aei": true,
        "has_print_trigger": false,
        "has_proof_trigger": false
      },
      {
        "id": 9,
        "name": "Sponsor NeoCard Dashboard",
        "description": "Special dashboard with print/proof functionality",
        "response_type": "sponsor_neocard_data",
        "requires_aei": true,
        "has_print_trigger": true,
        "has_proof_trigger": true
      }
    ],
    "total": 13
  }
}
```

---

### **3. Get Specific AI Tab**

**`GET /ai/tabs/:id`**

Retrieves information about a specific dashboard tab.

**Response:**

```json
{
  "status": "success",
  "message": "AI tab retrieved successfully",
  "timestamp": "2025-10-23T09:30:00.000Z",
  "data": {
    "id": 9,
    "name": "Sponsor NeoCard Dashboard",
    "description": "Special dashboard with print/proof functionality",
    "response_type": "sponsor_neocard_data",
    "requires_aei": true,
    "has_print_trigger": true,
    "has_proof_trigger": true,
    "special_features": {
      "has_print_trigger": true,
      "has_proof_trigger": true
    }
  }
}
```

---

### **4. Tab 9 Print Trigger**

**`POST /ai/tabs/9/print`**

Triggers print functionality for Tab 9 (Sponsor NeoCard Dashboard).

**Request:**

```json
{
  "request_id": "ai_req_1732278600000_abc123",
  "response_data": {
    "analysis": "Sponsor NeoCard data ready for print",
    "confidence": 0.99,
    "aei_proof": "a83f7b2c9d1e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5"
  }
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Print data generated successfully",
  "timestamp": "2025-10-23T09:30:00.000Z",
  "data": {
    "request_id": "ai_req_1732278600000_abc123",
    "print_timestamp": "2025-10-23T09:30:00.000Z",
    "print_data": {
      "analysis": "Sponsor NeoCard data ready for print",
      "confidence": 0.99,
      "risk_level": "low",
      "recommendations": ["Generate print proof", "Validate card design"],
      "aei_proof": "a83f7b2c9d1e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5"
    },
    "print_metadata": {
      "generated_at": "2025-10-23T09:30:00.000Z",
      "print_ready": true,
      "format": "sponsor_neocard_dashboard"
    }
  }
}
```

---

### **5. Tab 9 Proof Generation**

**`POST /ai/tabs/9/proof`**

Triggers proof generation for Tab 9 (Sponsor NeoCard Dashboard).

**Request:**

```json
{
  "request_id": "ai_req_1732278600000_abc123",
  "response_data": {
    "analysis": "Sponsor NeoCard data ready for print",
    "confidence": 0.99,
    "aei_proof": "a83f7b2c9d1e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5"
  }
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Proof data generated successfully",
  "timestamp": "2025-10-23T09:30:00.000Z",
  "data": {
    "request_id": "ai_req_1732278600000_abc123",
    "proof_timestamp": "2025-10-23T09:30:00.000Z",
    "proof_data": {
      "analysis": "Sponsor NeoCard data ready for print",
      "confidence": 0.99,
      "verification_status": true,
      "aei_checksum": "a83f7b2c9d1e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5"
    },
    "proof_metadata": {
      "generated_at": "2025-10-23T09:30:00.000Z",
      "proof_generated": true,
      "verification_type": "ai_analysis_proof"
    }
  }
}
```

---

### **6. Get AI Requests**

**`GET /ai/requests`**

Retrieves AI requests with optional filtering.

**Query Parameters:**

- `tab_id` - Filter by tab ID
- `status` - Filter by status (pending, completed, failed)
- `ai_mode` - Filter by AI mode (mock, live)
- `start_date` - Filter by start date (YYYY-MM-DD)
- `end_date` - Filter by end date (YYYY-MM-DD)
- `limit` - Limit number of results (default: 50)

**Response:**

```json
{
  "status": "success",
  "message": "AI requests retrieved successfully",
  "timestamp": "2025-10-23T09:30:00.000Z",
  "data": {
    "requests": [
      {
        "id": 1,
        "request_id": "ai_req_1732278600000_abc123",
        "tab_id": 9,
        "tab_name": "Sponsor NeoCard Dashboard",
        "request_data": "{\"user_id\":\"12345\",\"campaign_id\":\"DEMO01\"}",
        "ai_mode": "mock",
        "status": "completed",
        "created_at": "2025-10-23 09:30:00",
        "processed_at": "2025-10-23 09:30:00"
      }
    ],
    "total": 1,
    "filters_applied": {
      "tab_id": 9,
      "limit": 50
    }
  }
}
```

---

### **7. AI Health Check**

**`GET /ai/health`**

Checks the health status of the AI service.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-10-23T09:30:00.000Z",
  "ai_mode": "mock",
  "tabs_available": 13,
  "provider_configured": true
}
```

---

## 📋 **13 Dashboard Tabs Reference**

| ID  | Name                      | Response Type          | Print Trigger | Proof Trigger |
| --- | ------------------------- | ---------------------- | ------------- | ------------- |
| 1   | Audit Dashboard           | `audit_data`           | ❌            | ❌            |
| 2   | Sponsor Dashboard         | `sponsor_data`         | ❌            | ❌            |
| 3   | User NeoCard              | `user_card_data`       | ❌            | ❌            |
| 4   | Sponsor NeoCard           | `sponsor_card_data`    | ❌            | ❌            |
| 5   | Analytics Dashboard       | `analytics_data`       | ❌            | ❌            |
| 6   | Campaign Management       | `campaign_data`        | ❌            | ❌            |
| 7   | User Management           | `user_data`            | ❌            | ❌            |
| 8   | Payment Processing        | `payment_data`         | ❌            | ❌            |
| 9   | Sponsor NeoCard Dashboard | `sponsor_neocard_data` | ✅            | ✅            |
| 10  | Reports Dashboard         | `reports_data`         | ❌            | ❌            |
| 11  | Settings Dashboard        | `settings_data`        | ❌            | ❌            |
| 12  | Notifications Dashboard   | `notifications_data`   | ❌            | ❌            |
| 13  | System Monitoring         | `monitoring_data`      | ❌            | ❌            |

---

## 🔒 **Error Codes**

| Code                       | Description                     | HTTP Status |
| -------------------------- | ------------------------------- | ----------- |
| `MISSING_API_KEY`          | API key header missing          | 401         |
| `INVALID_API_KEY`          | Invalid or inactive API key     | 401         |
| `INSUFFICIENT_PERMISSIONS` | Admin permissions required      | 403         |
| `VALIDATION_ERROR`         | Request validation failed       | 400         |
| `INVALID_TAB_ID`           | Tab ID out of range (1-13)      | 400         |
| `TAB_NOT_FOUND`            | Tab ID not found                | 404         |
| `TAB_CONFIG_NOT_FOUND`     | Tab configuration missing       | 400         |
| `AI_MODE_ERROR`            | AI mode configuration error     | 500         |
| `AI_PROVIDER_ERROR`        | AI provider configuration error | 500         |
| `AI_ANALYSIS_ERROR`        | AI analysis processing error    | 500         |
| `PRINT_TRIGGER_ERROR`      | Print trigger failed            | 500         |
| `PROOF_GENERATION_ERROR`   | Proof generation failed         | 500         |

---

## 🚀 **Usage Examples**

### **Complete AI Analysis Flow:**

```bash
# 1. Check AI health
curl -H "x-api-key: neocard_admin_demo_key_2024" \
     http://localhost:3000/ai/health

# 2. Get available tabs
curl -H "x-api-key: neocard_admin_demo_key_2024" \
     http://localhost:3000/ai/tabs

# 3. Analyze data for Tab 9
curl -X POST \
     -H "Content-Type: application/json" \
     -H "x-api-key: neocard_admin_demo_key_2024" \
     -d '{"tab_id": 9, "request_data": {"test": "data"}}' \
     http://localhost:3000/ai/analyze

# 4. Trigger print for Tab 9
curl -X POST \
     -H "Content-Type: application/json" \
     -H "x-api-key: neocard_admin_demo_key_2024" \
     -d '{"request_id": "ai_req_123", "response_data": {"analysis": "test"}}' \
     http://localhost:3000/ai/tabs/9/print

# 5. Generate proof for Tab 9
curl -X POST \
     -H "Content-Type: application/json" \
     -H "x-api-key: neocard_admin_demo_key_2024" \
     -d '{"request_id": "ai_req_123", "response_data": {"analysis": "test"}}' \
     http://localhost:3000/ai/tabs/9/proof
```

---

## 📝 **Environment Configuration**

```bash
# AI Integration Configuration
AI_MODE=mock
AI_PROVIDER_API_KEY=your-ai-provider-api-key
AI_PROVIDER_URL=https://api.ai-provider.com/v1
AI_RESPONSE_TIMEOUT=30000
AI_MAX_RETRIES=3
```

---

**Neo Card™ AI Integration API - Ready for Demo Day! 🎯**
