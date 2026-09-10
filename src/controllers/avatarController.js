import * as avatarService from '../services/avatarService.js';

export const getAvatars = (req, res) => {
  try {
    const isLoggedIn = Boolean(req.user);
    const avatars = avatarService.getAvatarPaths(isLoggedIn);

    res.status(200).json({
      status: 'success',
      data: { 
        isLoggedIn,
        avatars 
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};