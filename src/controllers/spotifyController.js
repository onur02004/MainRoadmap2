import * as spotifyService from '../services/spotifyService.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import db from '../config/db.js'; // PostgreSQL db/pool bağlantın

/**
 * 1. Giriş URL'i üretir (Frontend fetch ile çağırır, authMiddleware protect doğrular)
 */
export const getLoginUrl = catchAsync(async (req, res, next) => {
  const userId = req.user?.id || req.user?._id;

  if (!userId) {
    return next(new AppError('Kullanıcı oturumu bulunamadı.', 401));
  }

  // userId'yi Spotify OAuth state parametresi olarak gönderiyoruz
  const authUrl = spotifyService.getAuthorizeURL(userId.toString());
  res.status(200).json({ status: 'success', url: authUrl });
});

/**
 * 2. Spotify Callback: Token'ları user_spotify_accounts tablosuna kaydeder
 */
export const callback = catchAsync(async (req, res, next) => {
  const { code, state: userId, error } = req.query;

  if (error) {
    return next(new AppError(`Spotify yetkilendirmesi reddedildi: ${error}`, 400));
  }

  if (!userId) {
    return next(new AppError('Geçersiz veya eksik state bilgisi.', 400));
  }

  const tokenData = await spotifyService.getTokensFromCode(code);

  if (tokenData.error) {
    return next(new AppError(tokenData.error_description || 'Token alınamadı', 400));
  }

  const { access_token, refresh_token, expires_in } = tokenData;
  const expiresAt = new Date(Date.now() + expires_in * 1000);

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
    access_token,
    refresh_token,
    expiresAt
  ]);

  // Giriş tamamlandıktan sonra sayfaya yönlendir
  res.redirect('/spotifyStatus.html?spotify=connected');
});

/**
 * Yardımcı: İlgili kullanıcının geçerli bir Access Token'ı olup olmadığını kontrol eder.
 * Süresi dolmuşsa refresh_token ile yenileyip DB'yi günceller.
 */
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

  let { access_token, refresh_token, expires_at } = result.rows[0];

  // Token'ın dolmasına 60 saniyeden az kaldıysa yenile
  const isExpired = new Date(expires_at).getTime() - Date.now() < 60 * 1000;

  if (isExpired && refresh_token) {
    const refreshed = await spotifyService.refreshAccessToken(refresh_token);

    if (refreshed.access_token) {
      access_token = refreshed.access_token;
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

      await db.query(
        `UPDATE user_spotify_accounts 
         SET access_token = $1, expires_at = $2, updated_at = NOW() 
         WHERE user_id = $3`,
        [access_token, newExpiresAt, userId]
      );
    } else {
      return null;
    }
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

  res.status(200).json({
    status: 'success',
    isPlaying: track.is_playing,
    title: track.item.name,
    artist: track.item.artists?.map(a => a.name).join(', '),
    album: track.item.album?.name,
    albumArt: track.item.album?.images?.[0]?.url,
    songUrl: track.item.external_urls?.spotify
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
 * Kullanıcının Spotify bağlantı durumunu döner
 */
export const getSpotifyStatus = catchAsync(async (req, res, next) => {
  const userId = req.user.id || req.user._id;

  const result = await db.query(
    `SELECT display_name, spotify_user_id, expires_at 
     FROM user_spotify_accounts 
     WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return res.status(200).json({ status: 'success', connected: false });
  }

  res.status(200).json({
    status: 'success',
    connected: true,
    account: {
      displayName: result.rows[0].display_name,
      spotifyUserId: result.rows[0].spotify_user_id
    }
  });
});

/**
 * Sistemdeki diğer kullanıcıların Spotify üzerinden anlık ne dinlediğini getirir
 */
export const getFriendsActivity = catchAsync(async (req, res, next) => {
  const currentUserId = req.user.id || req.user._id;

  // Spotify bağlamış olan diğer kullanıcıları çek (Kendisi hariç)
  const usersQuery = `
    SELECT u.id, u.user_name, u.profile_pic_path, s.display_name
    FROM users u
    INNER JOIN user_spotify_accounts s ON u.id = s.user_id
    WHERE u.id != $1
    LIMIT 10;
  `;
  const result = await db.query(usersQuery, [currentUserId]);
  const friends = result.rows;

  // Her arkadaş için anlık çalan şarkıyı paralel sorgula
  const activities = await Promise.all(
    friends.map(async (friend) => {
      try {
        const accessToken = await getValidAccessTokenForUser(friend.id);
        if (!accessToken) return null;

        const track = await spotifyService.getCurrentlyPlaying(accessToken);

        if (track && track.is_playing && track.item) {
          return {
            id: friend.id,
            username: friend.user_name || friend.display_name,
            avatar: friend.profile_pic_path || `https://api.dicebear.com/7.x/bottts/svg?seed=${friend.user_name}`,
            isPlaying: true,
            title: track.item.name,
            artist: track.item.artists?.map((a) => a.name).join(', '),
            albumArt: track.item.album?.images?.[0]?.url,
            songUrl: track.item.external_urls?.spotify
          };
        } else {
          return {
            id: friend.id,
            username: friend.user_name || friend.display_name,
            avatar: friend.profile_pic_path || `https://api.dicebear.com/7.x/bottts/svg?seed=${friend.user_name}`,
            isPlaying: false
          };
        }
      } catch (err) {
        return null;
      }
    })
  );

  // Null olmayanları filtrele
  const validActivities = activities.filter(Boolean);

  res.status(200).json({
    status: 'success',
    data: validActivities
  });
});


export const getActiveFriendsNowPlaying = catchAsync(async (req, res, next) => {
  const currentUserId = req.user?.id || req.user?._id;

  const usersQuery = `
    SELECT u.id, u.user_name, u.profile_pic_path, s.display_name
    FROM users u
    INNER JOIN user_spotify_accounts s ON u.id = s.user_id
    ${currentUserId ? 'WHERE u.id != $1' : ''}
    LIMIT 15;
  `;
  const result = await db.query(usersQuery, currentUserId ? [currentUserId] : []);
  const friends = result.rows;

  const activeActivities = (await Promise.all(
    friends.map(async (friend) => {
      try {
        const accessToken = await getValidAccessTokenForUser(friend.id);
        if (!accessToken) return null;

        const track = await spotifyService.getCurrentlyPlaying(accessToken);
        if (track && track.is_playing && track.item) {
          return {
            id: friend.id,
            username: friend.user_name || friend.display_name,
            avatar: friend.profile_pic_path,
            title: track.item.name,
            artist: track.item.artists?.map(a => a.name).join(', '),
            albumArt: track.item.album?.images?.[0]?.url || track.item.album?.images?.[1]?.url,
            songUrl: track.item.external_urls?.spotify
          };
        }
        return null;
      } catch (err) {
        return null;
      }
    })
  )).filter(Boolean);

  res.status(200).json({
    status: 'success',
    data: activeActivities
  });
});