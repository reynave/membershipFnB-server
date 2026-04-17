require('./config/loadEnv');

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../swagger.json');

const { initDatabase } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { attachIoToRequest } = require('./middleware/attachIo');
const { registerSocketHandlers } = require('./sockets');

const healthRoutes = require('./routes/health.routes');
const adminRoutes = require('./routes/admin');
const membershipRoutes = require('./routes/membership');

const app = express();
const server = http.createServer(app);

// --- Socket.IO ---
const io = new Server(server, {
  cors: { origin: '*' }
});
registerSocketHandlers(io);

// --- Middleware ---
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(attachIoToRequest(io));

// --- Root ---
app.get('/', (_req, res) => {
  res.json({ success: true, message: 'Membership API is running' });
});

// --- Swagger API Documentation ---
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Membership API Documentation'
}));

// --- Health ---
app.use('/api', healthRoutes);

// --- API Admin (admin office) ---
app.use('/api/admin', adminRoutes);

// --- API Membership (user app) ---
app.use('/api/membership', membershipRoutes);

// MEMBERHISP LOGIN AND REGISTRATION ROUTES ARE IN THE MEMBERSHIP ROUTES, NOT ADMIN ROUTES. ADMIN ROUTES ARE FOR ADMIN OFFICE ONLY.


// --- 404 ---
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// --- Global error handler ---
app.use(errorHandler);

// --- Start server ---
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  //let databaseReady = true;

  // try {
  //   await initDatabase();
  // } catch (error) {
  //   databaseReady = false;
  //   console.warn('[DB] Initialization skipped:', error.message);
  // }

  server.listen(PORT, () => {
    console.log(`[Server] Membership API running on http://localhost:${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[Server] Swagger API Documentation available at http://localhost:${PORT}/api-docs`);
    // if (!databaseReady) {
    //   console.log('[Server] Running in limited mode until MySQL is available.');
    // }
  });
};

startServer();

module.exports = { app, server, io };
