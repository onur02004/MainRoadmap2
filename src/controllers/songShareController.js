import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import db from '../config/db.js';

/**
 * 1. Yeni Şarkı Paylaşma (Share Track)
 */
export const shareSong = catchAsync(async (req, res, next) => {
  const userId = req.user.id || req.user._id;
  const {
    song_name,
    song_artist,
    spotify_uri,
    song_url,
    song_cover_url,
    visibility = 'public',
    target_users = [],
    rating_by_user,
    comment_by_user,
    recommended_time_by_user,
    lyrics,
    time_synced_lyrics
  } = req.body;

  if (!song_name || !song_artist) {
    return next(new AppError('Şarkı adı ve sanatçı bilgisi zorunludur.', 400));
  }

  const query = `
    INSERT INTO song_suggestions (
      user_id, song_name, song_artist, spotify_uri, song_url, 
      song_cover_url, visibility, target_users, rating_by_user, 
      comment_by_user, recommended_time_by_user, lyrics, time_synced_lyrics, date_added
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
    RETURNING *;
  `;

  const values = [
    userId,
    song_name,
    song_artist,
    spotify_uri || null,
    song_url || null,
    song_cover_url || null,
    visibility,
    target_users,
    rating_by_user !== undefined ? rating_by_user : null,
    comment_by_user || null,
    recommended_time_by_user || null,
    lyrics || null,
    time_synced_lyrics ? JSON.stringify(time_synced_lyrics) : null
  ];

  const result = await db.query(query, values);

  res.status(201).json({
    status: 'success',
    message: 'Şarkı başarıyla paylaşıldı.',
    data: result.rows[0]
  });
});

/**
 * 2. Feed Akışını Getir (En yeni eklenene göre sıralı)
 */
export const getFeed = catchAsync(async (req, res, next) => {
  const currentUserId = req.user.id || req.user._id;

  // Görünürlük filtrelemesine (public, friends, custom) göre SQL sorgusu
  const feedQuery = `
    SELECT 
      s.*, 
      u.user_name as sharer_username, 
      u.profile_pic_path as sharer_avatar
    FROM song_suggestions s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE 
      s.visibility = 'public' 
      OR s.user_id = $1 
      OR (s.visibility = 'friends' AND $1 = ANY(s.target_users)) -- veya arkadaşlık ilişkisine göre genişletilebilir
      OR (s.visibility = 'custom' AND $1 = ANY(s.target_users))
    ORDER BY s.date_added DESC
    LIMIT 20;
  `;

  const result = await db.query(feedQuery, [currentUserId]);

  res.status(200).json({
    status: 'success',
    results: result.rows.length,
    data: result.rows
  });
});

/**
 * 3. Repost İşlemi (Ekle / Çıkar)
 */
export const toggleRepost = catchAsync(async (req, res, next) => {
  const { id: suggestionId } = req.params;
  const userId = req.user.id || req.user._id;

  const checkQuery = `SELECT reposted_by, repost_count FROM song_suggestions WHERE id = $1`;
  const checkResult = await db.query(checkQuery, [suggestionId]);

  if (checkResult.rows.length === 0) {
    return next(new AppError('Paylaşım bulunamadı.', 404));
  }

  const { reposted_by = [], repost_count = 0 } = checkResult.rows[0];
  const hasReposted = reposted_by.includes(userId);

  let updatedReposts, newCount;
  if (hasReposted) {
    updatedReposts = reposted_by.filter(uid => uid !== userId);
    newCount = Math.max(0, repost_count - 1);
  } else {
    updatedReposts = [...reposted_by, userId];
    newCount = repost_count + 1;
  }

  const updateQuery = `
    UPDATE song_suggestions 
    SET reposted_by = $1, repost_count = $2 
    WHERE id = $3 
    RETURNING repost_count, reposted_by;
  `;
  const updateResult = await db.query(updateQuery, [updatedReposts, newCount, suggestionId]);

  res.status(200).json({
    status: 'success',
    reposted: !hasReposted,
    repostCount: updateResult.rows[0].repost_count
  });
});

/**
 * 4. Puanlama İşlemi (0-100)
 */
export const rateSong = catchAsync(async (req, res, next) => {
  const { id: suggestionId } = req.params;
  const { rating } = req.body;

  if (rating === undefined || rating < 0 || rating > 100) {
    return next(new AppError('Geçersiz puan. 0 ile 100 arasında olmalıdır.', 400));
  }

  const query = `
    UPDATE song_suggestions 
    SET rating_by_user = $1, date_edited = NOW() 
    WHERE id = $2 
    RETURNING *;
  `;
  const result = await db.query(query, [rating, suggestionId]);

  if (result.rows.length === 0) {
    return next(new AppError('Paylaşım bulunamadı.', 404));
  }

  res.status(200).json({
    status: 'success',
    data: result.rows[0]
  });
});

/**
 * 5. Yorum Ekleme
 */
export const addComment = catchAsync(async (req, res, next) => {
  const { id: suggestionId } = req.params;
  const { comment } = req.body;

  if (!comment) {
    return next(new AppError('Yorum içeriği boş olamaz.', 400));
  }

  const query = `
    UPDATE song_suggestions 
    SET comment_by_user = $1, date_edited = NOW() 
    WHERE id = $2 
    RETURNING *;
  `;
  const result = await db.query(query, [comment, suggestionId]);

  if (result.rows.length === 0) {
    return next(new AppError('Paylaşım bulunamadı.', 404));
  }

  res.status(200).json({
    status: 'success',
    data: result.rows[0]
  });
});