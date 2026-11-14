import pool from '../config/db.js';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';
import AppError from '../utils/appError.js';

const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const CSS_VARIABLES = new Set([
  '--bg-color', '--panel-bg', '--text-main', '--text-bright', '--accent-action',
  '--accent-glow', '--box-border', '--status-ok', '--app-font', '--app-radius', '--app-blur'
]);

function cleanCssVariables(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const output = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!CSS_VARIABLES.has(key) || typeof raw !== 'string' || raw.length > 100) continue;
    const value = raw.trim();
    if (key === '--app-font') {
      if (/^[a-zA-Z0-9 ,_'"-]{1,80}$/.test(value)) output[key] = value;
    } else if (key === '--app-radius' || key === '--app-blur') {
      if (/^(?:0|[0-9]{1,2})(?:px)?$/.test(value)) output[key] = value.endsWith('px') ? value : `${value}px`;
    } else if (COLOR.test(value) || /^rgba?\(\s*[0-9.,%\s]+\)$/.test(value)) {
      output[key] = value;
    }
  }
  return output;
}

function cleanBackground(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.length > 5_000_000) throw new AppError('Arka plan görseli çok büyük veya geçersiz.', 400);
  if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.toString();
  } catch { /* rejected below */ }
  throw new AppError('Arka plan görseli HTTPS URL veya desteklenen bir görsel olmalıdır.', 400);
}

export const getThemes = async (req, res) => {
  try {
    const jsonPath = path.join(process.cwd(), 'public', 'themes', 'themes.json');
    const baseThemes = JSON.parse(await fs.readFile(jsonPath, 'utf-8'));
    const userId = req.user?.id || null;
    const dbResult = await pool.query(
      `SELECT theme_key, name, category, has_cli, show_grid, dot_color, status_text, css_variables, bg_image_url, is_public
       FROM custom_themes WHERE is_public = true OR ($1::text IS NOT NULL AND user_id = $1)`,
      [userId ? String(userId) : null]
    );

    const mergedThemes = { ...baseThemes };
    for (const row of dbResult.rows) {
      mergedThemes[row.theme_key] = {
        name: row.name,
        category: row.category,
        hasCli: row.has_cli,
        showGrid: row.show_grid,
        dotColor: row.dot_color,
        statusText: row.status_text,
        cssVariables: row.css_variables,
        bgImage: row.bg_image_url,
        isPublic: row.is_public,
        isCustom: true
      };
    }
    return res.json(mergedThemes);
  } catch (err) {
    logger.error('THEMES', 'Theme list could not be loaded', { name: err.name, code: err.code });
    return res.status(500).json({ error: 'Failed to fetch themes' });
  }
};

export const saveCustomTheme = async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  try {
    if (!userId) return res.status(401).json({ error: 'Authentication required.' });
    const body = req.body || {};
    const themeKey = String(body.themeKey || '').toLowerCase();
    const name = String(body.name || '').trim();
    const statusText = String(body.statusText || 'CUSTOM RUNTIME ACTIVE').trim();
    const dotColor = String(body.dotColor || '#3ecf8e');
    if (!/^[a-z0-9-]{1,50}$/.test(themeKey) || !name || name.length > 100 || statusText.length > 100 || !COLOR.test(dotColor)) {
      return res.status(400).json({ error: 'Invalid theme data.' });
    }
    const bgImage = cleanBackground(body.bgImage);
    const cssVariables = cleanCssVariables(body.cssVariables);
    const query = `
      INSERT INTO custom_themes (theme_key, name, user_id, has_cli, show_grid, dot_color, status_text, css_variables, bg_image_url, is_public)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (theme_key)
      DO UPDATE SET
        name = EXCLUDED.name, has_cli = EXCLUDED.has_cli, show_grid = EXCLUDED.show_grid,
        dot_color = EXCLUDED.dot_color, status_text = EXCLUDED.status_text,
        css_variables = EXCLUDED.css_variables, bg_image_url = EXCLUDED.bg_image_url,
        is_public = EXCLUDED.is_public
      WHERE custom_themes.user_id = EXCLUDED.user_id
      RETURNING theme_key, name, category, user_id, has_cli, show_grid, dot_color, status_text, css_variables, bg_image_url, is_public;
    `;
    const result = await pool.query(query, [
      themeKey, name, String(userId), body.hasCli !== false, body.showGrid !== false,
      dotColor, statusText, JSON.stringify(cssVariables), bgImage, body.isPublic === true
    ]);
    if (!result.rowCount) return res.status(409).json({ error: 'Bu tema anahtarı başka bir kullanıcı tarafından kullanılıyor.' });
    return res.status(201).json({ success: true, theme: result.rows[0] });
  } catch (err) {
    if (err instanceof AppError) return res.status(err.statusCode || 400).json({ error: err.message });
    logger.error('THEMES', 'Theme save failed', { name: err.name, code: err.code });
    return res.status(500).json({ error: 'Failed to save theme' });
  }
};

export const deleteCustomTheme = async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  try {
    const themeKey = String(req.params.themeKey || '');
    const result = await pool.query(
      `DELETE FROM custom_themes WHERE theme_key = $1 AND user_id = $2 RETURNING theme_key`,
      [themeKey, String(userId)]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: 'Tema bulunamadı veya sana ait değil.' });
    return res.json({ success: true, message: `Theme ${themeKey} deleted` });
  } catch (err) {
    logger.error('THEMES', 'Theme delete failed', { name: err.name, code: err.code });
    return res.status(500).json({ error: 'Failed to delete theme' });
  }
};

export const getPhotoboothSnaps = async (req, res) => {
  // The current endpoint contains placeholder/demo photos, not a private user vault.
  // Do not imply that request headers or query parameters authenticate a user.
  return res.status(200).json({
    isAuthenticated: true,
    status: 'empty',
    message: 'Fotoğraf kasası henüz kişisel depolamaya bağlanmadı.',
    photos: []
  });
};
