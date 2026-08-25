// Çevre değişkenlerini fonksiyonların içine alarak 
// dotenv yüklenmeden önce 'undefined' kalmasını engelliyoruz.
const getClientCredentials = () => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error('⚠️ SPOTIFY UYARISI: .env dosyasındaki Spotify değişkenleri eksik veya okunamadı!');
  }

  return { clientId, clientSecret, redirectUri };
};

const getBasicAuthHeader = () => {
  const { clientId, clientSecret } = getClientCredentials();
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
};

/**
 * Kullanıcıyı yönlendireceğimiz Spotify OAuth URL'ini üretir.
 */
export const getAuthorizeURL = () => {
  const { clientId, redirectUri } = getClientCredentials();

  const scopes = [
    'user-read-currently-playing',
    'user-read-playback-state',
    'user-top-read',
    'user-read-private',
    'user-read-email'
  ].join(' ');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    show_dialog: 'true'
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
};

/**
 * Spotify'dan dönen authorization code ile access & refresh token alır.
 */
export const getTokensFromCode = async (code) => {
  const { redirectUri } = getClientCredentials();

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': getBasicAuthHeader()
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    })
  });

  return await res.json();
};

/**
 * Süresi dolan access token'ı refresh token kullanarak yeniler.
 */
export const refreshAccessToken = async (refreshToken) => {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': getBasicAuthHeader()
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });

  return await res.json();
};

/**
 * O an çalan şarkı bilgisini çeker.
 */
export const getCurrentlyPlaying = async (accessToken) => {
  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  // Şarkı çalmıyorsa Spotify 204 No Content döner
  if (res.status === 204 || res.status > 400) {
    return null;
  }

  return await res.json();
};

/**
 * Kullanıcının en çok dinlediği şarkıları çeker.
 * @param {string} timeRange - 'short_term' (4 hafta), 'medium_term' (6 ay), 'long_term' (tüm zamanlar)
 * @param {number} limit - Kaç adet şarkı getirileceği (max: 50)
 */
export const getTopTracks = async (accessToken, timeRange = 'medium_term', limit = 10) => {
  const res = await fetch(`https://api.spotify.com/v1/me/top/tracks?limit=${limit}&time_range=${timeRange}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  return await res.json();
};