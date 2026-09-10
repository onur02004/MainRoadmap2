// public/themes/modules/rick-astley-stream.js
import { loadServices, handleServiceClick } from '../../services-client.js';

export function init() {
  let ytPlayer = null;
  let isPlaying = false;

  // Görünmez YouTube IFrame Elemanı
  const hiddenYt = document.createElement('div');
  hiddenYt.id = 'rickYoutubePlayer';
  hiddenYt.style.position = 'fixed';
  hiddenYt.style.top = '-9999px';
  hiddenYt.style.left = '-9999px';
  hiddenYt.style.width = '1px';
  hiddenYt.style.height = '1px';
  hiddenYt.style.opacity = '0';
  hiddenYt.style.pointerEvents = 'none';
  document.body.appendChild(hiddenYt);

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
      ytPlayer = new window.YT.Player('rickYoutubePlayer', {
        height: '1',
        width: '1',
        videoId: 'dQw4w9WgXcQ',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          start: 0
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(80);
          },
          onStateChange: (event) => {
            const btn = document.getElementById('btnToggleRick');
            if (event.data === window.YT.PlayerState.PLAYING) {
              isPlaying = true;
              if (btn) {
                btn.innerHTML = '<span>⏸</span><span>PAUSE</span>';
                btn.classList.add('active');
              }
            } else {
              isPlaying = false;
              if (btn) {
                btn.innerHTML = '<span>▶</span><span>PLAY</span>';
                btn.classList.remove('active');
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

  // İlk tıklamada otomatik başlatma (Autoplay Policy Çözümü)
  const tryAutoPlayOnFirstClick = () => {
    if (ytPlayer && typeof ytPlayer.playVideo === 'function' && !isPlaying) {
      ytPlayer.playVideo();
    }
    document.removeEventListener('click', tryAutoPlayOnFirstClick);
  };
  document.addEventListener('click', tryAutoPlayOnFirstClick, { once: true });

  const LYRICS = [
    'Never gonna give you up, never gonna let you down...',
    'Never gonna run around and desert you...',
    'Never gonna make you cry, never gonna say goodbye...',
    'Never gonna tell a lie and hurt you!'
  ];
  let lyricIdx = 0;

  let currentUser = {
    isLoggedIn: false,
    username: 'RICK_ASTLEY',
    role: '80S POP LEGEND',
    nodeId: '#NEVER-GONNA-GIVE-YOU-UP',
    avatar: 'https://upload.wikimedia.org/wikipedia/it/f/f0/Screenshot_Videoclip_Never_Gonna_Give_You_Up.png'
  };

  const showcaseContainer = document.createElement('div');
  showcaseContainer.id = 'rickShowcase';
  showcaseContainer.className = 'rick-showcase-container';

  showcaseContainer.innerHTML = `
    <!-- 1. DISCO HERO HEADER -->
    <div class="rick-hero-header">
      <div class="rick-title-block">
        <h1 class="rick-main-title">NEVER GONNA GIVE YOU UP</h1>
        <span class="rick-sub-lyrics" id="rickLyricsText">"${LYRICS[0]}"</span>
      </div>

      <div style="font-family:'Share Tech Mono', monospace; font-size:0.8rem; color:var(--rick-pink);">
        TRACK: <strong>OFFICIAL 4K REMASTER</strong>
      </div>
    </div>

    <!-- 2. PLAYER KONTROLLERİ VE SES SLIDER -->
    <div class="rick-controls-grid">
      <div class="rick-control-card">
        <div class="rick-player-buttons">
          <button type="button" class="rick-neon-btn" id="btnToggleRick">
            <span>▶</span>
            <span>PLAY</span>
          </button>
          
          <button type="button" class="rick-neon-btn" id="btnRestartRick" title="Restart track">
            <span>⏮ REWIND</span>
          </button>
        </div>

        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:0.75rem; color:var(--rick-cyan);">VOL:</span>
          <input type="range" class="rick-volume-slider" id="rickVolSlider" min="0" max="100" value="80" />
        </div>
      </div>

      <div class="rick-control-card" style="justify-content:center; text-align:center;">
        <span style="font-size:0.85rem; color:var(--rick-text);">🕺 YOU'VE BEEN RICKROLLED // 1987 SYNTH POP 🕺</span>
      </div>
    </div>

    <!-- 3. SAĞ ALT GENİŞ HESAP BARI -->
    <div class="rick-wide-account-bar">
      <div class="rick-acc-left">
        <div class="rick-avatar-wrap" id="btnRickAvatar" title="Open Rick Profile">
          <img id="rickUserAvatar" src="${currentUser.avatar}" alt="Rick Astley" />
        </div>
        <div>
          <div class="rick-acc-name" id="rickUsername">RICK ASTLEY</div>
          <div class="rick-acc-sub">
            <span>RANK: <strong id="rickRole">80S LEGEND</strong></span>
            <span>STATUS: <strong id="rickNode">#NEVER-GONNA-LET-YOU-DOWN</strong></span>
          </div>
        </div>
      </div>
      <div id="rickAccountActions"></div>
    </div>
  `;

  const servicesSection = document.getElementById('servicesSection');
  if (servicesSection && servicesSection.parentNode) {
    servicesSection.parentNode.insertBefore(showcaseContainer, servicesSection);
  }

  // Play / Pause
  showcaseContainer.querySelector('#btnToggleRick')?.addEventListener('click', () => {
    if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
      if (isPlaying) {
        ytPlayer.pauseVideo();
      } else {
        ytPlayer.playVideo();
      }
    }
  });

  // Başa Sar
  showcaseContainer.querySelector('#btnRestartRick')?.addEventListener('click', () => {
    if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
      ytPlayer.seekTo(0, true);
      ytPlayer.playVideo();
    }
  });

  // Ses Seviyesi Slider'ı
  showcaseContainer.querySelector('#rickVolSlider')?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
      ytPlayer.setVolume(val);
    }
  });

  // Şarkı Sözleri Döngüsü
  const lyricInterval = setInterval(() => {
    lyricIdx = (lyricIdx + 1) % LYRICS.length;
    const txt = document.getElementById('rickLyricsText');
    if (txt) txt.textContent = `"${LYRICS[lyricIdx]}"`;
  }, 6000);

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
          currentUser.role = (u.relation || '80S POP ICON').toUpperCase();
          currentUser.nodeId = `#${u.id ? String(u.id).slice(0, 4) : '1987'}-RICKROLL`;
          currentUser.avatar = u.profile_pic_path || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.user_name}`;
        }
      } catch (err) {}
    }

    const avatar = showcaseContainer.querySelector('#rickUserAvatar');
    const name = showcaseContainer.querySelector('#rickUsername');
    const role = showcaseContainer.querySelector('#rickRole');
    const node = showcaseContainer.querySelector('#rickNode');
    const actions = showcaseContainer.querySelector('#rickAccountActions');

    if (avatar) avatar.src = currentUser.avatar;
    if (name) name.textContent = currentUser.username;
    if (role) role.textContent = currentUser.role;
    if (node) node.textContent = currentUser.nodeId;

    if (currentUser.isLoggedIn) {
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="rick-neon-btn" id="btnRickAccount">ACCOUNT</button>
          <button type="button" class="rick-neon-btn" id="btnRickLogout" style="border-color:#ff0055;">GIVE UP</button>
        `;
        showcaseContainer.querySelector('#btnRickAccount')?.addEventListener('click', () => window.location.href = '/account');
        showcaseContainer.querySelector('#btnRickLogout')?.addEventListener('click', () => {
          localStorage.removeItem('token');
          window.location.reload();
        });
      }
    } else {
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="rick-neon-btn" id="btnRickLogin">SIGN IN</button>
          <button type="button" class="rick-neon-btn" id="btnRickRegister">JOIN</button>
        `;
        showcaseContainer.querySelector('#btnRickLogin')?.addEventListener('click', () => window.location.href = '/login');
        showcaseContainer.querySelector('#btnRickRegister')?.addEventListener('click', () => window.location.href = '/login#register');
      }
    }

    showcaseContainer.querySelector('#btnRickAvatar')?.addEventListener('click', () => {
      window.location.href = currentUser.isLoggedIn ? '/account' : '/login';
    });
  }

  syncUserSession();

  return {
    destroy: () => {
      document.removeEventListener('click', tryAutoPlayOnFirstClick);
      clearInterval(lyricInterval);
      if (ytPlayer && typeof ytPlayer.destroy === 'function') {
        ytPlayer.destroy();
      }
      hiddenYt.remove();
      showcaseContainer.remove();
    }
  };
}