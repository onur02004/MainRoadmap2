import { Router } from 'express';
import * as spotifyController from '../controllers/spotifyController.js';
import { protect } from '../middleware/authMiddleware.js';
import { createRateLimit } from '../middleware/rateLimit.js';

const router = Router();

// /api/spotify/login-url
router.get('/login-url', protect, spotifyController.getLoginUrl);

// /api/spotify/callback (Spotify buraya yönlendirir)
router.get('/callback', protect, spotifyController.callback);

// /api/spotify/now-playing
router.get('/now-playing', protect, spotifyController.getNowPlaying);

// /api/spotify/top-tracks
router.get('/top-tracks', protect, spotifyController.getTopTracks);
router.get('/saved-tracks', protect, spotifyController.getSavedTracks);

router.get('/status', protect, spotifyController.getSpotifyStatus);
router.delete('/connection', protect, spotifyController.disconnectSpotify);

router.get('/friends-activity', protect, createRateLimit({ windowMs: 60_000, max: 20 }), spotifyController.getFriendsActivity);

// /api/spotify/search?q=sarkiarama
router.get('/search', createRateLimit({ windowMs: 60_000, max: 30 }), spotifyController.searchSpotifyTracks);

// /api/spotify/artist-images?name=Creed
router.get('/artist-images', createRateLimit({ windowMs: 60_000, max: 30 }), spotifyController.getArtistImages);

// /api/spotify/artist-gallery?name=Creed&limit=24
router.get('/artist-gallery', createRateLimit({ windowMs: 60_000, max: 20 }), spotifyController.getArtistGallery);

export default router;