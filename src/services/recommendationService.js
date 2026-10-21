import db from '../config/db.js';
import { getAppAccessToken } from './spotifyService.js';

const CACHE_ID = 1;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CHART_COUNTRIES = [
  { code: 'tr', label: 'Turkey', weight: 0.45, market: 'TR' },
  { code: 'us', label: 'United States', weight: 0.15, market: 'US' },
  { code: 'de', label: 'Germany', weight: 0.15, market: 'DE' },
  { code: 'gb', label: 'Global / UK', weight: 0.25, market: 'GB' }
];
const TRACKS_PER_COUNTRY = 15;
const MAX_CACHED_TRACKS = 60;

// Last-resort recommendations: no chart/API/DB cache is required to display these.
// spotifyUrl intentionally opens Spotify search instead of pretending to have a track ID.
const BUILT_IN_FALLBACK = [
  ['Get Lucky', 'Daft Punk', 'Random Access Memories', 'GB'],
  ['Firework', 'Katy Perry', 'Teenage Dream', 'US'],
  ['Roar', 'Katy Perry', 'PRISM', 'US'],
  ['Bad Romance', 'Lady Gaga', 'The Fame Monster', 'US'],
  ['Billie Jean', 'Michael Jackson', 'Thriller', 'US'],
  ["Don't Stop Me Now", 'Queen', 'Jazz', 'GB'],
  ['Dancing Queen', 'ABBA', 'Arrival', 'GB'],
  ['Viva La Vida', 'Coldplay', 'Viva la Vida or Death and All His Friends', 'GB'],
  ['Wake Me Up', 'Avicii', 'True', 'DE'],
  ['Blinding Lights', 'The Weeknd', 'After Hours', 'US'],
  ['Shape of You', 'Ed Sheeran', '÷', 'GB'],
  ['Rolling in the Deep', 'Adele', '21', 'GB'],
  ['Shake It Off', 'Taylor Swift', '1989', 'US'],
  ['Take On Me', 'a-ha', 'Hunting High and Low', 'GB'],
  ['Smells Like Teen Spirit', 'Nirvana', 'Nevermind', 'US'],
  ['Toxic', 'Britney Spears', 'In the Zone', 'US'],
  ['Careless Whisper', 'George Michael', 'Make It Big', 'GB'],
  ['Şımarık', 'Tarkan', 'Ölürüm Sana', 'TR'],
  ['Gülpembe', 'Barış Manço', 'Sözüm Meclisten Dışarı', 'TR'],
  ['Ele Güne Karşı', 'MFÖ', 'Ele Güne Karşı Yapayalnız', 'TR'],
  ['Senden Daha Güzel', 'Duman', 'Belki Alışman Lazım', 'TR'],
  ['Gülümse', 'Sezen Aksu', 'Gülümse', 'TR'],
  ['Everyway That I Can', 'Sertab Erener', 'No Boundaries', 'TR'],
  ['Aşkın Olayım', 'Simge', 'Ben Bazen', 'TR']
].map(([title, artist, album, region], index) => ({
  id: `fallback-${index + 1}`,
  title,
  artist,
  album,
  coverUrl: null,
  appleUrl: null,
  spotifyUri: null,
  spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist}`)}`,
  region,
  regionLabel: ({ TR: 'Turkey', US: 'United States', DE: 'Germany', GB: 'International classics' })[region],
  chartRank: null,
  source: 'SongShare built-in fallback',
  popularity: null,
  durationMs: null,
  releaseDate: null
}));

let refreshPromise = null;
let refreshTimer = null;

const clean = (value = '') => String(value)
  .replace(/[ıİ]/g, 'i')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const trackKey = (track) => `${clean(track.title)}::${clean(track.artist)}`;

