require('dotenv').config();
const validateEnv = require('./utils/validateEnv');
validateEnv();
const app = require('./app');
const { pool } = require('./config/db');
const { initTransporter } = require('./utils/email');

async function startServer() {
  try {
    // Test DB connection
    await pool.query('SELECT 1');
    console.log('PostgreSQL connected successfully');

    // Initialise email transporter (verifies SMTP credentials on startup)
    await initTransporter();

    // Start server
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });

    const cleanupExpiredSessions = require('./config/cleanup');

    // Run cleanup immediately on start, then every 6 hours
    cleanupExpiredSessions();
    setInterval(cleanupExpiredSessions, 6 * 60 * 60 * 1000);

    process.on('uncaughtException', (err) => {
      console.error('UNCAUGHT EXCEPTION! Shutting down...');
      console.error(err.name, err.message);
      process.exit(1);
    });

    process.on('unhandledRejection', (err) => {
      console.error('UNHANDLED REJECTION! Shutting down...');
      console.error(err.name, err.message);
      server.close(() => {
        process.exit(1);
      });
    });

  } catch (err) {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  }
}

startServer();
