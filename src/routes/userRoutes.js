import express from 'express';
import { register, login, logout, changePassword } from '../controllers/authController.js';
import { createRateLimit } from '../middleware/rateLimit.js';
import { protect } from '../middleware/authMiddleware.js';
import { updateAvatar, createAvatarDesign } from '../controllers/userController.js';

const router = express.Router();

router.post('/register', createRateLimit({ windowMs: 60 * 60 * 1000, max: 5 }), register);
router.post('/login', createRateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), login);
router.post('/logout', logout);
router.post('/password', protect, createRateLimit({ windowMs: 60 * 60 * 1000, max: 5 }), changePassword);

router.get('/profile', protect, (req, res) => {

    res.status(200).json({

        status: 'success',

        data: {

            user: {

                id:
                    req.user.id,

                user_name:
                    req.user.user_name,

                email:
                    req.user.email,

                role:
                    req.user.role,

                profile_pic_path:
                    req.user.profile_pic_path,

                avatar_type:
                    req.user.avatar_type,

                avatar_data:
                    req.user.avatar_data

            }

        }

    });

});


router.get('/me', protect, (req, res) => {

    res.status(200).json({

        status: 'success',

        data: {

            user: {

                id:
                    req.user.id,

                user_name:
                    req.user.user_name,

                email:
                    req.user.email,

                role:
                    req.user.role,

                profile_pic_path:
                    req.user.profile_pic_path,

                avatar_type:
                    req.user.avatar_type,

                avatar_data:
                    req.user.avatar_data

            }

        }

    });

});

router.post('/profile/avatar', protect, updateAvatar);

router.post('/avatar-designs', protect, createAvatarDesign);


export default router;