async function fetchAppleChart(countryCode) {
  // Apple Music RSS path order is: /{storefront}/music/most-played/{limit}/songs.json
  const path = `/api/v2/${countryCode}/music/most-played/50/songs.json`;
  const hosts = ['rss.applemarketingtools.com', 'rss.marketingtools.apple.com'];
  let json = null;
  let lastError = null;

  for (const host of hosts) {
    try {
      const response = await fetch(`https://${host}${path}`, {
        headers: { 'User-Agent': 'SongShare/1.0 (music discovery)' },
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) {
        lastError = new Error(`Apple chart (${countryCode}) returned ${response.status} from ${host}`);
        // Try the alternate Apple RSS hostname on server errors or missing routes.
        continue;
      }
      json = await response.json();
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!json) throw lastError || new Error(`Apple chart (${countryCode}) request failed`);
  return (json.feed?.results || []).slice(0, TRACKS_PER_COUNTRY).map((item, index) => ({
    title: item.name,
    artist: item.artistName,
    album: item.collectionName || null,
    coverUrl: item.artworkUrl100 || null,
    appleUrl: item.url || null,
    releaseDate: item.releaseDate || null,
    region: countryCode.toUpperCase(),
    regionLabel: CHART_COUNTRIES.find((country) => country.code === countryCode)?.label || countryCode,
    chartRank: index + 1,
    source: 'Apple Music Charts'
  }));
}

async function mapLimit(items, limit, mapper) {
  const output = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      try {
        output[index] = await mapper(items[index], index);
      } catch (error) {
        output[index] = null;
        console.warn('[SongShare recommendations] Track mapping failed:', error.message);
      }
    }
  });
  await Promise.all(workers);
  return output;
}

async function findSpotifyTrack(track, appToken) {
  const query = `track:"${track.title}" artist:"${track.artist}"`;
  const url = new URL('https://api.spotify.com/v1/search');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'track');
  url.searchParams.set('limit', '5');
  url.searchParams.set('market', track.region || 'TR');

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${appToken}` },
    signal: AbortSignal.timeout(12000)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Spotify search returned ${response.status}: ${body.slice(0, 160)}`);
  }

  const json = await response.json();
  const candidates = json.tracks?.items || [];
  if (!candidates.length) return null;

  const wantedTitle = clean(track.title);
  const wantedArtist = clean(track.artist);
  const ranked = candidates.map((candidate) => {
    const title = clean(candidate.name);
    const artists = (candidate.artists || []).map((artist) => clean(artist.name));
    let score = 0;
    if (title === wantedTitle) score += 5;
    else if (title.includes(wantedTitle) || wantedTitle.includes(title)) score += 2;
    if (artists.some((artist) => artist === wantedArtist)) score += 5;
    else if (artists.some((artist) => artist.includes(wantedArtist) || wantedArtist.includes(artist))) score += 2;
    score += (candidate.popularity || 0) / 100;
    return { candidate, score };
  }).sort((a, b) => b.score - a.score);

  // Avoid attaching an unrelated Spotify result to a chart entry.
  if (ranked[0].score < 4) return null;
  const item = ranked[0].candidate;
  return {
    ...track,
    id: item.id,
    spotifyUri: item.uri,
    spotifyUrl: item.external_urls?.spotify || `https://open.spotify.com/track/${item.id}`,
    title: item.name,
    artist: item.artists?.map((artist) => artist.name).join(', ') || track.artist,
    album: item.album?.name || track.album,
    coverUrl: item.album?.images?.[0]?.url || track.coverUrl,
    popularity: item.popularity ?? null,
    durationMs: item.duration_ms ?? null,
    source: 'Apple Music Charts + Spotify catalog'
  };
}

async function collectChartPool() {
  const chartResults = await Promise.allSettled(
    CHART_COUNTRIES.map((country) => fetchAppleChart(country.code))
  );

  const chartTracks = chartResults.flatMap((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    console.warn(`[SongShare recommendations] ${CHART_COUNTRIES[index].label} chart failed:`, result.reason?.message);
    return [];
  });

  if (!chartTracks.length) {
    throw new Error('All chart sources failed; keeping the previous recommendation cache.');
  }

  const deduped = [...new Map(chartTracks.map((track) => [trackKey(track), track])).values()];
  const appToken = await getAppAccessToken();
  if (!appToken) throw new Error('Spotify app access token could not be obtained.');

  // 4 concurrent Spotify searches to avoid sending a burst of requests.
  const mapped = await mapLimit(deduped, 4, async (track) => findSpotifyTrack(track, appToken));
  const spotifyTracks = mapped.filter(Boolean);

  if (spotifyTracks.length < 10) {
    throw new Error(`Only ${spotifyTracks.length} chart tracks could be matched to Spotify; keeping the previous cache.`);
  }

  // Keep a varied pool: Turkey is dominant, with US, Germany and UK/global representation.
  const ordered = [];
  const quotas = [
    { region: 'TR', count: 27 },
    { region: 'US', count: 9 },
    { region: 'DE', count: 9 },
    { region: 'GB', count: 15 }
  ];
  for (const quota of quotas) {
    ordered.push(...spotifyTracks.filter((track) => track.region === quota.region).slice(0, quota.count));
  }
  // If a region failed, fill the remaining pool with any other matched chart entries.
  const included = new Set(ordered.map((track) => track.id));
  ordered.push(...spotifyTracks.filter((track) => !included.has(track.id)));

  return [...new Map(ordered.map((track) => [track.id, track])).values()].slice(0, MAX_CACHED_TRACKS);
}

