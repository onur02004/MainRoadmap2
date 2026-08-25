import * as avatarService from '../services/avatarService.js';

export const getAvatars = (req, res) => {
  try {
    const avatars = avatarService.getAllAvatarPaths();

    res.status(200).json({
      status: 'success',
      data: { avatars }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};