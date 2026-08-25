import express from 'express';
import { getAvatars } from '../controllers/avatarController.js';

const router = express.Router();

// GET /api/avatars -> Tüm klasörlerdeki fotoların path'lerini döner
router.get('/', getAvatars);

export default router;