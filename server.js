require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Neo Card™ Demo Backend is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/v1', require('./routes/api'));

// AI routes
app.use('/ai', require('./routes/ai'));

// User Management routes
app.use('/v1/users', require('./routes/users'));

// Role Management routes
app.use('/v1/roles', require('./routes/roles'));

// Hardware Management routes (admin API key)
app.use('/v1/hardware', require('./routes/hardware'));

// Device terminal routes (device API key — Raspberry Pi)
app.use('/v1/device', require('./routes/device'));

// Fingerprint Management routes
app.use('/v1/fingerprints', require('./routes/fingerprints'));

// NeoCard terminal transactions (device API key)
app.use('/v1/neocard', require('./routes/neocard'));

// Device Security Module V1 (any hardware device_id; NeoCard is the first caller)
app.use('/v1/device-security', require('./routes/deviceSecurity'));

// Central License Server V1
const licenseServer = require('./services/licenseServer');
app.use('/v1/license', require('./routes/license'));

app.get('/license-manager/data', async (req, res) => {
  try {
    const tenantId = String(req.query.tenant || 'SCHOOL-GREENFIELD').trim();
    const data = await licenseServer.getLicenseView(tenantId);
    const activity = await licenseServer.listActivity(tenantId);
    return res.json({ success: true, data, activity });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
});

app.post('/license-manager/renew', async (req, res) => {
  try {
    const tenantId = String(req.body.tenant_id || 'SCHOOL-GREENFIELD').trim();
    const current = await licenseServer.getLicenseView(tenantId);
    const currentExpiry = new Date(current.expires_at || Date.now());
    const start = currentExpiry.getTime() > Date.now() ? currentExpiry : new Date();
    const nextExpiry = new Date(start);
    nextExpiry.setUTCFullYear(nextExpiry.getUTCFullYear() + 1);
    const data = await licenseServer.setStatus(tenantId, 'ACTIVE', nextExpiry.toISOString());
    const activity = await licenseServer.listActivity(tenantId);
    return res.json({ success: true, data, activity });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
});

app.get('/license-manager', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'license-manager.html'));
});
app.use('/license-manager', express.static(path.join(__dirname, 'public')));

// NeoCare Dashboard routes
app.use('/neocare', require('./routes/neocare'));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const startServer = async () => {
  try {
    // Initialize database
    await db.connect();
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Neo Card™ Demo Backend running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🗄️  Database: SQLite connected`);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        console.log('💡 Try: pkill -f "node server.js" or use a different port');
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down server...');
  await db.close();
  process.exit(0);
});

startServer();

module.exports = app;
