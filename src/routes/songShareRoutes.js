import { Router } from 'express';
import * as songShareController from '../controllers/songShareController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

// Tüm istekler için oturum koruması (protect) zorunludur
router.use(protect);

// Yeni şarkı paylaşma endpoint'i
router.post('/', songShareController.shareSong);

// Feed akışını eklenme zamanına (date_added DESC) göre getirme endpoint'i
router.post('/repost/:id', songShareController.toggleRepost);

// Şarkıyı puanlama endpoint'i
router.post('/rate/:id', songShareController.rateSong);

// Şarkıya yorum ekleme endpoint'i
router.post('/comment/:id', songShareController.addComment);

router.get('/feed', songShareController.getFeed);

export default router;