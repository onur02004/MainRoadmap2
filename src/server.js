import dotenv from 'dotenv';
import app from './app.js';
import pool from './config/db.js';
import logger from './utils/logger.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

// Verify DB connection before starting server
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    logger.error('DATABASE', 'Database connection error', err);
    process.exit(1);
  } else {
    logger.info('DATABASE', 'Database connected');
    app.listen(PORT, () => {
      logger.info('SYSTEM', `Server running on port ${PORT}`);
    });
  }
});