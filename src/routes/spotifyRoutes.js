import { Router } from 'express';
import * as spotifyController from '../controllers/spotifyController.js';

const router = Router();

router.get('/login', spotifyController.login);
router.get('/callback', spotifyController.callback);
router.get('/now-playing', spotifyController.getNowPlaying);
router.get('/top-tracks', spotifyController.getTopTracks);

export default router;