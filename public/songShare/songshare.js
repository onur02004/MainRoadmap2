let ytPlayer;
let isYTReady = false;
let syncedLyrics = [];
let lyricsTimer;

// Global HTML helper
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

function formatSecondsSimple(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

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
  }
};

window.switchPreviewMode = function (mode) {
  const spotifyBtn = document.getElementById('btnModeSpotify');
  const lyricsBtn = document.getElementById('btnModeLyrics');
  const spotifyIframe = document.getElementById('spotifyEmbedIframe');
  const lyricsBox = document.getElementById('wizLyricsStreamBox');

  if (mode === 'spotify') {
    spotifyBtn?.classList.add('active');
    lyricsBtn?.classList.remove('active');
    if (spotifyIframe) spotifyIframe.style.display = 'block';
    if (lyricsBox) lyricsBox.style.display = 'none';
    if (isYTReady && ytPlayer?.pauseVideo) ytPlayer.pauseVideo();
  } else {
    lyricsBtn?.classList.add('active');
    spotifyBtn?.classList.remove('active');
    if (spotifyIframe) spotifyIframe.style.display = 'none';
    if (lyricsBox) lyricsBox.style.display = 'flex';
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
        console.log("✅ YouTube Player Ready");
      },
      onStateChange: (event) => {
        if (window.handleYTStateChange) window.handleYTStateChange(event);
      }
    }
  });
};

