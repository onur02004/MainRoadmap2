// songshare.js

function getToken() {
  return localStorage.getItem('token');
}

/* ŞARKI VERİTABANI */
const TRACK_DATABASE = {
  rebel: {
    title: 'Rebel Yell',
    artist: 'Billy Idol',
    cover: 'https://i.scdn.co/image/ab67616d0000b273ed9554eeb17f7ffea9c81352',
    tempo: '166 BPM',
    key: 'B Minor',
    energy: '92%',
    vibe: 'Synth Rock',
    trivia: 'Billy Idol bu parçanın adını The Rolling Stones ile katıldığı bir partide keşfetti.',
    lyrics: [{ time: 144, text: 'In the midnight hour, she cried "more, more, more!"', active: true }]
  },
  skyfull: {
    title: 'A Sky Full of Stars',
    artist: 'Coldplay',
    cover: 'https://i.scdn.co/image/ab67616d00001e028ff7c3580d429c8212b9a3b6',
    tempo: '125 BPM',
    key: 'F Major',
    energy: '88%',
    vibe: 'EDM / Pop',
    trivia: 'Avicii ile ortak prodüksiyon sürecinden geçti.',
    lyrics: [{ time: 20, text: "Cause you're a sky full of stars...", active: true }]
  },
  everlong: {
    title: 'Everlong',
    artist: 'Foo Fighters',
    cover: 'https://i1.sndcdn.com/artworks-000079984264-e8xxju-t500x500.jpg',
    tempo: '158 BPM',
    key: 'D Major',
    energy: '95%',
    vibe: 'Alternative Rock',
    trivia: 'Dave Grohl akustik versiyonunu tek seferde kaydetti.',
    lyrics: [{ time: 110, text: 'If everything could ever feel this real forever...', active: true }]
  },
  aklimda: {
    title: 'Aklımda Biri Var',
    artist: 'Artis',
    cover: 'https://i.scdn.co/image/ab67616d0000b273960635da26f6fbccbeb36b2d',
    tempo: '120 BPM',
    key: 'C Major',
    energy: '78%',
    vibe: 'Pop Rock',
    trivia: 'Stüdyo kayıtlarında akustik gitar altyapısı tercih edildi.',
    lyrics: [{ time: 10, text: 'Aklımda biri var, her şeyim yarım kalan...', active: true }]
  },
  selfaware: {
    title: 'Self Aware',
    artist: 'Alternative',
    cover: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSpAp5NlImEisne6bbOOYVnPRHVm5B1gT4YQfF1Vi5dDQ&s=10',
    tempo: '130 BPM',
    key: 'D Minor',
    energy: '82%',
    vibe: 'Indie Rock',
    trivia: 'Alternatif sahnenin bağımsız projelerinden.',
    lyrics: [{ time: 15, text: 'Trying to keep my mind unclouded...', active: true }]
  },
  joinme: {
    title: 'Join Me',
    artist: 'HIM',
    cover: 'https://i.scdn.co/image/ab67616d0000b273a8cfc41719dc2c2028e0aad5',
    tempo: '114 BPM',
    key: 'G Minor',
    energy: '85%',
    vibe: 'Gothic Rock',
    trivia: 'Melodik metal ve gotik romantizmin harmanı.',
    lyrics: [{ time: 30, text: 'Join me in death, feel no regret...', active: true }]
  },
  denize: {
    title: 'Denize Bıraksam',
    artist: 'Turkish Rock',
    cover: 'https://i.scdn.co/image/ab67616d0000b2736054a3d4d3fadf0173dbdf07',
    tempo: '108 BPM',
    key: 'A Minor',
    energy: '70%',
    vibe: 'Anadolu Rock',
    trivia: 'Yaz akşamı nostaljisi yaşatan modern akustik parça.',
    lyrics: [{ time: 25, text: 'Denize bıraksam bütün dertleri...', active: true }]
  },
  bitik: {
    title: 'Bi Tik',
    artist: 'Pop Mix',
    cover: 'https://i1.sndcdn.com/artworks-ixY9Sl5eXz1mPMyZ-Sq9u8Q-t500x500.jpg',
    tempo: '128 BPM',
    key: 'E Major',
    energy: '90%',
    vibe: 'Club / Dance',
    trivia: 'Kulüp sahnelerinin dinamik temposu.',
    lyrics: [{ time: 10, text: 'Hadi bir tık daha yaklaş bana...', active: true }]
  },
  hot: {
    title: 'Hot',
    artist: 'Inna',
    cover: 'https://i.scdn.co/image/ab67616d0000b2733d6413c7dc24318bdbd5b366',
    tempo: '128 BPM',
    key: 'A Minor',
    energy: '94%',
    vibe: 'Dance Pop',
    trivia: 'Global listeleri sallayan dans marşı.',
    lyrics: [{ time: 10, text: 'Every time you look at me, I go hot...', active: true }]
  }
};

