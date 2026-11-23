import { getCurrentUser, renderAvatar } from '/avatarRenderer.js';

// Small, non-blocking toast notifications shared by SongShare modules.
window.showSongShareToast = function(message, type = 'info', duration = 4200) {
  const region = document.getElementById('songShareToastRegion');
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = `songshare-toast is-${type}`;
  const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info';
  const symbol = document.createElement('i');
  symbol.className = `fa-solid ${icon}`;
  const text = document.createElement('span');
  text.textContent = String(message || 'İşlem tamamlanamadı.');
  const close = document.createElement('button');
  close.type = 'button'; close.setAttribute('aria-label', 'Bildirimi kapat'); close.textContent = '×';
  close.addEventListener('click', () => toast.remove());
  toast.append(symbol, text, close); region.appendChild(toast);
  window.setTimeout(() => toast.remove(), duration);
};


// Geçici geliştirme bildirimi: modal/alert kullanmadan kısa süre gösterilir.
let developmentNoticeTimer = null;
window.showDevelopmentNotice = function (event) {
  if (event) { event.preventDefault(); event.stopPropagation(); }
  let toast = document.getElementById('songShareDevToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'songShareDevToast';
    toast.className = 'songshare-dev-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.textContent = 'Bu özellik şu anda geliştirme aşamasında.';
  toast.classList.add('is-visible');
  clearTimeout(developmentNoticeTimer);
  developmentNoticeTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
};

async function initSongShareCurrentUser() {
  const user = await getCurrentUser();

  if (!user) return;

  // Kullanıcı adını göster
  const nameEl = document.getElementById('songShareUsername');

  if (nameEl) {
    nameEl.textContent = user.user_name || 'User';
  }

  // Gerçek kullanıcının avatarını yükle
  const avatarEl = document.getElementById('songShareUserAvatar');

  if (avatarEl) {
    renderAvatar(
      avatarEl,
      user,
      {
        size: 42
      }
    );
  }

  // Kullanıcı kartına tıklayınca Account sayfasına git
  const card = document.getElementById('songShareUserCard');

  card?.addEventListener('click', () => {
    window.location.href = '/account';
  });
}

document.addEventListener('DOMContentLoaded', initSongShareCurrentUser);

// --- GLOBAL FETCH INTERCEPTOR (JWT SÜRESİ KONTROLÜ) ---


const originalFetch = window.fetch;

window.fetch = async function (...args) {
  const response = await originalFetch.apply(this, args);
  const requestUrl = args[0] instanceof Request
    ? args[0].url
    : String(args[0]);

  // Yalnızca API isteklerinin 401 cevabını değerlendir.
  if (
    response.status === 401 &&
    new URL(requestUrl, window.location.origin).origin === window.location.origin &&
    requestUrl.includes('/api/')
  ) {
    console.warn('API 401 döndürdü:', requestUrl);

    // Response body'yi okuyarak gerçek sebebi incele.
    // Şimdilik token'ı otomatik silme.
  }

  return response;
};

// ----------------------------------------------------

let ytPlayer;
let isYTReady = false;
let syncedLyrics = [];
let lyricsTimer;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function formatLastPlayedTime(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return 'Az önce';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} dk önce`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} saat önce`;
  }

  if (diffHours < 48) {
    return 'Dün';
  }

  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatSecondsSimple(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

// ----------------------------------------------------
// LYRICS PANELİ + SPOTIFY PLAYBACK SENKRONİZASYONU
// Spotify API yalnızca merkezi now-playing poll'unda (5 sn) çağrılır.
// Lyrics satırlarının görsel güncellemesi ise yerel timer ile yapılır.
// ----------------------------------------------------

let currentLyricsFetchId = 0;
let currentLyricsTrackKey = '';
let currentLyricsLoaded = false;
let currentLyricsLoading = false;
let currentLyricsLoadPromise = null;
let lastActiveLyricsIndex = -1;
let lyricsPlaybackTimer = null;
let nowPlayingRequestInFlight = false;
let lastForcedNowPlayingRefreshAt = 0;
let nowPlayingPollTimer = null;
let spotifyConnectionUsable = false;

const NOW_PLAYING_POLL_INTERVAL_MS = 5000;
const LYRICS_UI_TICK_INTERVAL_MS = 250;

function extractSpotifyTrackId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const uriMatch = raw.match(/spotify:track:([A-Za-z0-9]+)/i);
  if (uriMatch) return uriMatch[1];

  const urlMatch = raw.match(/open\.spotify\.com\/(?:embed\/)?track\/([A-Za-z0-9]+)/i);
  if (urlMatch) return urlMatch[1];

  return /^[A-Za-z0-9]{10,}$/.test(raw) ? raw : '';
}

function getLyricsTrackKey(track) {
  if (!track) return '';
  const spotifyId = extractSpotifyTrackId(track.uri || track.spotifyUri || track.songUrl);
  if (spotifyId) return `spotify:${spotifyId}`;
  return `${track.artist || ''}::${track.name || ''}`.trim().toLocaleLowerCase();
}

function isShareViewActive() {
  const shareView = document.getElementById('view-share');
  return !shareView || shareView.classList.contains('active');
}

function setLyricsSyncStatus(message, state = 'idle') {
  const status = document.getElementById('dockLyricsSyncStatus');
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function getEstimatedSpotifyPosition() {
  const track = window.currentSelectedTrack;
  if (!track) return 0;

  let position = Math.max(0, Number(track.playbackPositionSec) || 0);

  // Son Spotify ölçümünden bu yana geçen süreyi yalnızca aynı parça çalıyorsa ekle.
  if (track.syncWithSpotify && track.isPlaying && track.playbackCapturedAt) {
    position += Math.max(0, Date.now() - track.playbackCapturedAt) / 1000;
  }

  if (track.duration_ms > 0) {
    position = Math.min(position, track.duration_ms / 1000);
  }

  return position;
}

function updateActiveLyricByTime(position) {
  const scrollBody = document.getElementById('dockLyricsScrollBody');
  if (!scrollBody) return;

  const lines = Array.from(scrollBody.querySelectorAll('.lyrics-dock-line'));
  if (!lines.length) return;

  const track = window.currentSelectedTrack;
  const hasSyncedLyrics = track?.hasSyncedLyrics ??
    lines.some(line => Number(line.dataset.time || 0) > 0);

  if (!hasSyncedLyrics) return;

  let activeIndex = 0;
  const currentPosition = Math.max(0, Number(position) || 0);

  for (let i = 0; i < lines.length; i++) {
    const lineTime = Number(lines[i].dataset.time || 0);
    if (lineTime <= currentPosition) activeIndex = i;
    else break;
  }

  if (activeIndex === lastActiveLyricsIndex) return;

  const activeLine = lines[activeIndex];
  if (!activeLine) return;

  lines.forEach((line, index) => {
    const isActive = index === activeIndex;
    line.classList.toggle('active', isActive);
    line.classList.toggle('is-past', index < activeIndex);
    line.classList.toggle('is-upcoming', index > activeIndex);
    if (isActive) line.setAttribute('aria-current', 'true');
    else line.removeAttribute('aria-current');
  });

  lastActiveLyricsIndex = activeIndex;

  // Lyrics kesiti tasarlanırken kullanıcı satır seçiyor; otomatik kaydırma
  // seçim odağını bozmasın. Yalnızca normal lyrics görünümünde takip et.
  if (!lyricShareMode && isShareViewActive() && document.visibilityState !== 'hidden') {
    activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function stopLyricsPlaybackSync() {
  if (lyricsPlaybackTimer) {
    clearInterval(lyricsPlaybackTimer);
    lyricsPlaybackTimer = null;
  }
}

function startLyricsPlaybackSync() {
  stopLyricsPlaybackSync();

  const track = window.currentSelectedTrack;
  if (!track?.hasSyncedLyrics) return;

  // Bu timer API isteği atmaz; son Spotify pozisyonundan yerel tahmin yapar.
  lyricsPlaybackTimer = setInterval(() => {
    if (document.visibilityState === 'hidden') return;
    updateActiveLyricByTime(getEstimatedSpotifyPosition());
  }, LYRICS_UI_TICK_INTERVAL_MS);

  if (track.syncWithSpotify) {
    setLyricsSyncStatus(
      track.isPlaying ? 'Canlı senkronize' : 'Duraklatıldı',
      track.isPlaying ? 'live' : 'paused'
    );
  } else {
    setLyricsSyncStatus('Spotify eşleştirmesi bekleniyor', 'waiting');
  }

  updateActiveLyricByTime(getEstimatedSpotifyPosition());

  // İlk yüklemede veya yeni parça seçiminde anlık durum iste; devamı
  // loadMyNowPlaying'in merkezi 5 saniyelik poll'undan gelir.
  const hasFreshPlaybackSnapshot = track.playbackCapturedAt &&
    Date.now() - track.playbackCapturedAt < NOW_PLAYING_POLL_INTERVAL_MS;
  if (!hasFreshPlaybackSnapshot) requestLyricsPlaybackRefresh();
}

function requestLyricsPlaybackRefresh() {
  if (nowPlayingRequestInFlight ||
      typeof window.refreshSongShareNowPlaying !== 'function') return;

  // Çok hızlı parça değişimlerinde her seçim için yeni istek atma.
  const now = Date.now();
  if (now - lastForcedNowPlayingRefreshAt < 2500) return;

  lastForcedNowPlayingRefreshAt = now;
  window.refreshSongShareNowPlaying();
}

window.updateLyricsPlaybackFromSpotify = function (data) {
  const track = window.currentSelectedTrack;
  if (!track) return;

  const selectedTrackId = extractSpotifyTrackId(track.uri);
  const spotifyTrackId = extractSpotifyTrackId(
    data?.songUrl ||
    data?.spotifyUri ||
    data?.trackUri ||
    data?.uri ||
    data?.track_id ||
    data?.trackId
  );

  if (!selectedTrackId || !spotifyTrackId || selectedTrackId !== spotifyTrackId) {
    track.syncWithSpotify = false;
    track.isPlaying = false;
    track.playbackCapturedAt = null;

    if (track.hasSyncedLyrics) {
      setLyricsSyncStatus(
        spotifyTrackId ? 'Spotify’da başka parça çalıyor' : 'Spotify’da müzik çalmıyor',
        spotifyTrackId ? 'other' : 'idle'
      );
      updateActiveLyricByTime(getEstimatedSpotifyPosition());
    }
    return;
  }

  track.syncWithSpotify = true;

  if (data?.progress_ms !== undefined && data?.progress_ms !== null) {
    track.playbackPositionSec = Math.max(0, Number(data.progress_ms) / 1000);
  }

  if (Number(data?.duration_ms) > 0) {
    track.duration_ms = Number(data.duration_ms);
  }

  track.isPlaying = Boolean(data?.isPlaying);
  track.playbackCapturedAt = Date.now();

  if (track.hasSyncedLyrics) {
    setLyricsSyncStatus(
      track.isPlaying ? 'Canlı senkronize' : 'Duraklatıldı',
      track.isPlaying ? 'live' : 'paused'
    );
    updateActiveLyricByTime(getEstimatedSpotifyPosition());
  }
};

window.triggerRightPanelsSlideOut = function (track) {
  const rightAside = document.getElementById('rightAsideContainer');
  const friendsStrip = document.getElementById('friendsListeningStrip');
  const shell = document.getElementById('songShareShell');
  const stageCluster = document.getElementById('shareStageCluster');
  const appleAmbient = document.getElementById('appleLyricsAmbient');

  rightAside?.classList.add('slide-out-right');
  friendsStrip?.classList.add('slide-out-right');
  shell?.classList.add('share-lyrics-active');
  stageCluster?.classList.add('has-lyrics-attached');

  if (!track) return;

  const dockSongTitle = document.getElementById('dockLyricsSongTitle');
  const dockSongArtist = document.getElementById('dockLyricsSongArtist');
  const nextTrackKey = getLyricsTrackKey(track);
  const shouldFetchLyrics = currentLyricsTrackKey !== nextTrackKey ||
    (!currentLyricsLoaded && !currentLyricsLoading);

  if (dockSongTitle) dockSongTitle.textContent = track.name || 'Seçilen Parça';
  if (dockSongArtist) dockSongArtist.textContent = track.artist || 'Sanatçı';
  if (appleAmbient && track.imageUrl) {
    appleAmbient.style.backgroundImage = `url("${String(track.imageUrl).replace(/"/g, '%22')}")`;
  }

  if (shouldFetchLyrics) {
    fetchUpcomingShareLyrics(track.name, track.artist, track.duration_ms);
  } else {
    if (track.hasSyncedLyrics) startLyricsPlaybackSync();
    updateLyricsSharePreview();
  }

  const snapshotIsFresh = track.playbackCapturedAt &&
    Date.now() - track.playbackCapturedAt < NOW_PLAYING_POLL_INTERVAL_MS;
  if (!snapshotIsFresh) requestLyricsPlaybackRefresh();
};

async function fetchUpcomingShareLyrics(trackName, artistName, durationMs = null) {
  const scrollBody = document.getElementById('dockLyricsScrollBody');
  const syncStatus = document.getElementById('dockLyricsSyncStatus');
  if (!scrollBody) return;

  const requestedTrackKey = getLyricsTrackKey(
    window.currentSelectedTrack || { name: trackName, artist: artistName }
  );

  // Aynı şarkının sözleri zaten yükleniyorsa ikinci HTTP zincirini başlatma;
  // çağıran taraf mevcut işlemin tamamlanmasını beklesin.
  if (currentLyricsTrackKey === requestedTrackKey &&
      currentLyricsLoading &&
      currentLyricsLoadPromise) {
    await currentLyricsLoadPromise;
    return;
  }

  const fetchId = ++currentLyricsFetchId;
  let resolveThisFetch;
  const thisFetchPromise = new Promise(resolve => {
    resolveThisFetch = resolve;
  });
  currentLyricsLoadPromise = thisFetchPromise;

  stopLyricsPlaybackSync();
  currentLyricsLoaded = false;
  currentLyricsLoading = true;
  currentLyricsTrackKey = requestedTrackKey;
  lastActiveLyricsIndex = -1;

  if (window.currentSelectedTrack) {
    window.currentSelectedTrack.hasSyncedLyrics = false;
  }

  // 1. ANİMASYONLU SKELETON / SHIMMER LOADING DURUMU GÖSTER
  scrollBody.innerHTML = `
    <div class="lyrics-skeleton-container">
      <div class="lyrics-skeleton-status">
        <span class="lyrics-skeleton-spinner"></span>
        <span>LRCLIB üzerinden sözler aranıyor...</span>
      </div>
      <div class="lyrics-skeleton-bar" style="width: 82%;"></div>
      <div class="lyrics-skeleton-bar" style="width: 60%; animation-delay: 0.15s;"></div>
      <div class="lyrics-skeleton-bar" style="width: 95%; animation-delay: 0.3s;"></div>
      <div class="lyrics-skeleton-bar" style="width: 50%; animation-delay: 0.45s;"></div>
      <div class="lyrics-skeleton-bar" style="width: 78%; animation-delay: 0.6s;"></div>
      <div class="lyrics-skeleton-bar" style="width: 68%; animation-delay: 0.75s;"></div>
    </div>
  `;

  setLyricsSyncStatus('Sözler yükleniyor…', 'loading');

  // Şarkı adındaki "(Remastered)", "- Radio Edit" gibi ekleri temizle
  const cleanTrack = (trackName || '').replace(/\s*[\(\[-].*?[\)\]]/g, '').trim();
  const cleanArtist = (artistName || '').split(',')[0].trim();

  let params = new URLSearchParams({
    track_name: cleanTrack || trackName,
    artist_name: cleanArtist || artistName
  });

  if (durationMs) {
    params.append('duration', Math.round(durationMs / 1000));
  }

  try {
    // Önce uygulamanın kendi endpoint'ini kullan. Bazı kurulumlarda router
    // mount edilmediği/endpoint hata verdiği için LRCLIB'e güvenli fallback var.
    let songData = null;
    let lastLyricsError = null;
    const requestUrls = [`/api/songshare/lyrics?${params.toString()}`];
    if (durationMs) {
      const withoutDuration = new URLSearchParams(params);
      withoutDuration.delete('duration');
      requestUrls.push(`/api/songshare/lyrics?${withoutDuration.toString()}`);
    }

    for (const url of requestUrls) {
      try {
        const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (fetchId !== currentLyricsFetchId) return;
        if (!response.ok) {
          lastLyricsError = new Error(`Lyrics endpoint HTTP ${response.status}`);
          continue;
        }
        const result = await response.json();
        songData = result?.data || result?.lyrics || result;
        if (songData?.syncedLyrics || songData?.plainLyrics) break;
      } catch (error) {
        lastLyricsError = error;
      }
    }

    // Backend'de endpoint yoksa veya sonuç dönmezse LRCLIB public API'ye dene.
    if (!songData?.syncedLyrics && !songData?.plainLyrics) {
      const lrclibParams = new URLSearchParams({
        track_name: cleanTrack || trackName,
        artist_name: cleanArtist || artistName
      });
      if (durationMs) lrclibParams.set('duration', String(Math.round(durationMs / 1000)));
      const lrclibUrls = [`https://lrclib.net/api/get?${lrclibParams.toString()}`];
      const searchParams = new URLSearchParams({
        track_name: cleanTrack || trackName,
        artist_name: cleanArtist || artistName
      });
      lrclibUrls.push(`https://lrclib.net/api/search?${searchParams.toString()}`);

      for (const url of lrclibUrls) {
        try {
          const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
          if (fetchId !== currentLyricsFetchId) return;
          if (!response.ok) continue;
          const payload = await response.json();
          const candidates = Array.isArray(payload) ? payload : [payload];
          songData = candidates.find(item => item?.syncedLyrics || item?.plainLyrics) || null;
          if (songData) break;
        } catch (error) {
          lastLyricsError = error;
        }
      }
    }

    if (fetchId !== currentLyricsFetchId) return;
    if (!songData) throw (lastLyricsError || new Error('Lyrics not found'));

    let lines = [];

    // LRC timestamp'lerini ayrıştır. Aynı satırda birden fazla timestamp
    // varsa her biri için ayrı senkronize satır üret.
    if (songData?.syncedLyrics) {
      lines = String(songData.syncedLyrics)
        .split('\n')
        .flatMap(rawLine => {
          const timestamps = [...rawLine.matchAll(/\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
          const text = rawLine
            .replace(/\[\d{2}:\d{2}(?:\.\d{1,3})?\]/g, '')
            .replace(/\[[^\]]*]/g, '')
            .trim();

          if (!text) return [];

          if (!timestamps.length) return [{ time: 0, text }];

          return timestamps.map(match => {
            const fraction = match[3] ? Number(`0.${match[3]}`) : 0;
            return {
              time: Number(match[1]) * 60 + Number(match[2]) + fraction,
              text
            };
          });
        })
        .filter(line => line.text.length > 0)
        .sort((a, b) => a.time - b.time);

      if (syncStatus) syncStatus.textContent = 'Senkronize sözler';
    } else if (songData?.plainLyrics) {
      lines = String(songData.plainLyrics)
        .split('\n')
        .map(line => ({ time: 0, text: line.trim() }))
        .filter(line => line.text.length > 0);

      if (syncStatus) syncStatus.textContent = 'Düz Metin';
    }

    const hasTimecodes = Boolean(
      songData?.syncedLyrics && lines.some(line => line.time > 0)
    );

    if (window.currentSelectedTrack) {
      window.currentSelectedTrack.hasSyncedLyrics = hasTimecodes;
      window.currentSelectedTrack.lyrics = songData.plainLyrics || null;
      window.currentSelectedTrack.time_synced_lyrics = songData.syncedLyrics || null;
    }

    if (lines.length === 0) {
      currentLyricsLoaded = true;
      currentLyricsLoading = false;
      showEmptyLyricsState(scrollBody, syncStatus);
      return;
    }

    // Spotify'da "Şu Anda Çalanı Al" denildiği andaki pozisyon
    const playbackPosition =
      getEstimatedSpotifyPosition();

    // Bu pozisyondan önce başlayan son lyrics satırını bul
    let activeIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= playbackPosition) {
        activeIndex = i;
      } else {
        break;
      }
    }

    // 3. ANİMASYONLU GEÇİŞ: Satırları sırayla kaydırarak göster
    currentLyricsLoaded = true;
    currentLyricsLoading = false;
    scrollBody.innerHTML = lines.map((item, idx) => `
  <div class="lyrics-dock-line line-animate-in ${idx === activeIndex ? 'active' : ''}"
       style="--line-index: ${Math.min(idx, 15)};"
       data-time="${item.time || 0}" data-line-index="${idx}"
       onclick="selectActiveLyricLine(this)">
    ${escapeHtml(item.text)}
  </div>
`).join('');

    lastActiveLyricsIndex = -1;
    if (hasTimecodes) {
      setLyricsSyncStatus('Spotify eşleştirmesi bekleniyor', 'waiting');
      startLyricsPlaybackSync();
      updateActiveLyricByTime(getEstimatedSpotifyPosition());
    } else {
      stopLyricsPlaybackSync();
      setLyricsSyncStatus('Senkronize zaman bilgisi yok', 'plain');
    }

    renderLyricRangeSelection();
    updateLyricsSharePreview();

  } catch (err) {
    if (fetchId !== currentLyricsFetchId) return;
    console.warn('Lyrics yüklenemedi:', err);
    showEmptyLyricsState(scrollBody, syncStatus);
  } finally {
    if (fetchId === currentLyricsFetchId) {
      currentLyricsLoaded = true;
      currentLyricsLoading = false;
    }
    resolveThisFetch?.();
  }
}
window.fetchShareLyricsForTrack = fetchUpcomingShareLyrics;

function showEmptyLyricsState(scrollBody, syncStatus) {
  currentLyricsLoaded = true;
  currentLyricsLoading = false;
  stopLyricsPlaybackSync();
  if (window.currentSelectedTrack) window.currentSelectedTrack.hasSyncedLyrics = false;
  setLyricsSyncStatus('Söz bulunamadı', 'empty');
  scrollBody.innerHTML = `
    <div class="lyrics-empty-state">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M9 18V5l12-2v13"></path>
        <circle cx="6" cy="18" r="3"></circle>
        <circle cx="18" cy="16" r="3"></circle>
        <line x1="2" y1="2" x2="22" y2="22" stroke-width="2"></line>
      </svg>
      <strong>Sözler Bulunamadı</strong>
      <p>Bu parça için LRCLIB üzerinde söz kaydı bulunamadı veya enstrümantal olabilir.</p>
    </div>
  `;
}

window.restoreRightPanels = function () {
  stopLyricsPlaybackSync();
  const rightAside = document.getElementById('rightAsideContainer');
  const friendsStrip = document.getElementById('friendsListeningStrip');
  const shell = document.getElementById('songShareShell');
  const stageCluster = document.getElementById('shareStageCluster');

  rightAside?.classList.remove('slide-out-right');
  friendsStrip?.classList.remove('slide-out-right');
  shell?.classList.remove('share-lyrics-active');

  stageCluster?.classList.remove('has-lyrics-attached');
};

let lyricShareMode = false;
let lyricRangeStart = null;
let lyricRangeEnd = null;
let lyricDesign = { background: 'blur', color: '#211c35', gradientColor: '#452333', align: 'left', font: 'clean', lineSpacing: 1.45, fontColor: '#ffffff', fontSize: 23, textEffect: 'soft', textTransform: 'none', letterSpacing: -0.5, italic: false };

const MAX_LYRICS_SHARE_LINES = 8;

function renderLyricRangeSelection() {
  const lines = [...document.querySelectorAll('#dockLyricsScrollBody .lyrics-dock-line')];
  if (!lines.length || lyricRangeStart === null) return;
  const low = lyricRangeEnd === null ? lyricRangeStart : Math.min(lyricRangeStart, lyricRangeEnd);
  const high = lyricRangeEnd === null ? lyricRangeStart : Math.max(lyricRangeStart, lyricRangeEnd);
  lines.forEach((item, i) => {
    item.classList.remove('is-range-start', 'is-range-end', 'is-range-pending', 'is-range-selected');
    if (i >= low && i <= high) item.classList.add('is-range-selected');
    if (i === low) item.classList.add(lyricRangeEnd === null ? 'is-range-pending' : 'is-range-start');
    if (lyricRangeEnd !== null && i === high) item.classList.add('is-range-end');
  });
}

// İlk tıklama başlangıç, ikinci tıklama bitiştir. En fazla 8 satır seçilebilir.
window.selectActiveLyricLine = function (lineOrEvent) {
  const line = lineOrEvent?.currentTarget || lineOrEvent;
  if (!line || !line.classList?.contains('lyrics-dock-line')) return;
  const lines = [...document.querySelectorAll('#dockLyricsScrollBody .lyrics-dock-line')];
  const index = lines.indexOf(line);
  if (index < 0) return;

  if (lyricRangeStart === null || lyricRangeEnd !== null) {
    lyricRangeStart = index;
    lyricRangeEnd = null;
  } else {
    // Aralığı okuma sırasına normalize et ve maksimum satır sayısını uygula.
    const low = Math.min(lyricRangeStart, index);
    const high = Math.max(lyricRangeStart, index);
    lyricRangeStart = low;
    lyricRangeEnd = Math.min(high, low + MAX_LYRICS_SHARE_LINES - 1);
  }

  renderLyricRangeSelection();
  const selected = getSelectedLyricLines();
  const slider = document.getElementById('wizardHighlightSlider');
  if (selected.length && slider) {
    slider.value = String(Math.round(selected[0].time));
    window.updateWizardHighlightAnimation?.(slider.value);
  }
  updateLyricsSharePreview();
};

function getSelectedLyricLines() {
  const lines = [...document.querySelectorAll('.lyrics-dock-line')];
  if (!lines.length || lyricRangeStart === null) return [];
  const end = lyricRangeEnd === null ? lyricRangeStart : lyricRangeEnd;
  return lines.slice(Math.min(lyricRangeStart, end), Math.max(lyricRangeStart, end) + 1)
    .map(line => ({ text: line.textContent.trim(), time: Number(line.dataset.time || 0) })).filter(x => x.text);
}
function updateLyricsSharePreview() {
  const selected = getSelectedLyricLines();
  const linesEl = document.getElementById('lyricsPreviewLines');
  if (linesEl) linesEl.textContent = selected.length ? selected.map(x => x.text).join('\n') : 'Şarkı sözlerinden bir an seç';
  const track = window.currentSelectedTrack;
  const meta = document.getElementById('lyricsPreviewMeta');
  if (meta) meta.textContent = document.getElementById('lyricsIncludeMeta')?.checked === false ? '' : `${track?.artist || 'Sanatçı'} · ${track?.name || 'Şarkı'}`;
  const player = document.getElementById('lyricsPreviewPlayer');
  if (player) player.hidden = !document.getElementById('lyricsIncludePlayer')?.checked;
  const cover = document.getElementById('step2SelImg')?.src || track?.imageUrl || '';
  const coverEl = document.getElementById('lyricsPreviewCover');
  if (coverEl) { coverEl.src = cover; coverEl.alt = `${track?.name || 'Şarkı'} albüm kapağı`; }
  const preview = document.getElementById('lyricsSharePreview');
  if (preview) {
    preview.style.setProperty('--lyric-bg-color', lyricDesign.color);
    preview.style.setProperty('--lyric-bg-color-2', lyricDesign.gradientColor || '#452333');
    preview.style.setProperty('--lyric-bg-image', `url("${cover}")`);
    preview.dataset.background = lyricDesign.background;
    preview.dataset.align = lyricDesign.align;
    preview.dataset.font = lyricDesign.font;
    preview.style.setProperty('--lyrics-line-spacing', String(lyricDesign.lineSpacing || 1.45));
    preview.style.setProperty('--lyrics-font-color', lyricDesign.fontColor || '#ffffff');
    preview.style.setProperty('--lyrics-font-size', `${Number(lyricDesign.fontSize || 23)}px`);
    preview.style.setProperty('--lyrics-letter-spacing', `${Number(lyricDesign.letterSpacing ?? -0.5)}px`);
    preview.dataset.effect = lyricDesign.textEffect || 'soft';
    preview.dataset.transform = lyricDesign.textTransform || 'none';
    preview.classList.toggle('is-italic', !!lyricDesign.italic);
    preview.classList.toggle('hide-cover', document.getElementById('lyricsIncludeCover')?.checked === false);
  }
  const summary = document.getElementById('lyricsRangeSummary');
  if (summary) {
    if (!selected.length) {
      summary.innerHTML = '<i class="fa-solid fa-hand-pointer"></i><span>Başlangıç satırını seç, ardından bitiş satırına tıkla. Sağdaki panelde başlangıç ve bitiş etiketleri görünecek.</span>';
    } else {
      const startLine = lyricRangeStart + 1;
      const endLine = lyricRangeEnd === null ? null : lyricRangeEnd + 1;
      summary.innerHTML = `<i class="fa-solid fa-highlighter"></i><span><b>BAŞLANGIÇ: Satır ${startLine}</b>${endLine === null ? ' <em>Şimdi bitiş satırını seç…</em>' : ` <b>· BİTİŞ: Satır ${endLine}</b><small>${selected.length} satır seçildi · ${selected[0].time}s – ${selected[selected.length - 1].time}s</small>`}</span>`;
    }
  }
};

// ----------------------------------------------------
// 1. GLOBAL PAYLAŞIM SİHİRBAZI (WIZARD) VE SPOTLIGHT
// ----------------------------------------------------
function showShareWizardFeedback(message, type = 'error') {
  const box = document.getElementById('shareWizardFeedback');
  if (!box) return;
  box.className = `share-wizard-feedback is-${type}`;
  box.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'info' ? 'fa-circle-info' : 'fa-triangle-exclamation'}" aria-hidden="true"></i><span></span>`;
  box.querySelector('span').textContent = message;
  box.hidden = false;
}

function clearShareWizardFeedback() {
  const box = document.getElementById('shareWizardFeedback');
  if (box) { box.hidden = true; box.textContent = ''; box.className = 'share-wizard-feedback'; }
}

window.goToWizardStep = function (step) {
  if (step === 2) {
    if (!window.currentSelectedTrack?.uri) {
      showShareWizardFeedback('Devam etmeden önce önerilerden bir şarkı seç veya Spotify’da ara.', 'error');
      document.getElementById('wizardStep1')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      document.getElementById('spotifySearchInput')?.focus({ preventScroll: true });
      return;
    }
    if (lyricShareMode) {
      const selected = getSelectedLyricLines();
      const lyricsAvailable = document.querySelectorAll('#dockLyricsScrollBody .lyrics-dock-line').length > 0;
      if (!lyricsAvailable) {
        showShareWizardFeedback('Bu parça için şarkı sözü bulunamadı. Müzik paylaşımına geçebilir veya başka bir parça deneyebilirsin.', 'error');
        return;
      }
      // Söz aralığı ayarlar adımında seçilebilir; seçmeden ilerlemek serbesttir.
    }
    clearShareWizardFeedback();
  }
  const step1 = document.getElementById('wizardStep1');
  const step2 = document.getElementById('wizardStep2');
  const dot1 = document.getElementById('dotStep1');
  const dot2 = document.getElementById('dotStep2');

  if (step === 1) {
    step1?.classList.add('active');
    step2?.classList.remove('active');
    dot1?.classList.add('active');
    dot2?.classList.remove('active');
  } else if (step === 2) {
    step1?.classList.remove('active');
    step2?.classList.add('active');
    dot1?.classList.remove('active');
    dot2?.classList.add('active');

    if (window.currentSelectedTrack) {
      window.triggerRightPanelsSlideOut(window.currentSelectedTrack);
    }
  }
};

window.playToDock = function (title, artist, coverUrl, key = '') {
  const dockSong = document.getElementById('playerTrackTitle');
  const dockArtist = document.getElementById('playerTrackArtist');
  const dockImg = document.getElementById('playerCoverImg');

  if (dockSong) dockSong.textContent = title;
  if (dockArtist) dockArtist.textContent = artist;
  if (dockImg && coverUrl) dockImg.src = coverUrl;

  window.fetchSyncedLyricsExternal?.(title, artist);
};

// ----------------------------------------------------
// MÜZİK ÖNERİLERİ + PAYLAŞ SAYFASI ÖNERİLERİ
// Aynı API cevabını iki yerde kullanır; ekstra request atmaz.
// ----------------------------------------------------

window.songShareRecommendationTracks = [];

function renderShareRecommendationTiles(tracks, { loading = false, emptyMessage = '' } = {}) {
  const grid = document.getElementById('wizardSongGrid');
  if (!grid) return;

  if (loading) {
    grid.innerHTML = Array.from({ length: 4 }, (_, i) => `
      <div class="selector-tile selector-tile-skeleton" style="--tile-index:${i}">
        <span class="selector-skeleton-cover"></span>
        <span class="selector-skeleton-copy">
          <i></i><i></i>
        </span>
      </div>
    `).join('');
    return;
  }

  if (!Array.isArray(tracks) || tracks.length === 0) {
    grid.innerHTML = `
      <div class="selector-empty-state">
        <i class="fa-solid fa-music"></i>
        <span>${escapeHtml(emptyMessage || 'Öneriler şu anda kullanılamıyor.')}</span>
      </div>`;
    return;
  }

  // Coverflow için alınmış aynı listeyi kullanıyoruz; burada yeni API çağrısı yok.
  const picks = [...tracks]
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(4, tracks.length));

  window.songShareRecommendationTracks = picks;

  grid.innerHTML = picks.map((song, index) => {
    const title = song.title || song.name || 'Bilinmeyen Şarkı';
    const artist = song.artist || 'Bilinmeyen Sanatçı';
    const cover = song.coverUrl || song.imageUrl || song.cover || '';
    const uri = song.spotifyUri || (song.id ? `spotify:track:${song.id}` : '');
    return `
      <button type="button"
        class="selector-tile selector-tile-enter"
        data-recommendation-index="${index}"
        style="--tile-index:${index}"
        aria-label=" ${escapeHtml(title)} — ${escapeHtml(artist)} seç">
        <img src="${escapeHtml(cover || 'https://placehold.co/80x80?text=Music')}"
             alt="${escapeHtml(title)}" loading="lazy" />
        <span class="selector-tile-meta">
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(artist)}</span>
        </span>
        <span class="selector-tile-play"><i class="fa-solid fa-play"></i></span>
      </button>`;
  }).join('');

  grid.querySelectorAll('[data-recommendation-index]').forEach(tile => {
    tile.addEventListener('click', () => {
      const index = Number(tile.dataset.recommendationIndex);
      const song = window.songShareRecommendationTracks[index];
      if (!song) return;

      grid.querySelectorAll('.selector-tile').forEach(el => el.classList.remove('selected'));
      tile.classList.add('selected');

      const title = song.title || song.name || 'Bilinmeyen Şarkı';
      const artist = song.artist || 'Bilinmeyen Sanatçı';
      const cover = song.coverUrl || song.imageUrl || song.cover || '';
      const uri = song.spotifyUri || (song.id ? `spotify:track:${song.id}` : '');
      window.selectCustomTrack(title, artist, cover, uri, song.durationMs || song.duration_ms || 180000);
    });
  });
}

