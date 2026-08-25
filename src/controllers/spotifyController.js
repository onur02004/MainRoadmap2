import * as spotifyService from '../services/spotifyService.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';

// Geçici test için memory'de tutulabilir (veya req.user üzerinden DB'ye bağlanabilir)
let tempAccessToken = '';
let tempRefreshToken = '';

export const login = (req, res) => {
  const authUrl = spotifyService.getAuthorizeURL();
  res.redirect(authUrl);
};

export const callback = catchAsync(async (req, res, next) => {
  const { code, error } = req.query;

  if (error) {
    return next(new AppError(`Spotify yetkilendirme reddedildi: ${error}`, 400));
  }

  const tokenData = await spotifyService.getTokensFromCode(code);

  if (tokenData.error) {
    return next(new AppError(tokenData.error_description || 'Token alinamadi', 400));
  }

  tempAccessToken = tokenData.access_token;
  tempRefreshToken = tokenData.refresh_token;

  res.send('<h2>Spotify baglantisi basarili!</h2><p>Artik /api/spotify/now-playing veya /api/spotify/top-tracks adreslerini test edebilirsiniz.</p>');
});

export const getNowPlaying = catchAsync(async (req, res, next) => {
  if (!tempAccessToken) {
    return next(new AppError('Once Spotify ile giris yapmalisiniz (/api/spotify/login)', 401));
  }

  let track = await spotifyService.getCurrentlyPlaying(tempAccessToken);

  // Token suresi dolmussa yenilemeyi dene
  if (!track && tempRefreshToken) {
    const refreshed = await spotifyService.refreshAccessToken(tempRefreshToken);
    if (refreshed.access_token) {
      tempAccessToken = refreshed.access_token;
      track = await spotifyService.getCurrentlyPlaying(tempAccessToken);
    }
  }

  if (!track) {
    return res.json({ isPlaying: false, message: 'Su an bir sarki calmiyor.' });
  }

  res.json({
    isPlaying: track.is_playing,
    title: track.item?.name,
    artist: track.item?.artists?.map(a => a.name).join(', '),
    album: track.item?.album?.name,
    albumArt: track.item?.album?.images[0]?.url,
    songUrl: track.item?.external_urls?.spotify
  });
});

export const getTopTracks = catchAsync(async (req, res, next) => {
  if (!tempAccessToken) {
    return next(new AppError('Once Spotify ile giris yapmalisiniz (/api/spotify/login)', 401));
  }

  const data = await spotifyService.getTopTracks(tempAccessToken);
  const formattedTracks = data.items?.map((item, index) => ({
    rank: index + 1,
    title: item.name,
    artist: item.artists.map(a => a.name).join(', '),
    albumArt: item.album.images[0]?.url,
    url: item.external_urls.spotify
  }));

  res.json({ topTracks: formattedTracks });
});