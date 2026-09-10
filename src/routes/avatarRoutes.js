import express from 'express';
import { getAvatars } from '../controllers/avatarController.js';
import { checkAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/avatars -> Tüm klasörlerdeki fotoların path'lerini döner
router.get('/', checkAuth,getAvatars);

export default router;