async function loadRecommendations() {
  window.songShareRecommendationTracks = [];

  const stage =
    document.getElementById('coverflowStage');

  if (!stage) return;

  stage.classList.add('recommendations-loading');

  stage.innerHTML = `
    <div class="recommendation-loading-skeleton" id="recommendationLoadingSkeleton">

        <div class="recommendation-skeleton-status">
            <span class="recommendation-skeleton-status-dot"></span>
            ÖNERİLER YÜKLENİYOR
        </div>

        <div class="recommendation-skeleton-card left"></div>

        <div class="recommendation-skeleton-card center"></div>

        <div class="recommendation-skeleton-card right"></div>

        <div class="recommendation-skeleton-meta">
            <span class="recommendation-skeleton-line title"></span>
            <span class="recommendation-skeleton-line artist"></span>
        </div>

    </div>
`;

  renderShareRecommendationTiles([], { loading: true });

  if (!stage) return;

  try {
    const token = localStorage.getItem('token');

    const res = await fetch('/api/songshare/recommendations', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include'
    });

    if (!res.ok) {
      throw new Error('Öneriler alınamadı');
    }

    const response = await res.json();

    const recommendations =
      response.data ||
      response.recommendations ||
      [];

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      console.warn('Öneri bulunamadı.');
      renderShareRecommendationTiles([], {
        emptyMessage: 'Öneriler bulunamadı. Bir şarkı bulmak için aramayı kullanabilirsin.'
      });
      const label = document.getElementById('selectorListLabel');
      if (label) label.textContent = 'Öneriler bulunamadı';
      stage.classList.remove('recommendations-loading');
      return;
    }

    // Aynı API cevabını paylaş sayfasındaki öneri kartlarında da kullan.
    renderShareRecommendationTiles(recommendations);
    const label = document.getElementById('selectorListLabel');
    if (label) label.textContent = 'Önerilen şarkılar';

    // Backend'den gelen şarkıları Coverflow'a aktar
    stage.innerHTML = recommendations.map(song => {

      const title = song.title || 'Bilinmeyen Şarkı';
      const artist = song.artist || 'Bilinmeyen Sanatçı';
      const cover = song.coverUrl || song.imageUrl || song.cover || '';
      const uri = song.spotifyUri || song.uri || (song.id ? `spotify:track:${song.id}` : '');
      const spotifyUrl = song.spotifyUrl || song.external_urls?.spotify || (song.id ? `https://open.spotify.com/track/${song.id}` : '');

      return `
        <button type="button"
            class="coverflow-item"
            data-img="${escapeHtml(cover)}"
            data-title="${escapeHtml(title)}"
            data-artist="${escapeHtml(artist)}"
            data-uri="${escapeHtml(uri)}"
            data-url="${escapeHtml(spotifyUrl)}"
            aria-label="${escapeHtml(`Önizle: ${title} — ${artist}`)}"
        >

            <img
                src="${escapeHtml(cover)}"
                alt="${escapeHtml(title)}"
                loading="lazy"
            />

            <div class="coverflow-caption">
                <strong>${escapeHtml(title)}</strong>
                <span>${escapeHtml(artist)}</span>
            </div>

        </button>
    `;
    }).join('');

    stage.classList.remove(
      'recommendations-loading'
    );

    stage.classList.add(
      'recommendations-ready'
    );

    /*
     * Coverflow'un başlangıç indexini
     * gelen listenin ortasına ayarla.
     */
    coverflowCurrentIndex =
      Math.floor((recommendations.length - 1) / 2);

    // Coverflow item'ları DOM'a eklendikten sonra engine'i başlat
    initCoverflowEngine();


    console.log(
      `🎵 ${recommendations.length} müzik önerisi yüklendi.`
    );

  } catch (err) {

    console.warn(
      'Müzik önerileri alınamadı:',
      err.message
    );
    renderShareRecommendationTiles([], {
      emptyMessage: 'Öneriler yüklenemedi. Bir şarkı bulmak için aramayı kullanabilirsin.'
    });
    const label = document.getElementById('selectorListLabel');
    if (label) label.textContent = 'Öneriler yüklenemedi';

    /*
     * Öneri isteği başarısızsa ekstra bir istek atmayız.
     * Arama alanı kullanıcı tarafından kullanılabilir.
     */
  }

  stage
    .querySelectorAll('img')
    .forEach(img => prepareImage(img));
}

let coverflowCurrentIndex = 0;
let activeBgLayer = 'A';

function initCoverflowEngine() {
  const stage = document.getElementById('coverflowStage');
  const items = document.querySelectorAll('.coverflow-item');
  const dotsContainer = document.getElementById('coverflowDots');
  const btnHide = document.getElementById('btnHideSpotlight');
  const spotlightPanel = document.getElementById('spotlightPanel');

  if (!stage) return;

  spotlightPanel?.classList.add('recommendations-loading');
  stage.classList.add('recommendations-loading');

  stage.classList.remove('recommendations-loading');
  stage.classList.add('recommendations-ready');

  spotlightPanel?.classList.remove('recommendations-loading');
  spotlightPanel?.classList.add('recommendations-ready');

  if (!stage || items.length === 0) return;

  const btnShow = document.getElementById('btnShowSpotlight');
  if (btnHide && btnHide.dataset.bound !== 'true') {
    btnHide.dataset.bound = 'true';
    btnHide.addEventListener('click', () => {
      spotlightPanel?.classList.add('spotlight-is-hidden');
      if (btnShow) btnShow.hidden = false;
    });
  }
  if (btnShow && btnShow.dataset.bound !== 'true') {
    btnShow.dataset.bound = 'true';
    btnShow.addEventListener('click', () => {
      spotlightPanel?.classList.remove('spotlight-is-hidden');
      btnShow.hidden = true;
      spotlightPanel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  if (dotsContainer) {
    dotsContainer.innerHTML = Array.from(items)
      .map((_, i) => `<span class="coverflow-dot ${i === coverflowCurrentIndex ? 'active' : ''}" onclick="slideToOffset(${i - coverflowCurrentIndex})"></span>`)
      .join('');
  }

  items.forEach((item) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      const title = item.dataset.title || 'Bilinmeyen şarkı';
      const artist = item.dataset.artist || 'Bilinmeyen sanatçı';
      const uri = item.dataset.uri || '';
      const url = item.dataset.url || '';
      if (typeof window.openSongPreview === 'function' && (uri || url)) {
        window.openSongPreview({
          title, artist, cover: item.dataset.img || '', uri, url,
          rating: 0, comment: 'Günün önerilerinden keşfet.'
        });
      } else if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        const offset = Array.from(items).indexOf(item) - coverflowCurrentIndex;
        if (offset) slideToOffset(offset);
      }
    });
  });

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY > 0 || e.deltaX > 0) {
      moveCoverflow(1);
    } else {
      moveCoverflow(-1);
    }
  }, { passive: false });

  updateCoverflowPositions();
}

window.slideToOffset = function (offset) {
  const items = document.querySelectorAll('.coverflow-item');
  const newIndex = coverflowCurrentIndex + offset;
  if (newIndex >= 0 && newIndex < items.length) {
    coverflowCurrentIndex = newIndex;
    updateCoverflowPositions();
  }
};

window.moveCoverflow = function (step) {
  const items = document.querySelectorAll('.coverflow-item');
  const newIndex = coverflowCurrentIndex + step;
  if (newIndex >= 0 && newIndex < items.length) {
    coverflowCurrentIndex = newIndex;
    updateCoverflowPositions();
  }
};

function updateCoverflowPositions() {
  const items = document.querySelectorAll('.coverflow-item');
  const dots = document.querySelectorAll('.coverflow-dot');
  if (items.length === 0) return;

  items.forEach((item, index) => {
    const offset = index - coverflowCurrentIndex;
    item.style.setProperty('--offset', offset);

    if (offset === 0) {
      item.classList.add('active');
      const bgImgUrl = item.dataset.img;
      applyAnimatedBackground(bgImgUrl);
    } else {
      item.classList.remove('active');
    }
  });

  dots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === coverflowCurrentIndex);
  });
}

function applyAnimatedBackground(imgUrl) {
  if (!imgUrl) return;
  const bgA = document.getElementById('spotlightBgA');
  const bgB = document.getElementById('spotlightBgB');
  if (!bgA || !bgB) return;

  if (activeBgLayer === 'A') {
    bgB.style.backgroundImage = `url('${imgUrl}')`;
    bgB.classList.add('active');
    bgA.classList.remove('active');
    activeBgLayer = 'B';
  } else {
    bgA.style.backgroundImage = `url('${imgUrl}')`;
    bgA.classList.add('active');
    bgB.classList.remove('active');
    activeBgLayer = 'A';
  }
}

// ----------------------------------------------------
// 2. YOUTUBE IFRAME API
// ----------------------------------------------------
window.onYouTubeIframeAPIReady = function () {
  ytPlayer = new YT.Player('player', {
    height: '1',
    width: '1',
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      enablejsapi: 1,
      origin: window.location.origin
    },
    events: {
      onReady: () => {
        isYTReady = true;
        window.initSongPreviewYouTubePlayer?.();
      },
      onStateChange: (event) => {
        if (window.handleYTStateChange) window.handleYTStateChange(event);
      }
    }
  });
};

