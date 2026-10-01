import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import db from '../config/db.js';

// LRCLIB API Yapılandırması
const LRCLIB_BASE_URL = 'https://lrclib.net';
const LRCLIB_HEADERS = {
  // LRCLIB kuralları gereği User-Agent zorunludur
  'User-Agent': 'SongShareBackend/1.0.0 (https://github.com/myproject)'
};

/**
 * Yardımcı Fonksiyon: LRCLIB'den şarkı sözü çekme
 */
async function fetchLyricsFromLRCLIB(trackName, artistName, albumName = null, duration = null) {
  try {
    const params = new URLSearchParams({
      track_name: trackName,
      artist_name: artistName,
    });

    if (albumName) params.append('album_name', albumName);
    if (duration) params.append('duration', Math.round(duration));

    const response = await fetch(`${LRCLIB_BASE_URL}/api/get?${params.toString()}`, {
      headers: LRCLIB_HEADERS
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      console.warn(`[LRCLIB Warning] İstek başarısız: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[LRCLIB Error] Şarkı sözü çekilirken hata oluştu:', error.message);
    return null;
  }
}

/**
 * 0. LRCLIB Şarkı Sözü Getir (Public - Postman Test Endpoint'i)
 * GET /api/v1/songs/lyrics?track_name=...&artist_name=...&album_name=...&duration=...
 */
export const fetchSongLyrics = catchAsync(async (req, res, next) => {
  const { track_name, artist_name, album_name, duration } = req.query;

  if (!track_name || !artist_name) {
    return next(new AppError('track_name ve artist_name sorgu parametreleri zorunludur.', 400));
  }

  const lyricsData = await fetchLyricsFromLRCLIB(
    track_name,
    artist_name,
    album_name,
    duration ? Number(duration) : null
  );

  if (!lyricsData) {
    return res.status(404).json({
      status: 'fail',
      message: 'LRCLIB üzerinde bu şarkıya ait söz bulunamadı.'
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      id: lyricsData.id,
      trackName: lyricsData.trackName,
      artistName: lyricsData.artistName,
      albumName: lyricsData.albumName,
      duration: lyricsData.duration,
      instrumental: lyricsData.instrumental,
      plainLyrics: lyricsData.plainLyrics,
      syncedLyrics: lyricsData.syncedLyrics
    }
  });
});

/**
 * 1. Yeni Şarkı Paylaşma (Share Track)
 * Postman testi için auth middleware olmadan veya req.user yokken de çalışır.
 */
export const shareSong = catchAsync(async (req, res, next) => {
  // Public test: req.user yoksa varsayılan test id'si veya body'den gelen userId kullanılır
  const userId = req.user?.id || req.user?._id || req.body.userId || '11111111-1111-1111-1111-111111111111';

  let {
    song_name,
    song_artist,
    album_name,
    duration, // saniye cinsinden
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

  // Eğer istemci söz göndermediyse arka planda LRCLIB'e sorup otomatik doldur
  if (!lyrics && !time_synced_lyrics) {
    const lrcResult = await fetchLyricsFromLRCLIB(song_name, song_artist, album_name, duration);
    if (lrcResult) {
      lyrics = lrcResult.plainLyrics || null;
      time_synced_lyrics = lrcResult.syncedLyrics || null;
    }
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
 * 2. Feed Akışını Getir (Public test dostu)
 */
export const getFeed = catchAsync(async (req, res, next) => {

  const currentUserId =
    req.user?.id ||
    req.user?._id ||
    req.query.userId;

  if (!currentUserId) {
    return next(
      new AppError('Kullanıcı kimliği bulunamadı.', 401)
    );
  }

  const feedQuery = `
    SELECT
      s.*,

      /* PAYLAŞAN KİŞİ */
      u.user_name AS sharer_username,
      u.profile_pic_path AS sharer_avatar,
      u.avatar_type AS sharer_avatar_type,
      u.avatar_data AS sharer_avatar_data,

      /* TOPLULUK PUANI */
      COALESCE(r.rating_average, 0) AS community_rating,
      COALESCE(r.rating_count, 0) AS community_rating_count,

      /* BU KULLANICININ VERDİĞİ PUAN */
      my_rating.rating AS my_rating,

      /* DİĞER KULLANICILARIN YORUMLARI */
      COALESCE(c.comments, '[]'::json) AS comments

    FROM song_suggestions s

    LEFT JOIN users u
      ON u.id = s.user_id

    /* RATING AGGREGATION */
    LEFT JOIN LATERAL (
      SELECT
        ROUND(AVG(sr.rating)::numeric, 1) AS rating_average,
        COUNT(*)::integer AS rating_count
      FROM song_ratings sr
      WHERE sr.song_share_id = s.id
    ) r ON true

    /* CURRENT USER RATING */
    LEFT JOIN LATERAL (
      SELECT sr.rating
      FROM song_ratings sr
      WHERE
        sr.song_share_id = s.id
        AND sr.user_id = $1
      LIMIT 1
    ) my_rating ON true

    /* COMMENTS */
    LEFT JOIN LATERAL (
      SELECT
        json_agg(
          json_build_object(
            'id', sc.id,
            'comment', sc.comment,
            'created_at', sc.created_at,
            'user_id', sc.user_id,
            'username', cu.user_name,
            'avatar', cu.profile_pic_path,
            'avatar_type', cu.avatar_type,
            'avatar_data', cu.avatar_data
          )
          ORDER BY sc.created_at DESC
        ) AS comments
      FROM song_comments sc
      LEFT JOIN users cu
        ON cu.id = sc.user_id
      WHERE sc.song_share_id = s.id
    ) c ON true

    WHERE
      s.visibility = 'public'

      OR s.user_id = $1

      OR (
        s.visibility = 'friends'
        AND $1 = ANY(s.target_users)
      )

      OR (
        s.visibility = 'custom'
        AND $1 = ANY(s.target_users)
      )

    ORDER BY s.date_added DESC

    LIMIT 20;
  `;

  const result = await db.query(
    feedQuery,
    [currentUserId]
  );

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
  const userId = req.user?.id || req.user?._id || req.body.userId || '11111111-1111-1111-1111-111111111111';

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

  const userId =
    req.user?.id ||
    req.user?._id;

  if (!userId) {
    return next(
      new AppError('Oturum gerekli.', 401)
    );
  }

  const numericRating = Number(rating);

  if (
    !Number.isFinite(numericRating) ||
    numericRating < 0 ||
    numericRating > 100
  ) {
    return next(
      new AppError(
        'Geçersiz puan. 0 ile 100 arasında olmalıdır.',
        400
      )
    );
  }

  /* Paylaşımı kontrol et */
  const shareResult = await db.query(
    `
      SELECT user_id
      FROM song_suggestions
      WHERE id = $1
    `,
    [suggestionId]
  );

  if (shareResult.rows.length === 0) {
    return next(
      new AppError('Paylaşım bulunamadı.', 404)
    );
  }

  const ownerId = shareResult.rows[0].user_id;

  /* Kendi paylaşımına topluluk puanı verme */
  if (String(ownerId) === String(userId)) {
    return next(
      new AppError(
        'Kendi paylaşımına topluluk puanı veremezsin.',
        400
      )
    );
  }

  /* INSERT veya UPDATE */
  await db.query(
    `
      INSERT INTO song_ratings (
        song_share_id,
        user_id,
        rating
      )
      VALUES ($1, $2, $3)

      ON CONFLICT (
        song_share_id,
        user_id
      )

      DO UPDATE SET
        rating = EXCLUDED.rating,
        updated_at = NOW()
    `,
    [
      suggestionId,
      userId,
      numericRating
    ]
  );

  /* Yeni ortalamayı hesapla */
  const result = await db.query(
    `
      SELECT
        ROUND(AVG(rating)::numeric, 1) AS average,
        COUNT(*)::integer AS count
      FROM song_ratings
      WHERE song_share_id = $1
    `,
    [suggestionId]
  );

  const stats = result.rows[0];

  res.status(200).json({
    status: 'success',

    data: {
      rating: numericRating,
      average: stats.average
        ? Number(stats.average)
        : 0,
      count: Number(stats.count || 0)
    }
  });
});

/**
 * 5. Yorum Ekleme
 */
export const addComment = catchAsync(async (req, res, next) => {

  const { id: suggestionId } = req.params;
  const { comment } = req.body;

  const userId =
    req.user?.id ||
    req.user?._id;

  if (!userId) {
    return next(
      new AppError('Oturum gerekli.', 401)
    );
  }

  const cleanComment =
    String(comment || '').trim();

  if (!cleanComment) {
    return next(
      new AppError(
        'Yorum içeriği boş olamaz.',
        400
      )
    );
  }

  const shareResult = await db.query(
    `
      SELECT id
      FROM song_suggestions
      WHERE id = $1
    `,
    [suggestionId]
  );

  if (shareResult.rows.length === 0) {
    return next(
      new AppError('Paylaşım bulunamadı.', 404)
    );
  }

  const result = await db.query(
    `
      INSERT INTO song_comments (
        song_share_id,
        user_id,
        comment
      )

      VALUES ($1, $2, $3)

      RETURNING
        id,
        comment,
        created_at
    `,
    [
      suggestionId,
      userId,
      cleanComment
    ]
  );

  const commentRow = result.rows[0];

  const userResult = await db.query(
    `
      SELECT
        user_name,
        profile_pic_path,
        avatar_type,
        avatar_data
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  const user = userResult.rows[0];

  res.status(201).json({
    status: 'success',

    data: {
      id: commentRow.id,
      comment: commentRow.comment,
      created_at: commentRow.created_at,

      user_id: userId,

      username:
        user?.user_name || 'Kullanıcı',

      avatar:
        user?.profile_pic_path || null,

      avatar_type:
        user?.avatar_type || null,

      avatar_data:
        user?.avatar_data || null
    }
  });
});

// ========================================================
// 6. MÜZİK ÖNERİLERİ
// GEÇİCİ - Daha sonra gerçek recommendation sistemi gelecek
// ========================================================

export const getRecommendations = catchAsync(async (req, res, next) => {

    const recommendations = [

        {
            id: 'rec-001',
            title: 'Hot',
            artist: 'Inna',
            coverUrl: 'https://i.scdn.co/image/ab67616d00001e023d6413c7dc24318bdbd5b366',
            spotifyUrl: 'https://open.spotify.com/track/5F4d5D9s0hM8f0gM6XvQeF'
        },

        {
            id: 'rec-002',
            title: 'Aklımda Biri Var',
            artist: 'Artis',
            coverUrl: 'https://i.scdn.co/image/ab67616d0000b273960635da26f6fbccbeb36b2d',
            spotifyUrl: ''
        },

        {
            id: 'rec-003',
            title: 'A Sky Full of Stars',
            artist: 'Coldplay',
            coverUrl: 'https://i.scdn.co/image/ab67616d00001e028ff7c3580d429c8212b9a3b6',
            spotifyUrl: ''
        },

        {
            id: 'rec-004',
            title: 'Self Aware',
            artist: 'Alternative',
            coverUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSpAp5NlImEisne6bbOOYVnPRHVm5B1gT4YQfF1Vi5dDQ&s=10',
            spotifyUrl: ''
        },

        {
            id: 'rec-005',
            title: 'Maraton',
            artist: 'Ati242',
            coverUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-eHQUhSqV86ZoY3Ak8pVP_XqzFIStg-GSaCOu9EwjQw&s',
            spotifyUrl: ''
        },

        {
            id: 'rec-006',
            title: 'Join Me',
            artist: 'HIM',
            coverUrl: 'https://i.scdn.co/image/ab67616d0000b273a8cfc41719dc2c2028e0aad5',
            spotifyUrl: ''
        },

        {
            id: 'rec-007',
            title: 'Denize Bıraksam',
            artist: 'Turkish Rock',
            coverUrl: 'https://i.scdn.co/image/ab67616d0000b2736054a3d4d3fadf0173dbdf07',
            spotifyUrl: ''
        },

        {
            id: 'rec-008',
            title: 'Bi Tik',
            artist: 'Pop Mix',
            coverUrl: 'https://i1.sndcdn.com/artworks-ixY9Sl5eXz1mPMyZ-Sq9u8Q-t500x500.jpg',
            spotifyUrl: ''
        }

    ];

    res.status(200).json({
        status: 'success',
        results: recommendations.length,
        data: recommendations
    });
});