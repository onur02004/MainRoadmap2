import express from 'express';
import { register, login } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { updateAvatar, createAvatarDesign } from '../controllers/userController.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

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

                relation:
                    req.user.relation,

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

                relation:
                    req.user.relation,

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