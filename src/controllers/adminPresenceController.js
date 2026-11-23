
import { query } from '../config/db.js';
import { getOnlineUsers } from '../sockets/presence/presenceManager.js';

export const getAdminOnlineUsers = async (req, res, next) => {
  try {
    const users = getOnlineUsers();

    return res.json({
      status: 'success',
      data: {
        online: users
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminLoginHistory = async (req, res, next) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(100, Math.max(1, requestedLimit))
      : 15;

    const result = await query(
      `SELECT
         u.id,
         u.user_name,
         u.real_name,
         u.role,
         e.logged_in_at
       FROM user_login_events e
       INNER JOIN users u ON u.id = e.user_id
       ORDER BY e.logged_in_at DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({
      status: 'success',
      data: {
        logins: result.rows
      }
    });
  } catch (error) {
    next(error);
  }
};
