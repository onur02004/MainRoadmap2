import express from 'express';
import { register, login } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { updateAvatar } from '../controllers/userController.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

router.get('/profile', protect, (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: req.user.id,
        user_name: req.user.user_name,
        email: req.user.email,
        relation: req.user.relation,
        profile_pic_path: req.user.profile_pic_path
      }
    }
  });
});

router.post('/profile/avatar', protect, updateAvatar);

router.get('/me', protect, (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: req.user.id,
        user_name: req.user.user_name,
        email: req.user.email,
        relation: req.user.relation,
        profile_pic_path: req.user.profile_pic_path
      }
    }
  });
});


export default router;