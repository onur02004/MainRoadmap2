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

// ==========================================
// ADMIN SERVICE MANAGEMENT
// ==========================================

const serviceFields = `
  id,
  service_key,
  tag,
  title,
  description,
  icon,
  route,
  category,
  is_active,
  requires_auth,
  allowed_roles,
  allowed_user_ids,
  display_order,
  created_at
`;

const validCategories = new Set(['core', 'privileged']);

function normalizeServiceArray(value, fieldName) {
  if (Array.isArray(value)) {
    return value
      .map(item => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[,\n]/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  if (value == null) {
    return [];
  }

  throw httpError(400, `${fieldName} geçerli bir liste olmalı.`);
}

function validateService(body, partial = false) {
  const data = {};

  const stringFields = [
    'service_key',
    'tag',
    'title',
    'description',
    'icon',
    'route',
    'category'
  ];

  for (const key of stringFields) {
    if (partial && body[key] === undefined) {
      continue;
    }

    const value = String(body[key] ?? '').trim();

    if (
      !value &&
      ['service_key', 'tag', 'title', 'route', 'category'].includes(key)
    ) {
      throw httpError(400, `${key} alanı zorunludur.`);
    }

    data[key] = value || null;
  }

  if (
    data.service_key !== undefined &&
    !/^[a-zA-Z0-9_-]{2,80}$/.test(data.service_key)
  ) {
    throw httpError(
      400,
      'Service key 2–80 karakter olmalı; harf, rakam, _ ve - kullanılabilir.'
    );
  }

  if (
    data.route !== undefined &&
    data.route &&
    !data.route.startsWith('/')
  ) {
    throw httpError(
      400,
      'Route / ile başlamalıdır. Örnek: /account'
    );
  }

  if (
    data.category !== undefined &&
    !validCategories.has(data.category)
  ) {
    throw httpError(
      400,
      'Kategori core veya privileged olmalı.'
    );
  }

  for (const key of ['is_active', 'requires_auth']) {
    if (partial && body[key] === undefined) {
      continue;
    }

    const value = body[key];

    if (
      typeof value !== 'boolean' &&
      value !== 'true' &&
      value !== 'false'
    ) {
      throw httpError(400, `${key} boolean olmalı.`);
    }

    data[key] = value === true || value === 'true';
  }

  for (const key of ['allowed_roles', 'allowed_user_ids']) {
    if (partial && body[key] === undefined) {
      continue;
    }

    data[key] = normalizeServiceArray(body[key], key);
  }

  if (!partial || body.display_order !== undefined) {
    const order = Number(body.display_order ?? 0);

    if (!Number.isInteger(order)) {
      throw httpError(400, 'Display order tam sayı olmalı.');
    }

    data.display_order = order;
  }

  return data;
}


// GET /api/admin/services
export const listAdminServices = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT ${serviceFields}
      FROM cluster_services
      ORDER BY display_order ASC, title ASC
    `);

    res.json({
      status: 'success',
      data: {
        services: result.rows
      }
    });
  } catch (error) {
    next(error);
  }
};


// POST /api/admin/services
export const createAdminService = async (req, res, next) => {
  try {
    const service = validateService(req.body);

    const result = await query(`
      INSERT INTO cluster_services (
        service_key,
        tag,
        title,
        description,
        icon,
        route,
        category,
        is_active,
        requires_auth,
        allowed_roles,
        allowed_user_ids,
        display_order
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10::text[], $11::text[], $12
      )
      RETURNING ${serviceFields}
    `, [
      service.service_key,
      service.tag,
      service.title,
      service.description,
      service.icon,
      service.route,
      service.category,
      service.is_active,
      service.requires_auth,
      service.allowed_roles,
      service.allowed_user_ids,
      service.display_order
    ]);

    res.status(201).json({
      status: 'success',
      data: {
        service: result.rows[0]
      }
    });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'Bu service_key zaten kullanılıyor.';
    }

    next(error);
  }
};


// PATCH /api/admin/services/:id
export const updateAdminService = async (req, res, next) => {
  try {
    const service = validateService(req.body, true);

    // İstemciden gelen kolon isimlerini doğrudan SQL'e eklemiyoruz.
    const allowedColumns = {
      service_key: 'service_key',
      tag: 'tag',
      title: 'title',
      description: 'description',
      icon: 'icon',
      route: 'route',
      category: 'category',
      is_active: 'is_active',
      requires_auth: 'requires_auth',
      allowed_roles: 'allowed_roles',
      allowed_user_ids: 'allowed_user_ids',
      display_order: 'display_order'
    };

    const assignments = [];
    const values = [];

    for (const [key, value] of Object.entries(service)) {
      const column = allowedColumns[key];

      if (!column) {
        continue;
      }

      values.push(value);

      const arrayCast =
        key === 'allowed_roles' ||
        key === 'allowed_user_ids'
          ? '::text[]'
          : '';

      assignments.push(
        `${column} = $${values.length}${arrayCast}`
      );
    }

    if (assignments.length === 0) {
      throw httpError(400, 'Güncellenecek alan bulunamadı.');
    }

    values.push(req.params.id);

    const result = await query(`
      UPDATE cluster_services
      SET ${assignments.join(', ')}
      WHERE id = $${values.length}
      RETURNING ${serviceFields}
    `, values);

    if (!result.rowCount) {
      throw httpError(404, 'Servis bulunamadı.');
    }

    res.json({
      status: 'success',
      data: {
        service: result.rows[0]
      }
    });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'Bu service_key zaten kullanılıyor.';
    }

    next(error);
  }
};


// PATCH /api/admin/services/:id/active
export const setAdminServiceActive = async (req, res, next) => {
  try {
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      throw httpError(400, 'is_active true veya false olmalı.');
    }

    const result = await query(`
      UPDATE cluster_services
      SET is_active = $1
      WHERE id = $2
      RETURNING ${serviceFields}
    `, [is_active, req.params.id]);

    if (!result.rowCount) {
      throw httpError(404, 'Servis bulunamadı.');
    }

    res.json({
      status: 'success',
      data: {
        service: result.rows[0]
      }
    });
  } catch (error) {
    next(error);
  }
};