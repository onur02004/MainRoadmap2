
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

  // Connection pool settings
  max: 10,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 5000,
});

// Yeni fiziksel bağlantı oluşturulduğunda.
pool.on('connect', () => {
  logger.debug('DATABASE', 'New PostgreSQL pool connection established');
});

// Pool seviyesindeki beklenmeyen hatalar.
pool.on('error', (error) => {
  logger.error('DATABASE', 'Unexpected PostgreSQL pool error', error);
});

export const query = (text, params) => pool.query(text, params);

export default pool;
