// Read-only diagnostics for the system console.
import express from 'express';
import { checkAuth } from '../middleware/authMiddleware.js';
import pool from '../config/db.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, '../../public');
const router = express.Router();

// GET /api/debug/health — deliberately public and safe for uptime checks.
// Never return environment variables, credentials, SQL text, or raw driver errors.
router.get('/health', async (_req, res) => {
  const startedAt = Date.now();

  try {
    await pool.query('SELECT 1');
    return res.status(200).json({
      status: 'success',
      data: {
        service: 'MainRoadmap2 API',
        status: 'healthy',
        database: {
          status: 'connected',
          latencyMs: Date.now() - startedAt
        },
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      }
    });
  } catch {
    return res.status(503).json({
      status: 'error',
      message: 'Backend is running but the database health check failed.',
      data: {
        service: 'MainRoadmap2 API',
        status: 'degraded',
        database: { status: 'unavailable' },
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      }
    });
  }
});

// This endpoint intentionally returns only a simple diagnostic response.
router.get('/', checkAuth, (req, res) => {
  res.json({
    status: 'success',
    message: 'Debug endpoint reached.',
    data: {
      authenticated: Boolean(req.user),
      timestamp: new Date().toISOString()
    }
  });
});

router.get('/sh', (_req, res) => {
  res.sendFile(path.join(publicPath, 'songShare/songShare.html'));
});

export default router;
