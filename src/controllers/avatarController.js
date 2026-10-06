import * as avatarService from '../services/avatarService.js';
import logger from '../utils/logger.js';


export const getAvatars = (req, res) => {
  try {
    const isLoggedIn = Boolean(req.user);
    const avatars = avatarService.getAvatarPaths(isLoggedIn);

    logger.detail(`AVATARS`, `Fetched avatars for ${isLoggedIn ? 'logged-in user' : 'guest'}`, req.user ? { user_name: req.user.user_name } : {});
    res.status(200).json({
      status: 'success',
      data: { 
        isLoggedIn,
        avatars 
      }
    });
  } catch (error) {
    logger.error(`AVATARS`, 'Error fetching avatars:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};