let currentTrackKey = 'rebel';

/* 1. SPOTIFY AUTH */
async function initSpotifyAuth() {
  const token = getToken();
  const btnConnect = document.getElementById('btnConnectSpotify');
  const metaLabel = document.querySelector('.spotify-text-meta .meta-label');
  const metaStatus = document.querySelector('.spotify-text-meta .meta-status');

  if (!token) return;

  try {
    const res = await fetch('/api/spotify/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (res.ok && data.connected) {
      if (metaStatus) {
        metaStatus.textContent = 'CONNECTED';
        metaStatus.style.color = 'var(--accent-action)';
      }
      if (metaLabel) {
        metaLabel.textContent = data.account?.displayName || 'Spotify Connected';
      }
      if (btnConnect) {
        btnConnect.textContent = 'RECONNECT';
        btnConnect.style.background = 'rgba(255, 255, 255, 0.08)';
        btnConnect.style.color = '#fff';
      }
    }
  } catch (err) {
    console.error('Spotify auth error:', err);
  }

  btnConnect?.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/spotify/login-url', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      console.error(e);
    }
  });
}

/* 2. ARKADAŞ AKTİVİTESİ */
async function fetchFriendsActivity() {
  const token = getToken();
  const container = document.getElementById('friendsListContainer');
  const counterBadge = document.getElementById('onlineFriendsCount');
  const navPill = document.getElementById('friendsNavPill');

  if (!token || !container) return;

  try {
    const res = await fetch('/api/spotify/friends-activity', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const json = await res.json();

    if (res.ok && Array.isArray(json.data) && json.data.length > 0) {
      const list = json.data;
      const activeCount = list.filter(f => f.isPlaying).length;

      if (counterBadge) counterBadge.textContent = `${activeCount} LISTENING`;
      if (navPill) navPill.textContent = `${activeCount} live`;

      container.innerHTML = list.map(friend => {
        const isLive = Boolean(friend.isPlaying && friend.title);
        const hasRecent = Boolean(!friend.isPlaying && friend.lastTrack);
        
        let stateClass = 'state-offline';
        let statusText = 'Offline';
        let trackTitle = 'Not Listening';
        let trackArtist = 'No recent activity';
        let coverImg = '';

        if (isLive) {
          stateClass = 'state-live';
          statusText = 'Listening Now';
          trackTitle = friend.title;
          trackArtist = friend.artist || '';
          coverImg = friend.albumArt || '';
        } else if (hasRecent) {
          stateClass = 'state-last-played';
          statusText = friend.playedAgo ? `Played ${friend.playedAgo}` : 'Last played';
          trackTitle = friend.lastTrack.title || 'Unknown';
          trackArtist = friend.lastTrack.artist || '';
          coverImg = friend.lastTrack.albumArt || '';
        }

        const safeTitle = escapeHtml(trackTitle);
        const safeArtist = escapeHtml(trackArtist);
        const safeCover = escapeHtml(coverImg);
        const safeUser = escapeHtml(friend.username || 'Friend');
        const safeAvatar = escapeHtml(friend.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120');

        return `
          <div class="ios-friend-card ${stateClass}" onclick="playToDock('${safeTitle}', '${safeArtist}', '${safeCover}')">
            ${coverImg ? `<img src="${safeCover}" alt="${safeTitle}" class="card-bg-art" />` : ''}
            <div class="card-backdrop-overlay ${!coverImg ? 'offline-solid' : ''}"></div>

            <div class="card-top-bar">
              <div class="user-chip">
                <div class="avatar-ring-wrap">
                  <img src="${safeAvatar}" class="chip-avatar" alt="${safeUser}" />
                  ${isLive ? '<span class="live-dot-indicator"></span>' : ''}
                </div>
                <div class="chip-names">
                  <span class="chip-fullname">${safeUser}</span>
                  <span class="chip-status-text">${statusText}</span>
                </div>
              </div>

              ${isLive ? `
                <div class="sound-wave-bars">
                  <span></span><span></span><span></span><span></span>
                </div>` : ''
              }
              ${hasRecent ? `<span class="idle-tag">Last Played</span>` : ''}
            </div>

            <div class="card-bottom-meta">
              <span class="song-name ${!isLive && !hasRecent ? 'muted' : ''}">${safeTitle}</span>
              <span class="artist-name ${!isLive && !hasRecent ? 'muted' : ''}">${safeArtist}</span>
              ${isLive ? `
                <div class="track-mini-progress">
                  <div class="mini-progress-fill" style="width: 45%;"></div>
                </div>` : ''
              }
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Friends activity fetch error:', err);
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* 3. KENDİ SPOTIFY DURUMU */
async function fetchMyNowPlaying() {
  const token = getToken();
  const coverImg = document.getElementById('playerCoverImg');
  const trackTitle = document.getElementById('playerTrackTitle');
  const trackArtist = document.getElementById('playerTrackArtist');

  if (!token) return;

  try {
    const res = await fetch('/api/spotify/now-playing', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (res.ok && data.isPlaying) {
      if (coverImg) coverImg.src = data.albumArt || '';
      if (trackTitle) {
        trackTitle.textContent = data.title;
        delete trackTitle.dataset.manualSet;
      }
      if (trackArtist) trackArtist.textContent = `${data.artist} • ${data.album || ''}`;
    }
  } catch (err) {
    console.error('Now playing error:', err);
  }
}

/* 4. TRACK COMPANION SEKME YÖNETİMİ */
function switchCompanionTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  document.querySelectorAll('.companion-pane').forEach(pane => {
    pane.classList.remove('active');
  });

  const activePane = document.getElementById(`pane-${tabId}`);
  if (activePane) activePane.classList.add('active');
}

function initCompanionTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchCompanionTab(tabId);
    });
  });
}

/* 5. BÜYÜTME (EXPAND TOGGLE) */
function initExpandToggle() {
  const btnExpand = document.getElementById('btnToggleExpand');
  const companionDock = document.getElementById('mainPlayerDock');

  btnExpand?.addEventListener('click', () => {
    companionDock.classList.toggle('expanded-mode');
  });
}

/* 6. 3D APPLE-STYLE COVERFLOW VE DİNAMİK ARKA PLAN GEÇİŞİ */
let spotlightIndex = 4;

window.slideToOffset = function(targetOffset) {
  spotlightIndex += targetOffset;
  updateCoverflowPositions();
};

window.moveCoverflow = function(direction) {
  spotlightIndex += direction;
  updateCoverflowPositions();
};

function updateCoverflowPositions() {
  const items = document.querySelectorAll('.coverflow-item');
  if (!items.length) return;

  if (spotlightIndex < 0) spotlightIndex = 0;
  if (spotlightIndex >= items.length) spotlightIndex = items.length - 1;

  items.forEach((item, idx) => {
    const offset = idx - spotlightIndex;
    item.style.setProperty('--offset', offset);
    item.classList.toggle('active', offset === 0);
  });

  const activeItem = items[spotlightIndex];
  if (activeItem) {
    const title = activeItem.getAttribute('data-title');
    const artist = activeItem.getAttribute('data-artist');
    const img = activeItem.getAttribute('data-img');

    const islandImg = document.getElementById('spotIslandImg');
    const islandTitle = document.getElementById('spotIslandTitle');
    const islandArtist = document.getElementById('spotIslandArtist');

    if (islandImg) islandImg.src = img;
    if (islandTitle) islandTitle.textContent = title;
    if (islandArtist) islandArtist.textContent = artist;

    const dynamicBg = document.getElementById('spotlightDynamicBg');
    if (dynamicBg) {
      dynamicBg.style.opacity = '0.3';
      setTimeout(() => {
        dynamicBg.style.backgroundImage = `url('${img}')`;
        dynamicBg.style.opacity = '1';
      }, 250);
    }
  }
}

window.togglePauseState = function() {
  console.log('Spotlight playback toggled');
};

/* 7. TASTE MATCH TOOLTIP & REPOST SİSTEMİ */
window.showMatchTooltip = function(el) {
  const matchVal = el.getAttribute('data-match');
  let tip = el.querySelector('.match-tooltip-popup');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'match-tooltip-popup';
    el.appendChild(tip);
  }
  tip.textContent = `Beğenme İhtimalin: %${matchVal}`;
  el.classList.add('show-tip');
};

window.hideMatchTooltip = function(el) {
  el.classList.remove('show-tip');
};

const userRepostStates = { 1: true, 2: false, 3: false };

window.toggleRepost = function(cardId) {
  userRepostStates[cardId] = !userRepostStates[cardId];
  const countEl = document.getElementById(`repostCount-${cardId}`);
  const podContainer = document.getElementById(`repostWing-${cardId}`);
  const avatarsGrid = document.getElementById(`rfwList-${cardId}`) || document.createElement('div');
  
  let currentCount = parseInt(countEl.textContent) || 0;

  if (userRepostStates[cardId]) {
    currentCount += 1;
    if (podContainer) podContainer.style.display = 'flex';
    
    const myBubbleId = `myPodBubble-${cardId}`;
    if (!document.getElementById(myBubbleId)) {
      const bubble = document.createElement('div');
      bubble.className = 'pod-orbit-bubble';
      bubble.id = myBubbleId;
      bubble.innerHTML = `
        <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80" alt="Sen" />
        <span class="pod-holo-tooltip">Sen • Repostladın</span>
      `;
      avatarsGrid.appendChild(bubble);
    }
  } else {
    currentCount = Math.max(0, currentCount - 1);
    const myBubble = document.getElementById(`myPodBubble-${cardId}`);
    if (myBubble) myBubble.remove();

    if (podContainer && avatarsGrid.children.length === 0 && currentCount === 0) {
      podContainer.style.display = 'none';
    }
  }
  countEl.textContent = currentCount;
};

window.handleCommentKey = function(e, cardId) {
  if (e.key === 'Enter') {
    submitComment(cardId);
  }
};

window.submitComment = function(cardId) {
  const input = document.getElementById(`commentInput-${cardId}`);
  const list = document.getElementById(`commentList-${cardId}`);
  if (!input || !list) return;

  const val = input.value.trim();
  if (!val) return;

  const commentHtml = `
    <div class="comment-bubble">
      <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80" class="c-avatar" alt="Onur" />
      <div class="c-content">
        <div class="c-top"><strong>Onur Dönmez</strong> <span class="c-time">Şimdi</span></div>
        <p>${escapeHtml(val)}</p>
      </div>
    </div>
  `;

  list.insertAdjacentHTML('beforeend', commentHtml);
  input.value = '';
  list.scrollTop = list.scrollHeight;
};

/* 8. TAM EKRAN DİNLEME MODU */
window.openFullscreenCompanion = function(trackKey = currentTrackKey) {
  const modal = document.getElementById('fullscreenPlayerModal');
  const track = TRACK_DATABASE[trackKey] || TRACK_DATABASE.rebel;

  const fsCover = document.getElementById('fsCoverImg');
  const fsTitle = document.getElementById('fsTrackTitle');
  const fsArtist = document.getElementById('fsTrackArtist');
  const fsTrivia = document.getElementById('fsTriviaText');
  const fsBlurBg = document.getElementById('fullscreenDynamicBlur');
  const fsLyrics = document.getElementById('fsLyricsContainer');

  if (fsCover) fsCover.src = track.cover;
  if (fsTitle) fsTitle.textContent = track.title;
  if (fsArtist) fsArtist.textContent = track.artist;
  if (fsTrivia) fsTrivia.textContent = track.trivia;
  if (fsBlurBg) fsBlurBg.style.backgroundImage = `url('${track.cover}')`;

  if (fsLyrics && Array.isArray(track.lyrics)) {
    fsLyrics.innerHTML = track.lyrics.map(l => `
      <div class="fs-lyric-item ${l.active ? 'active' : ''}" data-time="${l.time}">
        ${escapeHtml(l.text)}
      </div>
    `).join('');
  }

  modal?.classList.add('active');
};

function closeFullscreenCompanion() {
  const modal = document.getElementById('fullscreenPlayerModal');
  modal?.classList.remove('active');
}

function initFullscreenControls() {
  const btnClose = document.getElementById('btnCloseFullscreen');
  const btnToggleFs = document.getElementById('btnToggleFullscreen');

  btnToggleFs?.addEventListener('click', () => {
    window.openFullscreenCompanion(currentTrackKey);
  });

  btnClose?.addEventListener('click', closeFullscreenCompanion);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeFullscreenCompanion();
      document.getElementById('mainPlayerDock')?.classList.remove('expanded-mode');
      closeRatingModal();
    }
  });
}

window.playToDock = function(title, artist, coverUrl, trackKey = 'rebel') {
  if (!title || title === 'Not Listening') return;

  currentTrackKey = trackKey;
  const coverImg = document.getElementById('playerCoverImg');
  const trackTitle = document.getElementById('playerTrackTitle');
  const trackArtist = document.getElementById('playerTrackArtist');

  if (coverImg && coverUrl) coverImg.src = coverUrl;
  if (trackTitle) {
    trackTitle.textContent = title;
    trackTitle.dataset.manualSet = 'true';
  }
  if (trackArtist) trackArtist.textContent = artist;

  const trackData = TRACK_DATABASE[trackKey] || TRACK_DATABASE.rebel;
  if (trackData) {
    const elTempo = document.getElementById('dnaTempo');
    const elKey = document.getElementById('dnaKey');
    const elEnergy = document.getElementById('dnaEnergy');
    const elVibe = document.getElementById('dnaVibe');
    if (elTempo) elTempo.textContent = trackData.tempo;
    if (elKey) elKey.textContent = trackData.key;
    if (elEnergy) elEnergy.textContent = trackData.energy;
    if (elVibe) elVibe.textContent = trackData.vibe;

    const elTrivia = document.getElementById('triviaTextBox');
    if (elTrivia) elTrivia.textContent = trackData.trivia;

    const elLyrics = document.getElementById('lyricsStreamBox');
    if (elLyrics && Array.isArray(trackData.lyrics)) {
      elLyrics.innerHTML = trackData.lyrics.map(l => `
        <p class="lyric-line ${l.active ? 'active-line' : 'upcoming'}" data-time="${l.time}">
          ${escapeHtml(l.text)}
        </p>
      `).join('');
    }
  }
};

/* 10. SCROLL ANİMASYONU (PÜRÜZSÜZ GEÇİŞ) */
function initScrollMorphAnimations() {
  const scrollContainer = document.getElementById('feedScrollContainer');
  const friendsStrip = document.getElementById('friendsListeningStrip');

  if (!scrollContainer || !friendsStrip) return;

  let ticking = false;

  scrollContainer.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const scrollTop = scrollContainer.scrollTop;

        if (scrollTop > 80) {
          if (!friendsStrip.classList.contains('is-docked-right')) {
            friendsStrip.classList.add('is-docked-right');
            switchCompanionTab('lyrics');
          }
        } else {
          if (friendsStrip.classList.contains('is-docked-right')) {
            friendsStrip.classList.remove('is-docked-right');
            switchCompanionTab('player');
          }
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

window.openRatingModal = function(songTitle, overallScore, totalVotes) {
  const backdrop = document.getElementById('ratingModalBackdrop');
  document.getElementById('modalSongTitle').textContent = songTitle;
  document.getElementById('modalBigScore').textContent = overallScore;
  
  if (totalVotes === '0' || totalVotes === 0 || overallScore === '--') {
    document.getElementById('modalTotalVotes').textContent = 'Bu parça için henüz yeterli oylama yapılmadı';
  } else {
    document.getElementById('modalTotalVotes').textContent = `Based on ${totalVotes} friend ratings`;
  }

  backdrop?.classList.add('active');
};

function closeRatingModal() {
  const backdrop = document.getElementById('ratingModalBackdrop');
  backdrop?.classList.remove('active');
}

window.toggleRateMiniPopup = function(cardId, event) {
  event.stopPropagation();
  document.querySelectorAll('.rate-mini-popup').forEach(p => {
    if (p.id !== `ratePopup-${cardId}`) p.classList.remove('active');
  });

  const popup = document.getElementById(`ratePopup-${cardId}`);
  popup?.classList.toggle('active');
};

window.updateMiniScore = function(cardId, val) {
  const valSpan = document.getElementById(`rangeVal-${cardId}`);
  if (valSpan) valSpan.textContent = val;
};

window.submitRate = function(cardId) {
  const val = document.getElementById(`rangeInput-${cardId}`).value;
  const popup = document.getElementById(`ratePopup-${cardId}`);
  popup?.classList.remove('active');
  console.log(`Card ${cardId} rated as: ${val}`);
};

function initRatingSystemListeners() {
  const backdrop = document.getElementById('ratingModalBackdrop');
  const btnClose = document.getElementById('btnCloseRatingModal');

  btnClose?.addEventListener('click', closeRatingModal);
  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) closeRatingModal();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.rate-mini-popup') && !e.target.closest('.btn-rate-trigger')) {
      document.querySelectorAll('.rate-mini-popup').forEach(p => p.classList.remove('active'));
    }
  });
}

/* INITIALIZATION */
document.addEventListener('DOMContentLoaded', () => {
  initSpotifyAuth();
  fetchFriendsActivity();
  fetchMyNowPlaying();
  initCompanionTabs();// songshare.js

const TRACK_DATABASE = {
  rebel: {
    title: 'Rebel Yell',
    artist: 'Billy Idol',
    cover: 'https://i.scdn.co/image/ab67616d0000b273ed9554eeb17f7ffea9c81352'
  },
  skyfull: {
    title: 'A Sky Full of Stars',
    artist: 'Coldplay',
    cover: 'https://i.scdn.co/image/ab67616d00001e028ff7c3580d429c8212b9a3b6'
  },
  everlong: {
    title: 'Everlong',
    artist: 'Foo Fighters',
    cover: 'https://i1.sndcdn.com/artworks-000079984264-e8xxju-t500x500.jpg'
  },
  maraton: {
    title: 'Maraton',
    artist: 'Ati242',
    cover: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-eHQUhSqV86ZoY3Ak8pVP_XqzFIStg-GSaCOu9EwjQw&s'
  }
};

let currentTrackKey = 'rebel';

window.playToDock = function(title, artist, coverUrl, trackKey = 'rebel') {
  currentTrackKey = trackKey;
  const coverImg = document.getElementById('playerCoverImg');
  const trackTitle = document.getElementById('playerTrackTitle');
  const trackArtist = document.getElementById('playerTrackArtist');

  if (coverImg && coverUrl) coverImg.src = coverUrl;
  if (trackTitle) trackTitle.textContent = title;
  if (trackArtist) trackArtist.textContent = artist;
};

/* ==============================================
   SPA ROUTING & SHARE PAGE LOGIC
   ============================================== */
function initSPA() {
  const links = document.querySelectorAll('.nav-menu-list .nav-link');
  
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      
      if(href.startsWith('#')) {
        e.preventDefault();
        
        // Menü aktif durumunu güncelle
        links.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        // Tüm görünüm bölümlerini gizle
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
        
        // Hedef sayfayı göster
        if (href === '#share') {
          document.getElementById('view-share').classList.add('active');
          resetShareWizard();
        } else if (href === '#home') {
          document.getElementById('view-home').classList.add('active');
        } else {
          // Diğer menüler yapım aşamasında, default home göster
          document.getElementById('view-home').classList.add('active');
        }
      }
    });
  });
}

window.resetShareWizard = function() {
  document.getElementById('step-1-search').classList.add('active');
  document.getElementById('step-2-settings').classList.remove('active');
  document.getElementById('shareSearchInput').value = '';
};

window.selectTrackForShare = function(trackKey) {
  const track = TRACK_DATABASE[trackKey] || TRACK_DATABASE['rebel'];
  
  // Ayarlar (Step 2) kısmındaki track bilgilerini güncelle
  document.getElementById('selShareImg').src = track.cover;
  document.getElementById('selShareTitle').textContent = track.title;
  document.getElementById('selShareArtist').textContent = track.artist;
  
  // Adımları değiştir
  document.getElementById('step-1-search').classList.remove('active');
  document.getElementById('step-2-settings').classList.add('active');
};

window.shareCurrentlyPlaying = function() {
  // Şu anda dock'ta çalan şarkıyı seç
  selectTrackForShare(currentTrackKey || 'rebel');
};

window.submitShare = function() {
  alert("Paylaşım başarılı! (Bu bir placeholder, gerçek sistemde backend'e istek atılacak)");
  
  // Ana sayfaya geri dön
  document.querySelector('.nav-link[href="#home"]').click();
};

document.addEventListener('DOMContentLoaded', () => {
  initSPA();
});

  initExpandToggle();
  initFullscreenControls();
  initScrollMorphAnimations();
  initRatingSystemListeners();
  updateCoverflowPositions();

  const btnHide = document.getElementById('btnHideSpotlight');
  const panel = document.getElementById('spotlightPanel');
  
  btnHide?.addEventListener('click', () => {
    panel?.classList.add('hidden');
  });

  document.querySelectorAll('.btn-highlight-time').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const startSec = Number(e.currentTarget.getAttribute('data-start') || 0);
      console.log(`Jumped to highlight time: ${startSec}s`);
    });
  });

  setInterval(() => {
    fetchFriendsActivity();
    fetchMyNowPlaying();
  }, 5000);
});