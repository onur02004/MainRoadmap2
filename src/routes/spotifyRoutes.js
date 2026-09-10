import { Router } from 'express';
import * as spotifyController from '../controllers/spotifyController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

// /api/spotify/login-url
router.get('/login-url', protect, spotifyController.getLoginUrl);

// /api/spotify/callback (Spotify buraya yönlendirir)
router.get('/callback', spotifyController.callback);

// /api/spotify/now-playing
router.get('/now-playing', protect, spotifyController.getNowPlaying);

// /api/spotify/top-tracks
router.get('/top-tracks', protect, spotifyController.getTopTracks);

router.get('/status', protect, spotifyController.getSpotifyStatus);

router.get('/friends-activity', protect, spotifyController.getFriendsActivity);

// /api/spotify/search?q=sarkiarama
router.get('/search', protect, spotifyController.searchSpotifyTracks);

export default router;