# Neo Card™ Demo Backend - Render Deployment Configuration

## Build Command

```bash
npm install
```

## Start Command

```bash
npm start
```

## Environment Variables (Set in Render Dashboard)

- `NODE_ENV=production`
- `PORT=10000` (Render will set this automatically)
- `DB_PATH=./database/neocard.db`
- `JWT_SECRET=your-production-jwt-secret-key`
- `AEI_SECRET_KEY=your-production-aei-secret-key`
- `API_KEY_SECRET=your-production-api-key-secret`
- `COOLDOWN_MINUTES=5`
- `DAILY_SCAN_LIMIT=100`
- `CORS_ORIGIN=https://your-frontend-domain.com`
- `RATE_LIMIT_WINDOW_MS=900000`
- `RATE_LIMIT_MAX_REQUESTS=100`

## Render Service Configuration

- **Runtime**: Node.js
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Auto-Deploy**: Yes (from main branch)
- **Health Check Path**: `/health`
- **Live URL**: https://neocard-backend.onrender.com

## Database

- SQLite database will be created automatically
- Database file persists between deployments
- No external database required for demo

## Security Notes

- Change all secret keys for production
- Update CORS origin to your actual domain
- Consider using environment-specific API keys
