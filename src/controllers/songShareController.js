import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import db from "../config/db.js";
import logger from "../utils/logger.js";
import * as spotifyService from "../services/spotifyService.js";
import { getRandomRecommendations } from "../services/recommendationService.js";

const MAX_COMMENT_LENGTH = 2000;
const VALID_VISIBILITIES = new Set(['public', 'friends', 'custom']);

async function findVisibleShare(shareId, userId) {
  const result = await db.query(
    `SELECT id, user_id, visibility, COALESCE(target_users, '{}'::uuid[]) AS target_users
     FROM song_suggestions WHERE id = $1`,
    [shareId]
  );
  const share = result.rows[0];
  if (!share) return null;
  const isOwner = String(share.user_id) === String(userId);
  const isPublic = share.visibility === 'public';
  const isTarget = Array.isArray(share.target_users) && share.target_users.some((id) => String(id) === String(userId));
  return (isOwner || isPublic || isTarget) ? share : null;
}

function isAllowedExternalUrl(value, allowedHosts = []) {
  if (value == null || value === '') return true;
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}


// LRCLIB API Yapılandırması
const LRCLIB_BASE_URL = "https://lrclib.net";
const LRCLIB_HEADERS = {
  // LRCLIB kuralları gereği User-Agent zorunludur
  "User-Agent":
    "SongShareBackend/1.0.0 (https://github.com/onur02004/MainRoadmap2)",
};

/**
 * Yardımcı Fonksiyon: LRCLIB'den şarkı sözü çekme
 */
