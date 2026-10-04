import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

// Logging for connectivity
pool.on('connect', () => {
  logger.info('DATABASE', 'PostgreSQL connected successfully');
});

export const query = (text, params) => pool.query(text, params);
export default pool;