document.addEventListener('DOMContentLoaded', () => {
  // YouTube IFrame API HTML'de zaten yükleniyor; ikinci kez yüklemek
  // callback/player yarışına ve çift ghost player oluşturulmasına yol açabiliyor.
  window.handleYTStateChange = onYTStateChange;

  window.currentSelectedTrack = null;

  // Paylaşım türü seçici: şarkı sözleri için puanlamasız, tasarlanabilir alıntı modu.
  const lyricsModeButton = document.getElementById('shareModeLyrics');
  const musicModeButton = document.getElementById('shareModeMusic');
  function setLyricsShareMode(enabled) {
    lyricShareMode = enabled;
    lyricsModeButton?.classList.toggle('is-active', enabled);
    musicModeButton?.classList.toggle('is-active', !enabled);
    lyricsModeButton?.setAttribute('aria-pressed', String(enabled));
    musicModeButton?.setAttribute('aria-pressed', String(!enabled));
    document.getElementById('lyricsEditorPanel')?.classList.toggle('is-mode-active', enabled);
    document.getElementById('wizardStep2')?.classList.toggle('lyrics-compose-mode', enabled);
    document.getElementById('shareStageCluster')?.classList.toggle('lyrics-compose-mode', enabled);
    document.getElementById('shareLyricsDockPanel')?.classList.toggle('lyrics-select-mode', enabled);
    const ratingContainer = document.querySelector('#wizardStep2 .rating-dynamic-container');
    ratingContainer?.closest('.form-group')?.classList.toggle('lyrics-rating-hidden', enabled);
    document.querySelector('#wizardStep2 .highlight-share-group')?.classList.toggle('lyrics-highlight-hidden', enabled);
    const commentField = document.getElementById('wizardCommentInput');
    commentField?.closest('.form-group')?.classList.toggle('lyrics-comment-hidden', enabled);
    if (enabled) {
      updateLyricsSharePreview();
      updateActiveLyricByTime(getEstimatedSpotifyPosition());
    }
  }
  lyricsModeButton?.addEventListener('click', async () => {
    clearShareWizardFeedback();
    setLyricsShareMode(true);
    const track = window.currentSelectedTrack;
    if (!track?.uri) {
      showShareWizardFeedback('Lyrics modu hazır. Önce bir şarkı seç; sözler ardından otomatik yüklenecek.', 'info');
      document.getElementById('spotifySearchInput')?.focus({ preventScroll: true });
      return;
    }
    let lyricLines = document.querySelectorAll('#dockLyricsScrollBody .lyrics-dock-line').length;
    if (!lyricLines) {
      showShareWizardFeedback('Bu şarkının sözleri kontrol ediliyor…', 'info');
      try {
        await window.fetchShareLyricsForTrack?.(track.name, track.artist, track.duration_ms);
      } catch (error) {
        console.warn('Lyrics moduna geçerken sözler yüklenemedi:', error);
      }
      lyricLines = document.querySelectorAll('#dockLyricsScrollBody .lyrics-dock-line').length;
    }
    if (!lyricLines) {
      showShareWizardFeedback('Bu parça için söz bulunamadı. Yine de ayarlara geçebilir veya başka bir şarkı deneyebilirsin.', 'info');
      return;
    }
    clearShareWizardFeedback();
    updateLyricsSharePreview();
  });
  musicModeButton?.addEventListener('click', () => { setLyricsShareMode(false); clearShareWizardFeedback(); });
  const refreshRecommendationsButton = document.getElementById('btnRefreshRecommendations');
  refreshRecommendationsButton?.addEventListener('click', async () => {
    const icon = refreshRecommendationsButton.querySelector('i');
    refreshRecommendationsButton.disabled = true;
    refreshRecommendationsButton.classList.add('is-loading');
    if (icon) icon.classList.add('fa-spin');
    clearShareWizardFeedback();
    const label = document.getElementById('selectorListLabel');
    if (label) label.textContent = 'Yeni öneriler yükleniyor…';
    try {
      await loadRecommendations();
      if (!window.songShareRecommendationTracks?.length) {
        showShareWizardFeedback('Öneriler şu anda yüklenemedi. Aramayı kullanarak şarkı bulabilirsin.', 'error');
      }
    } finally {
      refreshRecommendationsButton.disabled = false;
      refreshRecommendationsButton.classList.remove('is-loading');
      if (icon) icon.classList.remove('fa-spin');
    }
  });
  document.querySelectorAll('[data-lyric-bg]').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('[data-lyric-bg]').forEach(b => b.classList.toggle('is-active', b === btn));
    lyricDesign.background = btn.dataset.lyricBg;
    document.getElementById('lyricsColorRow')?.classList.toggle('is-muted', lyricDesign.background === 'blur');
    updateLyricsSharePreview();
  }));
  document.querySelectorAll('[data-lyric-align]').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('[data-lyric-align]').forEach(b => b.classList.toggle('is-active', b === btn));
    lyricDesign.align = btn.dataset.lyricAlign; updateLyricsSharePreview();
  }));
  document.querySelectorAll('[data-color]').forEach(btn => btn.addEventListener('click', () => {
    lyricDesign.color = btn.dataset.color;
    const input = document.getElementById('lyricsBackgroundColor'); if (input) input.value = lyricDesign.color;
    const hex = document.getElementById('lyricsColorHex'); if (hex) hex.textContent = lyricDesign.color.toUpperCase();
    updateLyricsSharePreview();
  }));
  document.getElementById('lyricsBackgroundColor')?.addEventListener('input', e => {
    lyricDesign.color = e.target.value;
    const hex = document.getElementById('lyricsColorHex'); if (hex) hex.textContent = lyricDesign.color.toUpperCase();
    updateLyricsSharePreview();
  });
  document.getElementById('lyricsGradientColor')?.addEventListener('input', e => {
    lyricDesign.gradientColor = e.target.value;
    const hex = document.getElementById('lyricsGradientColorHex'); if (hex) hex.textContent = lyricDesign.gradientColor.toUpperCase();
    updateLyricsSharePreview();
  });
  document.getElementById('lyricsFontStyle')?.addEventListener('change', e => { lyricDesign.font = e.target.value; updateLyricsSharePreview(); });
  document.getElementById('lyricsFontColor')?.addEventListener('input', e => { lyricDesign.fontColor = e.target.value; const out = document.getElementById('lyricsFontColorHex'); if (out) out.textContent = lyricDesign.fontColor.toUpperCase(); updateLyricsSharePreview(); });
  document.getElementById('lyricsFontSize')?.addEventListener('input', e => { lyricDesign.fontSize = Number(e.target.value); const out = document.getElementById('lyricsFontSizeValue'); if (out) out.textContent = `${lyricDesign.fontSize} px`; updateLyricsSharePreview(); });
  document.getElementById('lyricsTextEffect')?.addEventListener('change', e => { lyricDesign.textEffect = e.target.value; updateLyricsSharePreview(); });
  document.getElementById('lyricsTextTransform')?.addEventListener('change', e => { lyricDesign.textTransform = e.target.value; updateLyricsSharePreview(); });
  document.getElementById('lyricsLetterSpacing')?.addEventListener('input', e => { lyricDesign.letterSpacing = Number(e.target.value); const out = document.getElementById('lyricsLetterSpacingValue'); if (out) out.textContent = `${lyricDesign.letterSpacing.toFixed(1)} px`; updateLyricsSharePreview(); });
  document.getElementById('lyricsTextItalic')?.addEventListener('change', e => { lyricDesign.italic = e.target.checked; updateLyricsSharePreview(); });
  document.getElementById('lyricsLineSpacing')?.addEventListener('input', e => {
    lyricDesign.lineSpacing = Number(e.target.value);
    const output = document.getElementById('lyricsLineSpacingValue');
    if (output) output.textContent = `${lyricDesign.lineSpacing.toFixed(2)}×`;
    updateLyricsSharePreview();
  });
  ['lyricsIncludePlayer', 'lyricsIncludeCover', 'lyricsIncludeMeta'].forEach(id => document.getElementById(id)?.addEventListener('change', updateLyricsSharePreview));
  const lyricsAdvancedToggle = document.getElementById('lyricsAdvancedToggle');
  const lyricsAdvancedSettings = document.getElementById('lyricsAdvancedSettings');
  lyricsAdvancedToggle?.addEventListener('click', () => {
    const willOpen = lyricsAdvancedToggle.getAttribute('aria-expanded') !== 'true';
    lyricsAdvancedToggle.setAttribute('aria-expanded', String(willOpen));
    lyricsAdvancedToggle.classList.toggle('is-open', willOpen);
    if (lyricsAdvancedSettings) lyricsAdvancedSettings.hidden = !willOpen;
  });
  document.getElementById('resetLyricsRange')?.addEventListener('click', () => { lyricRangeStart = lyricRangeEnd = null; document.querySelectorAll('.lyrics-dock-line').forEach(line => line.classList.remove('is-range-start','is-range-end','is-range-pending','is-range-selected')); updateLyricsSharePreview(); });

  // ----------------------------------------------------
  // 3. SPA VIEW & SAYFA GEÇİŞ YÖNETİMİ
  // ----------------------------------------------------
  const navLinks = document.querySelectorAll('.nav-menu-list .nav-link');
  const viewSections = document.querySelectorAll('.view-section');

  function switchView(targetHash) {
    let viewName = targetHash.replace('#', '') || 'home';

    if (targetHash === '#discover' || targetHash === '#activity' || targetHash === '#search') {
      viewName = 'notyet';
    }

    if (targetHash === '#quit') {
      window.location.href = '/';
    }

    if (viewName !== 'share') stopLyricsPlaybackSync();

    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      link.classList.toggle('active', href === `#${viewName}`);
    });

    viewSections.forEach(section => {
      section.classList.remove('active');
    });

    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) {
      targetSection.classList.add('active');
    } else {
      document.getElementById('view-home')?.classList.add('active');
    }

    if (viewName === 'home') {
      window.restoreRightPanels();
    } else if (viewName === 'account') {
      window.dispatchEvent(new CustomEvent('songshare:account-view')); 
    } else if (viewName === 'share' && window.currentSelectedTrack) {
      // Home/feed görünümünden geri dönünce seçili şarkı, lyrics ve sanatçı bilgileri korunur.
      window.triggerRightPanelsSlideOut(window.currentSelectedTrack);
      if (lyricShareMode) {
        document.getElementById('lyricsEditorPanel')?.classList.add('is-mode-active');
        document.getElementById('wizardStep2')?.classList.add('lyrics-compose-mode');
        document.getElementById('shareStageCluster')?.classList.add('lyrics-compose-mode');
        document.getElementById('shareLyricsDockPanel')?.classList.add('lyrics-select-mode');
      }
      updateLyricsSharePreview();
    }
  }

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const hash = link.getAttribute('href');
      location.hash = hash;
      switchView(hash);
    });
  });

  window.addEventListener('hashchange', () => switchView(location.hash));
  switchView(location.hash || '#home');

  // ----------------------------------------------------
  // 4. SPOTIFY SYNC & CANLI VERİ
  // ----------------------------------------------------
  const btnConnectSpotify = document.getElementById('btnConnectSpotify');

  const spotifyStatus = document.querySelector('.meta-status');
  const spotifyLabel = document.querySelector('.meta-label');

  function updateSpotifyCard({ status, label, buttonText, connected = false }) {
    if (spotifyStatus) spotifyStatus.textContent = status;
    if (spotifyLabel) spotifyLabel.textContent = label;

    const card = btnConnectSpotify?.closest('.spotify-account-card');
    const normalizedStatus = String(status || '').toLocaleLowerCase('tr-TR');
    let state = 'idle';

    if (connected) state = 'connected';
    else if (normalizedStatus.includes('kontrol ediliyor')) state = 'loading';
    else if (normalizedStatus.includes('bağlı değil')) state = 'disconnected';
    else if (normalizedStatus.includes('yeniden bağlanmalı')) state = 'reconnect';
    else if (normalizedStatus.includes('başarısız') || normalizedStatus.includes('edilemedi')) state = 'error';
    else if (normalizedStatus.includes('gerekli')) state = 'required';

    if (card) {
      card.dataset.spotifyState = state;
    }

    if (btnConnectSpotify) {
      btnConnectSpotify.textContent = buttonText;
      btnConnectSpotify.disabled = connected || state === 'loading' || state === 'required';
      btnConnectSpotify.classList.toggle('is-connected', connected);
      btnConnectSpotify.classList.toggle('is-loading', state === 'loading');
      btnConnectSpotify.classList.toggle('is-error', state === 'error');
    }
  }

  function setNowPlayingPolling(enabled) {
    spotifyConnectionUsable = Boolean(enabled);

    if (!spotifyConnectionUsable) {
      if (nowPlayingPollTimer) {
        clearInterval(nowPlayingPollTimer);
        nowPlayingPollTimer = null;
      }
      setCompanionDockEmpty();
      window.updateLyricsPlaybackFromSpotify?.(null);
      initShareWizardState(null);
      return;
    }

    if (!nowPlayingPollTimer) {
      loadMyNowPlaying().finally(() => {
        initShareWizardState(window.__songShareLastNowPlaying || null);
      });
      nowPlayingPollTimer = setInterval(loadMyNowPlaying, NOW_PLAYING_POLL_INTERVAL_MS);
    }
  }

  async function loadSpotifyStatus() {
    const token = localStorage.getItem('token');

    updateSpotifyCard({
      status: 'KONTROL EDİLİYOR',
      label: 'Spotify bağlantısı kontrol ediliyor',
      buttonText: 'YÜKLENİYOR…'
    });
    if (btnConnectSpotify) btnConnectSpotify.disabled = true;

    try {
      const statusHeaders = {};
      if (token && token !== 'cookie-session') {
        statusHeaders.Authorization = `Bearer ${token}`;
      }
      const res = await fetch('/api/spotify/status', {
        headers: statusHeaders,
        credentials: 'include'
      });

      if (res.status === 401 || res.status === 403) {
        setNowPlayingPolling(false);
        updateSpotifyCard({
          status: 'OTURUM GEREKLİ',
          label: 'Oturumun sona ermiş olabilir; yeniden giriş yap',
          buttonText: 'YENİDEN GİRİŞ YAP'
        });
        return;
      }

      const data = await res.json();

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Spotify durumu alınamadı.');
      }

      if (!data.connected) {
        setNowPlayingPolling(false);
        updateSpotifyCard({
          status: 'BAĞLI DEĞİL',
          label: 'Spotify hesabını bağla',
          buttonText: 'SPOTIFY’I BAĞLA'
        });
        return;
      }

      if (data.usable) {
        updateSpotifyCard({
          status: 'SPOTIFY BAĞLI',
          label: data.account?.displayName
            ? `Bağlı hesap: ${data.account.displayName}`
            : 'Spotify hesabın bağlı ve kullanılabilir',
          buttonText: 'BAĞLANDI',
          connected: true
        });
        setNowPlayingPolling(true);
        return;
      }

      setNowPlayingPolling(false);
      updateSpotifyCard({
        status: 'YENİDEN BAĞLANMALI',
        label: 'Spotify erişimi yenilenemedi. Hesabını tekrar bağla.',
        buttonText: 'YENİDEN BAĞLA'
      });
    } catch (err) {
      setNowPlayingPolling(false);
      console.error('Spotify durum kontrolü başarısız:', err);

      window.showSongShareToast?.(err.message || 'Spotify bağlantı durumu alınamadı.', 'error');
      updateSpotifyCard({
        status: 'KONTROL EDİLEMEDİ',
        label: 'Bağlantı durumu alınamadı. Sayfayı yenilemeyi dene.',
        buttonText: 'TEKRAR DENE'
      });
    }
  }

  btnConnectSpotify?.addEventListener('click', async () => {
    // Bağlantı durumu tekrar kontrol edilebilsin.
    if (btnConnectSpotify.textContent.includes('TEKRAR DENE')) {
      await loadSpotifyStatus();
      return;
    }

    const token = localStorage.getItem('token');

    // Cookie-only authentication is supported; a JS-readable JWT is not required.
    try {
      btnConnectSpotify.disabled = true;
      btnConnectSpotify.textContent = 'YÖNLENDİRİLİYOR…';

      const loginHeaders = {};
      if (token && token !== 'cookie-session') {
        loginHeaders.Authorization = `Bearer ${token}`;
      }
      const res = await fetch('/api/spotify/login-url', {
        headers: loginHeaders,
        credentials: 'include'
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.message || 'Spotify bağlantı linki üretilemedi.');
      }

      window.location.href = data.url;
    } catch (err) {
      console.error('Spotify bağlantı hatası:', err);

      window.showSongShareToast?.(err.message || 'Spotify bağlantısı başlatılamadı.', 'error');
      updateSpotifyCard({
        status: 'BAĞLANTI BAŞARISIZ',
        label: err.message || 'Spotify bağlantısı başlatılamadı.',
        buttonText: 'TEKRAR DENE'
      });
    }
  });
  window.addEventListener('songshare:spotify-disconnected', () => loadSpotifyStatus());
  // Spotify status is checked from startup after page state is ready.

  let lastTrackTitle = null;

  let companionDockLoaded = false;
  let lastPlayedTrack = null;

  function setCompanionDockLoading() {
    const skeleton = document.getElementById('playerCoverSkeleton');
    const img = document.getElementById('playerCoverImg');

    const title = document.getElementById('playerTrackTitle');
    const artist = document.getElementById('playerTrackArtist');

    const indicator = document.getElementById('nowPlayingIndicator');

    skeleton?.classList.add('dock-loading-skeleton');

    if (img) {
      img.style.display = 'none';
      img.style.opacity = '0';
    }

    title?.classList.add('dock-loading-line');
    artist?.classList.add(
      'dock-loading-line',
      'dock-loading-line-small'
    );

    if (indicator) {
      indicator.textContent = 'LOADING';
    }
  }


  function setCompanionDockTrack({
    title,
    artist,
    cover,
    isPlaying = false,
    isLastPlayed = false
  }) {
    const skeleton = document.getElementById('playerCoverSkeleton');
    const img = document.getElementById('playerCoverImg');

    const titleEl = document.getElementById('playerTrackTitle');
    const artistEl = document.getElementById('playerTrackArtist');
    const indicator = document.getElementById('nowPlayingIndicator');

    skeleton?.classList.remove('dock-loading-skeleton');

    if (titleEl) {
      titleEl.classList.remove(
        'dock-loading-line',
        'dock-loading-line-small'
      );

      titleEl.textContent = title || '';
    }

    if (artistEl) {
      artistEl.classList.remove(
        'dock-loading-line',
        'dock-loading-line-small'
      );

      artistEl.textContent = artist || '';
    }

    if (cover && img) {
      img.src = cover;
      img.style.display = 'block';

      requestAnimationFrame(() => {
        img.style.opacity = '1';
      });
    } else if (img) {
      img.style.display = 'none';
    }

    if (indicator) {
      if (isPlaying) {
        indicator.textContent = 'LISTENING NOW';
      } else if (isLastPlayed) {
        indicator.textContent = 'LAST PLAYED';
      } else {
        indicator.textContent = 'COMPANION';
      }
    }

    companionDockLoaded = true;
    window.refreshCompanionFullscreenTrack?.();
  }


  function setCompanionDockEmpty() {
    const skeleton = document.getElementById('playerCoverSkeleton');
    const img = document.getElementById('playerCoverImg');

    const title = document.getElementById('playerTrackTitle');
    const artist = document.getElementById('playerTrackArtist');
    const indicator = document.getElementById('nowPlayingIndicator');

    skeleton?.classList.remove('dock-loading-skeleton');

    if (img) {
      img.style.display = 'none';
      img.removeAttribute('src');
    }

    title?.classList.remove(
      'dock-loading-line',
      'dock-loading-line-small'
    );

    artist?.classList.remove(
      'dock-loading-line',
      'dock-loading-line-small'
    );

    if (title) title.textContent = 'Müzik Çalmıyor';
    if (artist) artist.textContent = 'Spotify Beklemede';

    if (indicator) {
      indicator.textContent = 'COMPANION';
    }

    companionDockLoaded = true;
    window.refreshCompanionFullscreenTrack?.();
  }

  async function loadMyNowPlaying() {
    if (document.visibilityState === 'hidden') return;

    const token = localStorage.getItem('token');

    if (!spotifyConnectionUsable) {
      setCompanionDockEmpty();
      window.updateLyricsPlaybackFromSpotify?.(null);
      return;
    }

    if (nowPlayingRequestInFlight) return;
    nowPlayingRequestInFlight = true;

    try {
      const playbackHeaders = {};
      if (token && token !== 'cookie-session') {
        playbackHeaders.Authorization = `Bearer ${token}`;
      }
      const res = await fetch('/api/spotify/now-playing', {
        headers: playbackHeaders,
        credentials: 'include'
      });

      if (!res.ok) {
        // Don't repeat a failing Spotify request every five seconds.
        // Re-check status once; polling restarts only if the account is usable.
        if (res.status === 401 || res.status === 403) {
          if (nowPlayingPollTimer) {
            clearInterval(nowPlayingPollTimer);
            nowPlayingPollTimer = null;
          }
          spotifyConnectionUsable = false;
          await loadSpotifyStatus();
        } else {
          console.warn('Now playing alınamadı:', res.status);
        }
        window.updateLyricsPlaybackFromSpotify?.(null);
        setCompanionDockEmpty();
        return;
      }

      const data = await res.json();
      window.__songShareLastNowPlaying = data;
      window.updateCompanionPlaybackFromSpotify?.(data);
      window.dispatchEvent(new CustomEvent('songshare:now-playing-updated', { detail: data }));
      window.updateLyricsPlaybackFromSpotify?.(data);

      const dockSong =
        document.getElementById('playerTrackTitle');

      /*
       * =====================================================
       * 1. ŞU ANDA ÇALIYOR
       * =====================================================
       */
      if (data.isPlaying && data.title) {

        updateGetCurrentSongButton(
          true,
          data.title
        );

        const trackChanged =
          lastTrackTitle !== data.title;

        lastTrackTitle = data.title;

        setCompanionDockTrack({
          title: data.title,
          artist: data.artist,
          cover: data.albumArt,
          isPlaying: true
        });

        if (trackChanged) {
          window.fetchSyncedLyricsExternal?.(
            data.title,
            data.artist
          );
        }

        return;
      }

      /*
       * =====================================================
       * 2. ÇALMIYOR AMA SON ÇALAN VAR
       * =====================================================
       */

      updateGetCurrentSongButton(false);

      const lastSong =
        data.lastSong ||
        {};

      const lastTitle =
        lastSong.name ||
        data.last_song_name ||
        data.lastSongName ||
        null;

      const lastArtist =
        lastSong.artist ||
        data.last_song_artist ||
        data.lastSongArtist ||
        null;

      const lastCover =
        lastSong.cover ||
        data.last_song_cover ||
        data.lastSongCover ||
        null;

      if (lastTitle) {

        lastTrackTitle = null;

        setCompanionDockTrack({
          title: lastTitle,
          artist: lastArtist || 'Bilinmeyen Sanatçı',
          cover: lastCover,
          isPlaying: false,
          isLastPlayed: true
        });

        return;
      }

      /*
       * =====================================================
       * 3. HİÇBİR ŞARKI YOK
       * =====================================================
       */

      lastTrackTitle = null;

      setCompanionDockEmpty();

    } catch (err) {
      console.warn(
        'Now playing alınamadı:',
        err
      );

      /*
       * İlk yükleme sırasında hata olursa
       * skeleton sonsuza kadar kalmasın.
       */
      if (!companionDockLoaded) {
        setCompanionDockEmpty();
      }
    } finally {
      nowPlayingRequestInFlight = false;
    }
  }

  window.refreshSongShareNowPlaying = loadMyNowPlaying;

  let friendsActivityLoaded = false;

  function renderFriendsActivitySkeleton() {

    const container =
      document.getElementById('friendsListContainer');

    if (!container) return;

    container.innerHTML = `
    <div class="friends-loading-skeleton">

      ${Array.from({ length: 3 }, (_, i) => `
        <div
          class="friend-skeleton-card"
          style="--skeleton-delay:${i * 90}ms"
        >

          <div class="friend-skeleton-avatar"></div>

          <div class="friend-skeleton-content">

            <div class="friend-skeleton-line friend-name"></div>

            <div class="friend-skeleton-line friend-song"></div>

          </div>

          <div class="friend-skeleton-eq">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>

        </div>
      `).join('')}

    </div>
  `;
  }

  async function loadFriendsActivity() {
    const token = localStorage.getItem('token');

    const container =
      document.getElementById('friendsListContainer');

    const pill =
      document.getElementById('onlineFriendsCount');

    const navPill =
      document.getElementById('friendsNavPill');

    if (!container) return;

    /*
     * Sadece ilk yüklemede skeleton.
     *
     * Her 15 saniyelik refresh'te
     * kullanıcı tekrar skeleton görmeyecek.
     */
    if (!friendsActivityLoaded) {
      renderFriendsActivitySkeleton();
    }

    if (!container) return;

    try {
      const friendsHeaders = {};
      if (token && token !== 'cookie-session') {
        friendsHeaders.Authorization = `Bearer ${token}`;
      }
      const res = await fetch('/api/spotify/friends-activity', {
        headers: friendsHeaders,
        credentials: 'include'
      });

      if (!res.ok) return;

      const result = await res.json();
      const activities = result.data || [];
      const liveCount = activities.filter(a => a.isPlaying).length;

      if (pill) pill.textContent = `${liveCount} LISTENING`;
      if (navPill) navPill.textContent = `${liveCount} live`;

      if (activities.length === 0) {
        container.innerHTML = `
        <p style="
            font-size:0.75rem;
            color:var(--text-dim);
            padding:12px;
        ">
            Aktif arkadaş bulunmuyor.
        </p>
    `;

        friendsActivityLoaded = true;
        return;
      }

      container.innerHTML = activities.map((act) => {

        const isLive = Boolean(
          act.isPlaying &&
          act.title
        );

        const username =
          act.username ||
          act.user_name ||
          'Arkadaş';

        /*
         * ------------------------------------------------------
         * AVATAR URL
         * ------------------------------------------------------
         */

        /*
         * ------------------------------------------------------
         * ACCOUNT AVATAR DATA
         * ------------------------------------------------------
         */




        /*
         * ------------------------------------------------------
         * ALBUM ART
         * ------------------------------------------------------
         */

        const albumArt =
          act.albumArt ||
          act.album_art ||
          act.albumImage ||
          act.album_image ||
          '';


        /*
         * ------------------------------------------------------
         * TRACK INFO
         * ------------------------------------------------------
         */

        const title =
          act.title ||
          'Bilinmeyen Şarkı';

        const artist =
          act.artist ||
          'Bilinmeyen Sanatçı';

        // ------------------------------------------------------
        // LAST PLAYED SONG
        // ------------------------------------------------------

        const lastSong = act.lastSong || {};

        const lastSongName =
          lastSong.name ||
          act.last_song_name ||
          null;

        const lastSongArtist =
          lastSong.artist ||
          act.last_song_artist ||
          null;

        const lastSongCover =
          lastSong.cover ||
          act.last_song_cover ||
          null;

        const lastSongPlayedAt =
          lastSong.playedAt ||
          act.last_song_played_at ||
          null;

        const hasLastSong = Boolean(lastSongName);

        const offlineCover = lastSongCover || null;

        const lastPlayedTime = formatLastPlayedTime(lastSongPlayedAt);


        /*
         * ------------------------------------------------------
         * SOL GÖRSEL
         * ------------------------------------------------------
         */

        const visual = isLive && albumArt
          ? `
    <div class="friend-card-cover-shell friend-live-cover">

      <img
        src="${escapeHtml(albumArt)}"
        alt="${escapeHtml(title)}"
        class="friend-album-art"
        loading="eager"
      />

      <div class="friend-cover-overlay"></div>

    </div>
  `
          : `
    <div class="friend-card-cover-shell friend-offline-visual">

      ${offlineCover
            ? `
            <img
              src="${escapeHtml(offlineCover)}"
              alt="${escapeHtml(lastSongName || 'Last played')}"
              class="friend-offline-cover"
              loading="lazy"
              onerror="this.style.display='none';"
            />

            <div class="friend-offline-cover-overlay"></div>
          `
            : ''
          }

      <div
        class="friend-avatar-large friend-avatar-render"
        data-friend-avatar
      ></div>

    </div>
  `;


        /*
         * ------------------------------------------------------
         * KULLANICI SATIRI
         * ------------------------------------------------------
         */

        const userAvatar =
          isLive
            ? `
      <div class="friend-avatar-wrap">
        <div
          class="friend-avatar friend-avatar-render"
          data-friend-avatar-small
        ></div>

        <span class="friend-live-dot"></span>
      </div>
    `
            : '';


        /*
         * ------------------------------------------------------
         * EQ / STATUS
         * ------------------------------------------------------
         */

        const eq =
          isLive

            ? `
        <div class="friend-eq">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
      `

            : '';


        const stateBadge =
          isLive

            ? `
        <div class="friend-state-badge live">
          LIVE
        </div>
      `

            : `
        <div class="friend-state-badge">
          OFFLINE
        </div>
      `;


        /*
         * ------------------------------------------------------
         * CARD
         * ------------------------------------------------------
         */

        const clickHandler = isLive
          ? `data-friend-play="true" data-friend-title="${escapeHtml(title)}" data-friend-artist="${escapeHtml(artist)}" data-friend-cover="${escapeHtml(albumArt)}"`
          : '';


        return `
    <div
      class="ios-friend-card ${isLive ? 'state-live' : 'state-offline'}"
      ${clickHandler}
    >

      ${visual}


      <div class="friend-card-content">

        <div class="friend-user-row">

          ${userAvatar}

          <div class="friend-user-copy">

            <span class="friend-username">
              ${escapeHtml(username)}
            </span>

            <span class="friend-status-text">
              ${isLive ? 'Listening Now' : ''}
            </span>

          </div>

        </div>


<div class="friend-song">
  ${isLive
            ? escapeHtml(title)
            : hasLastSong
              ? escapeHtml(lastSongName)
              : 'Henüz şarkı dinlemedi'
          }
</div>

<div class="friend-artist">
  ${isLive
            ? escapeHtml(artist)
            : hasLastSong
              ? escapeHtml(lastSongArtist || 'Bilinmeyen Sanatçı')
              : 'Yakın zamanda dinleme yok'
          }
</div>

${!isLive
            ? `
      <div class="friend-last-played-time">
        ${lastPlayedTime
              ? `Last played · ${escapeHtml(lastPlayedTime)}`
              : 'Last played · Bilinmiyor'
            }
      </div>
    `
            : ''
          }


        ${eq}

      </div>


      ${stateBadge}

    </div>
  `;

      }).join('');

      friendsActivityLoaded = true;

      container.querySelectorAll('[data-friend-play]').forEach((card) => {
        card.addEventListener('click', () => window.playToDock?.(card.dataset.friendTitle || '', card.dataset.friendArtist || '', card.dataset.friendCover || ''));
      });

      // ------------------------------------------------------
      // FRIEND AVATARS - GLOBAL AVATAR RENDERER
      // ------------------------------------------------------

      const cards = container.querySelectorAll('.ios-friend-card');

      cards.forEach((card, index) => {

        const activity = activities[index];

        if (!activity) return;

        const username =
          activity.username ||
          activity.user_name ||
          'Arkadaş';

        const friendUser = {
          user_name: username,

          email:
            activity.email ||
            `${username}@avatar.local`,

          avatar_type:
            activity.avatar_type ||
            activity.avatarType ||
            'photo',

          avatar_data:
            activity.avatar_data ||
            activity.avatarData ||
            {},

          profile_pic_path:
            activity.profile_pic_path ||
            activity.profilePicPath ||
            activity.avatarUrl ||
            activity.avatar_url ||
            activity.avatar ||
            null
        };

        // Büyük avatar
        const largeAvatar =
          card.querySelector('[data-friend-avatar]');

        if (largeAvatar) {
          renderAvatar(
            largeAvatar,
            friendUser,
            {
              size: 72
            }
          );
        }

        // Küçük avatar
        const smallAvatar =
          card.querySelector('[data-friend-avatar-small]');

        if (smallAvatar) {
          renderAvatar(
            smallAvatar,
            friendUser,
            {
              size: 34
            }
          );
        }

      });

      container
        .querySelectorAll(
          '.friend-avatar, .friend-album-art'
        )
        .forEach(img => {
          img.style.opacity = '1';
          img.style.filter = 'none';
          img.style.transform = 'none';
        });
    } catch (err) {
      console.warn('Friends activity yüklenemedi:', err);
    }
  }

  // Şu Anda Çalanı Al Butonu
  window.shareCurrentlyPlaying = async function () {
    const token = localStorage.getItem('token');
    try {
      const playbackHeaders = {};
      if (token && token !== 'cookie-session') {
        playbackHeaders.Authorization = `Bearer ${token}`;
      }
      const res = await fetch('/api/spotify/now-playing', {
        headers: playbackHeaders,
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`Spotify API ${res.status}`);
      const data = await res.json();
      const trackId = extractSpotifyTrackId(data.songUrl || data.spotifyUri || data.uri);

      if (data.isPlaying && trackId) {
        // Önceden elle seçilmiş parça varsa da şu an çalanı seçime uygula.
        lyricRangeStart = lyricRangeEnd = null;
        window.currentSelectedTrack = {
          name: data.title || 'Bilinmeyen Şarkı',
          artist: data.artist || 'Bilinmeyen Sanatçı',
          imageUrl: data.albumArt || '',
          uri: `spotify:track:${trackId}`,
          playbackPositionSec: Math.max(0, Number(data.progress_ms) || 0) / 1000,
          playbackCapturedAt: Date.now(),
          duration_ms: Number(data.duration_ms) || 0,
          isPlaying: true,
          syncWithSpotify: true,
          hasSyncedLyrics: false
        };

        window.__songShareLastNowPlaying = data;
        applyTrackToWizard(window.currentSelectedTrack, true);
        window.updateLyricsPlaybackFromSpotify?.(data);
        window.triggerRightPanelsSlideOut(window.currentSelectedTrack);
        clearShareWizardFeedback();
      } else {
        showShareWizardFeedback('Şu anda Spotify hesabında çalan bir parça bulunamadı.', 'info');
      }
    } catch (e) {
      console.warn('Şu an çalan parça alınamadı:', e);
      showShareWizardFeedback('Şu an çalan şarkı bilgisi alınamadı. Spotify bağlantını kontrol edip tekrar dene.', 'error');
    }
  };

  // ----------------------------------------------------
  // 5. YOUTUBE SYNCED LYRICS PREVIEW VE COMPANION
  // ----------------------------------------------------
  async function fetchSyncedLyrics(trackName, artistName) {
    const wrapper = document.getElementById('l-scroll-wrapper');
    const playBtn = document.getElementById('l-play-btn');

    if (!wrapper) return;
    wrapper.innerHTML = `<div class="lyric-line active">Senkronize sözler aranıyor...</div>`;
    if (playBtn) playBtn.style.opacity = "0.5";

    try {
      const res = await fetch(`/api/auto-sync?track=${encodeURIComponent(trackName)}&artist=${encodeURIComponent(artistName)}`);
      const data = await res.json();

      if (data.videoId) {
        syncedLyrics = data.lyrics || [];
        window.updateCompanionLyrics?.(-1);

        const attemptCue = () => {
          if (isYTReady && ytPlayer?.cueVideoById) {
            ytPlayer.cueVideoById(data.videoId);
            if (playBtn) {
              playBtn.style.opacity = "1";
              playBtn.disabled = false;
            }
          } else {
            setTimeout(attemptCue, 200);
          }
        };
        attemptCue();

        wrapper.innerHTML = syncedLyrics.length > 0
          ? syncedLyrics.map((l, i) => `<div class="lyric-line" id="l-line-${i}">${escapeHtml(l.words)}</div>`).join('')
          : `<div class="lyric-line active">Şarkı sözü bulunamadı, parçayı dinleyebilirsiniz.</div>`;
      } else {
        wrapper.innerText = "Senkron video bulunamadı.";
      }
    } catch (err) {
      wrapper.innerText = "Söz servisi yanıt vermedi.";
    }
  }
  window.fetchSyncedLyricsExternal = fetchSyncedLyrics;

  function onYTStateChange(event) {
    const btn = document.getElementById('l-play-btn');
    if (event.data === YT.PlayerState.PLAYING) {
      if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
      const duration = ytPlayer.getDuration();
      const lTimeline = document.getElementById('l-timeline');
      if (lTimeline) lTimeline.max = duration;

      clearInterval(lyricsTimer);
      lyricsTimer = setInterval(syncLyricsUI, 200);
    } else {
      if (btn) btn.innerHTML = '<i class="fas fa-play"></i>';
      clearInterval(lyricsTimer);
    }
  }

  function syncLyricsUI() {
    if (!ytPlayer || !isYTReady) return;

    const time = ytPlayer.getCurrentTime() - 0.2;
    const curr = document.getElementById('l-currTime');
    const view = document.getElementById('l-lyrics-view');
    const scroll = document.getElementById('l-scroll-wrapper');
    const lTimeline = document.getElementById('l-timeline');

    if (lTimeline) lTimeline.value = ytPlayer.getCurrentTime();
    if (curr) curr.innerText = formatDuration(ytPlayer.getCurrentTime() * 1000);

    const companionActiveIndex = syncedLyrics.findLastIndex(l => l.time <= time);
    window.updateCompanionLyrics?.(companionActiveIndex);

    if (!scroll || !view || !syncedLyrics.length) return;

    const idx = syncedLyrics.findLastIndex(l => l.time <= time);
    if (idx !== -1) {
      const lines = scroll.querySelectorAll('.lyric-line');
      const activeLine = document.getElementById(`l-line-${idx}`);

      if (activeLine && !activeLine.classList.contains('active')) {
        lines.forEach(el => el.classList.remove('active'));
        activeLine.classList.add('active');

        const viewHeight = view.offsetHeight;
        const lineOffset = activeLine.offsetTop;
        const lineHeight = activeLine.offsetHeight;
        const scrollPos = lineOffset - (viewHeight / 2) + (lineHeight / 2);
        scroll.style.transform = `translateY(${-scrollPos}px)`;
      }
    }
  }

  // ----------------------------------------------------
  // 6. SPOTIFY BACKEND PARÇA ARAMA VE SEÇİMİ
  // ----------------------------------------------------
  let searchDebounceTimer = null;
  let spotifySearchRequestId = 0;

  window.handleSpotifySearchInput = function (e) {
    clearTimeout(searchDebounceTimer);
    const q = e.target.value.trim();
    const requestId = ++spotifySearchRequestId;

    if (q.length < 2) {
      if (!q) clearShareWizardFeedback();
      return;
    }
    clearShareWizardFeedback();
    const grid = document.getElementById('wizardSongGrid');
    if (grid) grid.innerHTML = '<div class="selector-search-state"><i class="fa-solid fa-spinner fa-spin"></i><span>Spotify’da aranıyor…</span></div>';

    searchDebounceTimer = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`, {
          headers: { 'Authorization': `Bearer ${token}` }, credentials: 'include'
        });

        // Hızlı aramalarda eski sorgunun cevabı yeni sonuçları ezmesin.
        if (requestId !== spotifySearchRequestId) return;
        if (!res.ok) throw new Error(res.status === 401 ? 'Spotify araması için oturumunu yenilemen gerekiyor.' : `Arama servisi yanıt vermedi (HTTP ${res.status}).`);
        const json = await res.json();
        if (requestId !== spotifySearchRequestId) return;

        if (json.tracks && json.tracks.length > 0) {
          const grid = document.getElementById('wizardSongGrid');
          if (!grid) return;

          grid.innerHTML = json.tracks.map((t, idx) => `
            <button type="button"
              class="selector-tile selector-tile-enter"
              style="--tile-index:${idx}"
              data-search-index="${idx}"
              aria-label="${escapeHtml(t.title)} — ${escapeHtml(t.artist)} seç">
              <img src="${escapeHtml(t.coverUrl || 'https://placehold.co/80x80?text=Music')}" alt="${escapeHtml(t.title)}" loading="lazy" />
              <span class="selector-tile-meta">
                <strong>${escapeHtml(t.title)}</strong>
                <span>${escapeHtml(t.artist)}</span>
              </span>
              <span class="selector-tile-play"><i class="fa-solid fa-play"></i></span>
            </button>
          `).join('');

          grid.querySelectorAll('[data-search-index]').forEach(tile => {
            tile.addEventListener('click', () => {
              const track = json.tracks[Number(tile.dataset.searchIndex)];
              if (!track) return;
              grid.querySelectorAll('.selector-tile').forEach(el => el.classList.remove('selected'));
              tile.classList.add('selected');
              selectCustomTrack(track.title, track.artist, track.coverUrl, track.spotifyUri, track.durationMs || track.duration_ms || 180000);
            });
          });

          const label = document.getElementById('selectorListLabel');
          if (label) label.textContent = `Arama sonuçları (${json.tracks.length})`;
          // Arama sonuçları gösterilirken otomatik şarkı seçme.
          // Kullanıcı hangi parçaya tıklarsa yalnızca o parça seçilsin.
          clearShareWizardFeedback();
        } else {
          if (grid) grid.innerHTML = '<div class="selector-empty-state"><i class="fa-solid fa-magnifying-glass"></i><span>Bu aramayla eşleşen şarkı bulunamadı. Farklı bir başlık veya sanatçı dene.</span></div>';
          showShareWizardFeedback('Sonuç bulunamadı. Şarkı adını veya sanatçıyı farklı yazarak tekrar dene.', 'info');
        }
      } catch (err) {
        if (requestId !== spotifySearchRequestId) return;
        console.error('Spotify arama hatası:', err);
        const grid = document.getElementById('wizardSongGrid');
        if (grid) grid.innerHTML = '<div class="selector-empty-state"><i class="fa-solid fa-triangle-exclamation"></i><span>Arama şu anda tamamlanamadı.</span></div>';
        showShareWizardFeedback(err.message || 'Spotify araması başarısız oldu. Bağlantını kontrol edip tekrar dene.', 'error');
      }
    }, 400);
  };

  window.selectWizardTrack = function (presetKey, trackId) {
    const presets = {
      rebel: { name: 'Rebel Yell', artist: 'Billy Idol', img: 'https://i.scdn.co/image/ab67616d0000b273ed9554eeb17f7ffea9c81352' },
      everlong: { name: 'Everlong', artist: 'Foo Fighters', img: 'https://i1.sndcdn.com/artworks-000079984264-e8xxju-t500x500.jpg' },
      skyfull: { name: 'A Sky Full of Stars', artist: 'Coldplay', img: 'https://i.scdn.co/image/ab67616d00001e028ff7c3580d429c8212b9a3b6' },
      maraton: { name: 'Maraton', artist: 'Ati242', img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-eHQUhSqV86ZoY3Ak8pVP_XqzFIStg-GSaCOu9EwjQw&s' }
    };

    const sel = presets[presetKey];
    if (!sel) return;

    selectCustomTrack(sel.name, sel.artist, sel.img, `spotify:track:${trackId}`);
  };

  window.selectCustomTrack = function (title, artist, coverUrl, spotifyUri, durationMs = 180000) {
    // Farklı parçaya geçerken eski alıntı aralığı ve playback snapshot'ı taşınmasın.
    lyricRangeStart = lyricRangeEnd = null;
    window.currentSelectedTrack = {
      name: title,
      artist,
      imageUrl: coverUrl,
      uri: spotifyUri,
      duration_ms: Number(durationMs) || 180000,
      playbackPositionSec: 0,
      playbackCapturedAt: null,
      isPlaying: false,
      syncWithSpotify: false,
      hasSyncedLyrics: false
    };
    applyTrackToWizard(window.currentSelectedTrack);
    window.triggerRightPanelsSlideOut(window.currentSelectedTrack);
  };


  const artistInfoCache = new Map();
  let artistInfoRequestId = 0;

  async function loadShareArtistInfo(artistName, fallbackCover = '') {
    const imageEl = document.getElementById('shareArtistCover');
    const genresEl = document.getElementById('shareArtistGenres');

    if (!artistName) return;

    const requestId = ++artistInfoRequestId;
    const artist = artistName.split(',')[0].trim();

    if (genresEl) {
      genresEl.textContent = 'Türler yükleniyor...';
    }

    try {
      let data = artistInfoCache.get(artist.toLowerCase());

      if (!data) {
        const response = await fetch(
          `/api/spotify/artist-images?name=${encodeURIComponent(artist)}`
        );

        if (!response.ok) throw new Error('Sanatçı bilgisi alınamadı');

        const result = await response.json();
        data = result.data ?? result.artist ?? result;

        artistInfoCache.set(artist.toLowerCase(), data);
      }

      // Hızlı parça değişimlerinde eski sonuçları uygulama.
      if (requestId !== artistInfoRequestId) return;

      const rawImage =
        data.primaryImageUrl ||
        data.primaryImage ||
        data.imageUrl ||
        data.artistImage ||
        data.images?.[0]?.url ||
        data.images?.[0] ||
        data.image ||
        data.backupImageUrl ||
        data.backupImage;

      const artistImage =
        typeof rawImage === 'string' ? rawImage : rawImage?.url;

      const genres = Array.isArray(data.genres) ? data.genres : [];

      if (imageEl) {
        imageEl.src = artistImage || fallbackCover || '';
        imageEl.alt = `${artist} sanatçı fotoğrafı`;
      }

      if (genresEl) {
        genresEl.innerHTML = genres.length
          ? genres.map(genre =>
            `<span class="artist-genre-chip">${escapeHtml(genre)}</span>`
          ).join('')
          : '<span class="artist-genre-placeholder">Tür bilgisi bulunamadı</span>';
      }
    } catch (error) {
      if (requestId !== artistInfoRequestId) return;

      console.error('Sanatçı bilgisi yüklenemedi:', error);

      if (imageEl) imageEl.src = fallbackCover || '';

      if (genresEl) {
        genresEl.innerHTML =
          '<span class="artist-genre-placeholder">Tür bilgisi alınamadı</span>';
      }
    }
  }


  function getSpotifyTrackId(track) {
    if (!track) return '';
    const raw = String(track.uri || track.spotifyUri || track.id || '').trim();
    const uriMatch = raw.match(/spotify:track:([A-Za-z0-9]+)/i);
    if (uriMatch) return uriMatch[1];
    const urlMatch = raw.match(/open\.spotify\.com\/(?:embed\/)?track\/([A-Za-z0-9]+)/i);
    if (urlMatch) return urlMatch[1];
    return /^[A-Za-z0-9]{10,}$/.test(raw) ? raw : '';
  }

  function applyTrackToWizard(track, isNowPlaying = false) {
    const emptyLayer = document.getElementById('wizEmptyLayer');
    const bgImg = document.getElementById('wizPrevBg');
    const gradient = document.getElementById('wizPrevGradient');
    const bottomMeta = document.getElementById('wizBottomMeta');
    const btnListen = document.getElementById('btnToggleListen');
    const spotifyIframe = document.getElementById('spotifyEmbedIframe');

    if (!track) {
      if (emptyLayer) emptyLayer.style.display = 'flex';
      if (bgImg) bgImg.style.display = 'none';
      if (gradient) gradient.style.display = 'none';
      if (bottomMeta) bottomMeta.style.display = 'none';
      if (btnListen) btnListen.style.display = 'none';
      window.toggleEmbedPlayer(false);
      return;
    }

    if (emptyLayer) emptyLayer.style.display = 'none';
    if (bgImg) {
      bgImg.src = track.imageUrl || '';
      bgImg.style.display = 'block';
    }
    if (gradient) gradient.style.display = 'block';
    if (bottomMeta) bottomMeta.style.display = 'flex';
    if (btnListen) btnListen.style.display = 'inline-flex';

    const titleEl = document.getElementById('wizPrevTitle');
    const artistEl = document.getElementById('wizPrevArtist');
    const badgeEl = document.getElementById('wizStatusBadge');

    if (titleEl) titleEl.textContent = track.name;
    if (artistEl) artistEl.textContent = track.artist;
    if (badgeEl) badgeEl.textContent = isNowPlaying ? 'Şu Anda Çalıyor' : 'Seçilen Parça';

    // Sol sanatçı bilgi kartını seçilen parçayla senkronize et.
    const artistCover = document.getElementById('shareArtistCover');
    const artistName = document.getElementById('shareArtistName');
    const artistTrack = document.getElementById('shareArtistTrack');
    const artistDescription = document.getElementById('shareArtistDescription');
    const artistLink = document.getElementById('shareArtistSpotifyLink');
    loadShareArtistInfo(track.artist, track.imageUrl);
    if (artistName) artistName.textContent = track.artist || 'Bilinmeyen sanatçı';
    if (artistTrack) artistTrack.textContent = track.name || 'Bilinmeyen parça';
    if (artistDescription) {
      artistDescription.textContent = `Paylaşımına eklediğin parça: “${track.name || 'Bilinmeyen parça'}”. Sanatçının diğer çalışmalarını Spotify üzerinden keşfedebilirsin.`;
    }
    if (artistLink) {
      const firstArtist = (track.artist || '').split(',')[0].trim();
      artistLink.href = firstArtist
        ? `https://open.spotify.com/search/${encodeURIComponent(firstArtist)}`
        : 'https://open.spotify.com/';
    }

    const step2Img = document.getElementById('step2SelImg');
    const step2Title = document.getElementById('step2SelTitle');
    const step2Artist = document.getElementById('step2SelArtist');
    if (step2Img) step2Img.src = track.imageUrl || '';
    if (step2Title) step2Title.textContent = track.name;
    if (step2Artist) step2Artist.textContent = track.artist;

    // Her seçimde iframe'i gerçekten durdurup yeniden kur; aksi halde Spotify
    // embed önceki parçanın playback state'ini koruyabiliyor.
    const trackId = getSpotifyTrackId(track);
    if (spotifyIframe) {
      spotifyIframe.src = 'about:blank';
      if (trackId) {
        const embedUrl = new URL(`https://open.spotify.com/embed/track/${encodeURIComponent(trackId)}`);
        embedUrl.searchParams.set('utm_source', 'generator');
        embedUrl.searchParams.set('theme', '0');
        // Her track seçimi için yeni iframe document/state.
        window.setTimeout(() => {
          if (window.currentSelectedTrack !== track) return;
          spotifyIframe.src = embedUrl.toString();
        }, 60);
      }
    }
    window.toggleEmbedPlayer(false);

    const highlightSlider = document.getElementById('wizardHighlightSlider');
    const durationLabel = document.getElementById('wizardTotalDurationLabel');

    if (highlightSlider) {
      let totalSec = 180;
      if (track && track.duration_ms) {
        totalSec = Math.floor(track.duration_ms / 1000);
      }
      highlightSlider.max = totalSec;
      highlightSlider.value = 0;
      if (durationLabel) {
        durationLabel.textContent = formatSecondsSimple(totalSec);
      }
      updateWizardHighlightAnimation(0);
    }
  }

  window.toggleEmbedPlayer = function (show) {
    const embedLayer = document.getElementById('wizEmbedLayer');
    const btnListen = document.getElementById('btnToggleListen');

    if (embedLayer) {
      if (show) {
        embedLayer.classList.add('active');
        if (btnListen) btnListen.style.display = 'none';
      } else {
        embedLayer.classList.remove('active');
        if (btnListen && window.currentSelectedTrack) btnListen.style.display = 'inline-flex';
      }
    }
  };

  function initShareWizardState(data = window.__songShareLastNowPlaying) {
    // İlk merkezi now-playing isteğinin sonucunu kullan; aynı endpoint'e
    // başlangıçta ikinci bir eşzamanlı istek gönderme.
    if (window.currentSelectedTrack) return;

    if (data?.isPlaying && data?.songUrl) {
      const trackId = extractSpotifyTrackId(data.songUrl || data.spotifyUri || data.uri);
      if (!trackId) {
        applyTrackToWizard(null);
        return;
      }

      window.currentSelectedTrack = {
        name: data.title || 'Bilinmeyen Şarkı',
        artist: data.artist || 'Bilinmeyen Sanatçı',
        imageUrl: data.albumArt || '',
        uri: `spotify:track:${trackId}`,
        playbackPositionSec: Math.max(0, Number(data.progress_ms) || 0) / 1000,
        playbackCapturedAt: Date.now(),
        duration_ms: Number(data.duration_ms) || 0,
        isPlaying: Boolean(data.isPlaying),
        syncWithSpotify: true,
        hasSyncedLyrics: false
      };

      applyTrackToWizard(window.currentSelectedTrack, true);
      if (isShareViewActive()) {
        window.triggerRightPanelsSlideOut(window.currentSelectedTrack);
      }
    } else {
      applyTrackToWizard(null);
    }
  }

  // ----------------------------------------------------
  // 7. HIGHLIGHT & RATING SLIDER ANİMASYONLARI
  // ----------------------------------------------------
  const TOTAL_HIGHLIGHT_BARS = 40;
  let wizardVisualizerBars = [];

  function initWizardVisualizerBars() {
    const visualizer = document.getElementById('wizardVisualizer');
    if (!visualizer) return;

    const existingBars = visualizer.querySelectorAll('.bar');
    existingBars.forEach(b => b.remove());

    const slider = document.getElementById('wizardHighlightSlider');

    for (let i = 0; i < TOTAL_HIGHLIGHT_BARS; i++) {
      const bar = document.createElement('div');
      bar.classList.add('bar');
      const height = 20 + Math.random() * 60;
      bar.style.height = `${height}%`;

      if (slider) {
        visualizer.insertBefore(bar, slider);
      } else {
        visualizer.appendChild(bar);
      }
    }
    wizardVisualizerBars = visualizer.querySelectorAll('.bar');
  }

  const highlightSliderForLyrics = document.getElementById('wizardHighlightSlider');
  highlightSliderForLyrics?.addEventListener('input', () => {
    if (!lyricShareMode) return;
    const lines = [...document.querySelectorAll('#dockLyricsScrollBody .lyrics-dock-line')];
    if (!lines.length) return;
    const targetTime = Number(highlightSliderForLyrics.value) || 0;
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    lines.forEach((line, index) => {
      const distance = Math.abs((Number(line.dataset.time) || 0) - targetTime);
      if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
    });
    const previousCount = lyricRangeStart !== null
      ? Math.max(1, Math.min(MAX_LYRICS_SHARE_LINES, Math.abs((lyricRangeEnd ?? lyricRangeStart) - lyricRangeStart) + 1))
      : 1;
    lyricRangeStart = nearestIndex;
    lyricRangeEnd = previousCount > 1 ? Math.min(lines.length - 1, nearestIndex + previousCount - 1) : null;
    renderLyricRangeSelection();
    updateLyricsSharePreview();
  });

  window.updateWizardHighlightAnimation = function (val) {
    const slider = document.getElementById('wizardHighlightSlider');
    const display = document.getElementById('wizardHighlightDisplay');
    if (!slider) return;

    const numVal = parseInt(val, 10) || 0;
    const maxVal = parseInt(slider.max, 10) || 180;
    const percent = maxVal > 0 ? (numVal / maxVal) : 0;
    const timeStr = formatSecondsSimple(numVal);

    if (display) {
      display.textContent = timeStr;
    }

    let color = '#3b82f6';
    if (percent > 0.3) color = '#10b981';
    if (percent > 0.7) color = '#f59e0b';
    if (percent > 0.9) color = '#ef4444';

    document.documentElement.style.setProperty('--primary-glow', color);
    if (display) {
      display.style.color = color;
      display.style.textShadow = `0 0 15px ${color}`;
    }

    const activeThreshold = Math.floor(percent * TOTAL_HIGHLIGHT_BARS);
    if (wizardVisualizerBars.length === 0) {
      wizardVisualizerBars = document.querySelectorAll('#wizardVisualizer .bar');
    }

    wizardVisualizerBars.forEach((bar, index) => {
      if (index <= activeThreshold) {
        bar.style.background = color;
        bar.style.boxShadow = `0 0 10px ${color}aa`;
        bar.style.transform = 'scaleY(1.15)';
      } else {
        bar.style.background = '#334155';
        bar.style.boxShadow = 'none';
        bar.style.transform = 'scaleY(1)';
      }
    });
  };

  window.updateWizardRatingAnimation = function (val) {
    const slider = document.getElementById('wizardRatingSlider');
    const display = document.getElementById('wizardRatingValue');
    if (!slider) return;

    const min = Number(slider.min || 0);
    const max = Number(slider.max || 100);
    const rating = Math.max(min, Math.min(max, Number(val) || 0));
    const percent = max > min ? ((rating - min) / (max - min)) * 100 : 0;
    const color = rating < 35 ? '#818cf8' : rating < 70 ? '#60a5fa' : '#3ecf8e';
    const glow = rating < 35
      ? 'rgba(129,140,248,.42)'
      : rating < 70 ? 'rgba(96,165,250,.42)' : 'rgba(62,207,142,.42)';
    const container = slider.closest('.rating-dynamic-container');

    if (display) {
      display.textContent = String(rating);
      display.style.setProperty('--rating-percent', `${percent}%`);
      display.style.setProperty('--rating-color', color);
      display.style.setProperty('--rating-glow', glow);
      display.setAttribute('aria-label', `${rating} / 100 puan`);
    }
    if (container) {
      container.style.setProperty('--rating-percent', `${percent}%`);
      container.style.setProperty('--rating-color', color);
      container.style.setProperty('--rating-glow', glow);
    }
    slider.style.setProperty('--rating-percent', `${percent}%`);
    slider.style.setProperty('--rating-color', color);
    slider.style.background = `linear-gradient(90deg, ${color} 0%, ${color} ${percent}%, rgba(39,48,61,.95) ${percent}%, rgba(39,48,61,.95) 100%)`;
    slider.setAttribute('aria-valuetext', `${rating} puan`);
  };

  initWizardVisualizerBars();
  updateWizardHighlightAnimation(0);
  updateWizardRatingAnimation(
    document.getElementById('wizardRatingSlider')?.value || 50
  );

  // Görünürlük kartları dropdown yerine yan yana; yalnızca public aktif.
  document.querySelectorAll('.privacy-option[data-privacy]').forEach(option => {
    option.addEventListener('click', () => {
      if (option.disabled) return;
      const privacy = option.dataset.privacy;
      const select = document.getElementById('wizardPrivacySelect');
      if (select) select.value = privacy;
      document.querySelectorAll('.privacy-option[data-privacy]').forEach(card => {
        const selected = card === option;
        card.classList.toggle('is-selected', selected);
        card.setAttribute('aria-pressed', String(selected));
      });
    });
  });
  // ----------------------------------------------------
  // 8. YENİ ŞARKIYI FEED'E YAYINLAMA
  // ----------------------------------------------------
  window.submitWizardShare = async function () {

    if (!window.currentSelectedTrack?.uri) {
      alert('Lütfen önce paylaşmak istediğin şarkıyı seç.');
      return;
    }

    const token = localStorage.getItem('token');
    const comment = document.getElementById('wizardCommentInput')?.value || '';
    const rating = document.getElementById('wizardRatingSlider')?.value || 5;
    const highlightSec = document.getElementById('wizardHighlightSlider')?.value || 0;
    const privacy = document.getElementById('wizardPrivacySelect')?.value || 'public';

    const payload = {
      song_name: window.currentSelectedTrack.name,
      song_artist: window.currentSelectedTrack.artist,
      spotify_uri: window.currentSelectedTrack.uri,
      song_url: `https://open.spotify.com/track/${window.currentSelectedTrack.uri.split(':')[2] || ''}`,
      song_cover_url: window.currentSelectedTrack.imageUrl,
      visibility: privacy,
      ...(lyricShareMode ? {} : { rating_by_user: Number(rating) }),
      comment_by_user: comment,
      recommended_time_by_user: formatSecondsSimple(highlightSec),
      post_type: lyricShareMode ? 'lyrics' : 'music',
      lyrics_excerpt: lyricShareMode ? getSelectedLyricLines().map(line => line.text).join('\n') : null,
      lyrics_start_time: lyricShareMode && getSelectedLyricLines().length ? getSelectedLyricLines()[0].time : null,
      lyrics_end_time: lyricShareMode && getSelectedLyricLines().length ? getSelectedLyricLines().at(-1).time : null,
      lyrics_design: lyricShareMode ? {
        background: lyricDesign.background, background_color: lyricDesign.color,
        text_align: lyricDesign.align, font_style: lyricDesign.font,
        line_spacing: Number(lyricDesign.lineSpacing || 1.45),
        font_color: lyricDesign.fontColor || '#ffffff', font_size: Number(lyricDesign.fontSize || 23),
        text_effect: lyricDesign.textEffect || 'soft', text_transform: lyricDesign.textTransform || 'none',
        letter_spacing: Number(lyricDesign.letterSpacing ?? -0.5), italic: !!lyricDesign.italic,
        include_player: document.getElementById('lyricsIncludePlayer')?.checked !== false,
        include_cover: document.getElementById('lyricsIncludeCover')?.checked !== false,
        include_metadata: document.getElementById('lyricsIncludeMeta')?.checked !== false
      } : null
    };

    if (lyricShareMode && !getSelectedLyricLines().length) {
      alert('Önce sağdaki söz panelinden paylaşmak istediğin ilk ve son satırı seç.');
      return;
    }

    try {
      const res = await fetch('/api/songshare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Paylaşım başarısız');

      const toast = document.getElementById('shareToastOverlay');
      if (toast) {
        toast.classList.add('active');
        setTimeout(() => {
          toast.classList.remove('active');
          location.hash = '#home';
          switchView('#home');
          location.reload();
        }, 1500);
      } else {
        location.hash = '#home';
        switchView('#home');
        location.reload();
      }
    } catch (err) {
      alert('Şarkı paylaşılırken hata oluştu: ' + err.message);
    }
  };

  // ----------------------------------------------------
  // OWNER POST MANAGEMENT (all post types)
  // ----------------------------------------------------
  window.openSongShareEditor = async function (id) {
    const card = document.querySelector(`[data-feed-id="${CSS.escape(String(id))}"]`);
    if (!card) return;
    const token = localStorage.getItem('token');
    const comment = prompt('Paylaşım açıklaması / yorumu:', card.dataset.previewComment || '');
    if (comment === null) return;
    const visibility = prompt('Görünürlük: public, friends veya custom', 'public');
    if (visibility === null) return;
    if (!['public', 'friends', 'custom'].includes(visibility.trim())) { alert('Geçersiz görünürlük.'); return; }
    const payload = { comment_by_user: comment, visibility: visibility.trim() };
    const isLyrics = card.dataset.postType === 'lyrics';
    if (isLyrics) {
      const currentDesign = card.dataset.lyricsDesign || '{}';
      const designText = prompt('Lyrics tasarım ayarlarını JSON olarak düzenle:', currentDesign);
      if (designText === null) return;
      try { payload.lyrics_design = JSON.parse(designText); }
      catch { alert('Lyrics tasarım JSON formatı geçersiz.'); return; }
      const excerpt = prompt('Paylaşılan sözler:', card.dataset.lyricsExcerpt || '');
      if (excerpt === null) return;
      payload.lyrics_excerpt = excerpt;
    } else {
      const rating = prompt('Paylaşım puanı (0-100):', card.dataset.ownerRating || '50');
      if (rating === null) return;
      const number = Number(rating);
      if (!Number.isInteger(number) || number < 0 || number > 100) { alert('Puan 0 ile 100 arasında olmalı.'); return; }
      payload.rating_by_user = number;
    }
    try {
      const response = await fetch(`/api/songshare/${encodeURIComponent(id)}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Paylaşım güncellenemedi.');
      alert('Paylaşım güncellendi.');
      location.reload();
    } catch (error) { alert(error.message); }
  };

  window.deleteSongSharePost = async function (id) {
    if (!confirm('Bu paylaşımı silmek istediğine emin misin? Bu işlem geri alınamaz.')) return;
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/songshare/${encodeURIComponent(id)}`, {
        method: 'DELETE', credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Paylaşım silinemedi.');
      document.querySelector(`[data-feed-id="${CSS.escape(String(id))}"]`)?.remove();
    } catch (error) { alert(error.message); }
  };

  // ----------------------------------------------------
  // 9. FEED AKIŞI ÇEKME
  // ----------------------------------------------------

  let feedPage = 1;
  let isLoadingFeed = false;
  let hasMoreSuggestions = true;

  /*
   * ====================================================
   * FEED HELPER FUNCTIONS
   * ====================================================
   */

  function feedValue(item, ...keys) {
    for (const key of keys) {
      const parts = key.split('.');
      let value = item;

      for (const part of parts) {
        value = value?.[part];
      }

      if (
        value !== undefined &&
        value !== null &&
        value !== ''
      ) {
        return value;
      }
    }

    return null;
  }

  function feedTimeLabel(value) {
    if (!value) return '';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    const diff = Math.max(
      0,
      Date.now() - date.getTime()
    );

    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'az önce';

    if (minutes < 60) {
      return `${minutes}dk önce`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `${hours}sa önce`;
    }

    const days = Math.floor(hours / 24);

    if (days < 7) {
      return `${days}g önce`;
    }

    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }


  /*
   * ====================================================
   * FEED DATA NORMALIZATION
   * ====================================================
   */

  function normalizeFeedItem(raw) {

    const user =
      feedValue(
        raw,
        'user',
        'author',
        'sender',
        'shared_by',
        'created_by'
      ) || {};

    const song =
      feedValue(
        raw,
        'song',
        'track'
      ) || {};


    /*
     * ====================================================
     * SONG
     * ====================================================
     */

    const title =
      feedValue(
        raw,
        'song_name',
        'songName',
        'title',
        'track_name',
        'trackName',
        'song.title',
        'track.title'
      ) ||
      feedValue(
        song,
        'name',
        'title'
      ) ||
      'Bilinmeyen Şarkı';


    const artist =
      feedValue(
        raw,
        'song_artist',
        'songArtist',
        'artist',
        'artist_name',
        'artistName',
        'song.artist',
        'track.artist'
      ) ||
      feedValue(
        song,
        'artist',
        'artist_name'
      ) ||
      'Bilinmeyen Sanatçı';


    const cover =
      feedValue(
        raw,
        'song_cover_url',
        'songCoverUrl',
        'album_art',
        'albumArt',
        'cover_url',
        'coverUrl',
        'image_url',
        'imageUrl',
        'song.cover',
        'track.cover',
        'song.album_art',
        'track.album_art'
      ) ||
      feedValue(
        song,
        'cover',
        'coverUrl',
        'albumArt',
        'image'
      ) ||
      '';


    const artistCover =
      feedValue(
        raw,
        'song_artist_cover_url',
        'songArtistCoverUrl',
        'artist_cover_url',
        'artistCoverUrl',
        'group_photo_url',
        'groupPhotoUrl'
      ) || '';



    const spotifyUrl =
      feedValue(
        raw,
        'song_url',
        'songUrl',
        'spotify_url',
        'spotifyUrl',
        'track_url',
        'trackUrl'
      ) || '';


    const uri =
      feedValue(
        raw,
        'spotify_uri',
        'spotifyUri',
        'uri',
        'track_uri',
        'trackUri'
      ) ||
      feedValue(
        song,
        'uri',
        'spotify_uri'
      ) ||
      '';


    /*
     * ====================================================
     * SHARER USER
     * ====================================================
     */

    const userName =
      feedValue(
        raw,
        'sharer_username',
        'username',
        'user_name',
        'display_name',
        'name',
        'user.username',
        'author.username',
        'sender.username',
        'shared_by.username'
      ) ||
      feedValue(
        user,
        'username',
        'display_name',
        'name'
      ) ||
      'Song Share Kullanıcısı';


    /*
     * Avatar URL / PATH
     */

    const avatar =
      feedValue(raw, 'sharer_avatar', 'profile_pic_path', 'avatar') ||
      feedValue(user, 'profile_pic_path', 'avatar');

    const avatarType =
      feedValue(raw, 'sharer_avatar_type', 'avatar_type', 'avatarType') ||
      feedValue(user, 'avatar_type', 'avatarType') ||
      'builtin';

    const avatarData =
      feedValue(raw, 'sharer_avatar_data', 'avatar_data', 'avatarData') ||
      feedValue(user, 'avatar_data', 'avatarData') ||
      {};


    /*
     * ====================================================
     * RATINGS
     * ====================================================
     */

    // Paylaşanın kendi puanı
    const sharerRating =
      Number(
        feedValue(
          raw,
          'rating_by_user',
          'ratingByUser'
        ) ?? 0
      );


    // Topluluk ortalaması
    const communityRating =
      Number(
        feedValue(
          raw,
          'community_rating',
          'communityRating',
          'average_rating',
          'averageRating'
        ) ?? 0
      );


    // Topluluk oy sayısı
    const communityRatingCount =
      Number(
        feedValue(
          raw,
          'community_rating_count',
          'communityRatingCount',
          'rating_count',
          'ratingCount'
        ) ?? 0
      );


    // Giriş yapan kullanıcının verdiği puan
    const myRating =
      raw.my_rating !== null &&
        raw.my_rating !== undefined
        ? Number(raw.my_rating)
        : null;

    const ratings = Array.isArray(raw.ratings) ? raw.ratings : [];


    /*
     * ====================================================
     * OWNER COMMENT
     * ====================================================
     */

    const comment =
      feedValue(
        raw,
        'comment_by_user',
        'commentByUser'
      ) || '';


    /*
     * ====================================================
     * HIGHLIGHT
     * ====================================================
     */

    const highlight =
      feedValue(
        raw,
        'recommended_time_by_user',
        'recommendedTimeByUser',
        'highlight',
        'highlight_time',
        'highlightTime'
      ) || '';


    /*
     * ====================================================
     * META
     * ====================================================
     */


    const created = feedValue(
      raw,
      'date_added',
      'dateAdded',
      'created_at',
      'createdAt',
      'shared_at',
      'sharedAt',
      'date',
      'timestamp'
    );



    const id =
      feedValue(
        raw,
        'id',
        '_id',
        'share_id',
        'shareId',
        'songshare_id',
        'songshareId'
      ) ||
      `feed-${Math.random()
        .toString(36)
        .slice(2)}`;


    const reposts =
      Number(
        feedValue(
          raw,
          'repost_count',
          'repostCount',
          'reposts',
          'repost_count_total'
        ) ?? 0
      );


    /*
     * ====================================================
     * OTHER USERS' COMMENTS
     * ====================================================
     */

    const comments =
      feedValue(
        raw,
        'comments',
        'comment_list',
        'commentList'
      ) || [];


    const repostUsers =
      feedValue(
        raw,
        'repost_users',
        'repostUsers',
        'reposters'
      ) || [];


    const match =
      feedValue(
        raw,
        'taste_match',
        'tasteMatch',
        'match_percentage',
        'matchPercentage'
      );


    return {

      raw,

      id,

      title,
      artist,
      cover,
      spotifyUrl,
      uri,

      cover,
      artistCover,
      spotifyUrl,


      /*
       * User
       */

      userName,
      isOwner: Boolean(feedValue(raw, 'is_owner', 'isOwner')),
      postType: String(feedValue(raw, 'post_type', 'postType') || 'music'),
      lyricsDesign: feedValue(raw, 'lyrics_design', 'lyricsDesign') || {},
      lyricsExcerpt: String(feedValue(raw, 'lyrics_excerpt', 'lyricsExcerpt') || ''),
      avatar,

      avatarType,
      avatarData,

      /*
       * Ratings
       */

      sharerRating,

      communityRating,

      communityRatingCount,

      myRating,

      ratings,

      /*
       * Owner content
       */

      comment,

      highlight,

      /*
       * Meta
       */

      created,

      /*
       * Community content
       */

      reposts,
      repostedByMe: Boolean(feedValue(raw, 'is_reposted_by_me', 'isRepostedByMe')),

      comments,

      repostUsers,

      match
    };
  }


  /*
   * ====================================================
   * AVATAR / SPOTIFY URL
   * ====================================================
   */

  function feedAvatarUrl(item) {

    /*
     * ----------------------------------------------------
     * 1. Avatar renderer verisi varsa
     * ----------------------------------------------------
     *
     * avatar_type / avatar_data backend'den geliyorsa
     * burada doğrudan kullanılabilecek bir data URL
     * oluşturmaya çalışıyoruz.
     */

    if (
      item.avatarData &&
      typeof item.avatarData === 'string'
    ) {

      const data =
        item.avatarData.trim();

      if (data.startsWith('data:image/')) {
        return data;
      }

      if (
        data.startsWith('http://') ||
        data.startsWith('https://')
      ) {
        return data;
      }

      if (
        data.startsWith('/content/') ||
        data.startsWith('content/')
      ) {
        return data.startsWith('/')
          ? data
          : `/${data}`;
      }
    }


    /*
     * ----------------------------------------------------
     * 2. Normal avatar URL/path
     * ----------------------------------------------------
     */

    if (item.avatar) {

      const avatar =
        String(item.avatar).trim();


      if (
        avatar.startsWith('http://') ||
        avatar.startsWith('https://')
      ) {
        return avatar;
      }


      if (
        avatar.startsWith('data:image/')
      ) {
        return avatar;
      }


      if (
        avatar.startsWith('/content/') ||
        avatar.startsWith('content/')
      ) {
        return avatar.startsWith('/')
          ? avatar
          : `/${avatar}`;
      }


      return `/media/${avatar
        .replace(
          /^\/?(media\/)?/,
          ''
        )}`;
    }


    /*
     * ----------------------------------------------------
     * 3. Fallback
     * ----------------------------------------------------
     */

    return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
      item.userName || 'user'
    )}`;
  }


  function spotifyTrackUrl(item) {
    const match = String(item.uri || '').match(/^spotify:track:([A-Za-z0-9]{10,40})$/);
    const candidate = item.spotifyUrl || (match ? `https://open.spotify.com/track/${match[1]}` : '');
    try {
      const url = new URL(candidate);
      return url.protocol === 'https:' && url.hostname === 'open.spotify.com' ? url.toString() : '#';
    } catch {
      return '#';
    }
  }


  /*
   * ====================================================
   * FEED SKELETON
   *
   * İlk açılışta gerçek kartların yerine
   * gri animasyonlu placeholder gösterilir.
   * ====================================================
   */

  function renderFeedSkeleton(count = 3) {

    const container =
      document.getElementById(
        'dynamicFeedItems'
      );

    const legacyCard =
      document.getElementById(
        'feedCard-1'
      );

    if (!container) return;

    /*
     * Eski hard-coded kartı gizliyoruz.
     * Böylece API yüklenirken eski örnek kart
     * görünmüyor.
     */
    if (legacyCard) {
      legacyCard.style.display = 'none';
    }

    container.innerHTML = `
      <div class="feed-loading-stack">

        ${Array.from(
      { length: count },
      (_, i) => `

          <div
            class="feed-skeleton-card"
            style="animation-delay:${i * 90}ms"
          >

            <div class="feed-skeleton-header">

              <div class="feed-skeleton-user">

                <div
                  class="
                    feed-skeleton-avatar
                    feed-skeleton-line
                  "
                ></div>

                <div
                  style="
                    display:flex;
                    flex-direction:column;
                    gap:7px;
                    width:150px;
                  "
                >

                  <div
                    class="
                      feed-skeleton-line
                      medium
                    "
                  ></div>

                  <div
                    class="
                      feed-skeleton-line
                      short
                    "
                  ></div>

                </div>

              </div>

              <div
                class="
                  feed-skeleton-pill
                "
              ></div>

            </div>


            <div class="feed-skeleton-main">

              <div
                class="
                  feed-skeleton-cover
                "
              ></div>


              <div
                class="
                  feed-skeleton-details
                "
              >

                <div
                  class="
                    feed-skeleton-line
                    long
                  "
                  style="
                    height:18px;
                  "
                ></div>

                <div
                  class="
                    feed-skeleton-line
                    medium
                  "
                ></div>

                <div
                  class="
                    feed-skeleton-quote
                  "
                ></div>

                <div
                  class="
                    feed-skeleton-line
                    short
                  "
                ></div>

                <div
                  style="
                    display:flex;
                    gap:8px;
                  "
                >

                  <div
                    class="
                      feed-skeleton-pill
                    "
                  ></div>

                  <div
                    class="
                      feed-skeleton-pill
                    "
                  ></div>

                </div>

              </div>

            </div>

          </div>

        `
    ).join('')}

      </div>
    `;
  }

  window.toggleRateMiniPopup = function (shareId, event) {
    if (event) {
      event.stopPropagation();
    }

    const popup = document.getElementById(
      `ratePopup-${shareId}`
    );

    if (!popup) {
      console.warn(
        'Rating popup bulunamadı:',
        shareId
      );
      return;
    }

    // Diğer açık rating popup'larını kapat
    document
      .querySelectorAll('.rate-mini-popup')
      .forEach(el => {
        if (el !== popup) {
          el.classList.remove('active');
        }
      });

    // Bu popup'ı aç/kapat
    popup.classList.toggle('active');
  };


  window.updateMiniScore = function (shareId, value) {
    const val = Math.max(0, Math.min(100, Number(value) || 0));

    const valueLabel = document.getElementById(`rangeVal-${shareId}`);
    const moodLabel = document.getElementById(`ratingMood-${shareId}`);
    const slider = document.getElementById(`rangeInput-${shareId}`);

    // Daha sade, sabit renkli puan göstergesi
    if (valueLabel) valueLabel.textContent = val;

    if (moodLabel) {
      moodLabel.textContent =
        val < 40 ? 'Beğenmedim' :
          val < 60 ? 'Ortalama' :
            val < 75 ? 'Güzel' :
              val < 90 ? 'Çok iyi' :
                'Favorilerimden';
    }

    if (slider) {
      slider.style.setProperty('--rating-progress', `${val}%`);
    }
  };



  // Popup dışına tıklanınca kapat; popup içindeki slider ve butonlar etkilenmez.
  document.addEventListener('click', (event) => {
    if (event.target.closest('.rate-mini-popup, .btn-rate-trigger')) return;
    document.querySelectorAll('.rate-mini-popup.active').forEach(popup => popup.classList.remove('active'));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      document.querySelectorAll('.rate-mini-popup.active').forEach(popup => popup.classList.remove('active'));
    }
  });

  window.submitRate = async function (shareId) {
    const slider = document.getElementById(`rangeInput-${shareId}`);
    const popup = document.getElementById(`ratePopup-${shareId}`);
    const button = popup?.querySelector('.btn-submit-mini');
    if (!slider || !button) return;
    const rating = Number(slider.value);
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span>Kaydediliyor…</span>';
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/songshare/rate/${encodeURIComponent(shareId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ rating })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Puan kaydedilemedi.');
      button.innerHTML = '<span>Kaydedildi</span><i class="fa-solid fa-check"></i>';
      const card = popup.closest('.feed-card') || popup.parentElement?.parentElement;
      const score = card?.querySelector('.compact-rating-badge .cr-label');
      if (score && payload.data) score.textContent = `Genel Puan ${Number(payload.data.average).toFixed(1)} (${payload.data.count} Oy)`;
      const votersList = document.getElementById(`ratingVoters-${shareId}`);
      const voters = Array.isArray(payload.data?.ratings) ? payload.data.ratings : [];
      const headingCount = popup.querySelector('.rating-voters-heading span:last-child');
      if (headingCount) headingCount.textContent = `${voters.length} kişi`;
      if (votersList) votersList.innerHTML = voters.length ? voters.map(voter => `
        <div class="rating-voter-row"><div class="rating-voter-avatar">${escapeHtml((voter.username || 'U').slice(0, 1).toUpperCase())}</div><span class="rating-voter-name">${escapeHtml(voter.username || 'Kullanıcı')}</span><strong class="rating-voter-score">${(Number(voter.rating) / 10).toFixed(1)}<small>/10</small></strong></div>
      `).join('') : '<div class="rating-voters-empty">Henüz puan veren yok.</div>';
      setTimeout(() => popup.classList.remove('active'), 650);
    } catch (error) {
      button.innerHTML = original;
      alert(error.message || 'Puan kaydedilemedi.');
    } finally {
      button.disabled = false;
    }
  };

  /*
   * ====================================================
   * FEED CARD
   * ====================================================
   */

  function renderFeedCard(raw, index) {

    const item = normalizeFeedItem(raw);

    const safeTitle = escapeHtml(item.title);
    const safeArtist = escapeHtml(item.artist);
    const safeUser = escapeHtml(item.userName);

    const avatar = escapeHtml(feedAvatarUrl(item));
    const cover = escapeHtml(item.cover);
    const artistCover = escapeHtml(item.artistCover || '');
    const artistGenresRaw = feedValue(item.raw, 'artist_genres', 'artistGenres', 'genres', 'song_artist_genre', 'songArtistGenre') || [];
    const artistGenres = Array.isArray(artistGenresRaw) ? artistGenresRaw.join(', ') : String(artistGenresRaw || '');
    const artistDescription = feedValue(item.raw, 'artist_description', 'artistDescription', 'artist_bio', 'artistBio', 'description') || '';
    const spotify = escapeHtml(spotifyTrackUrl(item));

    const cardId =
      `feedCard-${String(item.id).replace(/[^a-zA-Z0-9_-]/g, '_')}-${index}`;

    // ----------------------------------------------------
    // RATINGS
    // ----------------------------------------------------

    // Paylaşımı yapan kişinin kendi verdiği puan
    const sharerRating = Math.max(
      0,
      Math.min(
        100,
        Number(item.sharerRating || 0)
      )
    );

    // Diğer kullanıcıların ortalama puanı
    const communityRating =
      Number(item.communityRating || 0);

    // Diğer kullanıcıların oy sayısı
    const communityRatingCount =
      Number(item.communityRatingCount || 0);

    // Giriş yapan kullanıcının kendi verdiği puan
    const myRating =
      item.myRating !== null &&
        item.myRating !== undefined
        ? Number(item.myRating)
        : 0;

    const ratings = Array.isArray(item.ratings) ? item.ratings : [];

    // ----------------------------------------------------
    // HIGHLIGHT
    // ----------------------------------------------------

    const highlightSeconds =
      Number(item.highlight) || 0;

    const highlightLabel =
      typeof item.highlight === 'string' &&
        item.highlight.includes(':')
        ? item.highlight
        : formatSecondsSimple(highlightSeconds);

    // ----------------------------------------------------
    // COMMENTS
    // ----------------------------------------------------

    const comments =
      Array.isArray(item.comments)
        ? item.comments
        : [];


    // ----------------------------------------------------
    // FEED TIME LABEL
    // ----------------------------------------------------

    const shareTime = feedTimeLabel(
      item.created ??
      item.date_added ??
      item.created_at ??
      item.createdAt
    );
    // ----------------------------------------------------
    // REPOST USERS
    // ----------------------------------------------------

    const repostUsers =
      Array.isArray(item.repostUsers)
        ? item.repostUsers
        : [];

    const visibleReposts =
      repostUsers
        .slice(0, 4)
        .map((r, i) => {

          const name =
            feedValue(
              r,
              'username',
              'name',
              'display_name'
            ) ||
            `Kullanıcı ${i + 1}`;

          const av =
            feedValue(
              r,
              'avatar',
              'avatar_url',
              'avatarUrl',
              'image'
            ) ||
            `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name).replace(/'/g, '%27')}`;

          return `
          <div class="pod-orbit-bubble">

            <img
              src="${escapeHtml(av)}"
              alt="${escapeHtml(name)}"
              onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name).replace(/'/g, '%27')}'"
            >

            <span class="pod-holo-tooltip">
              ${escapeHtml(name)} • Repostladı
            </span>

          </div>
        `;
        })
        .join('');

    const fallbackRepostUsers =
      !visibleReposts &&
        item.reposts > 0
        ? `
        <div class="pod-orbit-bubble">

          <img
            src="https://api.dicebear.com/7.x/bottts/svg?seed=repost"
            alt="Repost"
          >

          <span class="pod-holo-tooltip">
            ${item.reposts} kişi repostladı
          </span>

        </div>
      `
        : '';

    // ----------------------------------------------------
    // COMMENT HTML
    // ----------------------------------------------------

    const commentHtml =
      comments
        .filter(c => !c.parent_comment_id)
        .slice(0, 8)
        .map(c => {

          const name =
            feedValue(
              c,
              'username',
              'name',
              'display_name',
              'user.username'
            ) ||
            'Kullanıcı';

          const text =
            feedValue(
              c,
              'text',
              'comment',
              'content',
              'message'
            ) ||
            '';

          const time =
            feedTimeLabel(
              feedValue(
                c,
                'created_at',
                'createdAt',
                'timestamp'
              )
            );

          const av =
            feedValue(
              c,
              'avatar',
              'avatar_url',
              'avatarUrl',
              'user.avatar'
            ) ||
            `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name).replace(/'/g, '%27')}`;

          const moment = Number.isInteger(Number(c.timestamp_seconds)) && c.timestamp_seconds !== null
            ? `<button class="comment-moment-chip" type="button" onclick="openCommentMoment('${escapeHtml(String(item.id))}', ${Number(c.timestamp_seconds)})"><i class="fa-solid fa-music"></i> ${escapeHtml(formatCommentMoment(Number(c.timestamp_seconds)))}</button>`
            : '';
          const replies = comments.filter(reply => String(reply.parent_comment_id) === String(c.id));
          const repliesHtml = replies.map(reply => {
            const replyName = feedValue(reply, 'username', 'name') || 'Kullanıcı';
            const replyText = feedValue(reply, 'comment', 'text', 'content') || '';
            const replyTime = feedTimeLabel(reply.created_at);
            const replyAvatar = feedValue(reply, 'avatar', 'avatar_url') || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(replyName)}`;
            return `<div class="comment-bubble comment-reply"><img src="${escapeHtml(replyAvatar)}" class="c-avatar" alt="${escapeHtml(replyName)}"><div class="c-content"><div class="c-top"><strong>${escapeHtml(replyName)}</strong><span class="c-time">${escapeHtml(replyTime)}</span></div><p>${escapeHtml(replyText)}</p></div></div>`;
          }).join('');
          return `
          <div class="comment-thread">
            <div class="comment-bubble">
              <img src="${escapeHtml(av)}" class="c-avatar" alt="${escapeHtml(name)}" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name).replace(/'/g, '%27')}'">
              <div class="c-content">
                <div class="c-top"><strong>${escapeHtml(name)}</strong><span class="c-time">${escapeHtml(time)}</span></div>
                <p>${escapeHtml(text)}</p>
                <div class="comment-inline-actions">${moment}<button type="button" class="comment-reply-trigger" onclick="replyToComment('${escapeHtml(String(item.id))}', '${escapeHtml(String(c.id))}')"><i class="fa-solid fa-reply"></i> Yanıtla</button></div>
              </div>
            </div>
            <div class="comment-replies">${repliesHtml}</div>
          </div>
        `;
        })
        .join('');

    // ----------------------------------------------------
    // OWNER COMMENT
    // ----------------------------------------------------

    const quote =
      item.comment || '';

    // ----------------------------------------------------
    // TASTE MATCH
    // ----------------------------------------------------

    const matchHtml =
      item.match !== null
        ? `
        <div class="taste-match-badge">

          <span class="match-text">

            <strong>
              ${escapeHtml(item.match)}%
            </strong>

            Tonal Uyum

          </span>

        </div>
      `
        : '';

    const lyricsDesign = item.lyricsDesign || {};
    const lyricFontMap = { clean: "'DM Sans', Arial, sans-serif", serif: "Georgia, 'Times New Roman', serif", bold: "'Arial Black', Arial, sans-serif" };
    const lyricBg = lyricsDesign.background || 'blur';
    const lyricBgColor = /^#[0-9a-f]{6}$/i.test(lyricsDesign.background_color || '') ? lyricsDesign.background_color : '#211c35';
    const lyricFontColor = /^#[0-9a-f]{6}$/i.test(lyricsDesign.font_color || '') ? lyricsDesign.font_color : '#ffffff';
    const lyricCover = lyricsDesign.include_cover !== false && cover ? `<img class="songshare-lyrics-cover" src="${cover}" alt="${safeTitle} album cover">` : '';
    const lyricMeta = lyricsDesign.include_metadata !== false ? `<div class="songshare-lyrics-meta">${safeArtist} · ${safeTitle}</div>` : '';
    const lyricPlayer = lyricsDesign.include_player !== false && spotify !== '#' ? `<a class="songshare-lyrics-player" href="${spotify}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-spotify"></i> Dinlemek için aç</a>` : '';
    const lyricBackgroundStyle = lyricBg === 'gradient'
      ? `background:linear-gradient(135deg,${lyricBgColor},${/^#[0-9a-f]{6}$/i.test(lyricsDesign.gradient_color || '') ? lyricsDesign.gradient_color : '#452333'});`
      : lyricBg === 'solid' ? `background:${lyricBgColor};` : `background:linear-gradient(135deg,rgba(10,10,14,.88),rgba(25,20,35,.92)),url('${cover}') center/cover;`;
    const lyricsCardHtml = item.postType === 'lyrics' ? `
      <section class="songshare-lyrics-card" style="${lyricBackgroundStyle}--lyrics-font:${lyricFontMap[lyricsDesign.font_style] || lyricFontMap.clean};--lyrics-color:${lyricFontColor};--lyrics-size:${Math.max(14,Math.min(38,Number(lyricsDesign.font_size)||23))}px;--lyrics-align:${['left','center','right'].includes(lyricsDesign.text_align) ? lyricsDesign.text_align : 'left'};--lyrics-line:${Math.max(1,Math.min(2.2,Number(lyricsDesign.line_spacing)||1.45))};--lyrics-letter:${Math.max(-2,Math.min(8,Number(lyricsDesign.letter_spacing)||0))}px;">
        <div class="songshare-lyrics-topline"><span>LYRICS MOMENT</span><span>${escapeHtml(highlightLabel)}</span></div>
        <div class="songshare-lyrics-body">${lyricCover}<div class="songshare-lyrics-copy"><div class="songshare-lyrics-text" style="${lyricsDesign.italic ? 'font-style:italic;' : ''}text-transform:${['uppercase','lowercase','none'].includes(lyricsDesign.text_transform) ? lyricsDesign.text_transform : 'none'};text-shadow:${lyricsDesign.text_effect === 'none' ? 'none' : '0 2px 18px rgba(0,0,0,.45)'}">${escapeHtml(item.lyricsExcerpt || item.comment || '')}</div>${lyricMeta}</div></div>
        ${lyricPlayer}
      </section>` : '';

    // ----------------------------------------------------
    // CARD
    // ----------------------------------------------------

    return `
    <article
      class="
        feed-card
        glass-panel
        feed-card-dynamic
      "
      id="${cardId}"
      data-feed-id="${escapeHtml(String(item.id))}"
      data-post-type="${escapeHtml(String(feedValue(item.raw, 'post_type', 'postType') || 'music'))}"
      data-lyrics-design="${escapeHtml(JSON.stringify(feedValue(item.raw, 'lyrics_design', 'lyricsDesign') || {}))}"
      data-lyrics-excerpt="${escapeHtml(String(feedValue(item.raw, 'lyrics_excerpt', 'lyricsExcerpt') || ''))}"
      data-owner-rating="${Number(item.sharerRating || 50)}"
      data-preview-title="${safeTitle}"
data-preview-artist="${safeArtist}"
data-preview-cover="${cover}"
data-preview-url="${spotify}"
data-preview-uri="${escapeHtml(item.uri || '')}"
data-preview-comment="${escapeHtml(item.comment || '')}"
data-preview-rating="${Number(item.sharerRating || 0)}"
      data-preview-genres="${escapeHtml(artistGenres)}"
      data-preview-bio="${escapeHtml(String(artistDescription))}"
    >

      ${cover
        ? `
            <div
              class="feed-card-ambient-bg"
              style="background-image:url('${cover}');"
            ></div>
          `
        : ''
      }

      ${item.reposts > 0 || visibleReposts
        ? `
            <div class="repost-holographic-pod">

              <div class="pod-ring-header">

                <svg
                  class="pod-pulse-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <polyline points="17 1 21 5 17 9"></polyline>
                  <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                  <polyline points="7 23 3 19 7 15"></polyline>
                  <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                </svg>

                <span class="pod-title-tag">
                  REPOST
                </span>

              </div>

              <div class="pod-avatars-grid">
                ${visibleReposts || fallbackRepostUsers}
              </div>

            </div>
          `
        : ''
      }

      <!-- HEADER -->

      <div class="feed-card-header">

        <div class="user-meta">

          <div class="avatar-holder">

            <div class="feed-author-avatar" data-feed-author-avatar></div>

            <span class="user-dot-badge"></span>

          </div>

          <div class="user-text-details">

            <span class="user-name">
              ${safeUser}
            </span>

            <span class="post-time">
              ${escapeHtml(feedTimeLabel(item.created))}
            </span>

          </div>

        </div>

        <div class="header-right-cluster">
          ${item.isOwner ? `<div class="songshare-owner-tools"><button type="button" class="songshare-owner-edit" onclick="openSongShareEditor('${escapeHtml(String(item.id))}')" aria-label="Paylaşımı düzenle" title="Düzenle"><i class="fa-solid fa-sliders"></i></button><button type="button" class="songshare-owner-delete" onclick="deleteSongSharePost('${escapeHtml(String(item.id))}')" aria-label="Paylaşımı sil" title="Sil"><i class="fa-solid fa-trash"></i></button></div>` : ''}
          ${matchHtml}
        </div>

      </div>

      <!-- MAIN -->

      ${lyricsCardHtml}
      <div class="feed-card-main-content">

        <!-- COVER -->

        
<div
  class="cover-stage"
  ${artistCover ? 'data-artist-cover="true"' : ''}
>
  ${cover
        ? `
        <img
          src="${cover}"
          alt="${safeTitle}"
          class="album-cover-main"
          loading="lazy"
          draggable="false"
          onerror="this.style.opacity='0.2'"
        >
      `
        : `
        <div
          class="album-cover-main"
          style="background:#151922;"
        ></div>
      `
      }

  ${artistCover
        ? `
        <img
          src="${artistCover}"
          alt="${safeArtist}"
          class="artist-cover-overlay"
          loading="lazy"
          draggable="false"
          onerror="this.classList.add('artist-cover-failed')"
        >
      `
        : ''
      }

  <div class="cover-gloss"></div>

  <button
    type="button"
    class="cover-play-cta"
    data-preview-play
    aria-label="Şarkıyı dinle: ${safeTitle} — ${safeArtist}"
  >
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </svg>
  </button>
</div>


        <!-- TRACK DETAILS -->

        <div class="track-details-col">

          <div>

            <h2 class="feed-track-title">
              ${safeTitle}
            </h2>

            <h3 class="feed-track-artist">
              ${safeArtist}
            </h3>

          </div>

          <!-- OWNER COMMENT / HIGHLIGHT -->
          
          

          ${quote || highlightSeconds > 0 ||
        (
          typeof item.highlight === 'string' &&
          item.highlight.includes(':')
        )
        ? `
                <div class="sharer-comment-quote">

                  ${quote
          ? `
                        <div class="quote-bar"></div>

                        <div class="quote-text">

                          <p>
                            "${escapeHtml(quote)}"
                          </p>

                        </div>
                      `
          : ''
        }

        

          ${escapeHtml(highlightLabel) != '0:00'
          ? `
                        <button
                          class="btn-highlight-time"
                          data-start="${highlightSeconds}"
                        >

                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.2"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="10"
                            ></circle>

                            <polyline
                              points="12 6 12 12 16 14"
                            ></polyline>
                          </svg>

                          <span>
                            Highlight at
                            ${escapeHtml(highlightLabel)}
                          </span>

                        </button>
                      `
          : ''
        }

        <div class="share-time-label">
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2",
    style="color: var(--text-dim);"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>

  <span style="color: var(--text-dim); font-weight: 700; font-size: 0.75rem; margin-left: 4px;">
    ${escapeHtml(shareTime)}
  </span>
</div>

                </div>
              `
        : ''



      }

          <!-- RATING -->

          <div class="compact-rating-badge">

            <!-- PAYLAŞANIN KENDİ PUANI -->

            <span
              class="cr-score"
              style="
                color:#22c55e;
                font-size:1.15rem;
                font-weight:800;
              "
            >
              ${sharerRating}
            </span>

            <span class="cr-sep">
              •
            </span>

            <!-- TOPLULUK PUANI -->

            <span class="cr-label">

              Genel Puan

              ${communityRating > 0
        ? communityRating.toFixed(1)
        : '—'
      }

              (${communityRatingCount} Oy)

            </span>

          </div>

          <!-- ACTIONS -->

          <div class="card-action-triggers">

            <button
              class="btn-rate-trigger"
              onclick='
                event.stopPropagation();
                toggleRateMiniPopup(
                  ${JSON.stringify(String(item.id))},
                  event
                );
              '
            >
              Puan Ver
            </button>

            <!-- RATE POPUP -->

            <div
              class="rate-mini-popup"
              id="ratePopup-${escapeHtml(String(item.id))}"
              role="dialog"
              aria-label="Parçayı puanla"
            >
              <div class="rating-popup-heading">
                <div class="rating-popup-icon"><i class="fa-solid fa-wave-square"></i></div>
                <div class="rating-popup-heading-copy">
                  <span class="rating-popup-eyebrow">YOUR TAKE</span>
                  <span class="mini-popup-title">Rate this song</span>
                </div>
                <span class="rating-popup-outof">/ 1-0</span>
              </div>

              <div class="rating-score-stage" id="ratingStage-${escapeHtml(String(item.id))}">
                <div class="rating-score-number" id="rangeVal-${escapeHtml(String(item.id))}">${myRating ?? 50}</div>
                <span class="rating-score-caption" id="ratingMood-${escapeHtml(String(item.id))}">Ortalama</span>
              </div>

              <div class="rating-slider-area">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value="${myRating ?? 50}"
                  class="mini-range-slider"
                  id="rangeInput-${escapeHtml(String(item.id))}"
                  data-share-id="${escapeHtml(String(item.id))}"
                  oninput="window.updateMiniScore(this.dataset.shareId, this.value)"
                  aria-label="0 ile 100 arasında puan"
                />

                <div class="rating-slider-labels">
                  <span>Beğenmedim</span>
                  <span>İyi</span>
                  <span>Çok iyi</span>
                </div>
              </div>

              <div class="rating-popup-footer">
                <div class="rating-voters-heading"><span>Kimler puanladı</span><span>${ratings.length} kişi</span></div>
                <div class="rating-voters-list" id="ratingVoters-${escapeHtml(String(item.id))}">
                  ${ratings.length ? ratings.map(voter => `
                    <div class="rating-voter-row">
                      <div class="rating-voter-avatar">${escapeHtml((voter.username || 'U').slice(0, 1).toUpperCase())}</div>
                      <span class="rating-voter-name">${escapeHtml(voter.username || 'Kullanıcı')}</span>
                      <strong class="rating-voter-score">${Number(voter.rating)}<small>/100</small></strong>
                    </div>
                  `).join('') : '<div class="rating-voters-empty">Henüz puan veren yok.</div>'}
                </div>
                <span class="rating-save-hint"><i class="fa-regular fa-circle-check"></i> Puanını daha sonra değiştirebilirsin.</span>
                <button
                    type="button"
                    class="btn-submit-mini"
                    onclick="submitRate('${String(item.id)}')"
                  >
                    <span>Puanı gönder</span><i class="fa-solid fa-arrow-up-right-from-square"></i>
                </button>
              </div>
            </div>

            <!-- REPOST -->

            <button
              type="button"
              class="btn-secondary-action feed-repost-button ${item.repostedByMe ? 'is-active' : ''}"
              data-repost-id="${escapeHtml(String(item.id))}"
              aria-pressed="${item.repostedByMe ? 'true' : 'false'}"
              title="Paylaşımı yeniden paylaş"
            >
              ${item.repostedByMe ? 'Repostu geri al' : 'Repostla'}
              (
              <span id="repostCount-${escapeHtml(String(item.id))}">${item.reposts}</span>
              )
            </button>

            <!-- SPOTIFY -->

            ${spotify !== '#'
        ? `
                  <a
                    href="${spotify}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-primary-action"
                  >
                    Spotify
                  </a>
                `
        : ''
      }

            <!-- IMMERSIVE -->

            <button type="button" class="btn-secondary-action" data-feed-immersive="${escapeHtml(String(item.id))}" title="Immersive dinleme deneyimini aç">
              Immersive
            </button>

          </div>

        </div>

      </div>

      <!-- COMMENTS -->

      <div class="feed-comments-section">

        <div
          class="comments-scroll-list"
          id="commentList-${escapeHtml(String(item.id))}"
          style="display:none;"
        >

          ${commentHtml ||
      `
              <div
                style="
                  font-size:.72rem;
                  color:var(--text-dim);
                  padding:6px 0;
                "
              >
                Henüz yorum yok.
              </div>
            `
      }

        </div>

        <div class="comment-action-toolbar">

          <button
            class="btn-text-action"
            onclick='
              toggleExtraComments(
                ${JSON.stringify(String(item.id))}
              )
            '
            id="btnMoreComments-${escapeHtml(String(item.id))}"
          >
            ${comments.length > 8
        ? 'Yorumları Gör'
        : 'Yorumları Gör'
      }
          </button>

          <button
            class="btn-write-comment-trigger"
            onclick='
              toggleCommentInput(
                ${JSON.stringify(String(item.id))}
              )
            '
          >
            Yorum Yap
          </button>

        </div>

        <!-- COMMENT INPUT -->

        <div
          class="comment-input-collapsible"
          id="commentInputBox-${escapeHtml(String(item.id))}"
        >

          <div class="comment-input-row">

            <input
              type="text"
              class="comment-input-field"
              id="commentInput-${escapeHtml(String(item.id))}"
              placeholder="Düşüncelerini paylaş..."
              onkeypress='
                handleCommentKey(
                  event,
                  ${JSON.stringify(String(item.id))}
                )
              '
            >

            <input type="text" class="comment-timestamp-input" id="commentTimestamp-${escapeHtml(String(item.id))}" placeholder="01:42 (isteğe bağlı)" aria-label="Şarkı zamanı">

            <button
              class="btn-send-comment"
              onclick='
                submitComment(
                  ${JSON.stringify(String(item.id))}
                )
              '
            >
              Gönder
            </button>

          </div>

        </div>

      </div>

    </article>
  `;
  }


  /*
   * ====================================================
   * FEED RENDER
   * ====================================================
   */

  function prepareImage(img) {
    if (!img) return;

    img.classList.remove("image-loaded");

    if (img.complete && img.naturalWidth > 0) {
      requestAnimationFrame(() => {
        img.classList.add("image-loaded");
      });
      return;
    }

    img.addEventListener("load", () => {
      requestAnimationFrame(() => {
        img.classList.add("image-loaded");
      });
    }, { once: true });

    img.addEventListener("error", () => {
      img.classList.add("image-loaded");
    }, { once: true });
  }

  // ====================================================
  // COMMENTS SYSTEM
  // ====================================================

  function formatCommentMoment(seconds) {
    const value = Math.max(0, Math.floor(seconds || 0));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  }

  function parseCommentMoment(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (/^\d+$/.test(raw)) return Number(raw);
    const match = raw.match(/^(\d{1,3}):(\d{1,2})$/);
    if (!match || Number(match[2]) > 59) throw new Error('Zamanı 01:42 biçiminde yaz.');
    return Number(match[1]) * 60 + Number(match[2]);
  }

  window.openCommentMoment = function (shareId, seconds) {
    const card = document.querySelector(`[data-feed-id="${CSS.escape(String(shareId))}"]`);
    const uri = card?.dataset.previewUri || '';
    const trackId = uri.match(/spotify:track:([^:]+)/)?.[1];
    if (trackId) {
      window.open(`https://open.spotify.com/track/${trackId}?t=${Math.floor(seconds)}`, '_blank', 'noopener');
    } else {
      alert(`Şarkı anı: ${formatCommentMoment(seconds)}`);
    }
  };

  window.replyToComment = async function (songShareId, parentCommentId) {
    const token = localStorage.getItem('token');
    if (!token) { alert('Yanıt vermek için giriş yapmalısın.'); return; }
    document.getElementById('songShareReplyDialog')?.remove();
    const dialog = document.createElement('div');
    dialog.id = 'songShareReplyDialog';
    dialog.className = 'ss-reply-backdrop';
    dialog.innerHTML = `<form class="ss-reply-dialog"><div class="ss-reply-head"><strong>Yanıt yaz</strong><button type="button" class="ss-reply-close" aria-label="Kapat">×</button></div><textarea name="reply" maxlength="2000" rows="4" placeholder="Düşünceni paylaş…" required></textarea><div class="ss-reply-actions"><span class="ss-reply-status" aria-live="polite"></span><button type="submit">Yanıtı gönder</button></div></form>`;
    document.body.appendChild(dialog);
    const form = dialog.querySelector('form');
    const textarea = form.elements.reply;
    textarea.focus();
    const close = () => dialog.remove();
    dialog.addEventListener('click', e => { if (e.target === dialog || e.target.closest('.ss-reply-close')) close(); });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const comment = textarea.value.trim();
      if (!comment) return;
      const submit = form.querySelector('[type="submit"]');
      const status = form.querySelector('.ss-reply-status');
      submit.disabled = true; status.textContent = 'Gönderiliyor…';
      try {
        const response = await fetch(`/api/songshare/comment/${encodeURIComponent(songShareId)}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          credentials: 'include', body: JSON.stringify({ comment, parent_comment_id: parentCommentId })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || 'Yanıt gönderilemedi.');
        close();
        // Re-render feed from the server without forcing a full page reload.
        if (typeof window.refreshSongShareFeed === 'function') await window.refreshSongShareFeed();
        else window.dispatchEvent(new CustomEvent('songshare:comment-added', { detail: { songShareId, result } }));
      } catch (error) { status.textContent = error.message; submit.disabled = false; }
    });
  };

  window.toggleExtraComments = function (songShareId) {

    const list =
      document.getElementById(
        `commentList-${songShareId}`
      );

    const button =
      document.getElementById(
        `btnMoreComments-${songShareId}`
      );

    if (!list || !button) {
      return;
    }

    const isOpen =
      list.classList.contains(
        'comments-visible'
      );

    if (isOpen) {

      list.classList.remove(
        'comments-visible'
      );

      button.textContent =
        'Yorumları Gör';

    } else {

      list.classList.add(
        'comments-visible'
      );

      button.textContent =
        'Yorumları Gizle';
    }
  };


  // ====================================================
  // COMMENT INPUT
  // ====================================================

  window.toggleCommentInput = function (songShareId) {

    const box =
      document.getElementById(
        `commentInputBox-${songShareId}`
      );

    if (!box) {
      return;
    }

    box.classList.toggle(
      'comment-input-visible'
    );

    if (
      box.classList.contains(
        'comment-input-visible'
      )
    ) {

      const input =
        document.getElementById(
          `commentInput-${songShareId}`
        );

      setTimeout(() => {
        input?.focus();
      }, 50);
    }
  };


  // ====================================================
  // ENTER → COMMENT
  // ====================================================

  window.handleCommentKey = function (
    event,
    songShareId
  ) {

    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {

      event.preventDefault();

      submitComment(
        songShareId
      );
    }
  };


  // ====================================================
  // SUBMIT COMMENT
  // ====================================================

  window.submitComment = async function (
    songShareId
  ) {

    const input =
      document.getElementById(
        `commentInput-${songShareId}`
      );

    const button =
      document.querySelector(
        `#commentInputBox-${songShareId} .btn-send-comment`
      );

    if (!input) {
      return;
    }

    const comment =
      input.value.trim();

    if (!comment) {

      input.focus();

      return;
    }


    const token =
      localStorage.getItem('token');

    if (!token) {

      alert(
        'Yorum yapmak için giriş yapmalısın.'
      );

      return;
    }


    /*
     * Gönderim sırasında butonu kilitle
     */

    if (button) {

      button.disabled = true;

      button.textContent =
        'Gönderiliyor...';
    }


    try {

      const response =
        await fetch(
          `/api/songshare/comment/${encodeURIComponent(
            songShareId
          )}`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',

              'Authorization':
                `Bearer ${token}`
            },

            credentials: 'include',

            body: JSON.stringify({
              comment,
              timestamp_seconds: parseCommentMoment(document.getElementById(`commentTimestamp-${songShareId}`)?.value)
            })
          }
        );


      const result =
        await response.json();


      if (!response.ok) {

        throw new Error(
          result.message ||
          result.error ||
          'Yorum gönderilemedi.'
        );
      }


      /*
       * Backend'in döndürdüğü yorum
       */

      const newComment =
        result.data;


      /*
       * Yorum listesi
       */

      const list =
        document.getElementById(
          `commentList-${songShareId}`
        );


      if (list && newComment) {

        /*
         * "Henüz yorum yok" yazısını kaldır
         */

        const emptyMessage =
          list.querySelector(
            '.feed-comment-empty'
          );

        emptyMessage?.remove();


        const name =
          newComment.username ||
          'Kullanıcı';


        /*
         * Avatar
         *
         * Normal URL varsa onu kullan.
         * avatar_data varsa onu tercih et.
         */

        let avatarUrl = '';

        if (
          newComment.avatar_data &&
          typeof newComment.avatar_data === 'string'
        ) {

          const data =
            newComment.avatar_data.trim();

          if (
            data.startsWith(
              'data:image/'
            ) ||
            data.startsWith(
              'http://'
            ) ||
            data.startsWith(
              'https://'
            )
          ) {

            avatarUrl = data;
          }
        }


        if (
          !avatarUrl &&
          newComment.avatar
        ) {

          const av =
            String(
              newComment.avatar
            );

          if (
            av.startsWith('http://') ||
            av.startsWith('https://') ||
            av.startsWith('data:image/')
          ) {

            avatarUrl = av;

          } else {

            avatarUrl =
              `/media/${av.replace(
                /^\/?(media\/)?/,
                ''
              )}`;
          }
        }


        if (!avatarUrl) {

          avatarUrl =
            `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
              name
            )}`;
        }


        const time =
          newComment.created_at
            ? feedTimeLabel(
              newComment.created_at
            )
            : 'Şimdi';


        const commentElement =
          document.createElement(
            'div'
          );

        commentElement.className =
          'comment-bubble';


        commentElement.innerHTML = `
        <img
          src="${escapeHtml(
          avatarUrl
        )}"
          class="c-avatar"
          alt="${escapeHtml(
          name
        )}"
          onerror="
            this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
          name
        )}'
          "
        >

        <div
          class="c-content"
        >

          <div
            class="c-top"
          >

            <strong>
              ${escapeHtml(name)}
            </strong>

            <span
              class="c-time"
            >
              ${escapeHtml(time)}
            </span>

          </div>

          <p>
            ${escapeHtml(
          newComment.comment || ''
        )}
          </p>

        </div>
      `;


        list.appendChild(
          commentElement
        );


        /*
         * Yeni yorum geldikten sonra
         * yorumları otomatik aç.
         */

        list.classList.add(
          'comments-visible'
        );


        const moreButton =
          document.getElementById(
            `btnMoreComments-${songShareId}`
          );

        if (moreButton) {

          moreButton.textContent =
            'Yorumları Gizle';
        }


        /*
         * Yeni yoruma scroll
         */

        requestAnimationFrame(() => {

          commentElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
          });

        });
      }


      /*
       * Input'u temizle
       */

      input.value = '';
      const timestampInput = document.getElementById(`commentTimestamp-${songShareId}`);
      if (timestampInput) timestampInput.value = '';


      /*
       * Input'u kapat
       */

      const inputBox =
        document.getElementById(
          `commentInputBox-${songShareId}`
        );

      inputBox?.classList.remove(
        'comment-input-visible'
      );


    } catch (error) {

      console.error(
        'Yorum gönderme hatası:',
        error
      );

      alert(
        error.message ||
        'Yorum gönderilemedi.'
      );

    } finally {

      if (button) {

        button.disabled = false;

        button.textContent =
          'Gönder';
      }
    }
  };

  function renderFeedItems(
    items,
    append = false
  ) {

    const container =
      document.getElementById(
        'dynamicFeedItems'
      );

    const legacyCard =
      document.getElementById(
        'feedCard-1'
      );

    if (!container) return;

    /*
     * API'den gerçek veri geldiyse
     * eski hardcoded kartı tamamen gizle.
     */

    if (legacyCard) {
      legacyCard.style.display = 'none';
    }


    if (!append) {
      container.innerHTML = '';
    }


    /*
     * Hiç veri yok.
     */

    if (
      !items.length &&
      !append
    ) {

      container.innerHTML = `
        <div
          class="feed-empty-state"
        >

          <strong>
            Henüz gösterilecek paylaşım yok.
          </strong>

          <span>
            Size gönderilen veya herkese açık
            paylaşımlar burada görünecek.
          </span>

        </div>
      `;

      return;
    }


    const html =
      items
        .map(
          (item, index) =>
            renderFeedCard(
              item,
              index
            )
        )
        .join('');


    if (append) {

      container.insertAdjacentHTML(
        'beforeend',
        html
      );

    } else {

      container.innerHTML =
        html;

    }


    // Feed kartları DOM'a eklendikten sonra avatarları çiz
    const feedCards = container.querySelectorAll('.feed-card');


    const normalizedItems = items.map(item => ({
      item,
      normalized: normalizeFeedItem(item)
    }));

    normalizedItems.forEach(({ normalized }) => {
      const cardId =
        `feedCard-${String(normalized.id).replace(/[^a-zA-Z0-9_-]/g, '_')}-`;

      const card = Array.from(
        container.querySelectorAll('.feed-card')
      ).find(element => element.id.startsWith(cardId));

      if (!card) return;

      const avatarElement = card.querySelector(
        '[data-feed-author-avatar]'
      );

      if (!avatarElement) return;

      renderAvatar(
        avatarElement,
        {
          user_name: normalized.userName,
          username: normalized.userName,
          avatar_type: normalized.avatarType,
          avatar_data: normalized.avatarData || {},
          profile_pic_path: normalized.avatar
        },
        { size: 34 }
      );
    });



    // Fotoğraflar yüklendikçe Apple-style reveal

    container
      .querySelectorAll('.album-cover-main, .artist-cover-overlay')
      .forEach(img => prepareImage(img));

    // Apple Music tarzı kapak etkileşimi
    container.querySelectorAll('.cover-stage[data-artist-cover="true"]')
      .forEach(stage => {
        // Feed yeniden render edilirse aynı event tekrar eklenmesin.
        if (stage.dataset.hoverBound === 'true') return;

        stage.dataset.hoverBound = 'true';

        let artistTimer = null;

        stage.addEventListener('pointerenter', event => {
          // Dokunmatik ekranda yapay hover oluşturma.
          if (event.pointerType === 'touch') return;

          stage.classList.add('is-hovering');

          clearTimeout(artistTimer);

          // Mouse kısa süre kalırsa sanatçı fotoğrafına geç.
          artistTimer = setTimeout(() => {
            const artistImage = stage.querySelector('.artist-cover-overlay');

            // Fotoğraf henüz yüklenmediyse geçiş yapma.
            if (
              artistImage &&
              !artistImage.classList.contains('artist-cover-failed') &&
              artistImage.complete &&
              artistImage.naturalWidth > 0
            ) {
              stage.classList.add('is-artist-visible');
            }
          }, 550);
        });

        stage.addEventListener('pointerleave', () => {
          clearTimeout(artistTimer);

          // Önceki görsele yumuşak biçimde geri dön.
          stage.classList.remove('is-artist-visible');
          stage.classList.remove('is-hovering');
        });
      });


    /*
* Apple-style card reveal
*/
    requestAnimationFrame(() => {

      container
        .querySelectorAll('.feed-card')
        .forEach((card, index) => {

          card.style.setProperty(
            '--reveal-index',
            index
          );

          requestAnimationFrame(() => {

            card.classList.add(
              'feed-card-visible'
            );

          });

        });

    });
  }


  /*
   * ====================================================
   * FEED API
   * ====================================================
   */

  async function fetchSuggestions(page) {

    if (
      isLoadingFeed ||
      !hasMoreSuggestions
    ) {
      return;
    }


    isLoadingFeed = true;


    /*
     * İLK YÜKLEME
     *
     * Gerçek veri gelene kadar
     * gri skeleton göster.
     */

    const isFirstLoad =
      page === 1;

    if (isFirstLoad) {
      renderFeedSkeleton(3);
    }


    try {

      const token =
        localStorage.getItem(
          'token'
        );


      const headers =
        token
          ? {
            'Authorization':
              `Bearer ${token}`
          }
          : {};


      /*
       * MEVCUT BACKEND ENDPOINT
       *
       * Backend'e ekstra bir şey
       * göndermiyoruz.
       */

      const res =
        await fetch(
          `/api/songshare/feed?page=${page}&limit=10`,
          {
            headers,
            credentials:
              'include'
          }
        );


      if (!res.ok) {
        throw new Error(
          'Feed alınamadı'
        );
      }


      const data =
        await res.json();


      /*
       * Backend farklı isimlerden
       * biriyle array döndürürse
       * hepsini destekle.
       */

      const suggestions =
        data.data ||
        data.suggestions ||
        data.items ||
        data.feed ||
        [];


      const items =
        Array.isArray(
          suggestions
        )
          ? suggestions
          : [];


      /*
       * SONUÇ YOK
       */

      if (
        items.length === 0
      ) {

        hasMoreSuggestions =
          false;


        if (isFirstLoad) {
          renderFeedItems([]);
        }

        return;
      }


      /*
       * İLK SAYFA
       *
       * Skeleton gider,
       * gerçek kartlar gelir.
       */

      renderFeedItems(
        items,
        !isFirstLoad
      );

      // If the first batch does not fill the scroll viewport, fetch the next page.
      requestAnimationFrame(() => {
        const feed = document.getElementById('feedScrollContainer');
        if (feed && feed.scrollHeight <= feed.clientHeight + 500 &&
            !isLoadingFeed && hasMoreSuggestions) {
          fetchSuggestions(page + 1);
        }
      });

      /*
       * SONRAKİ SAYFA
       */

      feedPage =
        page + 1;

      window.__songShareFeedNextPage =
        feedPage;


      /*
       * 10'dan az geldiyse
       * artık başka sayfa yok.
       */

      if (
        items.length < 10
      ) {
        hasMoreSuggestions =
          false;
      }


    } catch (err) {

      console.warn(
        "Feed bilgisi alınamadı:",
        err.message
      );


      /*
       * İLK YÜKLEME BAŞARISIZSA
       *
       * Kullanıcıyı sonsuz skeleton
       * ekranında bırakma.
       */

      if (isFirstLoad) {

        const container =
          document.getElementById(
            'dynamicFeedItems'
          );

        const legacyCard =
          document.getElementById(
            'feedCard-1'
          );


        /*
         * Mevcut eski kartı fallback
         * olarak geri getir.
         *
         * Böylece backend geçici olarak
         * kapalı olsa bile mevcut
         * sayfanın işlevi bozulmaz.
         */

        if (legacyCard) {
          legacyCard.style.display =
            '';
        }


        if (container) {

          container.innerHTML = `
            <div
              class="feed-empty-state"
            >

              <strong>
                Feed yüklenemedi.
              </strong>

              <span>
                Paylaşımlar alınırken
                bir sorun oluştu.
                Sayfayı yenilediğinizde
                tekrar denenir.
              </span>

            </div>
          `;

        }

      }

    } finally {

      isLoadingFeed =
        false;

    }

  }


  /*
   * ====================================================
   * FEED SCROLL / INFINITE LOADING
   * ====================================================
   */

  function initFeedInfiniteScroll() {

    const dynamicFeedScroll =
      document.getElementById(
        'feedScrollContainer'
      );


    if (!dynamicFeedScroll) {
      return;
    }


    dynamicFeedScroll.addEventListener(
      'scroll',
      () => {

        const nearBottom =
          dynamicFeedScroll.scrollTop +
          dynamicFeedScroll.clientHeight >=
          dynamicFeedScroll.scrollHeight -
          500;


        if (
          nearBottom &&
          !isLoadingFeed &&
          hasMoreSuggestions
        ) {

          fetchSuggestions(
            window.__songShareFeedNextPage ||
            feedPage
          );

        }

      },
      {
        passive: true
      }
    );

  }


  /*
   * Feed'i başlat.
   *
   * NOT:
   * Bu kısım sadece feed yükleme
   * davranışını ekler.
   *
   * Mevcut diğer fonksiyonlara
   * dokunulmaz.
   */

  window.__songShareFeedNextPage =
    feedPage;

  // ----------------------------------------------------
  // 10. AUTH KONTROLÜ VE BAŞLANGIÇ ÇAĞRILARI
  // ----------------------------------------------------
  async function checkLogin() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch('/api/users/me', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      if (data.status === 'success' || data.user) {
        const user = data.user || data.data?.user;
        window.currentLoggedInUserId = user?.id;
      }
    } catch (err) {
      console.warn('Oturum doğrulama:', err.message);
    }
  }

  async function startup() {

    // Her şeyi aynı anda başlat.
    // Hiçbirinin bitmesini bekleme.
    loadRecommendations();
    checkLogin();
    fetchSuggestions(feedPage);
    initFeedInfiniteScroll();
    loadFriendsActivity();

    // Coverflow hemen mevcut HTML ile başlasın.
    initCoverflowEngine();

    // Verify the Spotify connection first. Playback polling starts only when
    // the backend confirms that the connected account is usable.
    setCompanionDockLoading();
    await loadSpotifyStatus();

    // Friend activity refresh
    setInterval(loadFriendsActivity, 15000);
  }

  startup();
});