async function fetchLyricsFromLRCLIB(
  trackName,
  artistName,
  albumName = null,
  duration = null,
) {
  try {
    const params = new URLSearchParams({
      track_name: trackName,
      artist_name: artistName,
    });

    if (albumName) params.append("album_name", albumName);
    if (duration) params.append("duration", Math.round(duration));

    const response = await fetch(
      `${LRCLIB_BASE_URL}/api/get?${params.toString()}`,
      {
        headers: LRCLIB_HEADERS,
      },
    );

    if (response.status === 404) {
      logger.info(`LRCLIB`, `No Lyrics found: ${trackName} - ${artistName}`);
      return null;
    }

    if (!response.ok) {
      logger.warn(`LRCLIB`, `Request failed: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    logger.error(`LRCLIB`, "Error fetching lyrics:", error);
    return null;
  }
}

/**
 * 0. LRCLIB Şarkı Sözü Getir (Public - Postman Test Endpoint'i)
 * GET /api/v1/songs/lyrics?track_name=...&artist_name=...&album_name=...&duration=...
 */
export const fetchSongLyrics = catchAsync(async (req, res, next) => {
  const track_name = String(req.query.track_name || '').trim();
  const artist_name = String(req.query.artist_name || '').trim();
  const album_name = String(req.query.album_name || '').trim();
  const durationRaw = req.query.duration;
  const duration = durationRaw == null || durationRaw === '' ? null : Number(durationRaw);

  if (!track_name || !artist_name || track_name.length > 200 || artist_name.length > 200 || album_name.length > 200 || (duration !== null && (!Number.isFinite(duration) || duration <= 0 || duration > 86400))) {
    logger.error(
      `LRCLIB`,
      "track_name and artist_name paramaters are mandatory.",
    );
    return next(
      new AppError(
        "Geçerli track_name ve artist_name zorunludur; alanlar en fazla 200 karakter olabilir.",
        400,
      ),
    );
  }

  const lyricsData = await fetchLyricsFromLRCLIB(
    track_name,
    artist_name,
    album_name,
    duration,
  );

  if (!lyricsData) {
    logger.info(`LRCLIB`, `No Lyrics found: ${track_name} - ${artist_name}`);
    return res.status(404).json({
      status: "fail",
      message: "LRCLIB üzerinde bu şarkıya ait söz bulunamadı.",
    });
  }
  logger.info(`LRCLIB`, `Fetched Lyrics: ${track_name} - ${artist_name}`);
  res.status(200).json({
    status: "success",
    data: {
      id: lyricsData.id,
      trackName: lyricsData.trackName,
      artistName: lyricsData.artistName,
      albumName: lyricsData.albumName,
      duration: lyricsData.duration,
      instrumental: lyricsData.instrumental,
      plainLyrics: lyricsData.plainLyrics,
      syncedLyrics: lyricsData.syncedLyrics,
    },
  });
});

/**
 * 1. Yeni Şarkı Paylaşma (Share Track)
 * Postman testi için auth middleware olmadan veya req.user yokken de çalışır.
 */
export const shareSong = catchAsync(async (req, res, next) => {
  // Public test: req.user yoksa varsayılan test id'si veya body'den gelen userId kullanılır
  const userId = req.user?.id || req.user?._id;
  if (!userId) return next(new AppError("Oturum gerekli.", 401));

  let {
    song_name,
    song_artist,
    album_name,
    duration,
    spotify_uri,
    song_url,
    song_cover_url,

    visibility = "public",
    target_users = [],

    rating_by_user,
    comment_by_user,
    recommended_time_by_user,

    post_type = "music",

    lyrics,
    time_synced_lyrics,
    lyrics_excerpt,
    lyrics_start_time,
    lyrics_end_time,
    lyrics_design = {},
  } = req.body || {};

  if (!song_name || !song_artist || typeof song_name !== 'string' || typeof song_artist !== 'string' || song_name.trim().length > 200 || song_artist.trim().length > 200) {
    return next(new AppError("Şarkı adı ve sanatçı bilgisi zorunludur; en fazla 200 karakter olabilir.", 400));
  }
  if (!VALID_VISIBILITIES.has(visibility) || !['music', 'lyrics'].includes(post_type)) return next(new AppError('Paylaşım türü veya görünürlüğü geçersiz.', 400));
  if (!Array.isArray(target_users) || target_users.length > 100 || target_users.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id)))) return next(new AppError('Hedef kullanıcı listesi geçersiz.', 400));
  if (comment_by_user != null && (typeof comment_by_user !== 'string' || comment_by_user.length > MAX_COMMENT_LENGTH)) return next(new AppError('Açıklama en fazla 2000 karakter olabilir.', 400));
  if (rating_by_user !== undefined && rating_by_user !== null && (!Number.isInteger(Number(rating_by_user)) || Number(rating_by_user) < 0 || Number(rating_by_user) > 100)) return next(new AppError('Puan 0 ile 100 arasında tam sayı olmalıdır.', 400));

  // Sanatçı/grup fotoğraflarını Spotify'dan otomatik al
  let song_artist_cover_url = req.body.song_artist_cover_url || null;
  let song_artist_cover_url_backup =
    req.body.song_artist_cover_url_backup || null;
  let song_artist_genre = req.body.song_artist_genre || null;

  if (!song_artist_cover_url) {
    try {
      const artistMeta =
        await spotifyService.getArtistDetailsByName(song_artist);

      if (artistMeta) {
        song_artist_cover_url = artistMeta.artist_cover || null;
        song_artist_cover_url_backup = artistMeta.artist_cover_backup || null;
        song_artist_genre = artistMeta.genres || [];
      }
    } catch (error) {
      logger.warn("SONGSHARE", `Sanatçı fotoğrafı alınamadı: ${song_artist}`);
    }
  }

  if (!isAllowedExternalUrl(song_url, ['open.spotify.com']) || !isAllowedExternalUrl(song_cover_url, ['i.scdn.co', 'image-cdn-ak.spotifycdn.com']) || !isAllowedExternalUrl(song_artist_cover_url, ['i.scdn.co', 'image-cdn-ak.spotifycdn.com']) || !isAllowedExternalUrl(song_artist_cover_url_backup, ['i.scdn.co', 'image-cdn-ak.spotifycdn.com'])) {
    return next(new AppError('Spotify bağlantısı veya görsel adresi geçersiz.', 400));
  }
  if (spotify_uri != null && (typeof spotify_uri !== 'string' || !/^spotify:(track|episode):[A-Za-z0-9]{10,40}$/.test(spotify_uri))) return next(new AppError('Spotify URI geçersiz.', 400));
  if (lyrics != null && (typeof lyrics !== 'string' || lyrics.length > 100_000)) return next(new AppError('Şarkı sözleri çok uzun veya geçersiz.', 400));
  if (time_synced_lyrics != null && (typeof time_synced_lyrics !== 'string' && typeof time_synced_lyrics !== 'object' || JSON.stringify(time_synced_lyrics).length > 150_000)) return next(new AppError('Senkronize şarkı sözleri geçersiz.', 400));
  if (lyrics_excerpt != null && (typeof lyrics_excerpt !== 'string' || lyrics_excerpt.length > 5000)) return next(new AppError('Lyrics kesiti çok uzun.', 400));
  if (lyrics_start_time != null && (!Number.isFinite(Number(lyrics_start_time)) || Number(lyrics_start_time) < 0 || Number(lyrics_start_time) > 86400)) return next(new AppError('Lyrics başlangıç zamanı geçersiz.', 400));
  if (lyrics_end_time != null && (!Number.isFinite(Number(lyrics_end_time)) || Number(lyrics_end_time) < 0 || Number(lyrics_end_time) > 86400 || (lyrics_start_time != null && Number(lyrics_end_time) < Number(lyrics_start_time)))) return next(new AppError('Lyrics bitiş zamanı geçersiz.', 400));
  song_name = song_name.trim();
  song_artist = song_artist.trim();
  if (typeof comment_by_user === 'string') comment_by_user = comment_by_user.trim().slice(0, MAX_COMMENT_LENGTH);

  // Eğer istemci söz göndermediyse arka planda LRCLIB'e sorup otomatik doldur
  if (!lyrics && !time_synced_lyrics) {
    logger.detail(
      `SONGSHARE-LRCLIB`,
      `Lyrics missing, Fetching lyrics from LRCLIB for: ${song_name} - ${song_artist}`,
    );
    const lrcResult = await fetchLyricsFromLRCLIB(
      song_name,
      song_artist,
      album_name,
      duration,
    );
    if (lrcResult) {
      lyrics = lrcResult.plainLyrics || null;
      time_synced_lyrics = lrcResult.syncedLyrics || null;
    }
  }

  const query = `
    INSERT INTO song_suggestions (
      user_id, song_name, song_artist, spotify_uri, song_url,
      song_cover_url, song_artist_cover_url,
      song_artist_cover_url_backup, song_artist_genre,
      visibility, target_users, rating_by_user,
      comment_by_user, recommended_time_by_user,
      lyrics, time_synced_lyrics, post_type, lyrics_excerpt,
      lyrics_start_time, lyrics_end_time, lyrics_design, date_added
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,NOW()
    ) RETURNING *;
  `;

  const values = [
    userId, song_name, song_artist, spotify_uri || null, song_url || null,
    song_cover_url || null, song_artist_cover_url, song_artist_cover_url_backup,
    Array.isArray(song_artist_genre) ? song_artist_genre : (song_artist_genre ? [song_artist_genre] : null),
    visibility, Array.isArray(target_users) ? target_users : [],
    post_type === 'lyrics' ? null : (rating_by_user !== undefined ? rating_by_user : null),
    comment_by_user || null, recommended_time_by_user || null,
    lyrics || null, time_synced_lyrics ? JSON.stringify(time_synced_lyrics) : null,
    post_type === 'lyrics' ? 'lyrics' : 'music',
    post_type === 'lyrics' ? (lyrics_excerpt || null) : null,
    post_type === 'lyrics' ? (lyrics_start_time ?? null) : null,
    post_type === 'lyrics' ? (lyrics_end_time ?? null) : null,
    JSON.stringify(post_type === 'lyrics' && lyrics_design && typeof lyrics_design === 'object' ? lyrics_design : {})
  ];

  let result;

  try {
    result = await db.query(query, values);
  } catch (error) {
    console.error("SONGSHARE INSERT ERROR:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      column: error.column,
      table: error.table,
    });

    throw error;
  }

  logger.info(
    `SONGSHARE`,
    `New song shared by user ${song_name} - ${song_artist}`,
  );
  res.status(201).json({
    status: "success",
    message: "Şarkı başarıyla paylaşıldı.",
    data: result.rows[0],
  });
});

/** Kullanıcının kendi paylaşımını düzenlemesi. ID değişmez; yorum/puan ilişkileri korunur. */
export const updateSongShare = catchAsync(async (req, res, next) => {
  const userId = req.user?.id || req.user?._id;
  const { id } = req.params;
  if (!userId) return next(new AppError("Oturum gerekli.", 401));
  const {
    comment_by_user, visibility, target_users, rating_by_user,
    recommended_time_by_user, lyrics_excerpt, lyrics_start_time,
    lyrics_end_time, lyrics_design
  } = req.body || {};
  if (visibility !== undefined && !VALID_VISIBILITIES.has(visibility)) return next(new AppError('Geçersiz paylaşım görünürlüğü.', 400));
  if (target_users !== undefined && (!Array.isArray(target_users) || target_users.length > 100 || target_users.some((value) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value))))) return next(new AppError('Hedef kullanıcı listesi geçersiz.', 400));
  if (rating_by_user !== undefined && rating_by_user !== null && (!Number.isInteger(Number(rating_by_user)) || Number(rating_by_user) < 0 || Number(rating_by_user) > 100)) return next(new AppError('Puan 0 ile 100 arasında tam sayı olmalıdır.', 400));
  if (comment_by_user !== undefined && comment_by_user !== null && (typeof comment_by_user !== 'string' || comment_by_user.length > MAX_COMMENT_LENGTH)) return next(new AppError('Açıklama en fazla 2000 karakter olabilir.', 400));
  if (recommended_time_by_user !== undefined && recommended_time_by_user !== null && String(recommended_time_by_user).length > 10) return next(new AppError('Zaman etiketi çok uzun.', 400));
  if (lyrics_excerpt !== undefined && lyrics_excerpt !== null && (typeof lyrics_excerpt !== 'string' || lyrics_excerpt.length > 5000)) return next(new AppError('Lyrics kesiti çok uzun.', 400));
  if (lyrics_design !== undefined && (typeof lyrics_design !== 'object' || lyrics_design === null || Array.isArray(lyrics_design) || JSON.stringify(lyrics_design).length > 20000)) return next(new AppError('Lyrics tasarımı geçersiz.', 400));
  if (lyrics_start_time !== undefined && lyrics_start_time !== null && (!Number.isFinite(Number(lyrics_start_time)) || Number(lyrics_start_time) < 0 || Number(lyrics_start_time) > 86400)) return next(new AppError('Lyrics başlangıç zamanı geçersiz.', 400));
  if (lyrics_end_time !== undefined && lyrics_end_time !== null && (!Number.isFinite(Number(lyrics_end_time)) || Number(lyrics_end_time) < 0 || Number(lyrics_end_time) > 86400 || (lyrics_start_time != null && Number(lyrics_end_time) < Number(lyrics_start_time)))) return next(new AppError('Lyrics bitiş zamanı geçersiz.', 400));
  const result = await db.query(`
    UPDATE song_suggestions SET
      comment_by_user = COALESCE($1, comment_by_user),
      visibility = COALESCE($2::visibility_type, visibility),
      target_users = COALESCE($3::uuid[], target_users),
      rating_by_user = CASE WHEN post_type = 'lyrics' THEN NULL ELSE COALESCE($4::smallint, rating_by_user) END,
      recommended_time_by_user = COALESCE($5, recommended_time_by_user),
      lyrics_excerpt = CASE WHEN post_type = 'lyrics' THEN COALESCE($6, lyrics_excerpt) ELSE lyrics_excerpt END,
      lyrics_start_time = CASE WHEN post_type = 'lyrics' THEN COALESCE($7::numeric, lyrics_start_time) ELSE lyrics_start_time END,
      lyrics_end_time = CASE WHEN post_type = 'lyrics' THEN COALESCE($8::numeric, lyrics_end_time) ELSE lyrics_end_time END,
      lyrics_design = CASE WHEN post_type = 'lyrics' AND $9::jsonb IS NOT NULL THEN $9::jsonb ELSE lyrics_design END,
      date_edited = NOW()
    WHERE id = $10 AND user_id = $11
    RETURNING *`, [
      comment_by_user ?? null, visibility ?? null,
      Array.isArray(target_users) ? target_users : null,
      rating_by_user ?? null, recommended_time_by_user ?? null,
      lyrics_excerpt ?? null, lyrics_start_time ?? null, lyrics_end_time ?? null,
      lyrics_design && typeof lyrics_design === 'object' ? JSON.stringify(lyrics_design) : null,
      id, userId
    ]);
  if (!result.rowCount) return next(new AppError("Paylaşım bulunamadı veya sana ait değil.", 404));
  res.status(200).json({ status: "success", data: result.rows[0] });
});

/** Yalnızca paylaşım sahibi silebilir. */
export const deleteSongShare = catchAsync(async (req, res, next) => {
  const userId = req.user?.id || req.user?._id;
  if (!userId) return next(new AppError("Oturum gerekli.", 401));
  const result = await db.query(
    `DELETE FROM song_suggestions WHERE id = $1 AND user_id = $2 RETURNING id`,
    [req.params.id, userId]
  );
  if (!result.rowCount) return next(new AppError("Paylaşım bulunamadı veya sana ait değil.", 404));
  res.status(200).json({ status: "success", message: "Paylaşım silindi.", id: result.rows[0].id });
});

/**
 * 2. Feed Akışını Getir (Public test dostu)
 */
export const getFeed = catchAsync(async (req, res, next) => {
  const currentUserId = req.user?.id || req.user?._id;

  if (!currentUserId) {
    logger.error(
      `SONGSHARE`,
      "User ID not found in request for feed retrieval.",
    );
    return next(new AppError("Kullanıcı kimliği bulunamadı.", 401));
  }

  const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(30, Number.parseInt(req.query.limit, 10) || 10));
  const offset = (page - 1) * limit;

  const feedQuery = `
    SELECT
      s.*,
      (s.user_id = $1) AS is_owner,
      ($1::uuid = ANY(COALESCE(s.reposted_by, '{}'::uuid[]))) AS is_reposted_by_me,

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

      /* PUAN VEREN KULLANICILAR */
      COALESCE(voters.ratings, '[]'::json) AS ratings,

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

    LEFT JOIN LATERAL (
      SELECT json_agg(
        json_build_object(
          'user_id', sr.user_id,
          'username', COALESCE(ru.user_name, 'Kullanıcı'),
          'avatar', ru.profile_pic_path,
          'avatar_type', ru.avatar_type,
          'avatar_data', ru.avatar_data,
          'rating', sr.rating,
          'updated_at', sr.updated_at
        ) ORDER BY sr.updated_at DESC NULLS LAST
      ) AS ratings
      FROM song_ratings sr
      LEFT JOIN users ru ON ru.id = sr.user_id
      WHERE sr.song_share_id = s.id
    ) voters ON true

    /* COMMENTS */
    LEFT JOIN LATERAL (
      SELECT
        json_agg(
          json_build_object(
            'id', sc.id,
            'comment', sc.comment,
            'parent_comment_id', sc.parent_comment_id,
            'timestamp_seconds', sc.timestamp_seconds,
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

    ORDER BY s.date_added DESC, s.id DESC
    LIMIT $2 OFFSET $3;
  `;

  const result = await db.query(feedQuery, [currentUserId, limit, offset]);

  logger.detail(`SONGSHARE`, `Fetched feed for user ${currentUserId}`, {
    user_id: currentUserId,
  });
  const safeRows = result.rows.map((row) => {
    const { target_users, reposted_by, ...safeRow } = row;
    return safeRow;
  });
  res.status(200).json({
    status: "success",
    results: safeRows.length,
    page,
    limit,
    hasMore: safeRows.length === limit,
    data: safeRows,
  });
});

/**
 * 3. Repost İşlemi (Ekle / Çıkar)
 */
export const toggleRepost = catchAsync(async (req, res, next) => {
  const suggestionId = req.params.id;
  const userId = req.user?.id || req.user?._id;
  if (!userId) return next(new AppError('Oturum gerekli.', 401));

  const result = await db.query(`
    UPDATE song_suggestions
    SET
      reposted_by = CASE
        WHEN $2::uuid = ANY(COALESCE(reposted_by, '{}'::uuid[]))
          THEN array_remove(COALESCE(reposted_by, '{}'::uuid[]), $2::uuid)
        ELSE array_append(COALESCE(reposted_by, '{}'::uuid[]), $2::uuid)
      END,
      repost_count = GREATEST(0, COALESCE(repost_count, 0) + CASE
        WHEN $2::uuid = ANY(COALESCE(reposted_by, '{}'::uuid[])) THEN -1 ELSE 1 END)
    WHERE id = $1
      AND (user_id = $2 OR visibility = 'public' OR $2::uuid = ANY(COALESCE(target_users, '{}'::uuid[])))
    RETURNING repost_count, ($2::uuid = ANY(COALESCE(reposted_by, '{}'::uuid[]))) AS reposted
  `, [suggestionId, userId]);

  if (!result.rowCount) return next(new AppError('Paylaşım bulunamadı veya erişim iznin yok.', 404));
  return res.status(200).json({ status: 'success', reposted: result.rows[0].reposted, repostCount: result.rows[0].repost_count });
});

/**
 * 4. Puanlama İşlemi (0-100)
 */
export const rateSong = catchAsync(async (req, res, next) => {
  const { id: suggestionId } = req.params;
  const { rating } = req.body;

  const userId = req.user?.id || req.user?._id;

  if (!userId) {
    return next(new AppError("Oturum gerekli.", 401));
  }

  const numericRating = Number(rating);

  if (
    !Number.isInteger(numericRating) ||
    numericRating < 0 ||
    numericRating > 100
  ) {
    return next(
      new AppError("Geçersiz puan. 0 ile 100 arasında olmalıdır.", 400),
    );
  }

  /* Paylaşımı kontrol et */
  const shareResult = await db.query(
    `
      SELECT user_id, visibility, target_users
      FROM song_suggestions
      WHERE id = $1
    `,
    [suggestionId],
  );

  if (shareResult.rows.length === 0) {
    return next(new AppError("Paylaşım bulunamadı.", 404));
  }

  const ownerId = shareResult.rows[0].user_id;
  const visible = await findVisibleShare(suggestionId, userId);
  if (!visible) return next(new AppError('Paylaşım bulunamadı veya erişim iznin yok.', 404));

  /* Kendi paylaşımına topluluk puanı verme */
  if (String(ownerId) === String(userId)) {
    return next(
      new AppError("Kendi paylaşımına topluluk puanı veremezsin.", 400),
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
    [suggestionId, userId, numericRating],
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
    [suggestionId],
  );

  const stats = result.rows[0];
  const votersResult = await db.query(
    `SELECT sr.rating, sr.updated_at, u.user_name AS username
     FROM song_ratings sr
     LEFT JOIN users u ON u.id = sr.user_id
     WHERE sr.song_share_id = $1
     ORDER BY sr.updated_at DESC NULLS LAST`,
    [suggestionId],
  );

  res.status(200).json({
    status: "success",

    data: {
      rating: numericRating,
      average: stats.average ? Number(stats.average) : 0,
      count: Number(stats.count || 0),
      ratings: votersResult.rows,
    },
  });
});

/**
 * 5. Yorum Ekleme
 */
export const addComment = catchAsync(async (req, res, next) => {
  const { id: suggestionId } = req.params;
  const {
    comment,
    parent_comment_id = null,
    timestamp_seconds = null,
  } = req.body;

  const userId = req.user?.id || req.user?._id;

  if (!userId) {
    return next(new AppError("Oturum gerekli.", 401));
  }

  const cleanComment = String(comment || "").trim();

  if (!cleanComment) {
    return next(new AppError("Yorum içeriği boş olamaz.", 400));
  }
  if (cleanComment.length > MAX_COMMENT_LENGTH) return next(new AppError(`Yorum en fazla ${MAX_COMMENT_LENGTH} karakter olabilir.`, 400));

  const visibleShare = await findVisibleShare(suggestionId, userId);
  if (!visibleShare) return next(new AppError('Paylaşım bulunamadı veya erişim iznin yok.', 404));

  const shareResult = await db.query(
    `
      SELECT id
      FROM song_suggestions
      WHERE id = $1
    `,
    [suggestionId],
  );

  if (shareResult.rows.length === 0) {
    return next(new AppError("Paylaşım bulunamadı.", 404));
  }

  const parentCommentId = parent_comment_id || null;
  const timestampSeconds =
    timestamp_seconds === null ||
    timestamp_seconds === "" ||
    timestamp_seconds === undefined
      ? null
      : Number(timestamp_seconds);

  if (
    timestampSeconds !== null &&
    (!Number.isInteger(timestampSeconds) ||
      timestampSeconds < 0 ||
      timestampSeconds > 86400)
  ) {
    return next(
      new AppError("Şarkı zamanı 0 ile 86400 saniye arasında olmalıdır.", 400),
    );
  }

  if (parentCommentId) {
    const parentResult = await db.query(
      `SELECT id FROM song_comments WHERE id = $1 AND song_share_id = $2`,
      [parentCommentId, suggestionId],
    );
    if (parentResult.rows.length === 0) {
      return next(new AppError("Yanıtlanacak yorum bulunamadı.", 404));
    }
  }

  const result = await db.query(
    `
      INSERT INTO song_comments (
        song_share_id, user_id, comment, parent_comment_id, timestamp_seconds
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, comment, created_at, parent_comment_id, timestamp_seconds
    `,
    [suggestionId, userId, cleanComment, parentCommentId, timestampSeconds],
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
    [userId],
  );

  const user = userResult.rows[0];

  res.status(201).json({
    status: "success",

    data: {
      id: commentRow.id,
      comment: commentRow.comment,
      created_at: commentRow.created_at,
      parent_comment_id: commentRow.parent_comment_id,
      timestamp_seconds: commentRow.timestamp_seconds,

      user_id: userId,

      username: user?.user_name || "Kullanıcı",

      avatar: user?.profile_pic_path || null,

      avatar_type: user?.avatar_type || null,

      avatar_data: user?.avatar_data || null,
    },
  });
});

// ========================================================
// 6. MÜZİK ÖNERİLERİ
// GEÇİCİ - Daha sonra gerçek recommendation sistemi gelecek
// ========================================================

export const getRecommendationsDEMO = catchAsync(async (req, res, next) => {
  const recommendations = [
    {
      id: "rec-001",
      title: "Hot",
      artist: "Inna",
      coverUrl:
        "https://i.scdn.co/image/ab67616d00001e023d6413c7dc24318bdbd5b366",
      spotifyUrl: "https://open.spotify.com/track/5F4d5D9s0hM8f0gM6XvQeF",
    },

    {
      id: "rec-002",
      title: "Aklımda Biri Var",
      artist: "Artis",
      coverUrl:
        "https://i.scdn.co/image/ab67616d0000b273960635da26f6fbccbeb36b2d",
      spotifyUrl: "",
    },

    {
      id: "rec-003",
      title: "A Sky Full of Stars",
      artist: "Coldplay",
      coverUrl:
        "https://i.scdn.co/image/ab67616d00001e028ff7c3580d429c8212b9a3b6",
      spotifyUrl: "",
    },

    {
      id: "rec-004",
      title: "Self Aware",
      artist: "Alternative",
      coverUrl:
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSpAp5NlImEisne6bbOOYVnPRHVm5B1gT4YQfF1Vi5dDQ&s=10",
      spotifyUrl: "",
    },

    {
      id: "rec-005",
      title: "Maraton",
      artist: "Ati242",
      coverUrl:
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-eHQUhSqV86ZoY3Ak8pVP_XqzFIStg-GSaCOu9EwjQw&s",
      spotifyUrl: "",
    },

    {
      id: "rec-006",
      title: "Join Me",
      artist: "HIM",
      coverUrl:
        "https://i.scdn.co/image/ab67616d0000b273a8cfc41719dc2c2028e0aad5",
      spotifyUrl: "",
    },

    {
      id: "rec-007",
      title: "Denize Bıraksam",
      artist: "Turkish Rock",
      coverUrl:
        "https://i.scdn.co/image/ab67616d0000b2736054a3d4d3fadf0173dbdf07",
      spotifyUrl: "",
    },

    {
      id: "rec-008",
      title: "Bi Tik",
      artist: "Pop Mix",
      coverUrl:
        "https://i1.sndcdn.com/artworks-ixY9Sl5eXz1mPMyZ-Sq9u8Q-t500x500.jpg",
      spotifyUrl: "",
    },
  ];

  res.status(200).json({
    status: "success",
    results: recommendations.length,
    data: recommendations,
  });
});

export const getRecommendations = catchAsync(async (req, res, next) => {
  const limit = Math.max(1, Math.min(Number.parseInt(req.query.limit, 10) || 10, 10));
  const result = await getRandomRecommendations(limit);

  res.status(200).json({
    status: "success",
    results: result.tracks.length,
    data: result.tracks,
    meta: {
      source: "daily-chart-cache",
      cachedAt: result.fetchedAt,
      stale: result.stale,
      regions: ["TR", "US", "DE", "GB"],
    },
  });
});
