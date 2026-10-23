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



/**
 * Sanatçı adına göre Spotify'dan sanatçı bilgilerini ve albüm/single kapaklarını getirir.
 * Uygulama token'ı kullanır; kullanıcı hesabı bağlantısı gerektirmez.
 */
export const getArtistGalleryByName = async (artistName, limit = 24) => {
  try {
    const cleanArtist = String(artistName || '')
      .split(/,| feat\.?| featuring /i)[0]
      .trim();

    if (!cleanArtist) return null;

    const appToken = await getAppAccessToken();
    if (!appToken) return null;

    const headers = { Authorization: `Bearer ${appToken}` };
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(cleanArtist)}&type=artist&limit=5`;
    const searchResponse = await fetch(searchUrl, { headers });

    if (!searchResponse.ok) {
      console.error('[Spotify Artist Gallery Search]', searchResponse.status);
      return null;
    }

    const searchData = await searchResponse.json();
    const artists = searchData.artists?.items || [];
    if (!artists.length) return null;

    const normalize = (value) => String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    const artist =
      artists.find((item) => normalize(item.name) === normalize(cleanArtist)) ||
      artists[0];

    const safeLimit = Math.max(1, Math.min(50, Number.parseInt(limit, 10) || 24));
    const albumsUrl = new URL(`https://api.spotify.com/v1/artists/${encodeURIComponent(artist.id)}/albums`);
    albumsUrl.searchParams.set('include_groups', 'album,single,compilation');
    albumsUrl.searchParams.set('market', 'US');
    albumsUrl.searchParams.set('limit', String(safeLimit));

    const albumsResponse = await fetch(albumsUrl, { headers });
    let albums = [];

    if (albumsResponse.ok) {
      const albumsData = await albumsResponse.json();
      const seen = new Set();

      albums = (albumsData.items || [])
        .filter((album) => {
          const key = album.id || `${album.name}-${album.release_date}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((album) => ({
          id: album.id,
          name: album.name,
          type: album.album_type || 'album',
          releaseDate: album.release_date || null,
          totalTracks: album.total_tracks ?? null,
          image: album.images?.[0]?.url || album.images?.[1]?.url || null,
          images: (album.images || []).map((image) => ({
            url: image.url,
            width: image.width || null,
            height: image.height || null
          })),
          spotifyUrl: album.external_urls?.spotify || null,
          artists: (album.artists || []).map((item) => ({
            id: item.id,
            name: item.name
          }))
        }));
    } else {
      console.warn('[Spotify Artist Gallery Albums]', albumsResponse.status);
    }

    return {
      artist: {
        id: artist.id,
        name: artist.name,
        genres: artist.genres || [],
        image: artist.images?.[0]?.url || artist.images?.[1]?.url || null,
        images: (artist.images || []).map((image) => ({
          url: image.url,
          width: image.width || null,
          height: image.height || null
        })),
        spotifyUrl: artist.external_urls?.spotify || null,
        followers: artist.followers?.total ?? null,
        popularity: artist.popularity ?? null
      },
      albums
    };
  } catch (error) {
    console.error('[Spotify Artist Gallery Error]', error.message);
    return null;
  }
};

export const getAppAccessToken = async () => {
  try {
    const response = await fetch(
      'https://accounts.spotify.com/api/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: getBasicAuthHeader()
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials'
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        '[Spotify App Token Hatası]',
        response.status,
        errorText
      );
      return null;
    }

    const data = await response.json();
    return data.access_token || null;
  } catch (error) {
    console.error('[Spotify App Token Hatası]', error);
    return null;
  }
};
