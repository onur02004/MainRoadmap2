import { getCurrentUser, renderAvatar } from '/avatarRenderer.js';

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
  try {
    const response = await originalFetch.apply(this, args);

    // Eğer sunucu 401 (Yetkisiz) veya 403 (Yasak) döndürürse token bitmiş demektir
    if (response.status === 401 || response.status === 403) {
      console.warn("JWT token süresi doldu veya geçersiz. Yönlendiriliyor...");

      // Süresi dolan token'ı tarayıcıdan temizle
      localStorage.removeItem('token');

      // Kullanıcıyı giriş sayfasına yönlendir (Kendi giriş linkinize göre düzenleyin)
      window.location.replace('/login.html');

      // Yönlendirme gerçekleşene kadar sistemdeki diğer kodların çalışıp çökmeye sebep olmaması için işlemi durdur
      return Promise.reject(new Error("Token Expired - Redirecting..."));
    }

    return response;
  } catch (error) {
    throw error;
  }
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
// SAĞ PANELLERİ DIŞARI ATMA VE GERÇEK LRCLIB SÖZLERİNİ YÜKLEME
// ----------------------------------------------------
window.triggerRightPanelsSlideOut = function (track) {
  const rightAside = document.getElementById('rightAsideContainer');
  const friendsStrip = document.getElementById('friendsListeningStrip');
  const shell = document.getElementById('songShareShell');
  const stageCluster = document.getElementById('shareStageCluster');
  const appleAmbient = document.getElementById('appleLyricsAmbient');

  // Sağ panelleri ekranın dışına sağa kaydır
  rightAside?.classList.add('slide-out-right');
  friendsStrip?.classList.add('slide-out-right');
  shell?.classList.add('share-lyrics-active');

  // Bitişik lyrics modülünü aktif hale getir
  stageCluster?.classList.add('has-lyrics-attached');

  if (track) {
    const dockSongTitle = document.getElementById('dockLyricsSongTitle');
    const dockSongArtist = document.getElementById('dockLyricsSongArtist');
    if (dockSongTitle) dockSongTitle.textContent = track.name || 'Seçilen Parça';
    if (dockSongArtist) dockSongArtist.textContent = track.artist || 'Sanatçı';

    // Apple Music akışkan kapak rengi ışıltısı
    if (appleAmbient && track.imageUrl) {
      appleAmbient.style.backgroundImage = `url('${track.imageUrl}')`;
    }

    // Backend üzerinden LRCLIB sözlerini animasyonlu çek
    fetchUpcomingShareLyrics(track.name, track.artist, track.duration_ms);
  }
};

let currentLyricsFetchId = 0; // Hızlı parça değişimlerinde çakışmayı önleyen sayaç

// ----------------------------------------------------
// SPOTIFY LYRICS LIVE SYNC
// ----------------------------------------------------

let lyricsPlaybackTimer = null;
let lyricsSpotifyResyncTimer = null;

function getEstimatedSpotifyPosition() {
  const track = window.currentSelectedTrack;

  if (!track) return 0;

  let position = Number(track.playbackPositionSec) || 0;

  // Spotify'dan aldığımız pozisyonun üzerinden geçen süreyi ekle
  if (track.isPlaying && track.playbackCapturedAt) {
    position += (Date.now() - track.playbackCapturedAt) / 1000;
  }

  // Şarkı süresini geçmesin
  if (track.duration_ms) {
    position = Math.min(
      position,
      track.duration_ms / 1000
    );
  }

  return position;
}


function updateActiveLyricByTime(position) {
  const scrollBody = document.getElementById('dockLyricsScrollBody');

  if (!scrollBody) return;

  const lines = Array.from(
    scrollBody.querySelectorAll('.lyrics-dock-line')
  );

  if (!lines.length) return;

  // Gerçek senkronize söz var mı?
  const hasSyncedLyrics = lines.some(
    line => parseFloat(line.dataset.time || '0') > 0
  );

  if (!hasSyncedLyrics) return;

  let activeIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineTime = parseFloat(
      lines[i].dataset.time || '0'
    );

    if (lineTime <= position) {
      activeIndex = i;
    } else {
      break;
    }
  }

  const activeLine = lines[activeIndex];

  if (!activeLine) return;

  const currentActive = scrollBody.querySelector(
    '.lyrics-dock-line.active'
  );

  // Zaten doğru satır aktifse hiçbir şey yapma
  if (currentActive === activeLine) return;

  lines.forEach(line => {
    line.classList.remove('active');
  });

  activeLine.classList.add('active');

  // Yeni satırı merkeze getir
  activeLine.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}


