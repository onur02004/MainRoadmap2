import { query } from '../config/db.js';

const allowedDifficulties = new Set(['easy', 'medium', 'hard']);
const allowedStatuses = new Set(['draft', 'active', 'maintenance', 'archived']);
const allowedFields = new Set([
  'game_key', 'name', 'short_name', 'tagline', 'description', 'instructions',
  'category', 'difficulty', 'min_players', 'max_players', 'estimated_minutes',
  'player_modes', 'tags', 'logo_url', 'cover_image_url', 'preview_image_url',
  'icon', 'accent_color', 'route', 'status', 'is_active', 'is_featured',
  'sort_order', 'rules', 'config'
]);

function httpError(status, message) {
  const error = new Error(message);
  error.statusCode = status;
  return error;
}

function parseList(value, field) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(/[,\n]/).map(v => v.trim()).filter(Boolean);
  if (value == null) return [];
  throw httpError(400, `${field} must be a string array or comma-separated string.`);
}

function parseJsonObject(value, field) {
  if (value == null || value === '') return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {}
  }
  throw httpError(400, `${field} must be a valid JSON object.`);
}

function normalize(body, partial = false) {
  const data = {};
  const stringFields = [
    'game_key', 'name', 'short_name', 'tagline', 'description', 'instructions',
    'category', 'difficulty', 'logo_url', 'cover_image_url', 'preview_image_url',
    'icon', 'accent_color', 'route', 'status'
  ];
  for (const field of stringFields) {
    if (partial && body[field] === undefined) continue;
    const value = body[field] == null ? '' : String(body[field]).trim();
    if (['game_key', 'name', 'category', 'difficulty', 'route', 'status'].includes(field) && !value) {
      throw httpError(400, `${field} is required.`);
    }
    data[field] = value || null;
  }

  if (data.game_key && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.game_key)) {
    throw httpError(400, 'game_key must use lowercase letters, numbers and hyphens (e.g. number-duel).');
  }
  if (data.route && !data.route.startsWith('/')) {
    throw httpError(400, 'route must start with /.');
  }
  if (data.difficulty && !allowedDifficulties.has(data.difficulty)) {
    throw httpError(400, 'difficulty must be easy, medium or hard.');
  }
  if (data.status && !allowedStatuses.has(data.status)) {
    throw httpError(400, 'status must be draft, active, maintenance or archived.');
  }
  if (data.accent_color && !/^#[0-9a-fA-F]{3,8}$/.test(data.accent_color)) {
    throw httpError(400, 'accent_color must be a hex color, e.g. #a78bfa.');
  }

  for (const field of ['min_players', 'max_players', 'estimated_minutes', 'sort_order']) {
    if (partial && body[field] === undefined) continue;
    const value = Number(body[field] ?? ({min_players: 2, max_players: 2, estimated_minutes: 5, sort_order: 0}[field]));
    if (!Number.isInteger(value)) throw httpError(400, `${field} must be an integer.`);
    data[field] = value;
  }
  if (data.min_players !== undefined && data.min_players < 1) throw httpError(400, 'min_players must be at least 1.');
  if (data.max_players !== undefined && data.max_players < 1) throw httpError(400, 'max_players must be at least 1.');
  if (data.estimated_minutes !== undefined && (data.estimated_minutes < 1 || data.estimated_minutes > 240)) {
    throw httpError(400, 'estimated_minutes must be between 1 and 240.');
  }
  if (data.min_players !== undefined && data.max_players !== undefined && data.max_players < data.min_players) {
    throw httpError(400, 'max_players cannot be smaller than min_players.');
  }

  for (const field of ['is_active', 'is_featured']) {
    if (partial && body[field] === undefined) continue;
    const value = body[field];
    if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
      throw httpError(400, `${field} must be true or false.`);
    }
    data[field] = value === true || value === 'true';
  }

  for (const field of ['player_modes', 'tags']) {
    if (partial && body[field] === undefined) continue;
    data[field] = parseList(body[field], field);
  }
  for (const field of ['rules', 'config']) {
    if (partial && body[field] === undefined) continue;
    data[field] = parseJsonObject(body[field], field);
  }

  // Only publishable games should be available to players.
  if (data.status === 'active' && data.is_active === undefined && !partial) data.is_active = true;
  if (data.status && data.status !== 'active') data.is_active = false;
  if (data.is_active === true && data.status === undefined && !partial) data.status = 'active';

  return data;
}

