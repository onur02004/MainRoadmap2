import { query } from '../config/db.js';

// Public catalogue: show planned games too, but only active games can be launched.
export const listPublicGames = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        id, game_key, name, short_name, tagline, description, instructions,
        category, difficulty, min_players, max_players, player_modes,
        estimated_duration, logo_url, cover_image_url, preview_image_url,
        icon, accent_color, route, status, is_active, is_featured,
        sort_order, rules, config
      FROM game_catalog
      WHERE status <> 'archived'
      ORDER BY
        CASE status
          WHEN 'active' THEN 0
          WHEN 'draft' THEN 1
          WHEN 'maintenance' THEN 2
          ELSE 3
        END,
        is_featured DESC,
        sort_order ASC,
        name ASC
    `);

    const games = result.rows.map(game => ({
      ...game,
      can_play: game.status === 'active' && game.is_active === true
    }));

    res.json({ status: 'success', data: { games } });
  } catch (error) {
    next(error);
  }
};

export const getPublicGame = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        id, game_key, name, short_name, tagline, description, instructions,
        category, difficulty, min_players, max_players, player_modes,
        estimated_duration, logo_url, cover_image_url, preview_image_url,
        icon, accent_color, route, status, is_active, is_featured,
        rules, config
      FROM game_catalog
      WHERE game_key = $1
        AND status = 'active'
        AND is_active = TRUE
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
