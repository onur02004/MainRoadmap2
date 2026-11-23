import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import {
  listAdminGames,
  getAdminGame,
  createAdminGame,
  updateAdminGame,
  setAdminGameStatus,
  archiveAdminGame
} from '../controllers/adminGamesController.js';



const router = express.Router();
router.use(protect, restrictTo('ADMIN'));

router.get('/', listAdminGames);
router.get('/:id', getAdminGame);
router.post('/', createAdminGame);
router.patch('/:id', updateAdminGame);
router.patch('/:id/status', setAdminGameStatus);
router.delete('/:id', archiveAdminGame);

export default router;
