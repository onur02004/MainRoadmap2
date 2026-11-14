import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'node:http';

import app from './app.js';
import pool from './config/db.js';
import logger from './utils/logger.js';
import { initializeSocket } from './sockets/index.js';

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('Production requires JWT_SECRET with at least 32 characters.');
  }
  if (!process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY) {
    throw new Error('Production requires SPOTIFY_TOKEN_ENCRYPTION_KEY (32 random bytes, base64 or 64-char hex).');
  }
}

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