import jwt from 'jsonwebtoken';
import * as userService from '../services/userService.js';

export const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token || typeof token !== 'string') {
      return next(new Error('AUTH_REQUIRED'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId =
      decoded.id ||
      decoded.userId ||
      decoded._id ||
      decoded.user_id;

    if (!userId) {
      return next(new Error('INVALID_TOKEN'));
    }

    const user = await userService.findUserById(userId);

    if (!user) {
      return next(new Error('USER_NOT_FOUND'));
    }

    // Sadece istemciye gösterilmesi gereken alanları taşıyoruz.
    socket.user = {
      id: user.id,
      user_name: user.user_name,
      role: user.role,
      avatar_type: user.avatar_type || 'builtin',
      avatar_data: user.avatar_data || {},
      profile_pic_path: user.profile_pic_path || null
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new Error('TOKEN_EXPIRED'));
    }

    console.error('[Socket Auth]', error.message);
    return next(new Error('INVALID_TOKEN'));
  }
};