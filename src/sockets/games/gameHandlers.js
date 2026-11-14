import { query } from '../../config/db.js';
import { setGameActivity, getOnlineUser } from '../presence/presenceManager.js';

const GAME_STATES = new Set(['browsing', 'lobby', 'playing']);

export const registerGameHandlers = (io, socket) => {
  socket.on('games:activity:update', async payload => {
    try {
      if (!payload || typeof payload !== 'object') return;

      // Clear the current game activity when leaving a game.
      if (payload.clear === true) {
        if (setGameActivity(socket.user.id, socket.id, null)) {
          io.emit('presence:user-activity', getOnlineUser(socket.user.id));
        }
        return;
      }

      const gameKey = typeof payload.gameKey === 'string'
        ? payload.gameKey.trim().slice(0, 80)
        : '';
      const state = payload.state;

      if (!gameKey || !GAME_STATES.has(state)) return;

      // Resolve the game name server-side; never trust a client-supplied name.
      const result = await query(
        `SELECT game_key, name
         FROM game_catalog
         WHERE game_key = $1
           AND status = 'active'
           AND is_active = TRUE
         LIMIT 1`,
        [gameKey]
      );

      if (!result.rowCount) return;

      const game = {
        key: result.rows[0].game_key,
        name: result.rows[0].name,
        state
      };

      if (!setGameActivity(socket.user.id, socket.id, game)) return;

      io.emit('presence:user-activity', getOnlineUser(socket.user.id));
    } catch (error) {
      console.error('[Socket Games] Activity update failed:', error);
    }
  });
};
