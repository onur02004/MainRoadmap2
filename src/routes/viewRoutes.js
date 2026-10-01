import express from 'express';
import { getHome, getAccount, getLogin, getSongShare } from '../controllers/viewController.js';

const router = express.Router();

router.get('/', getHome);
router.get('/account', getAccount);
router.get('/login', getLogin);
router.get('/song-share', getSongShare);

export default router;