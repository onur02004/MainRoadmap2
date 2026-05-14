import { query } from '../config/db.js';
import bcrypt from 'bcrypt';

export const createUser = async (userData) => {
  const { user_name, email, password, real_name, relation } = userData;
  
  // 1. Hash the password
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  // 2. Insert into DB (matching your schema)
  const sql = `
    INSERT INTO users (user_name, email, password_hash, real_name, relation)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, user_name, email, relation;
  `;

  const values = [
    user_name, 
    email, 
    hashedPassword, 
    real_name || null, 
    relation || 'normal' // Default to normal if not provided
  ];

  const { rows } = await query(sql, values);
  return rows[0];
};

export const findUserByEmail = async (email) => {
  const sql = 'SELECT * FROM users WHERE email = $1';
  const { rows } = await query(sql, [email]);
  return rows[0];
};

export const findUserByIdentifier = async (id) => {
  // Checks both email and user_name since both are unique
  const sql = 'SELECT * FROM users WHERE email = $1 OR user_name = $1';
  const { rows } = await query(sql, [id]);
  return rows[0];
};