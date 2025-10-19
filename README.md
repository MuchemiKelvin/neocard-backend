# Neo Card™ Demo Backend – AEI Secure Lite Version

A secure, lightweight backend API for the Neo Card™ demo-day presentation, including AEI encryption, anti-fraud logic, and sponsor data export.

## 🚀 Features

- **AEI Security**: HMAC-SHA256 checksum validation for data integrity
- **Anti-Fraud Logic**: 5-minute cooldown + daily scan limit (100 scans/day)
- **API Key Authentication**: Secure admin dashboard access
- **Real-time Logging**: Scan registration with timestamp and campaign tracking
- **CSV Export**: Daily scan data export for sponsors
- **SQLite Database**: Lightweight, file-based database
- **Comprehensive Testing**: 17 test cases covering all functionality

## 📋 API Endpoints

- `POST /v1/scan` - Register UID, timestamp, and campaign ID
- `GET /v1/logs` - Display recent scans (admin only)
- `GET /v1/export/csv` - Export daily scan data for sponsors
- `GET /v1/stats` - Get scan statistics (admin only)
- `GET /health` - Health check endpoint

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd neocard-backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Start the server**

   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

## 🧪 Testing

Run the comprehensive test suite:

```bash
npm test
```

**Test Coverage:**

- ✅ Health check endpoint
- ✅ Scan registration and validation
- ✅ Anti-fraud logic (cooldown, daily limits)
- ✅ API key authentication
- ✅ CSV export functionality
- ✅ Statistics retrieval
- ✅ AEI security validation
- ✅ Error handling scenarios

## 🔐 Security Features

### AEI (Advanced Encryption & Integrity)

- **HMAC-SHA256** checksum validation
- **Formula**: `HMAC(secret_key, UID + timestamp + campaign_id)`
- **Purpose**: Ensures scan data integrity and prevents tampering

### Anti-Fraud Protection

- **Cooldown Period**: 5 minutes between scans for same UID
- **Daily Limit**: Maximum 100 scans per UID per day
- **UID Validation**: Alphanumeric format, 8-16 characters

### API Key Authentication

- Required for admin endpoints
- Demo keys provided for testing
- **Change keys for production!**

## 📊 Database Schema

### Tables

- **scans**: Scan records with UID, timestamp, campaign, checksum
- **campaigns**: Campaign management
- **api_keys**: API key management
- **fraud_tracking**: Anti-fraud monitoring

## 🚀 Deployment

### Local Development

```bash
npm run dev
# Server runs on http://localhost:3000
```

### Production (Render)

1. Connect your GitHub repository to Render
2. Set environment variables in Render dashboard
3. Deploy automatically on git push

See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for detailed deployment instructions.

## 📚 Documentation

- [API Documentation](./API_DOCUMENTATION.md) - Complete API reference
- [Render Deployment Guide](./RENDER_DEPLOYMENT.md) - Production deployment
- [Environment Configuration](./env.example) - Environment variables

## 🔑 Demo API Keys

For testing purposes:

- **Admin**: `neocard_admin_demo_key_2024`
- **Sponsor**: `neocard_sponsor_demo_key_2024`

**⚠️ Important**: Change these keys for production deployment!

## 📝 Example Usage

### Register a Scan

```bash
curl -X POST http://localhost:3000/v1/scan \
  -H "Content-Type: application/json" \
  -d '{"uid":"TEST123456","campaign_id":"DEMO01"}'
```

### Get Logs (Admin)

```bash
curl -X GET http://localhost:3000/v1/logs \
  -H "x-api-key: neocard_admin_demo_key_2024"
```

### Export CSV

```bash
curl -X GET http://localhost:3000/v1/export/csv \
  -H "x-api-key: neocard_admin_demo_key_2024" \
  -o scans.csv
```

## 🏗️ Project Structure

```
neocard-backend/
├── config/           # Configuration files
├── database/         # Database module and schema
├── middleware/       # Authentication and validation
├── routes/           # API route handlers
├── tests/            # Test suite
├── utils/            # Utility functions
├── server.js         # Main server file
├── package.json      # Dependencies and scripts
└── README.md         # This file
```

## 📈 Performance

- **Response Time**: < 100ms for scan registration
- **Throughput**: Handles 100+ requests per minute
- **Database**: SQLite for lightweight, fast operations
- **Memory**: Low memory footprint (~50MB)

## 🔧 Configuration

### Environment Variables

```bash
NODE_ENV=development
PORT=3000
DB_PATH=./database/neocard.db
JWT_SECRET=your-jwt-secret
AEI_SECRET_KEY=your-aei-secret
API_KEY_SECRET=your-api-secret
COOLDOWN_MINUTES=5
DAILY_SCAN_LIMIT=100
```

## 📞 Support

For questions or issues:

1. Check the [API Documentation](./API_DOCUMENTATION.md)
2. Run the test suite to verify functionality
3. Review the deployment guide for production setup

## 📄 License

MIT License - See LICENSE file for details.

---

**Neo Card™ Demo Backend** - Secure, Fast, Reliable 🚀