const feedScroll = document.getElementById('feedScrollContainer');
const friendsStrip = document.getElementById('friendsListeningStrip');

let friendsStripPlaceholder = null;

function dockFriendsStrip() {
  if (!friendsStrip) return;

  // Daha önce taşındıysa tekrar taşıma
  if (!friendsStripPlaceholder) {
    friendsStripPlaceholder = document.createComment('friends-strip-placeholder');
    friendsStrip.parentNode.insertBefore(
      friendsStripPlaceholder,
      friendsStrip
    );
  }

  // ÖNEMLİ:
  // view-home içinden çıkarıp direkt body içine alıyoruz.
  document.body.appendChild(friendsStrip);

  friendsStrip.classList.add('is-docked-right');
}

function undockFriendsStrip() {
  if (!friendsStrip) return;

  friendsStrip.classList.remove('is-docked-right');

  // Eski yerine geri koy
  if (
    friendsStripPlaceholder &&
    friendsStripPlaceholder.parentNode
  ) {
    friendsStripPlaceholder.parentNode.insertBefore(
      friendsStrip,
      friendsStripPlaceholder
    );

    friendsStripPlaceholder.remove();
    friendsStripPlaceholder = null;
  }
}

if (feedScroll && friendsStrip) {
  const isMobileFriendsBubbleMode = () => window.matchMedia('(max-width: 700px)').matches;

  const updateFriendsOnScroll = () => {
    if (isMobileFriendsBubbleMode()) {
      // Mobilde arkadaşları DOM'dan çıkarma: üstteki alan scroll ile kaybolur,
      // aynı kartlar ekranın alt tarafında küçük avatar bubble'larına dönüşür.
      undockFriendsStrip();
      document.body.classList.toggle('mobile-feed-scrolled', feedScroll.scrollTop > 70);
      return;
    }

    document.body.classList.remove('mobile-feed-scrolled');
    if (feedScroll.scrollTop > 70) dockFriendsStrip();
    else undockFriendsStrip();
  };

  feedScroll.addEventListener('scroll', updateFriendsOnScroll, { passive: true });
  window.addEventListener('resize', updateFriendsOnScroll);
  updateFriendsOnScroll();
}

