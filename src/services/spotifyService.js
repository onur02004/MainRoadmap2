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
 * State parametresi ile giriş yapan kullanıcı ID'sini aktarıyoruz.
 */
export const getAuthorizeURL = (state = '') => {
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
    show_dialog: 'true',
    ...(state && { state })
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
 * Giriş yapan kullanıcının temel Spotify profil bilgilerini getirir.
 */
export const getUserProfile = async (accessToken) => {
  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!res.ok) return null;
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

  // Şarkı çalmıyorsa veya içerik yoksa 204 döner
  if (res.status === 204 || res.status >= 400) {
    return null;
  }

  return await res.json();
};

/**
 * Kullanıcının en çok dinlediği şarkıları çeker.
 */
export const getTopTracks = async (accessToken, timeRange = 'medium_term', limit = 10) => {
  const res = await fetch(`https://api.spotify.com/v1/me/top/tracks?limit=${limit}&time_range=${timeRange}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!res.ok) {
    return { items: [] };
  }

  return await res.json();
};

/**
 * Spotify veritabanında parça araması yapar.
 */
export const searchTracks = async (accessToken, query, limit = 5) => {
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`;
  
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!res.ok) {
    return { tracks: { items: [] } };
  }

  return await res.json();
};


/**
 * Sanatçı adına göre Spotify'dan en yüksek çözünürlüklü 2 fotoğrafı ve türleri çeker.
 */
export const getArtistDetailsByName = async (artistName) => {
  try {
    const appToken = await getAppAccessToken();
    if (!appToken) return null;

    // Şarkıdaki düetleri veya feat kısımlarını temizle (Örn: "Billy Idol, Steve Stevens" -> "Billy Idol")
    const cleanArtist = artistName.split(',')[0].split('feat.')[0].trim();

    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(cleanArtist)}&type=artist&limit=1`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${appToken}`
      }
    });

    if (!res.ok) return null;
    const data = await res.json();
    const artist = data.artists?.items?.[0];

    if (!artist) return null;

    const images = artist.images || [];

    return {
      artist_cover: images[0]?.url || null,        // 1. En yüksek kalite
      artist_cover_backup: images[1]?.url || null, // 2. Orta/Alternatif kalite
      genres: artist.genres || []
    };
  } catch (err) {
    console.error('[Spotify Artist Fetch Hatası]:', err.message);
    return null;
  }
};