// Spotify pozisyonunu frontend'de sürekli ilerlet
function startLyricsPlaybackSync() {

  stopLyricsPlaybackSync();

  // Yaklaşık 10 FPS yeterli
  lyricsPlaybackTimer = setInterval(() => {

    const track = window.currentSelectedTrack;

    if (!track) return;

    if (!track.isPlaying) return;

    const position = getEstimatedSpotifyPosition();

    updateActiveLyricByTime(position);

  }, 100);


  // Her 3 saniyede bir Spotify'dan gerçek pozisyonu tekrar al
  // Böylece pause / seek / buffering kaynaklı drift oluşmaz.
  lyricsSpotifyResyncTimer = setInterval(
    async () => {

      const track = window.currentSelectedTrack;

      if (!track) return;

      try {

        const token = localStorage.getItem('token');

        const res = await fetch(
          '/api/spotify/now-playing',
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (!res.ok) return;

        const data = await res.json();

        if (!data.songUrl) return;

        const parts = data.songUrl.split('/');
        const spotifyTrackId =
          parts[parts.length - 1];

        const currentTrackId =
          track.uri?.split(':')[2];

        // Spotify'da başka şarkıya geçildiyse
        if (
          spotifyTrackId &&
          currentTrackId &&
          spotifyTrackId !== currentTrackId
        ) {

          console.log(
            '🎵 Spotify başka şarkıya geçti.'
          );

          track.name = data.title;
          track.artist = data.artist;
          track.imageUrl = data.albumArt;
          track.uri =
            `spotify:track:${spotifyTrackId}`;

          track.playbackPositionSec =
            (data.progress_ms || 0) / 1000;

          track.duration_ms =
            data.duration_ms || 0;

          track.isPlaying =
            data.isPlaying;

          track.playbackCapturedAt =
            Date.now();

          // Yeni şarkının sözlerini getir
          fetchUpcomingShareLyrics(
            track.name,
            track.artist,
            track.duration_ms
          );

          return;
        }

        // Aynı şarkıysa pozisyonu düzelt
        track.playbackPositionSec =
          (data.progress_ms || 0) / 1000;

        track.isPlaying =
          data.isPlaying;

        track.duration_ms =
          data.duration_ms ||
          track.duration_ms ||
          0;

        track.playbackCapturedAt =
          Date.now();

      } catch (err) {

        console.warn(
          'Spotify lyrics sync hatası:',
          err
        );

      }

    },
    5000
  );
}


function stopLyricsPlaybackSync() {

  if (lyricsPlaybackTimer) {
    clearInterval(lyricsPlaybackTimer);
    lyricsPlaybackTimer = null;
  }

  if (lyricsSpotifyResyncTimer) {
    clearInterval(lyricsSpotifyResyncTimer);
    lyricsSpotifyResyncTimer = null;
  }
}

async function fetchUpcomingShareLyrics(trackName, artistName, durationMs = null) {
  const scrollBody = document.getElementById('dockLyricsScrollBody');
  const syncStatus = document.getElementById('dockLyricsSyncStatus');
  if (!scrollBody) return;

  const fetchId = ++currentLyricsFetchId;

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

  if (syncStatus) syncStatus.textContent = 'Aranıyor...';

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
    // 2. BACKEND /api/songshare/lyrics ENDPOINT'İNE İSTEK AT
    let response = await fetch(`/api/songshare/lyrics?${params.toString()}`);

    // Süre toleransı yüzünden 404 aldıysa duration olmadan tekrar dene
    if (response.status === 404 && durationMs) {
      params.delete('duration');
      response = await fetch(`/api/songshare/lyrics?${params.toString()}`);
    }

    if (fetchId !== currentLyricsFetchId) return;

    if (!response.ok) throw new Error('Not found');

    const result = await response.json();
    const songData = result.data;

    let lines = [];

    // Senkronize sözler varsa ayrıştır
    if (songData?.syncedLyrics) {
      lines = songData.syncedLyrics
        .split('\n')
        .map(line => {
          const match = line.match(/^\[(\d{2}):(\d{2}\.\d{2,3})\](.*)$/);
          if (match) {
            const timeSec = parseInt(match[1], 10) * 60 + parseFloat(match[2]);
            return { time: timeSec, text: match[3].trim() };
          }
          return { time: 0, text: line.replace(/\[.*?\]/g, '').trim() };
        })
        .filter(l => l.text.length > 0);

      if (syncStatus) syncStatus.textContent = 'Canlı Senkronize';
    } else if (songData?.plainLyrics) {
      lines = songData.plainLyrics
        .split('\n')
        .map(line => ({ time: 0, text: line.trim() }))
        .filter(l => l.text.length > 0);

      if (syncStatus) syncStatus.textContent = 'Düz Metin';
    }

    if (lines.length === 0) {
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
    scrollBody.innerHTML = lines.map((item, idx) => `
  <div class="lyrics-dock-line line-animate-in ${idx === activeIndex ? 'active' : ''}" 
       style="--line-index: ${Math.min(idx, 15)};"
       data-time="${item.time || 0}"
       onclick="selectActiveLyricLine(this)">
    ${escapeHtml(item.text)}
  </div>
`).join('');

    if (window.currentSelectedTrack) {
      window.currentSelectedTrack.lyrics = songData.plainLyrics || null;
      window.currentSelectedTrack.time_synced_lyrics = songData.syncedLyrics || null;
    }

    // Lyrics DOM'a yerleştirildikten sonra canlı Spotify sync başlat
    if (
      window.currentSelectedTrack &&
      songData?.syncedLyrics
    ) {
      startLyricsPlaybackSync();

      // İlk pozisyonu hemen uygula
      updateActiveLyricByTime(
        getEstimatedSpotifyPosition()
      );
    }

  } catch (err) {
    if (fetchId !== currentLyricsFetchId) return;
    showEmptyLyricsState(scrollBody, syncStatus);
  }
}

function showEmptyLyricsState(scrollBody, syncStatus) {
  if (syncStatus) syncStatus.textContent = 'Söz Yok';
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
  const rightAside = document.getElementById('rightAsideContainer');
  const friendsStrip = document.getElementById('friendsListeningStrip');
  const shell = document.getElementById('songShareShell');
  const stageCluster = document.getElementById('shareStageCluster');

  rightAside?.classList.remove('slide-out-right');
  friendsStrip?.classList.remove('slide-out-right');
  shell?.classList.remove('share-lyrics-active');

  stageCluster?.classList.remove('has-lyrics-attached');
};

window.selectActiveLyricLine = function (el) {
  const lines = document.querySelectorAll('.lyrics-dock-line');
  lines.forEach(l => l.classList.remove('active'));
  el.classList.add('active');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

// ----------------------------------------------------
// 1. GLOBAL PAYLAŞIM SİHİRBAZI (WIZARD) VE SPOTLIGHT
// ----------------------------------------------------
window.goToWizardStep = function (step) {
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
// MÜZİK ÖNERİLERİ
// ----------------------------------------------------

async function loadRecommendations() {

  const stage =
    document.getElementById('coverflowStage');

  if (!stage) return;

  stage.classList.add(
    'recommendations-loading'
  );


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
      return;
    }

    // Backend'den gelen şarkıları Coverflow'a aktar
    stage.innerHTML = recommendations.map(song => {

      const title = song.title || 'Bilinmeyen Şarkı';
      const artist = song.artist || 'Bilinmeyen Sanatçı';
      const cover = song.coverUrl || '';

      return `
        <div
            class="coverflow-item"
            data-img="${escapeHtml(cover)}"
            data-title="${escapeHtml(title)}"
            data-artist="${escapeHtml(artist)}"
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

        </div>
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


    console.log(
      `🎵 ${recommendations.length} müzik önerisi yüklendi.`
    );

  } catch (err) {

    console.warn(
      'Müzik önerileri alınamadı:',
      err.message
    );

    /*
     * Endpoint çalışmazsa HTML'deki
     * mevcut şarkılar kullanılmaya devam eder.
     */
  }

  stage
    .querySelectorAll('img')
    .forEach(img => prepareImage(img));
}

let coverflowCurrentIndex = 4;
let activeBgLayer = 'A';

function initCoverflowEngine() {
  const stage = document.getElementById('coverflowStage');
  const items = document.querySelectorAll('.coverflow-item');
  const dotsContainer = document.getElementById('coverflowDots');
  const btnHide = document.getElementById('btnHideSpotlight');
  const spotlightPanel = document.getElementById('spotlightPanel');

  if (!stage || items.length === 0) return;

  btnHide?.addEventListener('click', () => {
    spotlightPanel?.classList.add('hidden');
  });

  if (dotsContainer) {
    dotsContainer.innerHTML = Array.from(items)
      .map((_, i) => `<span class="coverflow-dot ${i === coverflowCurrentIndex ? 'active' : ''}" onclick="slideToOffset(${i - coverflowCurrentIndex})"></span>`)
      .join('');
  }

  items.forEach((item, index) => {
    item.addEventListener('click', () => {
      const offset = index - coverflowCurrentIndex;
      if (offset === 0) {
        const title = item.dataset.title;
        const artist = item.dataset.artist;
        const img = item.dataset.img;
        if (window.playToDock) window.playToDock(title, artist, img);
      } else {
        slideToOffset(offset);
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
      },
      onStateChange: (event) => {
        if (window.handleYTStateChange) window.handleYTStateChange(event);
      }
    }
  });
};

document.addEventListener('DOMContentLoaded', () => {
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);

  window.handleYTStateChange = onYTStateChange;

  window.currentSelectedTrack = {
    name: 'Rebel Yell',
    artist: 'Billy Idol',
    uri: 'spotify:track:4TIJ7zSBNejNuQIYKjKXNE',
    imageUrl: 'https://i.scdn.co/image/ab67616d0000b273ed9554eeb17f7ffea9c81352'
  };

  // ----------------------------------------------------
  // 3. SPA VIEW & SAYFA GEÇİŞ YÖNETİMİ
  // ----------------------------------------------------
  const navLinks = document.querySelectorAll('.nav-menu-list .nav-link');
  const viewSections = document.querySelectorAll('.view-section');

  function switchView(targetHash) {
    const viewName = targetHash.replace('#', '') || 'home';

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
  btnConnectSpotify?.addEventListener('click', async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/spotify/login-url', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.message || 'Spotify bağlantı linki üretilemedi.');
      }
    } catch (err) {
      console.error('Spotify login hatası:', err);
    }
  });

  let lastTrackTitle = null;

  async function loadMyNowPlaying() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch('/api/spotify/now-playing', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) return;

      const data = await res.json();
      const dockSong = document.getElementById('playerTrackTitle');
      const dockArtist = document.getElementById('playerTrackArtist');
      const dockImg = document.getElementById('playerCoverImg');
      const dockIndicator = document.getElementById('nowPlayingIndicator');

      if (data.isPlaying && data.title) {
        updateGetCurrentSongButton(true, data.title);
        if (lastTrackTitle !== data.title) {
          lastTrackTitle = data.title;
          if (dockSong) dockSong.textContent = data.title;
          if (dockArtist) dockArtist.textContent = data.artist;
          if (dockImg && data.albumArt) dockImg.src = data.albumArt;
          if (dockIndicator) dockIndicator.textContent = 'LISTENING NOW';

          window.fetchSyncedLyricsExternal?.(data.title, data.artist);
        }
      } else {
        updateGetCurrentSongButton(false);
        if (lastTrackTitle !== null) {
          lastTrackTitle = null;
          if (dockSong) dockSong.textContent = 'Müzik Çalmıyor';
          if (dockArtist) dockArtist.textContent = 'Spotify Beklemede';
          if (dockIndicator) dockIndicator.textContent = 'COMPANION';
        }
      }
    } catch (err) {
      console.warn('Now playing alınamadı:', err);
    }
  }

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
      const res = await fetch('/api/spotify/friends-activity', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include'
      });

      if (!res.ok) return;

      const result = await res.json();
      const activities = result.data || [];
      const liveCount = activities.filter(a => a.isPlaying).length;

      if (pill) pill.textContent = `${liveCount} LISTENING`;
      if (navPill) navPill.textContent = `${liveCount} live`;

      if (activities.length === 0) {
        container.innerHTML = `<p style="font-size:0.75rem; color:var(--text-dim); padding:12px;">Aktif arkadaş bulunmuyor.</p>`;
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

        const clickHandler =
          isLive

            ? `onclick='playToDock(
          ${JSON.stringify(title)},
          ${JSON.stringify(artist)},
          ${JSON.stringify(albumArt)}
        )'`

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
              ${isLive ? 'Listening Now' : 'Offline'}
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
      const res = await fetch('/api/spotify/now-playing', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      if (data.isPlaying && data.songUrl) {
        const parts = data.songUrl.split('/');
        const trackId = parts[parts.length - 1];

        window.currentSelectedTrack = {
          name: data.title,
          artist: data.artist,
          imageUrl: data.albumArt,
          uri: `spotify:track:${trackId}`,

          // Spotify'daki o anki konum
          playbackPositionSec: (data.progress_ms || 0) / 1000,

          // Bu pozisyonu aldığımız zaman
          playbackCapturedAt: Date.now(),

          // Şarkının toplam süresi
          duration_ms: data.duration_ms || 0,

          // Spotify gerçekten çalıyor mu?
          isPlaying: data.isPlaying
        };

        applyTrackToWizard(window.currentSelectedTrack);
        window.triggerRightPanelsSlideOut(window.currentSelectedTrack);
      } else {
        alert('Şu anda Spotify hesabınızda çalan aktif bir şarkı bulunamadı.');
      }
    } catch (e) {
      alert('Şu an çalan şarkı bilgisi alınamadı. Spotify hesabınızın bağlı olduğundan emin olun.');
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
      lyricsTimer = setInterval(syncLyricsUI, 100);
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

  window.handleSpotifySearchInput = function (e) {
    clearTimeout(searchDebounceTimer);
    const q = e.target.value.trim();
    if (q.length < 2) return;

    searchDebounceTimer = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();

        if (json.tracks && json.tracks.length > 0) {
          const grid = document.getElementById('wizardSongGrid');
          if (!grid) return;

          grid.innerHTML = json.tracks.map((t, idx) => `
            <div class="selector-tile ${idx === 0 ? 'selected' : ''}" onclick="selectCustomTrack('${escapeHtml(t.title)}', '${escapeHtml(t.artist)}', '${t.coverUrl}', '${t.spotifyUri}')">
              <img src="${t.coverUrl || 'https://placehold.co/44'}" alt="${escapeHtml(t.title)}" />
              <div class="selector-tile-meta">
                <strong>${escapeHtml(t.title)}</strong>
                <span>${escapeHtml(t.artist)}</span>
              </div>
            </div>
          `).join('');

          const first = json.tracks[0];
          selectCustomTrack(first.title, first.artist, first.coverUrl, first.spotifyUri);
        }
      } catch (err) {
        console.error('Spotify arama hatası:', err);
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
    window.currentSelectedTrack = {
      name: title,
      artist,
      imageUrl: coverUrl,
      uri: spotifyUri,
      duration_ms: durationMs
    };
    applyTrackToWizard(window.currentSelectedTrack);
    window.triggerRightPanelsSlideOut(window.currentSelectedTrack);
  };

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

    const step2Img = document.getElementById('step2SelImg');
    const step2Title = document.getElementById('step2SelTitle');
    const step2Artist = document.getElementById('step2SelArtist');
    if (step2Img) step2Img.src = track.imageUrl || '';
    if (step2Title) step2Title.textContent = track.name;
    if (step2Artist) step2Artist.textContent = track.artist;

    const trackId = track.uri.includes(':') ? track.uri.split(':')[2] : track.uri;
    if (spotifyIframe && trackId) {
      spotifyIframe.src = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;
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

  async function initShareWizardState() {
    const token = localStorage.getItem('token');
    if (!token) {
      applyTrackToWizard(null);
      return;
    }

    try {
      const res = await fetch('/api/spotify/now-playing', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        applyTrackToWizard(null);
        return;
      }

      const data = await res.json();
      if (data.isPlaying && data.songUrl) {
        const parts = data.songUrl.split('/');
        const trackId = parts[parts.length - 1];

        window.currentSelectedTrack = {
          name: data.title,
          artist: data.artist,
          imageUrl: data.albumArt,
          uri: `spotify:track:${trackId}`,

          playbackPositionSec:
            (data.progress_ms || 0) / 1000,

          playbackCapturedAt:
            Date.now(),

          duration_ms:
            data.duration_ms || 0,

          isPlaying:
            data.isPlaying
        };
        applyTrackToWizard(window.currentSelectedTrack, true);
      } else {
        applyTrackToWizard(null);
      }
    } catch (err) {
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

    const rating = Math.max(
      0,
      Math.min(100, Number(val) || 0)
    );

    if (display) {
      display.textContent = rating;
    }

    const percent = rating;

    const color = '#3ecf8e';

    slider.style.background = `
        linear-gradient(
            90deg,
            ${color} 0%,
            ${color} ${percent}%,
            #27303d ${percent}%,
            #27303d 100%
        )
    `;

    slider.style.setProperty(
      '--rating-percent',
      `${percent}%`
    );
  };

  initWizardVisualizerBars();
  updateWizardHighlightAnimation(0);
  updateWizardRatingAnimation(
    document.getElementById('wizardRatingSlider')?.value || 50
  );
  // ----------------------------------------------------
  // 8. YENİ ŞARKIYI FEED'E YAYINLAMA
  // ----------------------------------------------------
  window.submitWizardShare = async function () {
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
      rating_by_user: Number(rating),
      comment_by_user: comment,
      recommended_time_by_user: formatSecondsSimple(highlightSec)
    };

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
      feedValue(
        raw,
        'sharer_avatar',
        'avatar',
        'avatar_url',
        'avatarUrl',
        'profile_image',
        'profileImage',
        'user.avatar',
        'author.avatar',
        'sender.avatar',
        'shared_by.avatar'
      ) ||
      feedValue(
        user,
        'avatar',
        'avatar_url',
        'avatarUrl',
        'profile_image'
      ) ||
      '';


    /*
     * Avatar renderer için gereken bilgiler
     *
     * Backend:
     * avatar_type
     * avatar_data
     */

    const avatarType =
      feedValue(
        raw,
        'sharer_avatar_type',
        'avatar_type',
        'avatarType',
        'user.avatar_type',
        'author.avatar_type'
      ) ||
      feedValue(
        user,
        'avatar_type',
        'avatarType'
      ) ||
      null;


    const avatarData =
      feedValue(
        raw,
        'sharer_avatar_data',
        'avatar_data',
        'avatarData',
        'user.avatar_data',
        'author.avatar_data'
      ) ||
      feedValue(
        user,
        'avatar_data',
        'avatarData'
      ) ||
      null;


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

    const created =
      feedValue(
        raw,
        'created_at',
        'createdAt',
        'date',
        'timestamp',
        'shared_at',
        'sharedAt'
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

      /*
       * User
       */

      userName,

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

    if (item.spotifyUrl) {
      return item.spotifyUrl;
    }

    const match =
      String(item.uri || '')
        .match(/spotify:track:([^:]+)/);

    return match
      ? `https://open.spotify.com/track/${match[1]}`
      : '#';
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
    const val = Number(value);

    const valueLabel = document.getElementById(
      `rangeVal-${shareId}`
    );

    if (valueLabel) {
      valueLabel.textContent = val;
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
            `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;

          return `
          <div class="pod-orbit-bubble">

            <img
              src="${escapeHtml(av)}"
              alt="${escapeHtml(name)}"
              onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}'"
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
            `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;

          return `
          <div class="comment-bubble">

            <img
              src="${escapeHtml(av)}"
              class="c-avatar"
              alt="${escapeHtml(name)}"
              onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}'"
            >

            <div class="c-content">

              <div class="c-top">

                <strong>
                  ${escapeHtml(name)}
                </strong>

                <span class="c-time">
                  ${escapeHtml(time)}
                </span>

              </div>

              <p>
                ${escapeHtml(text)}
              </p>

            </div>

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

            <img
              src="${avatar}"
              class="user-avatar"
              alt="${safeUser}"
              onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(item.userName)}'"
            >

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
          ${matchHtml}
        </div>

      </div>

      <!-- MAIN -->

      <div class="feed-card-main-content">

        <!-- COVER -->

        <div class="cover-stage">

          ${cover
        ? `
                <img
                  src="${cover}"
                  alt="${safeTitle}"
                  class="album-cover-main"
                  loading="lazy"
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

          <button
            class="cover-play-cta"
            onclick='playToDock(
              ${JSON.stringify(item.title)},
              ${JSON.stringify(item.artist)},
              ${JSON.stringify(item.cover)},
              ${JSON.stringify(String(item.id))}
            )'
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

                  ${highlightSeconds > 0 ||
          (
            typeof item.highlight === 'string' &&
            item.highlight.includes(':')
          )
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
            >

              <span class="mini-popup-title">
                Parçayı Puanla
              </span>

              <div class="mini-slider-wrap">

                <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value="${myRating > 0 ? myRating / 100 : 5}"
                    class="mini-range-slider"
                    id="rangeInput-${escapeHtml(String(item.id))}"
                    data-share-id="${escapeHtml(String(item.id))}"
                    oninput="window.updateMiniScore(this.dataset.shareId, this.value)"
                >

                <span
                    class="mini-range-val"
                    id="rangeVal-${escapeHtml(String(item.id))}"
                >
                    ${(myRating / 100).toFixed(1)}
                </span>

              </div>

              <button
                  type="button"
                  class="btn-submit-mini"
                  onclick="submitRate('${String(item.id)}')"
                >
                  Gönder
                </button>

            </div>

            <!-- REPOST -->

            <button
              class="btn-secondary-action"
              onclick='
                toggleRepost(
                  ${JSON.stringify(String(item.id))}
                )
              '
            >
              Repostla
              (
              <span
                id="repostCount-${escapeHtml(String(item.id))}"
              >
                ${item.reposts}
              </span>
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

            <button
              class="btn-secondary-action"
              onclick='
                openFullscreenCompanion(
                  ${JSON.stringify(String(item.id))}
                )
              '
            >
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
              comment
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

    // Fotoğraflar yüklendikçe Apple-style reveal
    container
      .querySelectorAll('.album-cover-main')
      .forEach(img => prepareImage(img));

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

    /*
     * Bütün ilk yüklemeleri aynı anda başlat.
     *
     * Böylece:
     *
     * Recommendations
     * Feed
     * Friends
     * Login
     *
     * birbirini beklemez.
     */

    await Promise.allSettled([
      loadRecommendations(),
      checkLogin(),
      fetchSuggestions(feedPage),
      initShareWizardState(),
      loadFriendsActivity()
    ]);

    /*
     * Recommendation DOM'a yerleştirildikten
     * sonra Coverflow'u başlat.
     */
    initCoverflowEngine();

    /*
     * Spotify companion
     */
    loadMyNowPlaying();
    setInterval(loadMyNowPlaying, 5000);

    /*
     * Friends Activity canlı güncelleme
     */
    setInterval(loadFriendsActivity, 15000);

    /*
     * Home'un son küçük "settle" animasyonu
     */
    requestAnimationFrame(() => {
      document
        .getElementById('view-home')
        ?.classList.add('home-content-ready');
    });
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
  feedScroll.addEventListener('scroll', () => {
    if (feedScroll.scrollTop > 70) {
      dockFriendsStrip();
    } else {
      undockFriendsStrip();
    }
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
    btn.title = 'Şu an çalan parçayı seç';
    if (dot) dot.style.display = 'inline-block';
    if (label) label.textContent = 'Şu Anda Çalanı Al';
  } else {
    btn.disabled = true;
    btn.setAttribute('disabled', 'true');
    btn.title = "Spotify'da müzik çalmıyor";
    if (dot) dot.style.display = 'none';
    if (label) label.textContent = 'Müzik Çalmıyor';
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