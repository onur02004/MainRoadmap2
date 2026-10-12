import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import logger from '../utils/logger.js';
import {
  listAdminUsers,
  createAdminUser,
  updateAdminUser
} from '../controllers/adminController.js';

const router = express.Router();
router.use(protect, restrictTo('admin'));

router.get('/logs', protect, restrictTo('ADMIN'), (req, res) => {
    try {
        if (typeof logger.getRecentLogs !== 'function') {
            return res.status(500).json({
                success: false,
                message: 'Logger does not support retrieving recent logs yet.'
            });
        }

        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 100, 1),
            1000
        );

        res.json({
            success: true,
            logs: logger.getRecentLogs(limit)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Could not retrieve server logs.'
        });
    }
});

router.get('/users', listAdminUsers);
router.post('/users', createAdminUser);
router.patch('/users/:id', updateAdminUser);


export default router;