// Mobilde sağ alttaki albüm bubble'ına dokununca companion panelini aç/kapat.
const mobilePlayerDock = document.getElementById('mainPlayerDock');
if (mobilePlayerDock) {
  mobilePlayerDock.addEventListener('click', (event) => {
    if (!window.matchMedia('(max-width: 700px)').matches) return;
    if (event.target.closest('button, a, iframe')) return;
    mobilePlayerDock.classList.toggle('mobile-player-expanded');
  });
}

function updateGetCurrentSongButton(isPlaying, trackTitle = '') {
  const btn = document.getElementById('btnGetCurrentSong');
  const dot = document.getElementById('btnCurrentDot');
  const label = document.getElementById('btnCurrentLabel');

  if (!btn) return;

  if (isPlaying) {
    btn.disabled = false;
    btn.removeAttribute('disabled');
    btn.title = 'Select the currently playing track';
    if (dot) dot.style.display = 'inline-block';
    if (label) label.textContent = 'Get Current Song';
  } else {
    btn.disabled = true;
    btn.setAttribute('disabled', 'true');
    btn.title = "Nothing playing on Spotify";
    if (dot) dot.style.display = 'none';
    if (label) label.textContent = 'Nothing Playing';
  }
}

function prepareImage(img) {
  if (!img) return;

  img.classList.remove("image-loaded");

  if (img.complete && img.naturalWidth > 0) {
    requestAnimationFrame(() => {
      img.classList.add("image-loaded");
    });
    return;
  }

  img.addEventListener("load", () => {
    requestAnimationFrame(() => {
      img.classList.add("image-loaded");
    });
  }, { once: true });

  img.addEventListener("error", () => {
    img.classList.add("image-loaded");
  }, { once: true });
}


