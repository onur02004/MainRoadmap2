import { query } from '../config/db.js';
import bcrypt from 'bcrypt';

const allowedRoles = new Set(['user', 'moderator', 'admin']);
const allowedRelations = new Set(['normal', 'friend', 'family', 'partner']);

function httpError(status, message) {
  const error = new Error(message);
  error.statusCode = status;
  return error;
}

export const listAdminUsers = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const role = String(req.query.role || '').trim().toLowerCase();
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const offset = (page - 1) * limit;

    const conditions = [];
    const values = [];

    if (q) {
      values.push(`%${q}%`);
      const p = `$${values.length}`;
      conditions.push(`(
        user_name::text ILIKE ${p}
        OR COALESCE(real_name, '') ILIKE ${p}
        OR COALESCE(email::text, '') ILIKE ${p}
      )`);
    }
    if (allowedRoles.has(role)) {
      values.push(role);
      conditions.push(`role = $${values.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await query(`SELECT COUNT(*)::int AS total FROM users ${where}`, values);
    const rows = await query(`
      SELECT id, user_name, real_name, email, tel_nr, relation, role,
             email_verified, email_confirmed_by_user, join_date, updated_at,
             last_online, profile_pic_path, avatar_type
      FROM users ${where}
      ORDER BY join_date DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `, [...values, limit, offset]);

    res.json({
      status: 'success',
      data: {
        users: rows.rows,
        pagination: {
          page, limit, total: count.rows[0].total,
          totalPages: Math.max(1, Math.ceil(count.rows[0].total / limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const createAdminUser = async (req, res, next) => {
  try {
    const {
      user_name, email, password, real_name, tel_nr,
      relation = 'normal', role = 'user', email_verified = false
    } = req.body;

    const username = String(user_name || '').trim();
    const normalizedEmail = String(email || '').trim();
    const normalizedRole = String(role).toLowerCase();
    const normalizedRelation = String(relation).toLowerCase();

    if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) {
      throw httpError(400, 'Kullanıcı adı 3–32 karakter olmalı; yalnızca harf, rakam ve _ kullanılabilir.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw httpError(400, 'Geçerli bir e-posta adresi girin.');
    }
    if (typeof password !== 'string' || password.length < 8) {
      throw httpError(400, 'Şifre en az 8 karakter olmalı.');
    }
    if (!allowedRoles.has(normalizedRole)) throw httpError(400, 'Geçersiz rol.');
    if (!allowedRelations.has(normalizedRelation)) throw httpError(400, 'Geçersiz relation değeri.');

    const duplicate = await query(
      'SELECT id FROM users WHERE user_name = $1 OR email = $2 LIMIT 1',
      [username, normalizedEmail]
    );
    if (duplicate.rowCount) throw httpError(409, 'Bu kullanıcı adı veya e-posta zaten kullanılıyor.');

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(`
      INSERT INTO users
        (user_name, email, password_hash, real_name, tel_nr, relation, role, email_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, user_name, real_name, email, tel_nr, relation, role,
                email_verified, join_date, updated_at
    `, [
      username, normalizedEmail, passwordHash,
      String(real_name || '').trim() || null,
      String(tel_nr || '').trim() || null,
      normalizedRelation, normalizedRole, Boolean(email_verified)
    ]);

    res.status(201).json({ status: 'success', data: { user: result.rows[0] } });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'Bu kullanıcı adı veya e-posta zaten kullanılıyor.';
    }
    next(error);
  }
};

export const updateAdminUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      user_name, email, real_name, tel_nr, relation, role,
      email_verified, password
    } = req.body;

    const fields = [];
    const values = [];
    const set = (column, value) => {
      values.push(value);
      fields.push(`${column} = $${values.length}`);
    };

    if (user_name !== undefined) {
      const v = String(user_name).trim();
      if (!/^[A-Za-z0-9_]{3,32}$/.test(v)) throw httpError(400, 'Geçersiz kullanıcı adı.');
      set('user_name', v);
    }
    if (email !== undefined) {
      const v = String(email).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw httpError(400, 'Geçerli bir e-posta girin.');
      set('email', v);
    }
    if (real_name !== undefined) set('real_name', String(real_name).trim() || null);
    if (tel_nr !== undefined) set('tel_nr', String(tel_nr).trim() || null);
    if (relation !== undefined) {
      const v = String(relation).toLowerCase();
      if (!allowedRelations.has(v)) throw httpError(400, 'Geçersiz relation değeri.');
      set('relation', v);
    }
    if (role !== undefined) {
      const v = String(role).toLowerCase();
      if (!allowedRoles.has(v)) throw httpError(400, 'Geçersiz rol.');
      if (String(req.user?.id) === String(id) && v !== 'admin') {
        throw httpError(400, 'Kendi admin rolünüzü buradan kaldıramazsınız.');
      }
      set('role', v);
    }
    if (email_verified !== undefined) set('email_verified', email_verified === true || email_verified === 'true');
    if (password !== undefined && password !== '') {
      if (typeof password !== 'string' || password.length < 8) throw httpError(400, 'Yeni şifre en az 8 karakter olmalı.');
      set('password_hash', await bcrypt.hash(password, 12));
    }

    if (!fields.length) throw httpError(400, 'Güncellenecek alan bulunamadı.');
    set('updated_at', new Date());
    values.push(id);

    const result = await query(`
      UPDATE users SET ${fields.join(', ')}
      WHERE id = $${values.length}
      RETURNING id, user_name, real_name, email, tel_nr, relation, role,
                email_verified, email_confirmed_by_user, join_date, updated_at
    `, values);

    if (!result.rowCount) throw httpError(404, 'Kullanıcı bulunamadı.');
    res.json({ status: 'success', data: { user: result.rows[0] } });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'Bu kullanıcı adı veya e-posta zaten kullanılıyor.';
    }
    next(error);
  }
};
