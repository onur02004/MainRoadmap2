import pool from '../config/db.js';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';

// Sistem temalarını (themes.json) ve Veritabanındaki Temaları Birleştir
export const getThemes = async (req, res) => {
  try {
    const jsonPath = path.join(process.cwd(), 'public', 'themes', 'themes.json');
    const baseThemesRaw = await fs.readFile(jsonPath, 'utf-8');
    const baseThemes = JSON.parse(baseThemesRaw);

    // DB'deki public temaları ve kullanıcının kendi temalarını çek
    const userId = req.query.userId || 'guest';
    const dbResult = await pool.query(
      `SELECT * FROM custom_themes WHERE is_public = true OR user_id = $1`,
      [userId]
    );

    const mergedThemes = { ...baseThemes };
    dbResult.rows.forEach(row => {
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
        isCustom: true,
        userId: row.user_id
      };
    });

    logger.detail('THEMES', `Fetched and merged themes for user: ${userId}`);
    res.json(mergedThemes);
  } catch (err) {
    logger.error('THEMES', `Error fetching themes for user: ${userId}`, err);
    res.status(500).json({ error: 'Failed to fetch themes', details: err.message });
  }
};

// Yeni Özel Tema Kaydet / Güncelle
export const saveCustomTheme = async (req, res) => {
  try {
    const {
      themeKey,
      name,
      hasCli,
      showGrid,
      dotColor,
      statusText,
      cssVariables,
      bgImage,
      isPublic,
      userId
    } = req.body;

    const query = `
      INSERT INTO custom_themes (theme_key, name, user_id, has_cli, show_grid, dot_color, status_text, css_variables, bg_image_url, is_public)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (theme_key) 
      DO UPDATE SET 
        name = $2, has_cli = $4, show_grid = $5, dot_color = $6, status_text = $7,
        css_variables = $8, bg_image_url = $9, is_public = $10
      RETURNING *;
    `;

    const values = [
      themeKey.toLowerCase().replace(/\s+/g, '-'),
      name,
      userId || 'onur',
      hasCli ?? true,
      showGrid ?? true,
      dotColor || '#3ecf8e',
      statusText || 'CUSTOM RUNTIME ACTIVE',
      JSON.stringify(cssVariables),
      bgImage || null,
      isPublic ?? false
    ];

    const result = await pool.query(query, values);
    logger.detail('THEMES', `Saved custom theme for user: ${userId}`, { themeKey, name });
    res.status(201).json({ success: true, theme: result.rows[0] });
  } catch (err) {
    logger.error('THEMES', `Error saving theme for user: ${userId}`, err);
    res.status(500).json({ error: 'Failed to save theme', details: err.message });
  }
};

export const deleteCustomTheme = async (req, res) => {
  try {
    const { themeKey } = req.params;
    await pool.query(`DELETE FROM custom_themes WHERE theme_key = $1`, [themeKey]);
    logger.detail('THEMES', `Deleted custom theme: ${themeKey}`);
    res.json({ success: true, message: `Theme ${themeKey} deleted` });
  } catch (err) {
    logger.error('THEMES', `Error deleting theme: ${themeKey}`, err);
    res.status(500).json({ error: 'Failed to delete theme', details: err.message });
  }
};

export const getPhotoboothSnaps = async (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-name'] || 'anonymous';
    const isAuthenticated = userId && userId !== 'anonymous' && userId !== 'guest_user';

    // 1. Giriş yapılmamışsa kilitli durum döndür
    if (!isAuthenticated) {
      return res.json({
        isAuthenticated: false,
        status: 'unauthenticated',
        message: 'Log in to see some pictures',
        photos: []
      });
    }

    // 2. Giriş yapılmışsa (onur / admin) rastgele veya DB fotoğraflarını döndür
    const samplePhotos = [
      {
        id: 'snap-1',
        url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=600&auto=format&fit=crop&q=80',
        caption: 'Admin Session Polaroid #01',
        takenAt: '14:52:33'
      },
      {
        id: 'snap-2',
        url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80',
        caption: 'Studio Snapshot #02',
        takenAt: '14:55:10'
      },
      {
        id: 'snap-3',
        url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&auto=format&fit=crop&q=80',
        caption: 'Cluster Dev Vault #03',
        takenAt: '15:02:44'
      }
    ];

    // Fotoğraflar varsa listele, yoksa boş döndür
    if (!samplePhotos || samplePhotos.length === 0) {
      return res.json({
        isAuthenticated: true,
        status: 'empty',
        message: 'Şu anda fotoğraf görüntülenemiyor',
        photos: []
      });
    }

    logger.detail('THEMES', `Fetched photobooth snaps for user: ${userId}`, { photoCount: samplePhotos.length });
    return res.json({
      isAuthenticated: true,
      status: 'ok',
      message: 'Photo Vault Loaded',
      photos: samplePhotos
    });
  } catch (err) {
    logger.error('THEMES', `Error fetching photobooth snaps for user: ${userId}`, err);
    return res.status(500).json({
      isAuthenticated: false,
      status: 'error',
      message: 'Şu anda fotoğraf görüntülenemiyor',
      photos: []
    });
  }
};