document.addEventListener('DOMContentLoaded', () => {
  // YouTube API Script Inject
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);

  window.handleYTStateChange = onYTStateChange;

  let currentSelectedTrack = {
    name: 'Rebel Yell',
    artist: 'Billy Idol',
    uri: 'spotify:track:4TIJ7zSBNejNuQIYKjKXNE',
    imageUrl: 'https://i.scdn.co/image/ab67616d0000b273ed9554eeb17f7ffea9c81352'
  };

  // ----------------------------------------------------
  // 3. SPA VIEW & SAYFA GEÇİŞ YÖNETİMİ (HOME / SHARE TRACK / VB.)
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
  // 4. SPOTIFY SYNC & CANLI VERİ ENTEGRASYONU
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
        // Şarkı değiştiyse bilgileri ve sözleri otomatik güncelle
        if (lastTrackTitle !== data.title) {
          lastTrackTitle = data.title;
          if (dockSong) dockSong.textContent = data.title;
          if (dockArtist) dockArtist.textContent = data.artist;
          if (dockImg && data.albumArt) dockImg.src = data.albumArt;
          if (dockIndicator) dockIndicator.textContent = 'LISTENING NOW';

          // Şarkı sözlerini ve companion panelini yeni şarkıyla güncelle
          window.fetchSyncedLyricsExternal?.(data.title, data.artist);
        }
      } else {
        // Şarkı çalmıyorsa bekleme moduna al
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

  async function loadFriendsActivity() {
    const token = localStorage.getItem('token');
    const container = document.getElementById('friendsListContainer');
    const pill = document.getElementById('onlineFriendsCount');
    const navPill = document.getElementById('friendsNavPill');

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

      container.innerHTML = activities.map(act => {
        const isLive = Boolean(act.isPlaying && act.title);

        // Profil resmi çözümü: URL değilse /media/ klasörüne yönlendir, yoksa varsayılan bottts avatarı ata
        let avatarUrl = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(act.username || 'user');
        if (act.avatar) {
          if (act.avatar.startsWith('http')) {
            avatarUrl = act.avatar;
          } else if (act.avatar.startsWith('/content/') || act.avatar.startsWith('content/')) {
            avatarUrl = act.avatar.startsWith('/') ? act.avatar : `/${act.avatar}`;
          } else {
            avatarUrl = `/media/${act.avatar.replace(/^\/?(media\/)?/, '')}`;
          }
        }

        // Offline ise albüm görseli koyma, düz arka plan kullan
        const coverArtImg = isLive && act.albumArt
          ? `<img src="${act.albumArt}" alt="${escapeHtml(act.title)}" class="card-bg-art" />`
          : '';

        return `
          <div class="ios-friend-card ${isLive ? 'state-live' : 'state-offline'}"
               onclick="${isLive ? `playToDock('${escapeHtml(act.title)}', '${escapeHtml(act.artist || '')}', '${act.albumArt || ''}')` : ''}">
            ${coverArtImg}
            <div class="card-backdrop-overlay ${!isLive ? 'offline-solid' : ''}"></div>
            <div class="card-top-bar">
              <div class="user-chip">
                <div class="avatar-ring-wrap">
                  <img src="${avatarUrl}" class="chip-avatar" alt="${escapeHtml(act.username)}" 
                       onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(act.username)}'" />
                  ${isLive ? '<span class="live-dot-indicator"></span>' : ''}
                </div>
                <div class="chip-names">
                  <span class="chip-fullname">${escapeHtml(act.username)}</span>
                  <span class="chip-status-text">${isLive ? 'Listening Now' : 'Offline'}</span>
                </div>
              </div>
              ${isLive ? '<div class="sound-wave-bars"><span></span><span></span><span></span><span></span></div>' : '<span class="idle-tag">OFFLINE</span>'}
            </div>
            <div class="card-bottom-meta">
              <span class="song-name ${!isLive ? 'muted' : ''}">${isLive ? escapeHtml(act.title) : 'Offline'}</span>
              <span class="artist-name ${!isLive ? 'muted' : ''}">${isLive ? escapeHtml(act.artist) : 'Şarkı çalmıyor'}</span>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.warn('Friends activity yüklenemedi:', err);
    }
  }

  // "Şu Anda Çalanı Al" butonu
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

        currentSelectedTrack = {
          name: data.title,
          artist: data.artist,
          imageUrl: data.albumArt,
          uri: `spotify:track:${trackId}`
        };

        applyTrackToWizard(currentSelectedTrack);
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

  document.getElementById('l-play-btn')?.addEventListener('click', () => {
    if (!isYTReady || !ytPlayer) return;
    const state = ytPlayer.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
      ytPlayer.pauseVideo();
    } else {
      ytPlayer.playVideo();
    }
  });

  const lTimeline = document.getElementById('l-timeline');
  lTimeline?.addEventListener('input', () => {
    if (isYTReady && ytPlayer?.seekTo) {
      ytPlayer.seekTo(lTimeline.value, true);
      const currLabel = document.getElementById('l-currTime');
      if (currLabel) currLabel.innerText = formatDuration(lTimeline.value * 1000);
    }
  });

  function onYTStateChange(event) {
    const btn = document.getElementById('l-play-btn');
    if (event.data === YT.PlayerState.PLAYING) {
      if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
      const duration = ytPlayer.getDuration();
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
  const spotifySearchInput = document.getElementById('spotifySearchInput');
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

          // İlk sonucu otomatik uygula
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

  window.selectCustomTrack = function (title, artist, coverUrl, spotifyUri) {
    currentSelectedTrack = { name: title, artist, imageUrl: coverUrl, uri: spotifyUri };
    applyTrackToWizard(currentSelectedTrack);
  };

  function applyTrackToWizard(track) {
    const wizPrevBg = document.getElementById('wizPrevBg');
    const wizPrevTitle = document.getElementById('wizPrevTitle');
    const wizPrevArtist = document.getElementById('wizPrevArtist');
    const step2SelImg = document.getElementById('step2SelImg');
    const step2SelTitle = document.getElementById('step2SelTitle');
    const step2SelArtist = document.getElementById('step2SelArtist');
    const spotifyIframe = document.getElementById('spotifyEmbedIframe');
    const lAlbumArt = document.getElementById('l-album-art');

    if (wizPrevBg) wizPrevBg.src = track.imageUrl;
    if (wizPrevTitle) wizPrevTitle.textContent = track.name;
    if (wizPrevArtist) wizPrevArtist.textContent = track.artist;

    if (step2SelImg) step2SelImg.src = track.imageUrl;
    if (step2SelTitle) step2SelTitle.textContent = track.name;
    if (step2SelArtist) step2SelArtist.textContent = track.artist;

    if (lAlbumArt) lAlbumArt.src = track.imageUrl;

    const trackId = track.uri.includes(':') ? track.uri.split(':')[2] : track.uri;
    if (spotifyIframe && trackId) {
      spotifyIframe.src = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;
    }

    fetchSyncedLyrics(track.name, track.artist);
  }

  // ----------------------------------------------------
  // 7. HIGHLIGHT & RATING SLIDER ANİMASYONLARI
  // ----------------------------------------------------
  window.updateWizardHighlightAnimation = function (val) {
    const display = document.getElementById('wizardHighlightDisplay');
    if (display) display.textContent = formatSecondsSimple(val);
  };

  window.updateWizardRatingAnimation = function (val) {
    const display = document.getElementById('wizardRatingValue');
    if (display) display.textContent = parseFloat(val).toFixed(1);

    const bars = document.querySelectorAll('#wizardBarsWrapper .bar');
    bars.forEach((bar, idx) => {
      if (idx <= val * 2) {
        bar.style.background = 'var(--accent-action)';
        bar.style.boxShadow = '0 0 10px var(--accent-action)';
      } else {
        bar.style.background = '#2d3748';
        bar.style.boxShadow = 'none';
      }
    });
  };

  const wizardBars = document.getElementById('wizardBarsWrapper');
  if (wizardBars && wizardBars.children.length === 0) {
    for (let i = 0; i <= 20; i++) {
      const b = document.createElement('div');
      b.className = 'bar';
      b.style.height = `${20 + (i * 3)}%`;
      wizardBars.appendChild(b);
    }
    updateWizardRatingAnimation(5);
  }

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
      song_name: currentSelectedTrack.name,
      song_artist: currentSelectedTrack.artist,
      spotify_uri: currentSelectedTrack.uri,
      song_url: `https://open.spotify.com/track/${currentSelectedTrack.uri.split(':')[2] || ''}`,
      song_cover_url: currentSelectedTrack.imageUrl,
      visibility: privacy,
      rating_by_user: Number(rating) * 10,
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
  // 9. FEED AKIŞI ÇEKME (TOKEN İLE 401 ENGELİ KALKTI)
  // ----------------------------------------------------
  let feedPage = 1;
  let isLoadingFeed = false;
  let hasMoreSuggestions = true;

  async function fetchSuggestions(page) {
    if (isLoadingFeed || !hasMoreSuggestions) return;
    isLoadingFeed = true;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/songshare/feed?page=${page}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Feed alınamadı');

      const data = await res.json();
      const suggestions = data.data || data.suggestions || [];

      if (suggestions.length === 0) {
        hasMoreSuggestions = false;
      } else {
        feedPage++;
      }
    } catch (err) {
      console.warn("Feed bilgisi alınamadı:", err.message);
    } finally {
      isLoadingFeed = false;
    }
  }

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
    await checkLogin();
    await fetchSuggestions(feedPage);

    // Kendi çalan şarkını hemen getir ve her 5 saniyede bir kontrol et (Realtime Sync)
    loadMyNowPlaying();
    setInterval(loadMyNowPlaying, 5000);

    // Arkadaş aktivitelerini hemen getir ve her 15 saniyede bir güncelle
    loadFriendsActivity();
    setInterval(loadFriendsActivity, 15000);
  }

  startup();
});

const feedScroll = document.getElementById('feedScrollContainer');
const friendsStrip = document.getElementById('friendsListeningStrip');

if (feedScroll && friendsStrip) {
  feedScroll.addEventListener('scroll', () => {
    // 70px'den fazla kaydırıldığında sağ üstteki dock'a kilitlenir
    if (feedScroll.scrollTop > 70) {
      friendsStrip.classList.add('is-docked-right');
    } else {
      friendsStrip.classList.remove('is-docked-right');
    }
  });
}