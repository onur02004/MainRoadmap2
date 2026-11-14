import express from 'express';
import { getHome, getAccount, getLogin, getSongShare, getAdmin, getGames } from '../controllers/viewController.js';

import {
  protect,
  restrictTo
} from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getHome);
router.get('/account', protect, getAccount);
router.get('/login', getLogin);
router.get('/song-share', protect, getSongShare);
router.get('/games', protect, getGames);
router.get('/admin', protect, restrictTo('ADMIN'), getAdmin);

export default router;