export async function ensureRecommendationCacheTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS song_recommendation_cache (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_error TEXT
    );
  `);
}

export async function refreshRecommendationCache() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    await ensureRecommendationCacheTable();
    const tracks = await collectChartPool();
    await db.query(`
      INSERT INTO song_recommendation_cache (id, tracks, fetched_at, last_error)
      VALUES ($1, $2::jsonb, NOW(), NULL)
      ON CONFLICT (id) DO UPDATE
      SET tracks = EXCLUDED.tracks,
          fetched_at = EXCLUDED.fetched_at,
          last_error = NULL;
    `, [CACHE_ID, JSON.stringify(tracks)]);
    console.info(`[SongShare recommendations] Cache refreshed: ${tracks.length} tracks.`);
    return tracks;
  })().catch(async (error) => {
    console.error('[SongShare recommendations] Cache refresh failed:', error.message);
    await ensureRecommendationCacheTable().catch(() => {});
    await db.query(
      "INSERT INTO song_recommendation_cache (id, tracks, fetched_at, last_error) VALUES ($1, $2::jsonb, NOW() - INTERVAL '25 hours', $3) ON CONFLICT (id) DO UPDATE SET last_error = EXCLUDED.last_error",
      [CACHE_ID, JSON.stringify([]), error.message]
    ).catch(() => {});
    throw error;
  }).finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function getRandomRecommendations(limit = 10) {
  await ensureRecommendationCacheTable();
  let result = await db.query('SELECT tracks, fetched_at, last_error FROM song_recommendation_cache WHERE id = $1', [CACHE_ID]);
  let cache = result.rows[0];
  const isStale = !cache || !cache.fetched_at || Date.now() - new Date(cache.fetched_at).getTime() >= CACHE_TTL_MS;

  if (isStale) {
    try {
      await refreshRecommendationCache();
      result = await db.query('SELECT tracks, fetched_at, last_error FROM song_recommendation_cache WHERE id = $1', [CACHE_ID]);
      cache = result.rows[0];
    } catch (error) {
      // Keep serving the previous cache when available; otherwise the built-in
      // classics below provide a last-resort response instead of failing the endpoint.
      console.warn('[SongShare recommendations] Serving fallback/previous cache after refresh failure.');
    }
  }

  const cachedTracks = Array.isArray(cache?.tracks) ? cache.tracks : [];
  const usingFallback = cachedTracks.length === 0;
  const tracks = usingFallback ? BUILT_IN_FALLBACK : cachedTracks;
  const shuffled = [...tracks];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return {
    tracks: shuffled.slice(0, Math.max(1, Math.min(Number(limit) || 10, 10))),
    fetchedAt: cache?.fetched_at || null,
    stale: usingFallback || !cache?.fetched_at || Date.now() - new Date(cache.fetched_at).getTime() >= CACHE_TTL_MS,
    lastError: cache?.last_error || null,
    fallback: usingFallback
  };
}

// Call once from the server entry point. Refreshes immediately, then every 24 hours.
export function startDailyRecommendationRefresh() {
  if (refreshTimer) return;

  const run = async () => {
    try {
      await ensureRecommendationCacheTable();
      const result = await db.query('SELECT fetched_at FROM song_recommendation_cache WHERE id = $1', [CACHE_ID]);
      const fetchedAt = result.rows[0]?.fetched_at;
      const stale = !fetchedAt || Date.now() - new Date(fetchedAt).getTime() >= CACHE_TTL_MS;
      if (stale) await refreshRecommendationCache();
    } catch (error) {
      console.error('[SongShare recommendations] Scheduled refresh failed:', error.message);
    }
  };

  void run();
  refreshTimer = setInterval(run, CACHE_TTL_MS);
  refreshTimer.unref?.();
}
