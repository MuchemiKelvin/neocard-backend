// Configuration module for Neo Card™ Demo Backend
const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development'
  },

  // Database configuration
  database: {
    path: process.env.DB_PATH || './database/neocard.db',
    type: 'sqlite'
  },

  // Security configuration
  security: {
    jwtSecret: process.env.JWT_SECRET || 'neocard-demo-jwt-secret-key-2024',
    aeiSecretKey: process.env.AEI_SECRET_KEY || 'neocard-aei-hmac-secret-key-2024',
    apiKeySecret: process.env.API_KEY_SECRET || 'neocard-api-key-secret-2024'
  },

  // Anti-fraud configuration
  antifraud: {
    cooldownMinutes: parseInt(process.env.COOLDOWN_MINUTES) || 5,
    dailyScanLimit: parseInt(process.env.DAILY_SCAN_LIMIT) || 100
  },

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  }
};

module.exports = config;
