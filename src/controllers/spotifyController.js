import * as spotifyService from '../services/spotifyService.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import db from '../config/db.js';
import crypto from 'node:crypto';
import { encryptSpotifyToken, decryptSpotifyToken } from '../utils/tokenEncryption.js';

/**
 * 1. Giriş URL'i üretir (Frontend fetch ile çağırır, authMiddleware protect doğrular)
 */
export const getLoginUrl = catchAsync(async (req, res, next) => {
  const userId = req.user?.id || req.user?._id;

  if (!userId) {
    return next(new AppError('Kullanıcı oturumu bulunamadı.', 401));
  }

  const state = crypto.randomBytes(32).toString('hex');
  res.cookie('spotify_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/api/spotify/callback'
  });
  const authUrl = spotifyService.getAuthorizeURL(state);
  res.status(200).json({ status: 'success', url: authUrl });
});

/**
 * 2. Spotify Callback: Token'ları user_spotify_accounts tablosuna kaydeder
 */
export const callback = catchAsync(async (req, res, next) => {
  const { code, state, error } = req.query;
  const userId = req.user?.id || req.user?._id;
  const expectedState = req.cookies?.spotify_oauth_state;
  res.clearCookie('spotify_oauth_state', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/spotify/callback' });

  if (error) return next(new AppError('Spotify yetkilendirmesi tamamlanmadı.', 400));
  if (!userId || typeof code !== 'string' || typeof state !== 'string' || !expectedState) {
    return next(new AppError('Geçersiz veya süresi dolmuş Spotify yetkilendirme isteği.', 400));
  }
  const supplied = Buffer.from(state);
  const expected = Buffer.from(expectedState);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return next(new AppError('Spotify OAuth state doğrulaması başarısız.', 400));
  }

  const tokenData = await spotifyService.getTokensFromCode(code);

  if (tokenData.error) {
    return next(new AppError(tokenData.error_description || 'Token alınamadı', 400));
  }

  const { access_token, refresh_token, expires_in } = tokenData;
  if (!access_token || !Number.isFinite(Number(expires_in))) return next(new AppError('Spotify token yanıtı geçersiz.', 502));
  const expiresAt = new Date(Date.now() + Number(expires_in) * 1000);
  const encryptedAccessToken = encryptSpotifyToken(access_token);
  const encryptedRefreshToken = encryptSpotifyToken(refresh_token);

  // Profil detaylarını al (opsiyonel)
  const profile = await spotifyService.getUserProfile(access_token);

  // user_spotify_accounts tablosuna UPSERT
  const upsertQuery = `
    INSERT INTO user_spotify_accounts 
      (user_id, spotify_user_id, display_name, email, access_token, refresh_token, expires_at, updated_at)
    VALUES 
      ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET
      spotify_user_id = EXCLUDED.spotify_user_id,
      display_name = EXCLUDED.display_name,
      email = EXCLUDED.email,
      access_token = EXCLUDED.access_token,
      refresh_token = COALESCE(EXCLUDED.refresh_token, user_spotify_accounts.refresh_token),
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW();
  `;

  await db.query(upsertQuery, [
    userId,
    profile?.id || null,
    profile?.display_name || null,
    profile?.email || null,
    encryptedAccessToken,
    encryptedRefreshToken,
    expiresAt
  ]);

  // Giriş tamamlandıktan sonra sayfaya yönlendir
  res.redirect('/spotifyStatus.html?spotify=connected');
});

/**
 * Yardımcı: İlgili kullanıcının geçerli bir Access Token'ı olup olmadığını kontrol eder.
 * Süresi dolmuşsa refresh_token ile yenileyip DB'yi günceller.
 */
const tokenRefreshInFlight = new Map();