const selectColumns = `
  id, game_key, name, short_name, tagline, description, instructions, category,
  difficulty, min_players, max_players, estimated_minutes, player_modes, tags,
  logo_url, cover_image_url, preview_image_url, icon, accent_color, route,
  status, is_active, is_featured, sort_order, rules, config, created_at, updated_at
`;

export const listAdminGames = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const category = String(req.query.category || '').trim();
    const values = [];
    const conditions = [];
    if (q) {
      values.push(`%${q}%`);
      conditions.push(`(name ILIKE $${values.length} OR game_key ILIKE $${values.length} OR COALESCE(description, '') ILIKE $${values.length})`);
    }
    if (allowedStatuses.has(status)) {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }
    if (category) {
      values.push(category);
      conditions.push(`category = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(`SELECT ${selectColumns} FROM game_catalog ${where} ORDER BY sort_order ASC, name ASC`, values);
    res.json({ status: 'success', data: { games: result.rows } });
  } catch (error) {
    next(error);
  }
};

export const getAdminGame = async (req, res, next) => {
  try {
    const result = await query(`SELECT ${selectColumns} FROM game_catalog WHERE id = $1 LIMIT 1`, [req.params.id]);
    if (!result.rowCount) throw httpError(404, 'Game not found.');
    res.json({ status: 'success', data: { game: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

export const createAdminGame = async (req, res, next) => {
  try {
    const game = normalize(req.body);
    const fields = Object.keys(game).filter(field => allowedFields.has(field));
    const values = fields.map(field => game[field]);
    const casts = new Set(['player_modes', 'tags']);
    const jsonCasts = new Set(['rules', 'config']);
    const placeholders = fields.map((field, index) => {
      const cast = casts.has(field) ? '::text[]' : jsonCasts.has(field) ? '::jsonb' : '';
      return `$${index + 1}${cast}`;
    });
    const result = await query(`
      INSERT INTO game_catalog (${fields.join(', ')}, updated_at)
      VALUES (${placeholders.join(', ')}, NOW())
      RETURNING ${selectColumns}
    `, values);
    res.status(201).json({ status: 'success', data: { game: result.rows[0] } });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'This game key already exists.';
    }
    next(error);
  }
};

export const updateAdminGame = async (req, res, next) => {
  try {
    const game = normalize(req.body, true);
    const fields = Object.keys(game).filter(field => allowedFields.has(field));
    if (!fields.length) throw httpError(400, 'No fields to update.');
    const values = [];
    const assignments = fields.map(field => {
      values.push(game[field]);
      const cast = ['player_modes', 'tags'].includes(field) ? '::text[]' : ['rules', 'config'].includes(field) ? '::jsonb' : '';
      return `${field} = $${values.length}${cast}`;
    });
    values.push(req.params.id);
    const result = await query(`
      UPDATE game_catalog SET ${assignments.join(', ')}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING ${selectColumns}
    `, values);
    if (!result.rowCount) throw httpError(404, 'Game not found.');
    res.json({ status: 'success', data: { game: result.rows[0] } });
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'This game key already exists.';
    }
    next(error);
  }
};

export const setAdminGameStatus = async (req, res, next) => {
  try {
    const status = String(req.body.status || '').trim();
    if (!allowedStatuses.has(status)) throw httpError(400, 'Invalid game status.');
    const isActive = status === 'active';
    const result = await query(`
      UPDATE game_catalog SET status = $1, is_active = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING ${selectColumns}
    `, [status, isActive, req.params.id]);
    if (!result.rowCount) throw httpError(404, 'Game not found.');
    res.json({ status: 'success', data: { game: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

export const archiveAdminGame = async (req, res, next) => {
  try {
    const result = await query(`
      UPDATE game_catalog SET status = 'archived', is_active = FALSE, updated_at = NOW()
      WHERE id = $1
      RETURNING ${selectColumns}
    `, [req.params.id]);
    if (!result.rowCount) throw httpError(404, 'Game not found.');
    res.json({ status: 'success', data: { game: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};
