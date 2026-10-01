import { Router } from 'express';
import * as songShareController from '../controllers/songShareController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();




// ========================================================
// 1. PUBLIC ENDPOINT'LER (protect öncesi - Token gerektirmez)
// ========================================================

// Postman'den şifresiz test edebilmen için protect'in ÜSTÜNDE tanımlandı:
router.get('/lyrics', songShareController.fetchSongLyrics);

// (İsteğe bağlı: Paylaşımı da token olmadan Postman'den denemek istersen bu satırı açabilirsin)
// router.post('/public-share', songShareController.shareSong);


// ========================================================
// 2. KORUMALI ENDPOINT'LER (protect sonrası - Token zorunlu)
// ========================================================

// Buradan sonraki tüm istekler için oturum koruması (protect) zorunludur
router.use(protect);

// Yeni şarkı paylaşma endpoint'i
router.post('/', songShareController.shareSong);

// Repost işlemi
router.post('/repost/:id', songShareController.toggleRepost);

// Şarkıyı puanlama endpoint'i
router.post('/rate/:id', songShareController.rateSong);

// Şarkıya yorum ekleme endpoint'i
router.post('/comment/:id', songShareController.addComment);

// Feed akışı
router.get('/feed', songShareController.getFeed);

// Önerilen şarkılar
router.get('/recommendations', songShareController.getRecommendations);

export default router;