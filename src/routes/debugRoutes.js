//Sadece Debug icin


import express from 'express';
import { checkAuth } from '../middleware/authMiddleware.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, '../../public');

const router = express.Router();

// GET /api/services
router.get('/', checkAuth, (req, res) => {
  res.json({ message: 'Debug endpoint hit' });
});

router.get('/sh', (req, res) => {
    res.sendFile(path.join(publicPath, '/songShare/songShare.html'));
});

export default router;