/* =========================================================
   SONG PREVIEW — SPOTIFY + YOUTUBE SYNCED LYRICS
   ========================================================= */

(() => {
  const modal = document.getElementById('songPreviewModal');
  if (!modal || modal.dataset.initialized === 'true') return;
  modal.dataset.initialized = 'true';

  const $ = id => document.getElementById(id);

  const cover = $('spCover');
  const ambient = $('spAmbient');
  const title = $('spTitle');
  const artist = $('spArtist');
  const comment = $('spComment');
  const rating = $('spRating');
  const artistBio = $('spArtistBio');
  const artistFacts = $('spArtistFacts');
  const artistSearch = $('spArtistSearch');
  const spotifyEmbed = $('spSpotifyEmbed');
  const spotifyOpen = $('spSpotifyOpen');
  const spotifyConnect = $('spSpotifyConnect');

  const lyricsStatus = $('spLyricsStatus');
  const lyricsLines = $('spLyricsLines');
  const lyricsViewport = $('spLyricsViewport');
  const timeline = $('spTimeline');
  const currentTime = $('spCurrentTime');
  const durationLabel = $('spDuration');
  const playButton = $('spYoutubePlay');
  const youtubeHost = $('spYoutubePlayerHost');

  let modalYTPlayer = null;
  let modalYTReady = false;
  let activeTrack = null;
  let lyrics = [];
  let syncTimer = null;
  let requestId = 0;
  let lastActiveIndex = -1;
  let seeking = false;

  const formatTime = seconds => {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  };

  // /api/auto-sync eski sürümlerde farklı alan adlarıyla zaman damgası döndürebiliyor.
  // Hepsini saniyeye normalize et; 0 saniyelik gerçek ilk satırı da koru.
  function normalizeLyricTime(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
    if (typeof value !== 'string') return null;

    const raw = value.trim();
    if (!raw) return null;

    const clock = raw.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
    if (clock) {
      const hours = Number(clock[1] || 0);
      const minutes = Number(clock[2] || 0);
      const seconds = Number(clock[3] || 0);
      return hours * 3600 + minutes * 60 + seconds;
    }

    const numeric = Number(raw);
    return Number.isFinite(numeric) ? Math.max(0, numeric) : null;
  }

  function normalizeSyncedLyrics(rawLyrics) {
    if (!Array.isArray(rawLyrics)) return [];
    return rawLyrics.map((item, originalIndex) => {
      const timeValue = item?.time ?? item?.startTime ?? item?.timestamp ?? item?.start ?? item?.seconds;
      const textValue = item?.words ?? item?.text ?? item?.line ?? item?.lyrics ?? '';
      return {
        time: normalizeLyricTime(timeValue),
        words: String(textValue ?? '').trim(),
        originalIndex
      };
    })
      .filter(item => item.time !== null && item.words.length > 0)
      .sort((a, b) => a.time - b.time || a.originalIndex - b.originalIndex)
      .map(({ time, words }) => ({ time, words }));
  }

  function getTrackId(track) {
    const uriMatch = String(track?.uri || '').match(/(?:^spotify:track:|open\.spotify\.com\/track\/)([a-zA-Z0-9]+)/);
    if (uriMatch) return uriMatch[1];

    try {
      const url = new URL(track?.url || '');
      const match = url.pathname.match(/\/track\/([a-zA-Z0-9]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  function setTab(name) {
    modal.querySelectorAll('[data-sp-tab]').forEach(button => {
      const selected = button.dataset.spTab === name;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
    });

    modal.querySelectorAll('[data-sp-pane]').forEach(pane => {
      const selected = pane.dataset.spPane === name;
      pane.classList.toggle('is-active', selected);
      pane.hidden = !selected;
    });

    if (name === 'spotify' && modalYTReady && modalYTPlayer?.pauseVideo) {
      modalYTPlayer.pauseVideo();
    }
  }

  function openModal() {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    ++requestId;

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    clearInterval(syncTimer);
    syncTimer = null;

    if (modalYTReady && modalYTPlayer?.pauseVideo) {
      modalYTPlayer.pauseVideo();
    }

    // Spotify iframe kaldırılınca önizleme sesi de durur.
    spotifyEmbed.replaceChildren();
    activeTrack = null;
  }

  async function checkSpotifyConnection(trackId, id) {
    spotifyOpen.hidden = true;
    spotifyConnect.hidden = true;

    try {
      const token = localStorage.getItem('token');
      const playbackHeaders = {};
      if (token && token !== 'cookie-session') {
        playbackHeaders.Authorization = `Bearer ${token}`;
      }
      const response = await fetch('/api/spotify/now-playing', {
        credentials: 'include',
        headers: playbackHeaders
      });

      if (id !== requestId) return;

      if (response.ok) {
        spotifyOpen.href =
          `https://open.spotify.com/track/${trackId}`;
        spotifyOpen.hidden = false;
      } else if (response.status === 401 ||
        response.status === 403) {
        spotifyConnect.hidden = false;
      }
    } catch (error) {
      console.warn('Spotify bağlantı durumu alınamadı:', error);
    }
  }

  function renderLyrics(items) {
    lyricsLines.replaceChildren();

    items.forEach((line, index) => {
      const element = document.createElement('div');
      element.className = 'sp-lyric-line';
      element.textContent = line.words || '';
      element.dataset.index = String(index);
      element.dataset.time = String(Number(line.time) || 0);

      element.addEventListener('click', () => {
        if (!modalYTReady || !modalYTPlayer?.seekTo) return;

        modalYTPlayer.seekTo(Number(line.time) || 0, true);
        modalYTPlayer.playVideo?.();
      });

      lyricsLines.appendChild(element);
    });

    lastActiveIndex = -1;
  }

  function updateLyrics() {
    if (!modalYTReady || !modalYTPlayer?.getCurrentTime) return;

    const time = modalYTPlayer.getCurrentTime();
    const duration = modalYTPlayer.getDuration() || 0;

    if (!seeking) timeline.value = String(time);

    timeline.max = String(Math.max(duration, 1));
    currentTime.textContent = formatTime(time);
    durationLabel.textContent = formatTime(duration);

    let index = -1;

    for (let i = 0; i < lyrics.length; i++) {
      const lineTime = Number(lyrics[i]?.time);
      if (Number.isFinite(lineTime) && lineTime <= time + 0.08) {
        index = i;
      } else if (Number.isFinite(lineTime)) {
        break;
      }
    }

    if (index === lastActiveIndex) return;
    lastActiveIndex = index;

    lyricsLines.querySelectorAll('.sp-lyric-line').forEach((line, i) => {
      line.classList.toggle('is-active', i === index);
    });

    const activeLine = lyricsLines.children[index];

    if (activeLine) {
      const target = activeLine.offsetTop -
        lyricsViewport.clientHeight / 2 +
        activeLine.offsetHeight / 2;

      lyricsViewport.scrollTo({
        top: Math.max(0, target),
        behavior: 'smooth'
      });
    }
  }

  function startSync() {
    clearInterval(syncTimer);
    syncTimer = setInterval(updateLyrics, 150);
  }

  function parseLrcText(value) {
    if (typeof value !== 'string') return [];
    const result = [];
    for (const rawLine of value.split(/\r?\n/)) {
      const matches = [...rawLine.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
      const words = rawLine.replace(/\[(?:\d{1,2}:\d{2})(?:\.\d{1,3})?\]/g, '').trim();
      if (!words || !matches.length) continue;
      for (const match of matches) {
        const fraction = match[3] ? Number(`0.${match[3]}`) : 0;
        result.push({ time: Number(match[1]) * 60 + Number(match[2]) + fraction, words });
      }
    }
    return result.sort((a, b) => a.time - b.time);
  }

  async function fetchLrclibLyrics(trackName, artistName, id) {
    const cleanTrack = String(trackName || '').replace(/\s*[([{].*?[)\]}]\s*/g, ' ').trim();
    const cleanArtist = String(artistName || '').split(',')[0].trim();
    const params = new URLSearchParams({ track_name: cleanTrack || trackName, artist_name: cleanArtist || artistName });
    const requests = [
      `https://lrclib.net/api/get?${params.toString()}`,
      `https://lrclib.net/api/search?${params.toString()}`
    ];
    for (const url of requests) {
      try {
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (id !== requestId) return null;
        if (!response.ok) continue;
        const payload = await response.json();
        const candidates = Array.isArray(payload) ? payload : [payload];
        const match = candidates.find(item => item?.syncedLyrics || item?.plainLyrics);
        if (match) {
          const synced = parseLrcText(match.syncedLyrics || '');
          if (synced.length) return { lyrics: synced, plain: match.plainLyrics || '', source: 'LRCLIB' };
          if (match.plainLyrics) return { lyrics: match.plainLyrics.split(/\r?\n/).filter(Boolean).map(words => ({ time: null, words })), plain: match.plainLyrics, source: 'LRCLIB' };
        }
      } catch (error) {
        console.warn('LRCLIB isteği başarısız:', error);
      }
    }
    return null;
  }

  async function loadLyrics(track, id) {
    const trackName = typeof track === 'string' ? track : track.title;
    const artistName = typeof track === 'string' ? '' : track.artist;
    lyricsStatus.textContent = 'Senkronize sözler aranıyor…';
    lyricsLines.replaceChildren();
    playButton.disabled = true;
    playButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor';

    let syncData = null;
    let lyricSource = '';
    // 1) Mevcut otomatik senkronizasyon servisi: YouTube video ID'si burada bulunur.
    try {
      const response = await fetch(
        `/api/auto-sync?track=${encodeURIComponent(trackName)}&artist=${encodeURIComponent(artistName)}`,
        { credentials: 'include', headers: { Accept: 'application/json' } }
      );
      if (response.ok) syncData = await response.json();
    } catch (error) {
      console.warn('Otomatik senkronizasyon servisine ulaşılamadı:', error);
    }
    if (id !== requestId || !modal.classList.contains('is-open')) return;

    const rawLyrics = syncData?.lyrics || syncData?.syncedLyrics || syncData?.data?.lyrics || [];
    let normalized = typeof rawLyrics === 'string' ? parseLrcText(rawLyrics) : normalizeSyncedLyrics(rawLyrics);
    let videoId = syncData?.videoId || syncData?.video_id || syncData?.youtubeVideoId || syncData?.youtube_video_id || syncData?.data?.videoId || syncData?.data?.video_id;

    // 2) Otomatik servis söz döndürmediyse LRCLIB'den zaman damgalı LRC al.
    if (!normalized.length) {
      const fallback = await fetchLrclibLyrics(trackName, artistName, id);
      if (id !== requestId || !modal.classList.contains('is-open')) return;
      if (fallback?.lyrics?.length) {
        normalized = fallback.lyrics;
        lyricSource = fallback.source;
      }
    }

    lyrics = normalized;
    renderLyrics(lyrics);

    if (!lyrics.length) {
      lyricsStatus.textContent = 'Bu parça için zaman damgalı söz bulunamadı. Başka bir sürümünü deneyebilirsin.';
      playButton.disabled = true;
      playButton.innerHTML = '<i class="fa-solid fa-circle-info"></i> Söz bulunamadı';
      return;
    }

    const hasTimestamps = lyrics.some(line => Number.isFinite(Number(line.time)));
    lyricsStatus.textContent = hasTimestamps
      ? `${lyricSource ? lyricSource + ' · ' : ''}Zaman damgalı sözler hazır. Senkron için YouTube oynatımını başlat.`
      : 'Sözler bulundu ancak zaman damgası yok; bu sürümde otomatik senkronizasyon yapılamıyor.';

    if (!videoId) {
      // Lyrics are still useful when the auto-sync service has no matching video.
      playButton.disabled = true;
      playButton.innerHTML = '<i class="fa-solid fa-circle-info"></i> Video bulunamadı';
      lyricsStatus.textContent = hasTimestamps
        ? `${lyricSource ? lyricSource + ' · ' : ''}Sözler yüklendi, fakat otomatik senkronizasyon servisi eşleşen YouTube videosu döndürmedi.`
        : 'Sözler yüklendi ancak senkronizasyon için video bulunamadı.';
      return;
    }

    let attempts = 0;
    const cueWhenReady = () => {
      if (id !== requestId) return;
      if (modalYTReady && modalYTPlayer?.cueVideoById) {
        modalYTPlayer.cueVideoById(videoId);
        playButton.disabled = false;
        playButton.innerHTML = '<i class="fa-solid fa-play"></i> YouTube ile dinle';
        updateLyrics();
        return;
      }
      if (++attempts < 40) setTimeout(cueWhenReady, 250);
      else {
        playButton.disabled = true;
        playButton.innerHTML = '<i class="fa-solid fa-circle-info"></i> Oynatıcı hazır değil';
        lyricsStatus.textContent = 'Sözler yüklendi ancak YouTube oynatıcı başlatılamadı. Sayfayı yenileyip tekrar dene.';
      }
    };
    cueWhenReady();
  }

  window.initSongPreviewYouTubePlayer = function () {
    if (!youtubeHost || modalYTPlayer || !window.YT?.Player) return;
    modalYTPlayer = new YT.Player('spYoutubePlayerHost', {
      height: '180', width: '320',
      playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, origin: window.location.origin },
      events: {
        onReady: () => { modalYTReady = true; },
        onStateChange: event => {
          if (!window.YT?.PlayerState) return;
          if (event.data === YT.PlayerState.PLAYING) {
            playButton.innerHTML = '<i class="fa-solid fa-pause"></i> Duraklat';
            startSync();
          } else if ([YT.PlayerState.PAUSED, YT.PlayerState.ENDED, YT.PlayerState.CUED].includes(event.data)) {
            playButton.innerHTML = '<i class="fa-solid fa-play"></i> YouTube ile dinle';
            clearInterval(syncTimer);
            syncTimer = null;
            // Duraklatma/sonlandırma anındaki satır ve timeline konumunu koru.
            updateLyrics();
          }
        }
      }
    });
  };

  // YouTube API callback bazen bu modül yüklenmeden önce çalışır. O durumda
  // ghost player hazır olur ama modal player hiç oluşturulmazdı.
  if (isYTReady && window.YT?.Player) {
    window.initSongPreviewYouTubePlayer();
  }

  async function loadArtistGallery(artistName, id) {
    const gallery = $('spArtistGallery');
    const galleryTitle = $('spGalleryTitle');
    const galleryCount = $('spGalleryCount');
    const galleryCaption = $('spGalleryCaption');
    if (!gallery) return;
    gallery.innerHTML = '<div class="sp-gallery-placeholder"><i class="fa-solid fa-spinner fa-spin"></i><span>Albüm kapakları aranıyor…</span></div>';
    if (galleryTitle) galleryTitle.textContent = `${artistName} · Albüm ve single kapakları`;
    try {
      const response = await fetch(`/api/spotify/artist-gallery?name=${encodeURIComponent(artistName)}&limit=100`, { credentials: 'include' });
      const result = await response.json();
      if (id !== requestId || !modal.classList.contains('is-open')) return;
      if (!response.ok) throw new Error(result.message || 'Galeri yüklenemedi');
      const data = result.data || {};
      const albums = Array.isArray(data.albums) ? data.albums : [];
      const entries = [
        ...(data.artist?.image ? [{ id: `artist-${data.artist.id}`, name: `${data.artist.name} · Sanatçı`, type: 'artist', image: data.artist.image, spotifyUrl: data.artist.spotifyUrl }] : []),
        ...albums.filter(album => album.image)
      ];
      if (galleryCount) galleryCount.textContent = `${entries.length} GÖRSEL`;
      if (!entries.length) {
        gallery.innerHTML = '<div class="sp-gallery-placeholder"><i class="fa-regular fa-images"></i><span>Bu sanatçı için görsel bulunamadı.</span></div>';
        if (galleryCaption) galleryCaption.textContent = 'Spotify kataloğunda eşleşen kapak bulunamadı.';
        return;
      }
      gallery.replaceChildren();
      entries.forEach((item, index) => {
        const link = document.createElement('a');
        link.className = 'sp-gallery-item';
        link.href = item.spotifyUrl || data.artist?.spotifyUrl || '#';
        link.target = '_blank'; link.rel = 'noopener noreferrer'; link.title = item.name || 'Albüm kapağı';
        const img = document.createElement('img');
        img.loading = index > 11 ? 'lazy' : 'eager'; img.src = item.image; img.alt = `${item.name || 'Albüm'} kapak görseli`;
        img.addEventListener('error', () => link.remove(), { once: true });
        const caption = document.createElement('span'); caption.className = 'sp-gallery-item-caption'; caption.textContent = item.name || 'Albüm';
        const meta = document.createElement('small');
        const year = item.releaseDate ? String(item.releaseDate).slice(0, 4) : '';
        meta.textContent = [item.type === 'single' ? 'Single' : item.type === 'compilation' ? 'Derleme' : item.type === 'artist' ? 'Sanatçı' : 'Albüm', year].filter(Boolean).join(' · ');
        link.append(img, caption, meta); gallery.appendChild(link);
      });
      if (galleryCaption) galleryCaption.textContent = `${data.artist?.name || artistName} · Spotify kataloğundaki albüm, single ve derleme kapakları`;
    } catch (error) {
      if (id !== requestId) return;
      console.warn('Sanatçı albüm galerisi yüklenemedi:', error);
      gallery.innerHTML = '<div class="sp-gallery-placeholder"><i class="fa-solid fa-triangle-exclamation"></i><span>Kapaklar yüklenemedi. Daha sonra tekrar dene.</span></div>';
    }
  }

  window.openSongPreview = async function (track) {
    const id = ++requestId;

    activeTrack = track;
    lyrics = [];
    lastActiveIndex = -1;

    clearInterval(syncTimer);
    syncTimer = null;

    if (isYTReady && ytPlayer?.pauseVideo) ytPlayer.pauseVideo();
    if (modalYTReady && modalYTPlayer?.pauseVideo) modalYTPlayer.pauseVideo();

    const trackId = getTrackId(track);
    if (!trackId) {
      console.warn('Şarkının Spotify track ID bilgisi eksik.');
      if (track?.url) window.open(track.url, '_blank', 'noopener,noreferrer');
      return;
    }

    title.textContent = track.title;
    artist.textContent = track.artist;
    comment.textContent = track.comment || 'Bu parça toplulukla paylaşıldı.';
    rating.textContent = `${track.rating}/100`;

    const genreList = String(track.genres || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
      .slice(0, 5);

    artistFacts.replaceChildren();
    const factItems = [
      `Parça: ${track.title}`,
      ...genreList
    ];
    factItems.forEach((value, index) => {
      const fact = document.createElement('span');
      fact.className = 'sp-artist-fact';
      fact.textContent = index === 0 ? value : value;
      artistFacts.appendChild(fact);
    });

    artistBio.textContent = track.bio ||
      (genreList.length
        ? `${track.artist}, bu paylaşımda ${genreList.join(', ')} türleriyle ilişkilendiriliyor. Sanatçı hakkında daha fazla bilgi için Spotify sanatçı aramasını açabilirsin.`
        : `${track.artist} hakkında bu paylaşımın verilerinde doğrulanmış bir biyografi bulunmuyor. Sanatçının müzikleri ve profili için Spotify'da keşfedebilirsin.`);

    artistSearch.href =
      `https://open.spotify.com/search/${encodeURIComponent(track.artist)}/artists`;

    cover.src = track.cover || '';
    cover.alt = `${track.title} albüm kapağı`;
    ambient.style.backgroundImage = track.cover
      ? `url("${track.cover.replace(/["\\]/g, '')}")`
      : 'none';

    spotifyEmbed.replaceChildren();

    const iframe = document.createElement('iframe');
    iframe.title = `${track.title} Spotify önizlemesi`;
    iframe.src =
      `https://open.spotify.com/embed/track/${trackId}?theme=0`;
    iframe.loading = 'lazy';
    iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.style.height = '152px';
    spotifyEmbed.appendChild(iframe);

    timeline.value = '0';
    currentTime.textContent = '0:00';
    durationLabel.textContent = '0:00';

    setTab('spotify');
    openModal();

    // Bu iki istek birbirinden bağımsız çalışır.
    await Promise.allSettled([
      checkSpotifyConnection(trackId, id),
      loadLyrics(track, id),
      loadArtistGallery(track.artist, id)
    ]);
  };

  document.addEventListener('click', async event => {
    const repostButton = event.target.closest('[data-repost-id]');
    if (repostButton) {
      event.preventDefault();
      event.stopPropagation();
      if (repostButton.disabled) return;
      const shareId = repostButton.dataset.repostId;
      const countEl = document.getElementById(`repostCount-${shareId}`);
      const originalText = repostButton.textContent;
      repostButton.disabled = true;
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/songshare/repost/${encodeURIComponent(shareId)}`, {
          method: 'POST',
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || 'Repost işlemi tamamlanamadı.');
        if (countEl) countEl.textContent = String(payload.repostCount ?? 0);
        repostButton.classList.toggle('is-active', Boolean(payload.reposted));
        repostButton.setAttribute('aria-pressed', String(Boolean(payload.reposted)));
        repostButton.childNodes[0].textContent = payload.reposted ? 'Repostu geri al (' : 'Repostla (';
      } catch (error) {
        console.warn('Repost işlemi başarısız:', error.message);
        if (typeof window.showSongShareToast === 'function') window.showSongShareToast(error.message);
      } finally {
        repostButton.disabled = false;
      }
      return;
    }

    const immersiveButton = event.target.closest('[data-feed-immersive]');
    if (immersiveButton) {
      event.preventDefault();
      event.stopPropagation();
      const card = immersiveButton.closest('.feed-card[data-preview-title]');
      if (!card || typeof window.openSongPreview !== 'function') return;
      window.openSongPreview({
        title: card.dataset.previewTitle || '', artist: card.dataset.previewArtist || '',
        cover: card.dataset.previewCover || '', url: card.dataset.previewUrl || '',
        uri: card.dataset.previewUri || '', comment: card.dataset.previewComment || '',
        rating: Math.max(0, Math.min(100, Number(card.dataset.previewRating) || 0)),
        genres: card.dataset.previewGenres || '', bio: card.dataset.previewBio || ''
      });
      return;
    }

    const closeTarget = event.target.closest('[data-preview-close]');

    if (closeTarget) {
      closeModal();
      return;
    }

    const tab = event.target.closest('[data-sp-tab]');
    if (tab) {
      setTab(tab.dataset.spTab);
      return;
    }

    const playTrigger = event.target.closest('.cover-play-cta[data-preview-play]');
    if (playTrigger) {
      event.preventDefault();
      event.stopPropagation();
      const playCard = playTrigger.closest('.feed-card[data-preview-title]');
      if (!playCard) return;

      window.openSongPreview({
        title: playCard.dataset.previewTitle || '',
        artist: playCard.dataset.previewArtist || '',
        cover: playCard.dataset.previewCover || '',
        url: playCard.dataset.previewUrl || '',
        uri: playCard.dataset.previewUri || '',
        comment: playCard.dataset.previewComment || '',
        rating: Math.max(0, Math.min(100, Number(playCard.dataset.previewRating) || 0)),
        genres: playCard.dataset.previewGenres || '',
        bio: playCard.dataset.previewBio || ''
      });
      return;
    }

    const lyricsSurface = event.target.closest('.songshare-lyrics-card');
    if (lyricsSurface && !event.target.closest('a, button, [data-no-preview]')) {
      const lyricsCard = lyricsSurface.closest('.feed-card[data-preview-title]');
      if (lyricsCard) {
        event.preventDefault();
        window.openSongPreview({
          title: lyricsCard.dataset.previewTitle || '', artist: lyricsCard.dataset.previewArtist || '',
          cover: lyricsCard.dataset.previewCover || '', url: lyricsCard.dataset.previewUrl || '',
          uri: lyricsCard.dataset.previewUri || '', comment: lyricsCard.dataset.previewComment || '',
          rating: Number(lyricsCard.dataset.previewRating) || 0,
          genres: lyricsCard.dataset.previewGenres || '', bio: lyricsCard.dataset.previewBio || ''
        });
        return;
      }
    }

    const card = event.target.closest('.feed-card[data-preview-title]');
    if (!card) return;

    // Kart içindeki puanlama, menü, profil ve bağlantılar normal çalışsın.
    if (event.target.closest(
      'button, a, input, textarea, select, label, ' +
      '.rate-mini-popup, [data-no-preview]'
    )) return;

    window.openSongPreview({
      title: card.dataset.previewTitle || '',
      artist: card.dataset.previewArtist || '',
      cover: card.dataset.previewCover || '',
      url: card.dataset.previewUrl || '',
      uri: card.dataset.previewUri || '',
      comment: card.dataset.previewComment || '',
      rating: Math.max(
        0,
        Math.min(100, Number(card.dataset.previewRating) || 0)
      ),
      genres: card.dataset.previewGenres || '',
      bio: card.dataset.previewBio || ''
    });
  });

  playButton.addEventListener('click', () => {
    if (!modalYTReady || !modalYTPlayer) return;

    const state = modalYTPlayer.getPlayerState();

    if (state === YT.PlayerState.PLAYING) {
      modalYTPlayer.pauseVideo();
      playButton.innerHTML =
        '<i class="fa-solid fa-play"></i> Devam et';
    } else {
      modalYTPlayer.playVideo();
      playButton.innerHTML =
        '<i class="fa-solid fa-pause"></i> Duraklat';
    }
  });

  timeline.addEventListener('input', () => {
    seeking = true;
    currentTime.textContent = formatTime(timeline.value);
  });

  timeline.addEventListener('change', () => {
    if (modalYTReady && modalYTPlayer?.seekTo) {
      modalYTPlayer.seekTo(Number(timeline.value), true);
    }
    seeking = false;
    updateLyrics();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) {
      closeModal();
    }
  });

  // Yalnızca YouTube gerçekten oynatılırken kontrol simgesini güncelle.
  window.addEventListener('song-preview-unused', () => { });
})();


// ------------------------------------------------------------
// FIRST-VISIT FEATURE TOUR — focused, one feature per step
// ------------------------------------------------------------
(function initSongShareFeatureTour() {
  const STORAGE_KEY = 'songshare_feature_tour_dismissed_v1';
  const SEEN_KEY = 'songshare_feature_tour_seen_v1';
  const steps = [
    { target: '.nav-menu-list', title: 'Gezinme menüsü', text: 'Home akışına, şarkı paylaşımına, keşfetmeye ve arkadaşlarının alanına buradan geçebilirsin.' },
    { target: '#friendsListeningStrip', title: 'Friend Activity', text: 'Arkadaşlarının şu anda dinlediği parçaları burada görürsün. Canlı bir karta tıklayarak parçayı mini oynatıcıda açabilirsin.' },
    { target: '#spotlightPanel', title: 'Öne çıkanlar', text: 'Spotlight alanında öne çıkan parçaları kapaklarıyla keşfet; oklarla parçalar arasında gez.' },
    { target: '#dynamicFeedItems', title: 'Müzik akışı', text: 'Arkadaşlarının paylaşımları burada görünür. Paylaşımlara göz atıp müzik keşfedebilirsin.' },
    { target: '#navLinkShare', title: 'Parça paylaş', text: 'Share Track bölümünden Spotify’da arama yapabilir, bir parça seçip paylaşımını hazırlayabilirsin. Lyrics kesiti seçeneği şimdilik yakında.' },
    { target: '.spotify-account-card', title: 'Spotify bağlantısı', text: 'Spotify hesabını bağlayarak dinlediğin parçayı paylaşma ve dinleme durumunu eşleştirme özelliklerinden yararlanabilirsin.' }
  ];
  let index = 0;
  let currentTarget = null;
  let resizeHandler = null;
  const backdrop = document.getElementById('songShareTourBackdrop');
  const card = document.getElementById('songShareTourCard');
  const title = document.getElementById('songShareTourTitle');
  const description = document.getElementById('songShareTourDescription');
  const progress = document.getElementById('songShareTourProgress');
  const next = document.getElementById('songShareTourNext');
  const later = document.getElementById('songShareTourLater');
  const never = document.getElementById('songShareTourNever');
  if (!backdrop || !card || !title || !description || !progress || !next || !later || !never) return;

  function clearTarget() {
    if (currentTarget) currentTarget.classList.remove('songshare-tour-highlight');
    currentTarget = null;
  }
  function closeTour({ remember = false } = {}) {
    clearTarget();
    backdrop.classList.remove('is-visible');
    card.classList.remove('is-visible');
    backdrop.hidden = true;
    card.hidden = true;
    document.body.classList.remove('songshare-tour-open');
    if (remember) {
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch (_) { }
    }
    if (resizeHandler) window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
  function placeCard(target) {
    if (window.matchMedia('(max-width: 760px)').matches) return;
    const rect = target.getBoundingClientRect();
    const cardWidth = Math.min(340, window.innerWidth - 32);
    const cardHeight = card.offsetHeight || 210;
    let left = rect.right + 18;
    if (left + cardWidth > window.innerWidth - 16) left = rect.left - cardWidth - 18;
    if (left < 16) left = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, rect.left));
    let top = rect.top + rect.height / 2 - cardHeight / 2;
    top = Math.max(16, Math.min(window.innerHeight - cardHeight - 16, top));
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.style.right = 'auto';
    card.style.bottom = 'auto';
  }
  function showStep() {
    clearTarget();
    const step = steps[index];
    let target = document.querySelector(step.target);
    // A hidden SPA section is not a useful target; use the share navigation item instead.
    if (!target || target.getClientRects().length === 0) target = document.querySelector('#navLinkShare');
    currentTarget = target;
    currentTarget?.classList.add('songshare-tour-highlight');
    title.textContent = step.title;
    description.textContent = step.text;
    progress.textContent = `${index + 1} / ${steps.length}`;
    next.innerHTML = index === steps.length - 1 ? 'Bitir <span aria-hidden="true">✓</span>' : 'İleri <span aria-hidden="true">→</span>';
    if (currentTarget) placeCard(currentTarget);
    card.classList.remove('is-visible');
    requestAnimationFrame(() => card.classList.add('is-visible'));
  }
  function startTour() {
    if (localStorage.getItem(STORAGE_KEY) === '1') return;
    index = 0;
    backdrop.hidden = false;
    card.hidden = false;
    document.body.classList.add('songshare-tour-open');
    requestAnimationFrame(() => backdrop.classList.add('is-visible'));
    showStep();
    resizeHandler = () => { if (currentTarget) placeCard(currentTarget); };
    window.addEventListener('resize', resizeHandler);
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (_) { }
  }
  next.addEventListener('click', () => {
    if (index >= steps.length - 1) { closeTour({ remember: true }); return; }
    index += 1;
    showStep();
  });
  later.addEventListener('click', () => closeTour());
  never.addEventListener('click', () => closeTour({ remember: true }));
  backdrop.addEventListener('click', () => closeTour());
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !card.hidden) closeTour();
  });
  // Re-open the tour from the brand mark whenever it has only been postponed.
  document.querySelector('.brand-badge')?.addEventListener('dblclick', startTour);
  window.addEventListener('load', () => {
    if (localStorage.getItem(STORAGE_KEY) === '1') return;
    window.setTimeout(startTour, 700);
  }, { once: true });
})();


/* =========================================================
   SONGSHARE COMPANION — SPOTIFY-SYNCED LYRICS + IMMERSIVE LISTENING
   Companion lyrics use the same LRCLIB/songshare lyrics endpoint and the
   same Spotify playback clock as the Share page. No second YouTube clock.
   ========================================================= */
(() => {
  const initCompanionControls = () => {
    const dock = document.getElementById('mainPlayerDock');
    if (!dock || dock.dataset.companionReady === 'true') return;
    dock.dataset.companionReady = 'true';

    const tabs = [...dock.querySelectorAll('.tab-btn[data-tab]')];
    const panes = [...dock.querySelectorAll('.companion-pane')];
    const expandBtn = document.getElementById('btnToggleExpand');
    const fullscreenBtn = document.getElementById('btnToggleFullscreen');
    const modal = document.getElementById('fullscreenPlayerModal');
    const closeBtn = document.getElementById('btnCloseFullscreen');
    const fsTitle = document.getElementById('fsTrackTitle');
    const fsArtist = document.getElementById('fsTrackArtist');
    const fsCover = document.getElementById('fsCoverImg');
    const fsBlur = document.getElementById('fullscreenDynamicBlur');
    const fsLyrics = document.getElementById('fsLyricsContainer');
    const fsScrubber = document.getElementById('fsInteractiveScrubber');
    const fsFill = document.getElementById('fsScrubberFill');
    const fsCurrent = document.getElementById('fsCurrentTime');
    const fsRemaining = document.getElementById('fsTotalTime');
    const fsPlay = document.getElementById('btnFsPlayPause');
    const fsPrev = document.getElementById('btnFsPrev');
    const fsNext = document.getElementById('btnFsNext');
    const fsBrand = modal?.querySelector('.fs-brand');

    const safeText = (el, value, fallback = '') => { if (el) el.textContent = value || fallback; };
    const currentTrack = () => window.__songShareLastNowPlaying || {};
    // Prefer the latest Spotify snapshot over the dock image, which can briefly
    // still contain the previous track's cover while the UI is transitioning.
    const coverUrl = () => {
      const track = currentTrack();
      const dockCover = document.getElementById('playerCoverImg');
      return track.albumArt || track.album_art || track.imageUrl || track.image_url ||
        track.coverUrl || track.cover_url || dockCover?.currentSrc ||
        dockCover?.getAttribute('src') || '';
    };
    const playback = { position: 0, duration: 0, isPlaying: false, capturedAt: 0, trackKey: '', spotifyUrl: '' };
    let companionLyrics = [];
    let lyricsRequestId = 0;
    let lastActiveIndex = -1;
    let lastRenderedTrackKey = '';
    let lastScrollIndex = -1;

    function setTab(name) {
      if (!tabs.some(tab => tab.dataset.tab === name)) return;
      tabs.forEach(tab => {
        const active = tab.dataset.tab === name;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-pressed', String(active));
      });
      panes.forEach(pane => pane.classList.toggle('active', pane.id === `pane-${name}`));
      dock.dataset.activeTab = name;
      if (name === 'lyrics') {
        renderLyrics();
        lastScrollIndex = -1;
        updateActiveLyrics(true);
      }
    }
    tabs.forEach(tab => tab.addEventListener('click', () => setTab(tab.dataset.tab)));
    tabs.forEach(tab => tab.setAttribute('aria-pressed', String(tab.classList.contains('active'))));

    expandBtn?.addEventListener('click', () => {
      const expanded = dock.classList.toggle('companion-expanded');
      expandBtn.setAttribute('aria-pressed', String(expanded));
      expandBtn.title = expanded ? 'Küçült' : 'Büyüt';
      expandBtn.setAttribute('aria-label', expanded ? 'Companion penceresini küçült' : 'Companion penceresini büyüt');
    });

    function trackKey(data) {
      const uri = String(data?.songUrl || data?.spotifyUri || data?.trackUri || data?.uri || data?.track_id || '');
      const id = uri.match(/(?:track:|track\/)([A-Za-z0-9]{10,})/i)?.[1];
      return id || `${data?.title || ''}::${data?.artist || ''}`.toLocaleLowerCase();
    }
    function getPosition() {
      // SongShare's main lyrics view uses this exact Spotify clock. Reuse it
      // when the selected track and the live Spotify track are the same.
      const selected = window.currentSelectedTrack;
      const live = currentTrack();
      const selectedId = extractSpotifyTrackId(
        selected?.uri || selected?.spotifyUri || selected?.songUrl
      );
      const liveId = extractSpotifyTrackId(
        playback.spotifyUrl || live.songUrl || live.spotifyUri || live.trackUri ||
        live.uri || live.track_id || live.trackId
      );

      if (
        selected && selectedId && liveId && selectedId === liveId &&
        selected.syncWithSpotify && typeof getEstimatedSpotifyPosition === 'function'
      ) {
        return getEstimatedSpotifyPosition();
      }

      // Fallback for playback sessions where the Share view has not selected
      // the live track: interpolate from the same now-playing snapshot.
      if (!playback.capturedAt || !playback.isPlaying) return playback.position;
      const elapsed = Math.max(0, (performance.now() - playback.capturedAt) / 1000);
      return Math.min(playback.duration || Infinity, playback.position + elapsed);
    }
    function formatTime(seconds) {
      const value = Math.max(0, Math.floor(Number(seconds) || 0));
      return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
    }
    function setLyricsStatus(message, state = 'waiting') {
      const stream = document.getElementById('lyricsStreamBox');
      if (!companionLyrics.length && stream) {
        stream.innerHTML = `<div class="companion-lyrics-empty"><span class="lyrics-empty-orb">♪</span><strong>${escapeHtml(message)}</strong><small>${state === 'loading' ? 'Şarkının zaman damgalı sözleri hazırlanıyor.' : 'Bu parça için senkronize söz bulunamadı.'}</small></div>`;
      }
      if (fsLyrics && !companionLyrics.length) {
        fsLyrics.innerHTML = `<div class="fs-lyrics-empty"><strong>${escapeHtml(message)}</strong><span>${state === 'loading' ? 'Sözler yükleniyor…' : 'Başka bir parça başladığında tekrar denenecek.'}</span></div>`;
      }
    }
    function parseLrc(raw, durationSeconds = 0) {
      const source = String(raw || '').replace(/^\uFEFF/, '');
      if (!source.trim()) return [];
      const offsetMatch = source.match(/^\s*\[offset:([+-]?\d+)\]\s*$/im);
      const offsetSeconds = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0;
      const timestampPattern = /(?:\[|<)(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.,](\d{1,3}))?(?:\]|>)/g;
      const entries = [];
      let order = 0;

      // Keep source order while filling omitted timestamps. Sort by clock only afterwards.
      for (const rawLine of source.split(/\r?\n/)) {
        const stamps = [...rawLine.matchAll(timestampPattern)];
        const text = rawLine
          .replace(timestampPattern, '')
          .replace(/\[[a-z]{2,12}:[^\]]*\]/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!text || /^\[[a-z]{2,12}:/i.test(rawLine.trim())) continue;

        if (!stamps.length) {
          if (!/^\[[^\]]+\]$/.test(rawLine.trim())) entries.push({ time: null, text, estimated: true, order: order++ });
          continue;
        }

        const isEnhanced = stamps.some(match => match[0].startsWith('<'));
        const selectedStamps = isEnhanced ? [stamps[0]] : stamps;
        for (const match of selectedStamps) {
          const first = Number(match[1]);
          const second = Number(match[2]);
          const third = match[3] === undefined ? null : Number(match[3]);
          const fraction = match[4] ? Number(`0.${match[4]}`) : 0;
          const seconds = third === null
            ? first * 60 + second + fraction
            : first * 3600 + second * 60 + third + fraction;
          entries.push({ time: Math.max(0, seconds + offsetSeconds), text, estimated: false, order: order++ });
        }
      }

      const timed = entries.map((entry, index) => entry.time === null ? -1 : index).filter(index => index >= 0);
      if (!timed.length) return [];
      const gaps = [];
      for (let i = 1; i < timed.length; i++) {
        const gap = entries[timed[i]].time - entries[timed[i - 1]].time;
        if (gap > 0.35 && gap < 12) gaps.push(gap);
      }
      gaps.sort((a, b) => a - b);
      const typicalGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 3.4;

      let cursor = 0;
      while (cursor < entries.length) {
        if (entries[cursor].time !== null) { cursor++; continue; }
        const begin = cursor;
        while (cursor < entries.length && entries[cursor].time === null) cursor++;
        const count = cursor - begin;
        const previous = begin > 0 ? entries[begin - 1].time : null;
        const next = cursor < entries.length ? entries[cursor].time : null;
        if (previous !== null && next !== null && next > previous) {
          const step = (next - previous) / (count + 1);
          for (let i = 0; i < count; i++) entries[begin + i].time = previous + step * (i + 1);
        } else if (next !== null) {
          const firstTime = Math.max(0, next - typicalGap * count);
          const step = (next - firstTime) / count;
          for (let i = 0; i < count; i++) entries[begin + i].time = firstTime + step * i;
        } else {
          let time = previous === null ? 0 : previous;
          for (let i = 0; i < count; i++) {
            time += typicalGap;
            entries[begin + i].time = durationSeconds > 0 ? Math.min(time, durationSeconds) : time;
          }
        }
      }

      entries.sort((a, b) => a.time - b.time || a.order - b.order);
      const cleaned = [];
      for (const entry of entries) {
        entry.time = Math.max(0, Number(entry.time) || 0);
        delete entry.order;
        const previous = cleaned[cleaned.length - 1];
        if (previous && Math.abs(previous.time - entry.time) < 0.015 && previous.text === entry.text) continue;
        cleaned.push(entry);
      }
      return cleaned;
    }

    function parsePlainLyrics(raw, durationSeconds = 0) {
      const lines = String(raw || '').split(/\r?\n/).map(line => line.trim())
        .filter(line => line && !/^\[[a-z]{2,12}:[^\]]*\]$/i.test(line));
      if (!lines.length) return [];
      const duration = durationSeconds > 10 ? durationSeconds : Math.max(120, lines.length * 3.6);
      const start = Math.min(2, duration * 0.025);
      const end = Math.max(start, duration - Math.min(5, duration * 0.05));
      const step = lines.length > 1 ? (end - start) / (lines.length - 1) : 0;
      return lines.map((text, index) => ({ time: start + step * index, text, estimated: true }));
    }

    function normalizeLyricsCandidate(payload) {
      let candidate = payload?.data ?? payload;
      if (typeof candidate === 'string') {
        return /(?:\[|<)\d{1,2}:\d{2}/.test(candidate) ? { syncedLyrics: candidate } : { plainLyrics: candidate };
      }
      if (!candidate || typeof candidate !== 'object') return null;
      if (typeof candidate.lyrics === 'string' && !candidate.syncedLyrics && !candidate.plainLyrics) {
        return /(?:\[|<)\d{1,2}:\d{2}/.test(candidate.lyrics)
          ? { ...candidate, syncedLyrics: candidate.lyrics }
          : { ...candidate, plainLyrics: candidate.lyrics };
      }
      if (typeof candidate.data === 'string' && !candidate.syncedLyrics && !candidate.plainLyrics) {
        return /(?:\[|<)\d{1,2}:\d{2}/.test(candidate.data)
          ? { ...candidate, syncedLyrics: candidate.data }
          : { ...candidate, plainLyrics: candidate.data };
      }
      return candidate;
    }
    async function loadCompanionLyrics(data) {
      const requestId = ++lyricsRequestId;
      const key = trackKey(data);
      companionLyrics = [];
      lastActiveIndex = -1;
      lastScrollIndex = -1;
      lastRenderedTrackKey = key;
      if (fsLyrics) fsLyrics.innerHTML = '';
      setLyricsStatus('Senkronize sözler aranıyor…', 'loading');
      if (!data?.title || !data?.artist) return;

      const cleanTrack = String(data.title).replace(/\s*[([\-].*?[)\]]/g, '').trim() || data.title;
      const cleanArtist = String(data.artist).split(',')[0].trim() || data.artist;
      const params = new URLSearchParams({ track_name: cleanTrack, artist_name: cleanArtist });
      if (Number(data.duration_ms) > 0) params.set('duration', String(Math.round(Number(data.duration_ms) / 1000)));
      let songData = null;
      const urls = [`/api/songshare/lyrics?${params}`];
      if (params.has('duration')) {
        const noDuration = new URLSearchParams(params);
        noDuration.delete('duration');
        urls.push(`/api/songshare/lyrics?${noDuration}`);
      }

      for (const url of urls) {
        try {
          const response = await fetch(url, { headers: { Accept: 'application/json' } });
          if (requestId !== lyricsRequestId) return;
          if (!response.ok) continue;
          const candidate = normalizeLyricsCandidate(await response.json());
          if (candidate?.syncedLyrics) { songData = candidate; break; }
          if (!songData && candidate?.plainLyrics) songData = candidate;
        } catch (_) { /* keep searching with the next lyrics source */ }
      }

      // Some endpoints return a synced file with only a few timed sections.
      // In that case, compare against LRCLIB's exact and search results and
      // retain the version with the fuller timestamp coverage.
      const durationHint = Number(data.duration_ms) / 1000 || 0;
      const timedLineCount = raw => [...String(raw || '').matchAll(/(?:\[|<)\d{1,2}:\d{2}/g)].length;
      const minimumTimedLines = durationHint > 0 ? Math.max(8, Math.floor(durationHint / 12)) : 12;
      const shouldSeekFullerSync = !songData?.syncedLyrics || timedLineCount(songData.syncedLyrics) < minimumTimedLines;

      if (shouldSeekFullerSync) {
        try {
          const response = await fetch(`https://lrclib.net/api/get?${params}`, { headers: { Accept: 'application/json' } });
          if (response.ok) {
            const candidate = normalizeLyricsCandidate(await response.json());
            if (candidate?.syncedLyrics && timedLineCount(candidate.syncedLyrics) > timedLineCount(songData?.syncedLyrics)) songData = candidate;
            else if (!songData?.plainLyrics && candidate?.plainLyrics) songData = candidate;
          }
        } catch (_) { /* the search endpoint below may still return a match */ }
      }

      if (shouldSeekFullerSync && timedLineCount(songData?.syncedLyrics) < minimumTimedLines) {
        try {
          const searchParams = new URLSearchParams({ track_name: cleanTrack, artist_name: cleanArtist });
          const response = await fetch(`https://lrclib.net/api/search?${searchParams}`, { headers: { Accept: 'application/json' } });
          if (response.ok) {
            const payload = await response.json();
            const candidates = (Array.isArray(payload) ? payload : [payload])
              .map(normalizeLyricsCandidate)
              .filter(item => item?.syncedLyrics || item?.plainLyrics);
            const normalize = value => String(value || '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
            const wantedTitle = normalize(cleanTrack);
            const wantedArtist = normalize(cleanArtist);
            const score = item => {
              let value = item.syncedLyrics ? 100 : 0;
              if (normalize(item.trackName) === wantedTitle) value += 30;
              if (normalize(item.artistName) === wantedArtist) value += 20;
              const duration = Number(item.duration) || 0;
              const target = Number(data.duration_ms) / 1000 || 0;
              if (duration && target) value += Math.max(0, 12 - Math.abs(duration - target) / 2);
              return value;
            };
            candidates.sort((a, b) => score(b) - score(a));
            const synced = candidates
              .filter(item => item.syncedLyrics)
              .sort((a, b) => score(b) - score(a) || timedLineCount(b.syncedLyrics) - timedLineCount(a.syncedLyrics))[0];
            if (synced && timedLineCount(synced.syncedLyrics) > timedLineCount(songData?.syncedLyrics)) songData = synced;
            else if (!songData?.plainLyrics && candidates[0]) songData = candidates[0];
          }
        } catch (_) { /* use the first-party/plain fallback if available */ }
      }

      if (requestId !== lyricsRequestId) return;
      const durationSeconds = Math.max(0, Number(data.duration_ms) / 1000 || Number(songData?.duration) || 0);
      companionLyrics = parseLrc(songData?.syncedLyrics || '', durationSeconds);
      const approximateTiming = !companionLyrics.length && Boolean(songData?.plainLyrics);
      if (approximateTiming) companionLyrics = parsePlainLyrics(songData.plainLyrics, durationSeconds);

      if (!companionLyrics.length) {
        setLyricsStatus('Bu parça için kullanılabilir söz bulunamadı', 'empty');
        return;
      }
      const hasEstimatedRows = approximateTiming || companionLyrics.some(line => line.estimated);
      if (fsLyrics) fsLyrics.dataset.syncQuality = hasEstimatedRows ? 'estimated' : 'synced';
      const syncLabel = document.getElementById('dockLyricsSyncStatus');
      if (syncLabel) {
        syncLabel.textContent = approximateTiming ? 'Yaklaşık zamanlama' : (hasEstimatedRows ? 'Eksik satırlar tamamlandı' : 'Canlı senkronize');
        syncLabel.dataset.state = approximateTiming ? 'waiting' : 'live';
      }
      renderLyrics();
      updatePlaybackUI();
    }

    function lyricButton(line, index, activeIndex, target) {
      const state = index < activeIndex ? 'passed' : index === activeIndex ? 'active-line' : 'upcoming';
      const dataAttribute = target === 'fs' ? `data-fs-lyric="${index}"` : `data-companion-lyric="${index}"`;
      return `<div class="${target === 'fs' ? 'fs-lyric-line' : 'lyric-line'} ${state}" ${dataAttribute} data-lyric-index="${index}" aria-current="${index === activeIndex ? 'true' : 'false'}">${escapeHtml(line.text)}</div>`;
    }
    function renderFullscreenLyrics(activeIndex = lastActiveIndex) {
      if (!fsLyrics || !companionLyrics.length) return;

      // Before the first timestamp, preview the first two lines without
      // falsely marking the first line as already sung.
      const currentIndex = Math.max(0, activeIndex);
      const current = companionLyrics[currentIndex];
      const next = companionLyrics[currentIndex + 1];
      if (!current) return;

      fsLyrics.dataset.activeIndex = String(currentIndex);
      fsLyrics.setAttribute('aria-live', 'polite');
      fsLyrics.innerHTML = `
        <div class="fs-live-lyrics ${activeIndex < 0 ? 'is-waiting' : ''}">
          <div class="fs-live-current">
            <span class="fs-live-kicker">${activeIndex < 0 ? 'COMING UP' : 'NOW PLAYING'}</span>
            <p class="fs-live-current-text">${escapeHtml(current.text)}</p>
          </div>
          ${next ? `
            <div class="fs-live-next">
              <span class="fs-live-kicker">UP NEXT</span>
              <p class="fs-live-next-text">${escapeHtml(next.text)}</p>
            </div>
          ` : ''}
        </div>
      `;
    }

    function renderLyrics() {
      const stream = document.getElementById('lyricsStreamBox');
      if (!companionLyrics.length) return;
      const activeIndex = lastActiveIndex;

      // Keep the Companion Dock's complete, scrollable lyrics list untouched.
      if (stream && lastRenderedTrackKey) {
        stream.innerHTML = companionLyrics
          .map((line, index) => lyricButton(line, index, activeIndex, 'companion'))
          .join('');
      }

      // Immersive view gets a dedicated, minimal two-line renderer.
      lastScrollIndex = -1;
      renderFullscreenLyrics(activeIndex);
      updateActiveLyrics(true);
    }

    function updateActiveLyrics(force = false) {
      if (!companionLyrics.length) return;

      const position = getPosition();
      let index = -1;
      for (let i = 0; i < companionLyrics.length; i++) {
        if (Number(companionLyrics[i].time) <= position + 0.12) index = i;
        else break;
      }

      if (index !== lastActiveIndex || force) {
        lastActiveIndex = index;

        // The regular Companion Dock still highlights its full lyrics list.
        const stream = document.getElementById('lyricsStreamBox');
        stream?.querySelectorAll('[data-companion-lyric]').forEach((el, i) => {
          el.classList.toggle('passed', i < index);
          el.classList.toggle('active-line', i === index);
          el.classList.toggle('upcoming', i > index);
          el.setAttribute('aria-current', String(i === index));
        });

        // Only replace the two lines when the active timestamp changes.
        renderFullscreenLyrics(index);
      }

      // Auto-follow is intentionally limited to the Dock. The fullscreen
      // two-line layout has no long list to scroll.
      const shouldFollowDock = dock.dataset.activeTab === 'lyrics';
      if (shouldFollowDock && index >= 0 && index !== lastScrollIndex) {
        const container = document.getElementById('lyricsStreamBox');
        const line = container?.querySelector(
          `[data-companion-lyric="${index}"]`
        );
        if (container && line) {
          const lineTop = line.getBoundingClientRect().top -
            container.getBoundingClientRect().top + container.scrollTop;
          const targetTop = lineTop - container.clientHeight / 2 + line.offsetHeight / 2;
          container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
          lastScrollIndex = index;
        }
      }
    }

    function updateFullscreenTrack() {
      const track = currentTrack();
      const title = document.getElementById('playerTrackTitle')?.textContent || track.title;
      const artist = document.getElementById('playerTrackArtist')?.textContent || track.artist;
      const cover = coverUrl();
      safeText(fsTitle, title, 'Müzik Çalmıyor');
      safeText(fsArtist, artist, 'Spotify Beklemede');
      if (fsCover) {
        const currentCover = fsCover.getAttribute('src') || '';
        if (cover && currentCover !== cover) fsCover.src = cover;
        else if (!cover && currentCover) fsCover.removeAttribute('src');
      }
      if (fsBlur) {
        const nextBackground = cover ? `url("${cover.replace(/["\\]/g, '')}")` : '';
        if (fsBlur.style.backgroundImage !== nextBackground) fsBlur.style.backgroundImage = nextBackground;
      }
      safeText(document.getElementById('fsTriviaText'), document.getElementById('triviaTextBox')?.textContent?.trim(), 'Bu oturumda henüz parça bilgisi yok.');
      if (fsBrand) fsBrand.innerHTML = `<span class="live-dot-indicator ${playback.isPlaying ? 'is-playing' : ''}"></span><span>${playback.isPlaying ? 'NOW PLAYING ON SPOTIFY' : 'SONG SHARE IMMERSIVE'}</span>`;
      if (fsPlay) {
        fsPlay.innerHTML = '<i class="fa-brands fa-spotify" aria-hidden="true"></i>';
        fsPlay.title = 'Spotify’da aç';
        fsPlay.setAttribute('aria-label', 'Şarkıyı Spotify’da aç');
      }
      if (fsPrev) fsPrev.hidden = true;
      if (fsNext) fsNext.hidden = true;
    }
    function updatePlaybackUI() {
      const position = getPosition();
      const duration = playback.duration || Number(currentTrack().duration_ms) / 1000 || 0;
      if (duration > 0) {
        if (fsFill) fsFill.style.width = `${Math.min(100, Math.max(0, position / duration * 100))}%`;
        safeText(fsCurrent, formatTime(position));
        safeText(fsRemaining, `-${formatTime(Math.max(0, duration - position))}`);
      } else {
        if (fsFill) fsFill.style.width = '0%';
        safeText(fsCurrent, formatTime(position));
        safeText(fsRemaining, '--:--');
      }
      updateActiveLyrics();
      updateFullscreenTrack();
    }
    window.updateCompanionPlaybackFromSpotify = data => {
      if (!data?.title) {
        playback.position = getPosition();
        playback.isPlaying = false;
        playback.capturedAt = performance.now();
        playback.spotifyUrl = '';
        updatePlaybackUI();
        return;
      }
      const nextKey = trackKey(data);
      const changed = nextKey !== playback.trackKey;
      const currentEstimate = getPosition();
      playback.trackKey = nextKey;
      const incomingProgress = Number(data.progress_ms);
      playback.position = Number.isFinite(incomingProgress) && incomingProgress >= 0
        ? incomingProgress / 1000
        : (changed ? 0 : currentEstimate);
      const incomingDuration = Number(data.duration_ms);
      if (Number.isFinite(incomingDuration) && incomingDuration > 0) playback.duration = incomingDuration / 1000;
      playback.isPlaying = Boolean(data.isPlaying ?? data.is_playing ?? data.playing);
      playback.capturedAt = performance.now();
      playback.spotifyUrl = data.songUrl || data.spotifyUrl || data.spotify_uri || data.uri || '';
      if (changed) loadCompanionLyrics(data);
      updatePlaybackUI();
    };

    const nativeFullscreenBtn = document.getElementById('btnNativeFullscreen');

    function syncNativeFullscreenButton() {
      if (!nativeFullscreenBtn) return;
      const active = document.fullscreenElement === modal;
      nativeFullscreenBtn.setAttribute('aria-pressed', String(active));
      nativeFullscreenBtn.title = active ? 'Tarayıcı tam ekranından çık' : 'Gerçek tarayıcı tam ekranını aç';
      nativeFullscreenBtn.innerHTML = active
        ? '<i class="fa-solid fa-compress" aria-hidden="true"></i><span>Tam ekrandan çık</span>'
        : '<i class="fa-solid fa-expand" aria-hidden="true"></i><span>Gerçek tam ekran</span>';
    }

    async function toggleNativeFullscreen() {
      if (!modal) return;
      try {
        if (document.fullscreenElement === modal) await document.exitFullscreen();
        else if (modal.requestFullscreen) await modal.requestFullscreen({ navigationUI: 'hide' });
      } catch (error) {
        console.warn('Tarayıcı tam ekranı açılamadı:', error);
      } finally {
        syncNativeFullscreenButton();
      }
    }

    function openFullscreen() {
      if (!modal) return;
      updateFullscreenTrack();
      renderLyrics();
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('companion-immersive-open');
      document.addEventListener('keydown', onEscape);
      lastScrollIndex = -1;
      syncNativeFullscreenButton();
      requestAnimationFrame(() => {
        updatePlaybackUI();
        updateActiveLyrics(true);
        window.dispatchEvent(new Event('songshare:immersive-opened'));
      });
    }
    function closeFullscreen() {
      if (!modal) return;
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('companion-immersive-open');
      document.removeEventListener('keydown', onEscape);
      if (document.fullscreenElement === modal && document.exitFullscreen) document.exitFullscreen().catch(() => {});
      syncNativeFullscreenButton();
    }
    function onEscape(event) {
      if (event.key !== 'Escape') return;
      // First Escape exits native browser fullscreen; the immersive layer stays open.
      if (document.fullscreenElement === modal) return;
      closeFullscreen();
    }
    fullscreenBtn?.addEventListener('click', openFullscreen);
    nativeFullscreenBtn?.addEventListener('click', toggleNativeFullscreen);
    if (nativeFullscreenBtn && !document.fullscreenEnabled) {
      nativeFullscreenBtn.disabled = true;
      nativeFullscreenBtn.title = 'Bu tarayıcı gerçek tam ekranı desteklemiyor';
    }
    closeBtn?.addEventListener('click', closeFullscreen);
    modal?.addEventListener('click', event => { if (event.target === modal) closeFullscreen(); });
    document.addEventListener('fullscreenchange', () => {
      syncNativeFullscreenButton();
      if (!document.fullscreenElement && modal?.classList.contains('active')) {
        document.body.classList.add('companion-immersive-open');
      }
    });
    fsPlay?.addEventListener('click', () => {
      const url = playback.spotifyUrl || currentTrack().songUrl || currentTrack().spotifyUrl;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    });
    fsScrubber?.classList.add('is-readonly');

    // Receive the same now-playing snapshot used by the rest of SongShare.
    const initial = currentTrack();
    if (initial?.isPlaying) window.updateCompanionPlaybackFromSpotify(initial);
    window.refreshCompanionFullscreenTrack = updateFullscreenTrack;
    updateFullscreenTrack();
    updatePlaybackUI();
    window.setInterval(updatePlaybackUI, 250);
    window.addEventListener('songshare:now-playing-updated', event => {
      const data = event.detail || currentTrack();
      window.updateCompanionPlaybackFromSpotify(data);
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCompanionControls, { once: true });
  else initCompanionControls();
})();
