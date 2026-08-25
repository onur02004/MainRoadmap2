import express from 'express';
import { getThemes, saveCustomTheme, deleteCustomTheme, getPhotoboothSnaps } from '../controllers/themeController.js';

const router = express.Router();

router.get('/', getThemes);
router.post('/custom', saveCustomTheme);
router.delete('/custom/:themeKey', deleteCustomTheme);

router.get('/photobooth-snaps', getPhotoboothSnaps);

export default router;