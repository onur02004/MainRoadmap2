// public/themes/modules/obsession-cinema.js
import { loadServices, handleServiceClick } from '../../services-client.js';

export function init() {
  let ytPlayer = null;
  let isPlaying = false;

  // Görünmez YouTube IFrame Container'ı
  const hiddenYtContainer = document.createElement('div');
  hiddenYtContainer.id = 'obsYoutubePlayer';
  hiddenYtContainer.style.position = 'fixed';
  hiddenYtContainer.style.top = '-9999px';
  hiddenYtContainer.style.left = '-9999px';
  hiddenYtContainer.style.width = '1px';
  hiddenYtContainer.style.height = '1px';
  hiddenYtContainer.style.opacity = '0';
  hiddenYtContainer.style.pointerEvents = 'none';
  document.body.appendChild(hiddenYtContainer);

  // YouTube IFrame API'sini Sayfaya Yükle
  function loadYouTubeIframeApi() {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }

  function initPlayer() {
    if (window.YT && window.YT.Player) {
      ytPlayer = new window.YT.Player('obsYoutubePlayer', {
        height: '1',
        width: '1',
        videoId: 'KzRF5ELw8oU',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          start: 55 // 55. saniyeden başlat
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(80);
          },
          onStateChange: (event) => {
            const btnPlay = document.getElementById('btnToggleMusic');
            if (event.data === window.YT.PlayerState.PLAYING) {
              isPlaying = true;
              if (btnPlay) {
                btnPlay.innerHTML = '<span>⏸</span><span>PAUSE OST</span>';
                btnPlay.classList.add('active');
              }
            } else {
              isPlaying = false;
              if (btnPlay) {
                btnPlay.innerHTML = '<span>▶</span><span>PLAY OST (55s)</span>';
                btnPlay.classList.remove('active');
              }
            }
          }
        }
      });
    } else {
      setTimeout(initPlayer, 200);
    }
  }

  loadYouTubeIframeApi();
  initPlayer();

  // Tarayıcı Otomatik Oynatma Politikası için İlk Kullanıcı Tıklamasında Başlatma Denemesi
  const tryAutoPlayOnFirstClick = () => {
    if (ytPlayer && typeof ytPlayer.playVideo === 'function' && !isPlaying) {
      ytPlayer.seekTo(55, true);
      ytPlayer.playVideo();
    }
    document.removeEventListener('click', tryAutoPlayOnFirstClick);
  };
  document.addEventListener('click', tryAutoPlayOnFirstClick, { once: true });

  let obsessionIndex = 84;
  let currentUser = {
    isLoggedIn: false,
    username: 'PROTAGONIST',
    role: 'OBSESSED SUBJECT',
    nodeId: '#MONOCHROME-RED',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80'
  };

  const showcaseContainer = document.createElement('div');
  showcaseContainer.id = 'obsessionShowcase';
  showcaseContainer.className = 'obs-2025-container';

  showcaseContainer.innerHTML = `
    <!-- 1. ALBÜM KAPAĞI STİLİNDE BAŞLIK -->
    <div class="obs-album-hero">
      <div class="obs-title-block">
        <h1 class="obs-chromatic-title">OBSESSION</h1>
        <span class="obs-soundtrack-sub">LOVE IS IN THE AIR // 2025</span>
      </div>

      <div style="font-family:'Share Tech Mono', monospace; font-size:0.8rem; color:var(--obs-red);">
        START POINT: <strong>00:55</strong>
      </div>
    </div>

    <!-- 2. MÜZİK ÇALAR VE NABIZ KONTROL PANELİ -->
    <div class="obs-dashboard-grid">
      
      <!-- YouTube Müzik Kontrolleri (Play/Pause + Ses Slider) -->
      <div class="obs-thriller-card">
        <div class="obs-player-controls">
          <button type="button" class="obs-red-btn" id="btnToggleMusic">
            <span>▶</span>
            <span>PLAY OST (55s)</span>
          </button>
          
          <button type="button" class="obs-red-btn" id="btnRestart55" title="Restart at 55s">
            <span>⏮ 55s</span>
          </button>
        </div>

        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:0.75rem; color:var(--obs-text-dim);">VOL:</span>
          <input type="range" class="obs-volume-slider" id="obsVolumeSlider" min="0" max="100" value="80" />
        </div>
      </div>

      <!-- Nabız & Gerilim Göstergesi -->
      <div class="obs-thriller-card">
        <div class="obs-pulse-indicator">
          <div class="obs-pulse-dot"></div>
          <div>
            <div style="font-size:0.72rem; color:var(--obs-text-dim);">OBSESSION INDEX</div>
            <div style="font-size:1.3rem; font-weight:900; color:var(--obs-red);" id="obsIndexVal">${obsessionIndex}% CRITICAL</div>
          </div>
        </div>

        <button type="button" class="obs-red-btn" id="btnTriggerPulse">STIMULUS</button>
      </div>

    </div>

    <!-- 3. SAĞ ALT GENİŞ THRILLER HESAP BARI -->
    <div class="obs-wide-account-bar">
      <div class="obs-acc-left">
        <div class="obs-avatar-box" id="btnObsAvatar" title="Open Dossier">
          <img id="obsUserAvatar" src="${currentUser.avatar}" alt="Subject" />
        </div>
        <div>
          <div class="obs-acc-name" id="obsUsername">PROTAGONIST</div>
          <div class="obs-acc-sub">
            <span>STATUS: <strong id="obsRole">PSYCHOLOGICAL LOCK</strong></span>
            <span>NODE: <strong id="obsNode">#MONOCHROME-RED</strong></span>
          </div>
        </div>
      </div>
      <div id="obsAccountActions"></div>
    </div>
  `;

  const servicesSection = document.getElementById('servicesSection');
  if (servicesSection && servicesSection.parentNode) {
    servicesSection.parentNode.insertBefore(showcaseContainer, servicesSection);
  }

  // Play / Pause Butonu
  const btnToggleMusic = showcaseContainer.querySelector('#btnToggleMusic');
  btnToggleMusic?.addEventListener('click', () => {
    if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
      if (isPlaying) {
        ytPlayer.pauseVideo();
      } else {
        // Eğer şarkı hiç başlamamışsa 55. saniyeye git
        if (ytPlayer.getCurrentTime() < 55) {
          ytPlayer.seekTo(55, true);
        }
        ytPlayer.playVideo();
      }
    }
  });

  // 55. Saniyeye Yeniden Sarma Butonu
  showcaseContainer.querySelector('#btnRestart55')?.addEventListener('click', () => {
    if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
      ytPlayer.seekTo(55, true);
      ytPlayer.playVideo();
    }
  });

  // Ses Seviyesi Slider'ı
  const volSlider = showcaseContainer.querySelector('#obsVolumeSlider');
  volSlider?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
      ytPlayer.setVolume(val);
    }
  });

  // Nabız Artırma Butonu
  showcaseContainer.querySelector('#btnTriggerPulse')?.addEventListener('click', () => {
    obsessionIndex = Math.min(100, obsessionIndex + 4);
    const val = document.getElementById('obsIndexVal');
    if (val) val.textContent = `${obsessionIndex}% CRITICAL`;
  });

  // Oturum Bilgilerini Senkronize Et
  async function syncUserSession() {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const res = await fetch('/api/users/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (res.ok && result.status === 'success') {
          const u = result.data.user;
          currentUser.isLoggedIn = true;
          currentUser.username = u.user_name.toUpperCase();
          currentUser.role = (u.relation || 'OBSESSED SUBJECT').toUpperCase();
          currentUser.nodeId = `#${u.id ? String(u.id).slice(0, 4) : '2025'}-RED`;
          currentUser.avatar = u.profile_pic_path || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.user_name}`;
        }
      } catch (err) {}
    }

    const avatar = showcaseContainer.querySelector('#obsUserAvatar');
    const name = showcaseContainer.querySelector('#obsUsername');
    const role = showcaseContainer.querySelector('#obsRole');
    const node = showcaseContainer.querySelector('#obsNode');
    const actions = showcaseContainer.querySelector('#obsAccountActions');

    if (avatar) avatar.src = currentUser.avatar;
    if (name) name.textContent = currentUser.username;
    if (role) role.textContent = currentUser.role;
    if (node) node.textContent = currentUser.nodeId;

    if (currentUser.isLoggedIn) {
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="obs-red-btn" id="btnObsAccount">DOSSIER</button>
          <button type="button" class="obs-red-btn" id="btnObsLogout" style="background:transparent; border-color:#555;">TERMINATE</button>
        `;
        showcaseContainer.querySelector('#btnObsAccount')?.addEventListener('click', () => window.location.href = '/account');
        showcaseContainer.querySelector('#btnObsLogout')?.addEventListener('click', () => {
          localStorage.removeItem('token');
          window.location.reload();
        });
      }
    } else {
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="obs-red-btn" id="btnObsLogin">ENTER</button>
          <button type="button" class="obs-red-btn" id="btnObsRegister">ENLIST</button>
        `;
        showcaseContainer.querySelector('#btnObsLogin')?.addEventListener('click', () => window.location.href = '/login');
        showcaseContainer.querySelector('#btnObsRegister')?.addEventListener('click', () => window.location.href = '/login#register');
      }
    }

    showcaseContainer.querySelector('#btnObsAvatar')?.addEventListener('click', () => {
      window.location.href = currentUser.isLoggedIn ? '/account' : '/login';
    });
  }

  syncUserSession();

  return {
    destroy: () => {
      document.removeEventListener('click', tryAutoPlayOnFirstClick);
      if (ytPlayer && typeof ytPlayer.destroy === 'function') {
        ytPlayer.destroy();
      }
      hiddenYtContainer.remove();
      showcaseContainer.remove();
    }
  };
}