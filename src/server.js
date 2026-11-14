import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'node:http';

import app from './app.js';
import pool from './config/db.js';
import logger from './utils/logger.js';
import { initializeSocket } from './sockets/index.js';

const PORT = process.env.PORT || 5000;

const httpServer = createServer(app);

// Socket.IO bağlantısını aynı HTTP server üzerine kur.
initializeSocket(httpServer);

// Veritabanı bağlantısını kontrol et ve sunucuyu başlat.
pool.query('SELECT NOW()', (err) => {
  if (err) {
    logger.error('DATABASE', 'Database connection error', err);
    process.exit(1);
  }

  logger.info('DATABASE', 'Database connected');

  httpServer.listen(PORT, () => {
    logger.info('SYSTEM', `Server running on port ${PORT}`);
  });
});