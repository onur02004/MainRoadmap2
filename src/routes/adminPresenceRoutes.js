
import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

import {
  getAdminOnlineUsers,
  getAdminLoginHistory
} from '../controllers/adminPresenceController.js';

const router = express.Router();

router.use(protect, restrictTo('ADMIN'));

router.get('/online', getAdminOnlineUsers);
router.get('/logins', getAdminLoginHistory);

export default router;
