import express from 'express';
import { getThemes, saveCustomTheme, deleteCustomTheme, getPhotoboothSnaps } from '../controllers/themeController.js';
import { protect, checkAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', checkAuth, getThemes);
router.post('/custom', protect, saveCustomTheme);
router.delete('/custom/:themeKey', protect, deleteCustomTheme);
router.get('/photobooth-snaps', protect, getPhotoboothSnaps);

export default router;
