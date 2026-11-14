import express from 'express';
import { listPublicGames, getPublicGame } from '../controllers/gameController.js';

const router = express.Router();

router.get('/', listPublicGames);
router.get('/:gameKey', getPublicGame);

export default router;
