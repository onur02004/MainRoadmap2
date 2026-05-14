import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

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
  console.log('🐘 PostgreSQL connected successfully');
});

export const query = (text, params) => pool.query(text, params);
export default pool;