const getValidAccessTokenForUser = async (userId) => {
  const result = await db.query(
    `SELECT access_token, refresh_token, expires_at 
     FROM user_spotify_accounts 
     WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  let { access_token: storedAccessToken, refresh_token: storedRefreshToken, expires_at } = result.rows[0];
  let access_token = decryptSpotifyToken(storedAccessToken);
  let refresh_token = decryptSpotifyToken(storedRefreshToken);

  // Token'ın dolmasına 60 saniyeden az kaldıysa yenile.
  const isExpired = !expires_at || new Date(expires_at).getTime() - Date.now() < 60 * 1000;
  if (isExpired) {
    if (!refresh_token) return null;
    const key = String(userId);
    if (tokenRefreshInFlight.has(key)) return tokenRefreshInFlight.get(key);

    const refreshPromise = (async () => {
      const refreshed = await spotifyService.refreshAccessToken(refresh_token);
      if (!refreshed?.access_token) return null;
      const nextRefreshToken = refreshed.refresh_token || refresh_token;
      const newExpiresAt = new Date(Date.now() + Number(refreshed.expires_in || 3600) * 1000);
      await db.query(
        `UPDATE user_spotify_accounts
         SET access_token = $1, refresh_token = COALESCE($2, refresh_token), expires_at = $3, updated_at = NOW()
         WHERE user_id = $4`,
        [encryptSpotifyToken(refreshed.access_token), refreshed.refresh_token ? encryptSpotifyToken(refreshed.refresh_token) : null, newExpiresAt, userId]
      );
      return refreshed.access_token;
    })();
    tokenRefreshInFlight.set(key, refreshPromise);
    try { return await refreshPromise; }
    finally { tokenRefreshInFlight.delete(key); }
  }

  return access_token;
};

/**
 * 3. O An Çalan Şarkı
 */
export const getNowPlaying = catchAsync(async (req, res, next) => {
  const userId = req.user.id || req.user._id;
  const accessToken = await getValidAccessTokenForUser(userId);

  if (!accessToken) {
    return next(new AppError('Spotify hesabı bağlı değil veya oturum yenilenemedi.', 401));
  }

  const track = await spotifyService.getCurrentlyPlaying(accessToken);

  if (!track || !track.item) {
    return res.status(200).json({ status: 'success', isPlaying: false, message: 'Şu an çalan bir şarkı yok.' });
  }

  if (track.is_playing) {
    await saveLastPlayedSong(userId, track);
  }

  res.status(200).json({
    status: 'success',
    isPlaying: track.is_playing,
    title: track.item.name,
    artist: track.item.artists?.map(a => a.name).join(', '),
    album: track.item.album?.name,
    albumArt: track.item.album?.images?.[0]?.url,
    songUrl: track.item.external_urls?.spotify,

    progress_ms: track.progress_ms || 0,
  duration_ms: track.item.duration_ms || 0
  });
});

/**
 * 4. En Çok Dinlenenler
 */
export const getTopTracks = catchAsync(async (req, res, next) => {
  const userId = req.user.id || req.user._id;
  const accessToken = await getValidAccessTokenForUser(userId);

  if (!accessToken) {
    return next(new AppError('Spotify hesabı bağlı değil veya oturum yenilenemedi.', 401));
  }

  const { time_range = 'medium_term', limit = 10 } = req.query;
  const data = await spotifyService.getTopTracks(accessToken, time_range, Number(limit));

  const formattedTracks = data.items?.map((item, index) => ({
    rank: index + 1,
    title: item.name,
    artist: item.artists.map(a => a.name).join(', '),
    albumArt: item.album.images?.[0]?.url,
    url: item.external_urls.spotify
  })) || [];

  res.status(200).json({ status: 'success', topTracks: formattedTracks });
});


/**
 * GET /api/spotify/status
 * Kullanıcının Spotify bağlantı durumunu kontrol eder.
 */
export const getSpotifyStatus = catchAsync(async (req, res, next) => {
  const userId = req.user.id || req.user._id;

  const result = await db.query(
    `SELECT display_name, spotify_user_id
     FROM user_spotify_accounts
     WHERE user_id = $1`,
    [userId]
  );

  // Kullanıcının Spotify hesabı hiç bağlanmamış.
  if (result.rows.length === 0) {
    return res.status(200).json({
      status: 'success',
      connected: false,
      usable: false,
      reconnectRequired: false,
      account: null
    });
  }

  const account = result.rows[0];
  let usable = false;

  // Token'ı backend tarafında kontrol et ve gerekiyorsa yenile.
  try {
    const accessToken = await getValidAccessTokenForUser(userId);
    usable = Boolean(accessToken);
  } catch (error) {
    // Token bilgilerini veya hata ayrıntılarını istemciye gönderme.
    usable = false;
  }

  return res.status(200).json({
    status: 'success',
    connected: true,
    usable,
    reconnectRequired: !usable,
    account: {
      displayName: account.display_name,
      spotifyUserId: account.spotify_user_id
    }
  });
});


/**
 * Return listening activity for people explicitly classified as personal
 * contacts by an administrator (friends/family). Do not expose every
 * Spotify-connected account and never return email addresses or OAuth data.
 *
 * Playback snapshots are cached per Spotify account so every viewer does not
 * trigger a separate Spotify request for the same person every 15 seconds.
 */
const FRIEND_PLAYBACK_CACHE_TTL_MS = 10_000;
const FRIEND_RECENT_CACHE_TTL_MS = 60_000;
const friendPlaybackCache = new Map();
const friendRecentCache = new Map();

const getCachedFriendRecentTrack = async (friendId, accessToken) => {
  const key = String(friendId);
  const cached = friendRecentCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.promise || cached.data || null;
  }

  const entry = { expiresAt: Date.now() + FRIEND_RECENT_CACHE_TTL_MS, promise: null, data: null };
  entry.promise = (async () => {
    try {
      const recent = await spotifyService.getRecentlyPlayedTrack(accessToken);
      const recentItem = recent?.items?.[0];
      if (!recentItem?.track) return null;

      const track = recentItem.track;
      const snapshot = {
        id: track.id || null,
        name: track.name || null,
        artist: track.artists?.map((artist) => artist.name).filter(Boolean).join(', ') || null,
        album: track.album?.name || null,
        cover: track.album?.images?.[0]?.url || null,
        url: track.external_urls?.spotify || null,
        playedAt: recentItem.played_at || null
      };
      await saveLastPlayedSong(key, { item: track }, recentItem.played_at);
      return snapshot;
    } catch (error) {
      return null;
    }
  })();

  friendRecentCache.set(key, entry);
  const data = await entry.promise;
  entry.data = data;
  entry.promise = null;
  entry.expiresAt = Date.now() + FRIEND_RECENT_CACHE_TTL_MS;
  if (friendRecentCache.size > 500) {
    const oldestKey = friendRecentCache.keys().next().value;
    if (oldestKey !== undefined && oldestKey !== key) friendRecentCache.delete(oldestKey);
  }
  return data;
};

const getCachedFriendPlayback = async (friendId) => {
  const key = String(friendId);
  const now = Date.now();
  const cached = friendPlaybackCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.promise || cached.data || null;
  }

  const entry = { expiresAt: now + FRIEND_PLAYBACK_CACHE_TTL_MS, promise: null, data: null };
  entry.promise = (async () => {
    try {
      const accessToken = await getValidAccessTokenForUser(key);
      if (!accessToken) return null;

      const track = await spotifyService.getCurrentlyPlaying(accessToken);
      if (track?.is_playing && track.item) {
        await saveLastPlayedSong(key, track);
        return {
          isPlaying: true,
          track: {
            id: track.item.id || null,
            title: track.item.name || null,
            artist: track.item.artists?.map((artist) => artist.name).filter(Boolean).join(', ') || null,
            album: track.item.album?.name || null,
            cover: track.item.album?.images?.[0]?.url || null,
            songUrl: track.item.external_urls?.spotify || null
          },
          lastSong: null
        };
      }

      // When they are not actively playing, use Spotify's recently-played
      // endpoint so the card shows a genuinely recent track, not only the
      // last track this server happened to observe while they were online.
      const lastSong = await getCachedFriendRecentTrack(key, accessToken);
      return { isPlaying: false, track: null, lastSong };
    } catch (error) {
      // A friend's Spotify token can expire or their account can be offline.
      // Keep their last saved track visible instead of failing the whole rail.
      return null;
    }
  })();

  friendPlaybackCache.set(key, entry);
  const data = await entry.promise;
  entry.data = data;
  entry.promise = null;
  entry.expiresAt = Date.now() + FRIEND_PLAYBACK_CACHE_TTL_MS;

  // Keep the in-memory cache bounded on long-running instances.
  if (friendPlaybackCache.size > 500) {
    const oldestKey = friendPlaybackCache.keys().next().value;
    if (oldestKey !== undefined && oldestKey !== key) friendPlaybackCache.delete(oldestKey);
  }

  return data;
};

export const getFriendsActivity = catchAsync(async (req, res) => {
  const currentUserId = req.user?.id || req.user?._id;
  if (!currentUserId) {
    return res.status(401).json({ status: 'error', message: 'Oturum gerekli.' });
  }

  // `relation` is the project's existing, admin-assigned user classification.
  // Only personal contacts are included; `normal` users are not discoverable
  // through this endpoint. Last-played history remains visible after unlinking
  // Spotify, because the account join is intentionally LEFT JOIN.
  const usersResult = await db.query(
    `SELECT
       u.id,
       u.user_name,
       u.profile_pic_path,
       u.avatar_type,
       u.avatar_data,
       u.last_song_id,
       u.last_song_name,
       u.last_song_artist,
       u.last_song_album,
       u.last_song_cover,
       u.last_song_url,
       u.last_song_played_at,
       s.user_id AS spotify_connected_user_id
     FROM users u
     LEFT JOIN user_spotify_accounts s ON s.user_id = u.id
     WHERE u.id <> $1
       AND LOWER(COALESCE(u.relation::text, 'normal')) = ANY($2::text[])
       AND (s.user_id IS NOT NULL OR u.last_song_id IS NOT NULL)
     ORDER BY u.last_song_played_at DESC NULLS LAST, u.user_name ASC
     LIMIT 30`,
    [currentUserId, ['friends', 'family']]
  );

  const activities = await Promise.all(usersResult.rows.map(async (friend) => {
    const playback = friend.spotify_connected_user_id
      ? await getCachedFriendPlayback(friend.id)
      : null;
    const liveTrack = playback?.track || null;
    const isPlaying = Boolean(playback?.isPlaying && liveTrack?.title);
    const lastSong = playback?.lastSong || {
      id: friend.last_song_id || null,
      name: friend.last_song_name || null,
      artist: friend.last_song_artist || null,
      album: friend.last_song_album || null,
      cover: friend.last_song_cover || null,
      url: friend.last_song_url || null,
      playedAt: friend.last_song_played_at || null
    };

    return {
      id: friend.id,
      username: friend.user_name || 'Arkadaş',
      avatar: friend.profile_pic_path || null,
      avatar_type: friend.avatar_type || 'builtin',
      avatar_data: friend.avatar_data || {},
      profile_pic_path: friend.profile_pic_path || null,
      isPlaying,
      title: isPlaying ? liveTrack.title : null,
      artist: isPlaying ? liveTrack.artist : null,
      albumArt: isPlaying ? liveTrack.cover : null,
      songUrl: isPlaying ? liveTrack.songUrl : null,
      lastSong
    };
  }));

  activities.sort((a, b) => {
    if (a.isPlaying !== b.isPlaying) return a.isPlaying ? -1 : 1;
    const aTime = Date.parse(a.lastSong.playedAt || '') || 0;
    const bTime = Date.parse(b.lastSong.playedAt || '') || 0;
    return bTime - aTime;
  });

  res.status(200).json({ status: 'success', data: activities });
});

export const getActiveFriendsNowPlaying = catchAsync(async (req, res) => {
  return res.status(200).json({ status: 'success', data: [], availability: 'friendship-graph-required' });
});


export const disconnectSpotify = catchAsync(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  await db.query('DELETE FROM user_spotify_accounts WHERE user_id = $1', [userId]);
  return res.status(200).json({ status: 'success', connected: false });
});

/**
 * Spotify Parça Arama Endpoint'i
 */

export const searchSpotifyTracks = catchAsync(async (req, res, next) => {
  const query = String(req.query.q || '').trim();
  if (query.length > 120) return next(new AppError('Arama metni çok uzun.', 400));

  if (!query) {
    return res.status(200).json({
      status: 'success',
      tracks: []
    });
  }

  const accessToken = await spotifyService.getAppAccessToken();

  if (!accessToken) {
    return next(
      new AppError('Spotify arama servisine şu anda ulaşılamıyor.', 503)
    );
  }

  const data = await spotifyService.searchTracks(
    accessToken,
    query,
    6
  );

  const formattedTracks = data.tracks?.items?.map(item => ({
    id: item.id,
    title: item.name,
    artist: item.artists.map(a => a.name).join(', '),
    album: item.album.name,
    coverUrl: item.album.images?.[0]?.url || '',
    spotifyUri: item.uri,
    externalUrl: item.external_urls.spotify
  })) || [];

  return res.status(200).json({
    status: 'success',
    tracks: formattedTracks
  });
});


/**
 * Sanatçı/grup fotoğraflarını Spotify'dan getirir.
 * GET /api/spotify/artist-images?name=Creed
 */
export const getArtistImages = catchAsync(async (req, res, next) => {
  const name = String(req.query.name || '').trim();
  if (name.length > 100) return next(new AppError('Sanatçı adı çok uzun.', 400));

  if (!name) {
    return next(
      new AppError('Sanatçı adı (name) parametresi zorunludur.', 400)
    );
  }

  const artistData =
    await spotifyService.getArtistDetailsByName(name);

  if (!artistData?.artist_cover) {
    return res.status(404).json({
      status: 'fail',
      message: `${name} için Spotify üzerinde fotoğraf bulunamadı.`,
      data: {
        artist: name,
        primaryImage: null,
        backupImage: null,
        genres: []
      }
    });
  }

  return res.status(200).json({
    status: 'success',
    data: {
      artist: name,
      primaryImage: artistData.artist_cover,
      backupImage: artistData.artist_cover_backup,
      genres: artistData.genres || []
    }
  });
});



/**
 * Sanatçı galerisi: sanatçı görselleri ve albüm/single kapakları.
 * GET /api/spotify/artist-gallery?name=Creed&limit=24
 */
export const getArtistGallery = catchAsync(async (req, res, next) => {
  const name = String(req.query.name || '').trim();
  if (name.length > 100) return next(new AppError('Sanatçı adı çok uzun.', 400));
  const parsedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(100, parsedLimit))
    : 50;

  if (!name) {
    return next(new AppError('Sanatçı adı (name) parametresi zorunludur.', 400));
  }

  const gallery = await spotifyService.getArtistGalleryByName(name, limit);

  if (!gallery) {
    return res.status(404).json({
      status: 'fail',
      message: `${name} için sanatçı veya albüm bilgisi bulunamadı.`,
      data: { artist: null, albums: [] }
    });
  }

  return res.status(200).json({
    status: 'success',
    data: gallery
  });
});

export const shareSong = catchAsync(async (req, res, next) => {
  const userId = req.user?.id || req.user?._id || req.body.userId || '11111111-1111-1111-1111-111111111111'; //[cite: 4]

  let {
    song_name,
    song_artist,
    album_name,
    duration,
    spotify_uri,
    song_url,
    song_cover_url,
    song_artist_cover_url,
    song_artist_cover_url_backup,
    song_artist_genre,
    visibility = 'public', //[cite: 4]
    target_users = [],
    rating_by_user,
    comment_by_user,
    recommended_time_by_user,
    lyrics,
    time_synced_lyrics
  } = req.body; //[cite: 4]

  if (!song_name || !song_artist) {
    return next(new AppError('Şarkı adı ve sanatçı bilgisi zorunludur.', 400)); //[cite: 4]
  }

  // 1. Sanatçı görselleri istemciden gelmediyse Spotify'dan otomatik çek
  if (!song_artist_cover_url) {
    const artistMeta = await spotifyService.getArtistDetailsByName(song_artist);
    if (artistMeta) {
      song_artist_cover_url = artistMeta.artist_cover;
      song_artist_cover_url_backup = artistMeta.artist_cover_backup;
      song_artist_genre = artistMeta.genres;
    }
  }

  // 2. LRCLIB'den şarkı sözü kontrolü[cite: 4]
  if (!lyrics && !time_synced_lyrics) {
    const lrcResult = await fetchLyricsFromLRCLIB(song_name, song_artist, album_name, duration); //[cite: 4]
    if (lrcResult) {
      lyrics = lrcResult.plainLyrics || null; //[cite: 4]
      time_synced_lyrics = lrcResult.syncedLyrics || null; //[cite: 4]
    }
  }

  const query = `
    INSERT INTO song_suggestions (
      user_id, song_name, song_artist, spotify_uri, song_url, 
      song_cover_url, song_artist_cover_url, song_artist_cover_url_backup, song_artist_genre,
      visibility, target_users, rating_by_user, 
      comment_by_user, recommended_time_by_user, lyrics, time_synced_lyrics, date_added
    ) VALUES (
      $1, $2, $3, $4, $5, 
      $6, $7, $8, $9, 
      $10, $11, $12, 
      $13, $14, $15, $16, NOW()
    )
    RETURNING *;
  `;

  const values = [
    userId,
    song_name,
    song_artist,
    spotify_uri || null, //[cite: 4]
    song_url || null, //[cite: 4]
    song_cover_url || null, //[cite: 4]
    song_artist_cover_url || null,
    song_artist_cover_url_backup || null,
    song_artist_genre || [],
    visibility, //[cite: 4]
    target_users, //[cite: 4]
    rating_by_user !== undefined ? rating_by_user : null, //[cite: 4]
    comment_by_user || null, //[cite: 4]
    recommended_time_by_user || null, //[cite: 4]
    lyrics || null, //[cite: 4]
    time_synced_lyrics ? JSON.stringify(time_synced_lyrics) : null //[cite: 4]
  ];

  const result = await db.query(query, values); //[cite: 4]

  res.status(201).json({
    status: 'success',
    message: 'Şarkı başarıyla paylaşıldı.', //[cite: 4]
    data: result.rows[0] //[cite: 4]
  });
});

const saveLastPlayedSong = async (userId, track, playedAt = null) => {
  if (!userId || !track?.item) return;

  const songId = track.item.id || null;
  const songName = track.item.name || null;
  const artist = track.item.artists?.map(a => a.name).join(', ') || null;
  const album = track.item.album?.name || null;
  const cover = track.item.album?.images?.[0]?.url || null;
  const songUrl = track.item.external_urls?.spotify || null;
  const validPlayedAt = playedAt && Number.isFinite(Date.parse(playedAt))
    ? new Date(playedAt)
    : null;

  await db.query(
    `
      UPDATE users
      SET
        last_song_id = $1,
        last_song_name = $2,
        last_song_artist = $3,
        last_song_album = $4,
        last_song_cover = $5,
        last_song_url = $6,
        last_song_played_at = CASE
          WHEN $7::timestamptz IS NOT NULL THEN $7::timestamptz
          WHEN last_song_id IS DISTINCT FROM $1 THEN NOW()
          ELSE last_song_played_at
        END
      WHERE id = $8
        AND (
          last_song_id IS DISTINCT FROM $1
          OR ($7::timestamptz IS NOT NULL AND last_song_played_at IS DISTINCT FROM $7::timestamptz)
        )
    `,
    [songId, songName, artist, album, cover, songUrl, validPlayedAt, userId]
  );
};
