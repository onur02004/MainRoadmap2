import { query } from '../config/db.js';

export const listPublicGames = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT id, game_key, name, short_name, tagline, description, instructions,
             category, difficulty, min_players, max_players, estimated_minutes,
             player_modes, tags, logo_url, cover_image_url, preview_image_url,
             icon, accent_color, route, is_featured, sort_order
      FROM game_catalog
      WHERE is_active = TRUE AND status = 'active'
      ORDER BY is_featured DESC, sort_order ASC, name ASC
    `);
    res.json({ status: 'success', data: { games: result.rows } });
  } catch (error) {
    next(error);
  }
};

export const getPublicGame = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT id, game_key, name, short_name, tagline, description, instructions,
             category, difficulty, min_players, max_players, estimated_minutes,
             player_modes, tags, logo_url, cover_image_url, preview_image_url,
             icon, accent_color, route, is_featured, rules, config
      FROM game_catalog
      WHERE game_key = $1 AND is_active = TRUE AND status = 'active'
      LIMIT 1
    `, [req.params.gameKey]);

    if (!result.rowCount) {
      return res.status(404).json({
        status: 'error',
        message: 'Game not found or not currently available.'
      });
    }
    res.json({ status: 'success', data: { game: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};
