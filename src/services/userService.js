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

export const findUserByIdentifier = async (identifier) => {
  const sql = 'SELECT * FROM users WHERE email = $1 OR user_name = $2';
  const { rows } = await query(sql, [identifier, identifier]);
  return rows[0];
};

export const findUserById = async (id) => {
  const sql = 'SELECT * FROM users WHERE id = $1';
  const { rows } = await query(sql, [id]);
  return rows[0];
};

export const updateUserAvatar = async (userId, avatarType, avatarData, profilePicPath = null ) => {

  const sql = `
    UPDATE users
    SET
      avatar_type = $1,
      avatar_data = $2,
      profile_pic_path = $3,
      updated_at = NOW()
    WHERE id = $4

    RETURNING
      id,
      user_name,
      email,
      relation,
      avatar_type,
      avatar_data,
      profile_pic_path;
  `;

  const values = [
    avatarType,
    avatarData,
    profilePicPath,
    userId
  ];

  const { rows } = await query(
    sql,
    values
  );

  return rows[0];
};

export const createAvatarDesign = async (
    userId,
    designType,
    name,
    designData
) => {

    const sql = `
        INSERT INTO avatar_designs (
            user_id,
            design_type,
            name,
            design_data
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
            id,
            user_id,
            design_type,
            name,
            design_data,
            created_at,
            updated_at;
    `;

    const values = [
        userId,
        designType,
        name,
        designData
    ];

    const { rows } = await query(sql, values);

    return rows[0];
};