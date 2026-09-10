import { loadServices, handleServiceClick } from '../../services-client.js';

export function init() {
  const isLoginPage = !!document.getElementById('loginCard');
  const isAccountPage = !!document.getElementById('accountSettingsSection') || !!document.querySelector('.account-hero-viewport');

  let audioCtx = null;
  const initAudio = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  };

  const playPs5Nav = (freq = 460, dur = 0.04) => {
    try {
      initAudio();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + dur);
    } catch (e) {}
  };

  const ps5Stage = document.createElement('div');
  ps5Stage.id = 'ps5ExperienceLayer';
  ps5Stage.className = 'ps5-stage-layer';

  // --- 1. LOGIN SAYFASI (SADE & ZARİF PSN SIGN-IN) ---
  if (isLoginPage) {
    const origLogin = document.getElementById('loginCard');
    if (origLogin) origLogin.style.display = 'none';

    ps5Stage.innerHTML = `
      <div class="ps5-psn-login-view">
        <div class="psn-login-card">
          <div class="psn-header">
            <div class="psn-logo-circle">
              <svg viewBox="0 0 24 24" class="ps-vector-icon" fill="currentColor">
                <path d="M8.5 3a5.5 5.5 0 0 0-5.5 5.5v7A5.5 5.5 0 0 0 8.5 21h7a5.5 5.5 0 0 0 5.5-5.5v-7A5.5 5.5 0 0 0 15.5 3h-7zm0 2h7A3.5 3.5 0 0 1 19 8.5v7a3.5 3.5 0 0 1-3.5 3.5h-7A3.5 3.5 0 0 1 5 15.5v-7A3.5 3.5 0 0 1 8.5 5z"/>
              </svg>
            </div>
            <h2>PlayStation™Network</h2>
            <p>Sign in to connect to sys-cluster nodes</p>
          </div>

          <div id="psnAlert" class="psn-alert" style="display:none;"></div>

          <form id="psnCustomForm" class="psn-form" onsubmit="return false;">
            <div class="psn-field">
              <label>Sign-In ID (Email or Username)</label>
              <input type="text" id="psnIdent" placeholder="username" autocomplete="username" spellcheck="false" />
            </div>

            <div class="psn-field">
              <label>Password</label>
              <input type="password" id="psnPass" placeholder="••••••••••••" autocomplete="current-password" />
            </div>

            <button type="submit" id="btnPsnSubmit" class="psn-primary-btn">Sign In</button>
          </form>

          <div class="psn-card-footer">
            <a href="/">&larr; Back to Dashboard</a>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(ps5Stage);

    const form = ps5Stage.querySelector('#psnCustomForm');
    const ident = ps5Stage.querySelector('#psnIdent');
    const pass = ps5Stage.querySelector('#psnPass');
    const btn = ps5Stage.querySelector('#btnPsnSubmit');
    const alertBox = ps5Stage.querySelector('#psnAlert');

    const handleLogin = async () => {
      const u = ident.value.trim();
      const p = pass.value;
      if (!u || !p) {
        alertBox.textContent = 'Please enter your username and password.';
        alertBox.style.display = 'block';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Signing in...';

      try {
        const res = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: u, password: p })
        });
        const data = await res.json();

        if (res.ok && data.status === 'success') {
          localStorage.setItem('token', data.data.token);
          window.location.replace('/account');
        } else {
          alertBox.textContent = data.message || 'Invalid credentials.';
          alertBox.style.display = 'block';
        }
      } catch (err) {
        alertBox.textContent = 'Unable to connect to login gateway.';
        alertBox.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    };

    form.addEventListener('submit', handleLogin);
    btn.addEventListener('click', handleLogin);

    return { destroy: () => ps5Stage.remove() };
  }

  // --- 2. ACCOUNT SAYFASI (SADE, FERAH VE ANLAŞILIR PSN PROFILE) ---
  if (isAccountPage) {
    ps5Stage.innerHTML = `
      <div class="ps5-hero-backdrop"></div>
      <div class="ps5-dark-gradient-overlay"></div>

      <div class="ps5-clean-account-hub">
        <!-- Üst Bar -->
        <div class="ps5-acc-header">
          <a href="/" class="ps5-back-nav">&larr; Dashboard</a>
          <div class="ps5-acc-brand">PSN // Account Management</div>
          <button type="button" class="ps5-logout-nav" id="btnAccLogout">Sign Out</button>
        </div>

        <div class="ps5-acc-body-grid">
          <!-- Sol Kart: Kullanıcı Kimliği -->
          <aside class="ps5-user-id-pane">
            <div class="ps5-avatar-bubble" id="btnTriggerVault">
              <img id="ps5AccAvatar" src="https://api.dicebear.com/7.x/bottts/svg?seed=user" alt="Avatar" />
              <span class="avatar-hover-tip">Edit Avatar</span>
            </div>

            <h2 id="ps5AccUser" class="ps5-acc-name">User</h2>
            <div class="ps5-acc-pill" id="ps5AccRole">ROLE: USER</div>
            <p id="ps5AccEmail" class="ps5-acc-sub">user@cluster.local</p>

            <div class="ps5-quick-telemetry-box">
              <div class="q-stat">
                <span class="q-lbl">CLUSTER NODE</span>
                <strong class="q-val">#8921-X</strong>
              </div>
              <div class="q-stat">
                <span class="q-lbl">SYNC STATUS</span>
                <strong class="q-val ok">Active</strong>
              </div>
            </div>

            <button type="button" class="ps5-vault-launch-btn" id="btnLaunchVault">
              <span>🖼️ Open 2D Avatar Vault</span>
            </button>
          </aside>

          <!-- Sağ Taraf: Anlaşılır Ayar Formları -->
          <main class="ps5-acc-forms-pane" id="ps5FormsContainer">
            <!-- Orijinal form kartları buraya enjekte edilir -->
          </main>
        </div>
      </div>
    `;

    document.body.appendChild(ps5Stage);

    // Orijinal Form Kartlarını Yeni Temiz Kutunun İçine Taşı
    const settingsGrid = document.querySelector('.account-settings-grid');
    const formPane = ps5Stage.querySelector('#ps5FormsContainer');
    if (settingsGrid && formPane) {
      formPane.appendChild(settingsGrid);
    }

    // Bilgileri Senkronize Et
    const origUser = document.getElementById('userNameLabel');
    const origRole = document.getElementById('userRoleBadge');
    const origEmail = document.getElementById('userEmailLabel');
    const origAvatar = document.getElementById('userAvatar');

    const updateDetails = () => {
      if (origUser) ps5Stage.querySelector('#ps5AccUser').textContent = origUser.textContent;
      if (origRole) ps5Stage.querySelector('#ps5AccRole').textContent = origRole.textContent;
      if (origEmail) ps5Stage.querySelector('#ps5AccEmail').textContent = origEmail.textContent;
      if (origAvatar) ps5Stage.querySelector('#ps5AccAvatar').src = origAvatar.src;
    };
    updateDetails();
    setTimeout(updateDetails, 400);

    ps5Stage.querySelector('#btnTriggerVault').addEventListener('click', () => {
      document.getElementById('btnOpenAvatarVault')?.click();
    });
    ps5Stage.querySelector('#btnLaunchVault').addEventListener('click', () => {
      document.getElementById('btnOpenAvatarVault')?.click();
    });
    ps5Stage.querySelector('#btnAccLogout').addEventListener('click', () => {
      localStorage.removeItem('token');
      window.location.href = '/';
    });

    return { destroy: () => ps5Stage.remove() };
  }

  // --- 3. ANA SAYFA DASHBOARD (USER-FRIENDLY PS5 HUB) ---
  let activeCategory = 'games';
  let itemsList = [];
  let selectedIdx = 0;
  let particleAnimId = null;

  const SERVICE_STYLE_MAP = {
    'remote-control': {
      icon: '🎛️',
      color: '#0070d1',
      bg: 'radial-gradient(circle at 65% 35%, #00438c 0%, #030712 80%)',
      badge: 'HARDWARE LINK',
      trophy: '🏆 DualSense & LED Matrix Linked'
    },
    'song-share': {
      icon: '🎵',
      color: '#1db954',
      bg: 'radial-gradient(circle at 65% 35%, #0e4e24 0%, #030712 80%)',
      badge: 'AUDIO ENGINE',
      trophy: '🏆 Spatial Group Stream Active'
    },
    'file-storage': {
      icon: '📁',
      color: '#f59e0b',
      bg: 'radial-gradient(circle at 65% 35%, #593504 0%, #030712 80%)',
      badge: 'DATABASE VAULT',
      trophy: '🏆 Encrypted Storage Mounted'
    },
    'default': {
      icon: '⚡',
      color: '#8b5cf6',
      bg: 'radial-gradient(circle at 65% 35%, #351b68 0%, #030712 80%)',
      badge: 'CLUSTER NODE',
      trophy: '🏆 99.99% Node Health'
    }
  };

  ps5Stage.innerHTML = `
    <div class="ps5-hero-backdrop" id="ps5HeroBg"></div>
    <canvas class="ps5-particles-canvas" id="ps5ParticleCanvas"></canvas>
    <div class="ps5-dark-gradient-overlay"></div>

    <!-- Kenar Algılama Tetikleyicileri -->
    <div class="ps5-edge-zone left" id="edgeZoneLeft"></div>
    <div class="ps5-edge-zone right" id="edgeZoneRight"></div>

    <!-- KONSOL AÇILIŞ PARILTI FLÂŞI -->
    <div class="ps5-boot-sequence" id="ps5BootSequence">
      <div class="boot-logo-container">
        <svg class="boot-ps-logo" viewBox="0 0 100 100">
          <path fill="#ffffff" d="M48,15 L52,15 L52,85 L48,85 Z" />
          <path fill="#0070d1" d="M52,25 C75,25 80,45 65,58 C55,67 52,65 52,55 C52,48 60,42 65,36 C70,30 65,25 52,25 Z" />
          <path fill="#ffffff" d="M48,35 C25,35 20,55 35,68 C45,77 48,75 48,65 C48,58 40,52 35,46 C30,40 35,35 48,35 Z" />
        </svg>
      </div>
      <div class="boot-tagline">PLAY HAS NO LIMITS</div>
    </div>

    <!-- ANA PS5 DASHBOARD GÖRÜNÜMÜ -->
    <div class="ps5-dashboard-view" id="ps5DashboardView">
      
      <!-- Üst Bar: Kategoriler & Profil -->
      <header class="ps5-top-hub">
        <div class="ps5-nav-categories">
          <button type="button" class="category-tab active" id="tabGames">Core Services</button>
          <button type="button" class="category-tab" id="tabMedia">Extended Modules</button>
        </div>

        <div class="ps5-profile-dock">
          <button type="button" class="ps5-icon-btn" id="btnThemePalette" title="Themes (⌘K)">🎨</button>
          <button type="button" class="ps5-icon-btn" id="btnThemeStudio" title="Theme Studio">⚙️</button>
          <div class="ps5-user-pill" id="btnUserMenu" title="Profile &amp; Settings">
            <img class="ps5-avatar" id="ps5UserAvatar" src="https://api.dicebear.com/7.x/identicon/svg?seed=off" alt="Avatar" />
            <span class="ps5-username" id="lblPs5User">GUEST</span>
            <span class="online-status" id="ps5OnlineDot"></span>
          </div>
          <div class="ps5-clock" id="ps5Clock">19:05</div>
        </div>
      </header>

      <!-- Sade, Okunaklı ve Boşluksuz Yatay Kartlar Şeridi -->
      <nav class="ps5-games-ribbon-wrapper">
        <div class="ps5-games-ribbon" id="ps5GamesRibbon"></div>
      </nav>

      <!-- Seçili Kartın Büyük Bilgi Paneli -->
      <section class="ps5-game-hero-details">
        <div class="hero-badge" id="lblGameBadge">CLUSTER INSTANCE</div>
        <h1 class="hero-title" id="lblGameTitle">INITIALIZING...</h1>

        <div class="hero-meta-row">
          <span id="lblPublisher">SYS-CLUSTER // PRODUCTION-EU</span>
          <span class="hero-trophy" id="lblTrophy">🏆 SYSTEM VERIFIED</span>
        </div>
        <p class="hero-note" id="lblServiceNote">Managed database tables, node managers and compute workers.</p>

        <div class="hero-actions-row">
          <button type="button" class="ps5-play-btn" id="btnPlayGame">
            <span class="play-icon">▶</span>
            <span id="lblPlayAction">LAUNCH SERVICE</span>
          </button>
          <button type="button" class="ps5-more-btn" id="btnExploreTelemetry">SYSTEM TELEMETRY</button>
        </div>
      </section>

      <!-- Alt Tuş Rehberi -->
      <footer class="ps5-footer-nav">
        <div class="nav-hint-item"><span class="ps-btn-circle cross">✕</span> Start</div>
        <div class="nav-hint-item"><span class="ps-btn-circle square">□</span> Switch Tab [TAB]</div>
        <div class="nav-hint-item"><span class="ps-btn-circle triangle">△</span> Theme Palette (⌘K)</div>
        <div class="nav-hint-item"><span class="ps-btn-circle ps-home">PS</span> Telemetry [ESC]</div>
      </footer>
    </div>
  `;

  document.body.appendChild(ps5Stage);

  // Canlı Partikül Çizimi (Canvas)
  const canvas = ps5Stage.querySelector('#ps5ParticleCanvas');
  const ctx = canvas.getContext('2d');
  let particles = [];

  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 2 + 0.6;
      this.speedX = (Math.random() - 0.5) * 0.25;
      this.speedY = -Math.random() * 0.35 - 0.1;
      this.color = Math.random() > 0.4 ? '#0070d1' : '#38bdf8';
      this.alpha = Math.random() * 0.4 + 0.1;
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (this.y < 0 || this.x < 0 || this.x > canvas.width) {
        this.reset();
        this.y = canvas.height + 10;
      }
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  for (let i = 0; i < 40; i++) particles.push(new Particle());

  const renderParticles = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    particleAnimId = requestAnimationFrame(renderParticles);
  };
  renderParticles();

  // /api/services Verisi ile Senkronizasyon
  const ribbon = ps5Stage.querySelector('#ps5GamesRibbon');
  const heroBg = ps5Stage.querySelector('#ps5HeroBg');
  const lblTitle = ps5Stage.querySelector('#lblGameTitle');
  const lblBadge = ps5Stage.querySelector('#lblGameBadge');
  const lblPublisher = ps5Stage.querySelector('#lblPublisher');
  const lblTrophy = ps5Stage.querySelector('#lblTrophy');
  const lblServiceNote = ps5Stage.querySelector('#lblServiceNote');
  const lblPlayAction = ps5Stage.querySelector('#lblPlayAction');
  const btnPlay = ps5Stage.querySelector('#btnPlayGame');

  const tabGames = ps5Stage.querySelector('#tabGames');
  const tabMedia = ps5Stage.querySelector('#tabMedia');

  async function syncRealtimeServices() {
    const userEl = document.getElementById('lblUsername');
    const roleEl = document.getElementById('lblRole');
    const avatarEl = document.getElementById('userAvatar');

    const currentUser = userEl?.textContent || 'GUEST';
    const currentRole = roleEl?.textContent || 'GUEST';
    const currentAvatar = avatarEl?.src || 'https://api.dicebear.com/7.x/identicon/svg?seed=off';

    ps5Stage.querySelector('#lblPs5User').textContent = currentUser;
    ps5Stage.querySelector('#ps5UserAvatar').src = currentAvatar;

    const isOnline = currentUser !== 'anonymous' && currentUser !== 'GUEST';
    ps5Stage.querySelector('#ps5OnlineDot').className = `online-status ${isOnline ? 'online' : 'offline'}`;

    const servicesData = await loadServices(true);
    const core = servicesData?.core || [];
    const privileged = servicesData?.privileged || [];

    itemsList = activeCategory === 'games' ? core : privileged;
    renderRibbonCards();
  }

  function getStyleForService(service) {
    const routeKey = (service.route || '').replace('/', '').toLowerCase();
    const tagKey = (service.tag || '').toLowerCase();
    if (SERVICE_STYLE_MAP[routeKey]) return SERVICE_STYLE_MAP[routeKey];
    if (tagKey.includes('iot') || tagKey.includes('matrix')) return SERVICE_STYLE_MAP['remote-control'];
    if (tagKey.includes('audio') || tagKey.includes('stream')) return SERVICE_STYLE_MAP['song-share'];
    if (tagKey.includes('vault') || tagKey.includes('db')) return SERVICE_STYLE_MAP['file-storage'];
    return SERVICE_STYLE_MAP['default'];
  }

  function renderRibbonCards() {
    ribbon.innerHTML = '';

    // PlayStation Store Hub Kartı
    const storeCard = document.createElement('div');
    storeCard.className = 'ps5-card-tile store';
    storeCard.title = 'PlayStation Store / Themes';
    storeCard.innerHTML = `
      <div class="tile-icon-wrap">🛍️</div>
      <span class="tile-label">Theme Store</span>
    `;
    storeCard.onclick = () => document.getElementById('themeModalOpenBtn')?.click();
    ribbon.appendChild(storeCard);

    if (itemsList.length === 0) {
      const emptyCard = document.createElement('div');
      emptyCard.className = 'ps5-card-tile empty-tile';
      emptyCard.innerHTML = `
        <div class="tile-icon-wrap">🔒</div>
        <span class="tile-label">${activeCategory === 'games' ? 'No Services' : 'Login Required'}</span>
      `;
      emptyCard.onclick = () => { if (activeCategory !== 'games') window.location.href = '/login'; };
      ribbon.appendChild(emptyCard);

      lblTitle.textContent = 'NO MODULES AVAILABLE';
      lblBadge.textContent = 'RESTRICTED ACCESS';
      lblPublisher.textContent = 'SYS-CLUSTER // SCOPED MODULES';
      lblTrophy.textContent = '🏆 Authentication Required';
      lblServiceNote.textContent = 'Please sign in to unlock your privileged service modules.';
      lblPlayAction.textContent = 'SIGN IN';
      btnPlay.onclick = () => window.location.href = '/login';
      return;
    }

    itemsList.forEach((service, idx) => {
      const style = getStyleForService(service);
      const isLocked = service.status === 'maintenance';

      const tile = document.createElement('div');
      tile.className = `ps5-card-tile ${idx === selectedIdx ? 'active' : ''} ${isLocked ? 'locked' : ''}`;
      tile.dataset.idx = idx;

      tile.innerHTML = `
        <div class="ps5-tile-content" style="--tile-accent: ${style.color}">
          <div class="tile-icon-wrap">${style.icon}</div>
          <div class="tile-label">${service.title}</div>
          <div class="tile-tag-pill">${service.tag || 'NODE'}</div>
        </div>
        <div class="tile-focus-border"></div>
      `;

      tile.addEventListener('mouseenter', () => setFocusedService(idx));
      tile.addEventListener('click', () => {
        playPs5Nav(540, 0.06);
        handleServiceClick(service);
      });

      ribbon.appendChild(tile);
    });

    if (selectedIdx >= itemsList.length) selectedIdx = 0;
    setFocusedService(selectedIdx);
  }

  function setFocusedService(idx) {
    if (!itemsList[idx]) return;
    selectedIdx = idx;

    const allTiles = ribbon.querySelectorAll('.ps5-card-tile[data-idx]');
    allTiles.forEach(t => t.classList.remove('active'));
    allTiles[idx]?.classList.add('active');

    allTiles[idx]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

    const currentService = itemsList[idx];
    const style = getStyleForService(currentService);

    heroBg.style.opacity = '0.35';
    setTimeout(() => {
      heroBg.style.background = style.bg;
      heroBg.style.opacity = '1';
      lblTitle.textContent = currentService.title.toUpperCase();
      lblBadge.textContent = `${style.badge} // ${currentService.tag || 'SERVICE'}`;
      lblPublisher.textContent = `SYS-CLUSTER // ENDPOINT: ${currentService.route || '/api'}`;
      lblTrophy.textContent = currentService.status === 'maintenance' ? '🛠️ Under Maintenance' : style.trophy;
      lblServiceNote.textContent = currentService.desc;
      lblPlayAction.textContent = currentService.status === 'maintenance' ? 'LOCKED (MAINTENANCE)' : 'START SERVICE';
    }, 80);

    btnPlay.onclick = () => {
      playPs5Nav(600, 0.08);
      handleServiceClick(currentService);
    };

    playPs5Nav(440, 0.03);
  }

  tabGames.addEventListener('click', () => {
    if (activeCategory === 'games') return;
    activeCategory = 'games';
    tabGames.classList.add('active');
    tabMedia.classList.remove('active');
    syncRealtimeServices();
  });

  tabMedia.addEventListener('click', () => {
    if (activeCategory === 'media') return;
    activeCategory = 'media';
    tabMedia.classList.add('active');
    tabGames.classList.remove('active');
    syncRealtimeServices();
  });

  // Fare Tekerleği ile Kaydırma
  window.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > 20 || Math.abs(e.deltaX) > 20) {
      if (itemsList.length === 0) return;
      if (e.deltaY > 0 || e.deltaX > 0) {
        setFocusedService((selectedIdx + 1) % itemsList.length);
      } else {
        setFocusedService((selectedIdx - 1 + itemsList.length) % itemsList.length);
      }
    }
  }, { passive: true });

  // Kenar Algılama Bölgeleri
  const zoneLeft = ps5Stage.querySelector('#edgeZoneLeft');
  const zoneRight = ps5Stage.querySelector('#edgeZoneRight');
  let lastEdgeScrollTime = 0;

  const handleEdgeMove = (direction) => {
    const now = Date.now();
    if (now - lastEdgeScrollTime > 450 && itemsList.length > 0) {
      lastEdgeScrollTime = now;
      if (direction === 'right') {
        setFocusedService((selectedIdx + 1) % itemsList.length);
      } else {
        setFocusedService((selectedIdx - 1 + itemsList.length) % itemsList.length);
      }
    }
  };

  zoneLeft.addEventListener('mouseenter', () => handleEdgeMove('left'));
  zoneRight.addEventListener('mouseenter', () => handleEdgeMove('right'));

  // Boot Animasyonu
  const bootSeq = ps5Stage.querySelector('#ps5BootSequence');
  const dashboard = ps5Stage.querySelector('#ps5DashboardView');

  setTimeout(() => {
    bootSeq.classList.add('fading');
    dashboard.classList.add('visible');
    setTimeout(() => { bootSeq.style.display = 'none'; }, 900);
  }, 1000);

  // Canlı Saat
  const clockEl = ps5Stage.querySelector('#ps5Clock');
  const updateClock = () => {
    const d = new Date();
    clockEl.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  updateClock();
  const clockInterval = setInterval(updateClock, 1000);

  // Üst Bar Butonları
  ps5Stage.querySelector('#btnThemePalette').addEventListener('click', () => document.getElementById('themeModalOpenBtn')?.click());
  ps5Stage.querySelector('#btnThemeStudio').addEventListener('click', () => document.getElementById('btnOpenThemeStudio')?.click());
  ps5Stage.querySelector('#btnUserMenu').addEventListener('click', () => {
    const token = localStorage.getItem('token');
    if (token) window.location.href = '/account';
    else window.location.href = '/login';
  });
  ps5Stage.querySelector('#btnExploreTelemetry').addEventListener('click', () => {
    const section = document.getElementById('servicesSection');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
  });

  syncRealtimeServices();

  return {
    destroy: () => {
      cancelAnimationFrame(particleAnimId);
      clearInterval(clockInterval);
      window.removeEventListener('resize', resizeCanvas);
      ps5Stage.remove();
    }
  };
}