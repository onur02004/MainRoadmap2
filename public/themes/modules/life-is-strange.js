import { loadServices, handleServiceClick } from '../../services-client.js';

export function init() {
  let activeTab = 'services';
  let isRewinding = false;
  let audioCtx = null;
  let rewindInterval = null;

  let currentUser = {
    isLoggedIn: false,
    username: 'Max Caulfield',
    role: 'STUDENT',
    nodeId: '#BLACKWELL',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80'
  };

  const lisStage = document.createElement('div');
  lisStage.id = 'lifeIsStrangeLayer';
  lisStage.className = 'lis-stage-layer';
  lisStage.innerHTML = `
    <!-- Işık Parıltısı -->
    <div class="lis-ambient-light"></div>

    <!-- ZAMANI GERİ SARMA (TIME REWIND) EFEKTİ -->
    <div class="lis-rewind-vfx-layer" id="lisRewindOverlay">
      <div class="lis-rewind-spiral-clock"></div>
      <div class="lis-rewind-status-box">
        <strong>REWINDING TIME...</strong>
        <span>HOLD [R] TO ALTER PAST CHOICES</span>
      </div>
    </div>

    <!-- KELEBEK ETKİSİ (THIS ACTION WILL HAVE CONSEQUENCES) -->
    <div class="lis-butterfly-hud" id="lisButterflyBanner">
      <div class="lis-butterfly-svg">🦋</div>
      <div class="lis-butterfly-meta">
        <strong>THIS ACTION WILL HAVE CONSEQUENCES...</strong>
        <small>The timeline of Arcadia Bay has been modified</small>
      </div>
    </div>

    <!-- ANA MAX CAULFIELD GÜNLÜK ÇALIŞMA ALANI -->
    <main class="lis-journal-workspace">
      
      <!-- Sol Defter Sayfası -->
      <aside class="lis-left-page">
        <div class="lis-tape-strip"></div>
        
        <div>
          <div class="lis-journal-header">
            <h2>Max's Journal</h2>
            <span>ARCADIA BAY // OCT 2013</span>
          </div>

          <nav class="lis-nav-tree">
            <button type="button" class="lis-nav-tab active" data-target="services">
              <span>📁 CLUSTER SERVICES</span>
            </button>
            <button type="button" class="lis-nav-tab" data-target="telemetry">
              <span>📊 SYSTEM TELEMETRY</span>
            </button>
            <button type="button" class="lis-nav-tab" data-target="diary">
              <span>📖 DIARY &amp; SKETCHES</span>
            </button>
          </nav>
        </div>

        <!-- Sol Alt: Walkman Kaset Çalar -->
        <div class="lis-walkman-box">
          <div class="lis-cassette-gears">
            <div class="lis-gear spin" id="lisGearL"></div>
            <div class="lis-gear spin" id="lisGearR"></div>
          </div>
          <div class="lis-track-info">
            <strong>SYD MATTERS</strong>
            <small id="lisTrackStatus">To All of You • 02:44</small>
          </div>
          <button type="button" class="lis-play-btn" id="btnLisToggleMusic">⏸</button>
        </div>
      </aside>

      <!-- Sağ Defter Sayfası: Dinamik İçerik ve Geniş Hesap Paneli -->
      <section class="lis-right-page">
        
        <div class="lis-content-canvas">
          
          <!-- SEKME 1: DİNAMİK SERVİSLER (POLAROID GÖRÜNÜMÜ) -->
          <div class="lis-view-sec" id="viewLisServices">
            <div class="lis-canvas-title-row">
              <h3>Snapshots &amp; Services</h3>
              <span id="lisServiceCount">LOADING...</span>
            </div>
            <div class="lis-polaroid-grid" id="lisDynamicServicesGrid"></div>
          </div>

          <!-- SEKME 2: TELEMETRY -->
          <div class="lis-view-sec" id="viewLisTelemetry" style="display: none;">
            <div class="lis-canvas-title-row">
              <h3>Telemetry &amp; Node Diagnostic</h3>
              <span>LATENCY: 14ms</span>
            </div>
            <div style="font-family: 'Patrick Hand', cursive; font-size: 1.15rem; color: #3b281e; line-height: 1.8;">
              <p>• <strong>REST Throughput:</strong> 148 req/s (Pool: 99.9% health)</p>
              <p>• <strong>Database Pool:</strong> 4 / 20 connections open</p>
              <p>• <strong>Memory Utilization:</strong> 312 MB allocated</p>
              <p>• <strong>Realtime Stream:</strong> #global-stream connected</p>
            </div>
          </div>

          <!-- SEKME 3: MAX'İN NOTLARI -->
          <div class="lis-view-sec" id="viewLisDiary" style="display: none;">
            <div class="lis-canvas-title-row">
              <h3>Personal Notes</h3>
              <span>BLACKWELL ACADEMY</span>
            </div>
            <div style="font-family: 'Caveat', cursive; font-size: 1.45rem; color: #2b1d16; line-height: 1.5;">
              <p>"I can't believe I can actually rewind time... It feels like a dream, or a nightmare. I have to protect Chloe and figure out what's happening to this town before the storm hits."</p>
            </div>
          </div>

        </div>

        <!-- SAĞ ALTTA FULL GENİŞLİKTE POLAROID HESAP BARI -->
        <div class="lis-wide-account-panel">
          <div class="lis-acc-left">
            <div class="lis-polaroid-avatar-frame" id="lisAvatarBtn" title="Account Settings">
              <img id="lisUserAvatar" src="${currentUser.avatar}" alt="Avatar" />
            </div>
            <div class="lis-acc-meta">
              <h4 id="lisUsernameText">Max Caulfield</h4>
              <div class="lis-acc-sub">
                <span>ROLE: <strong id="lisUserRole">SENIOR (STUDENT)</strong></span>
                <span>NODE: <strong id="lisUserNode">#BLACKWELL</strong></span>
              </div>
            </div>
          </div>

          <div class="lis-acc-actions" id="lisAccountActions">
            <!-- Dinamik Login / Account Butonları -->
          </div>
        </div>

      </section>

    </main>
  `;

  document.body.appendChild(lisStage);

  // --- AUDIO SFX ---
  const initAudio = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  };

  const playRewindSfx = () => {
    try {
      initAudio();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.35);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  };

  const playCameraClick = () => {
    try {
      initAudio();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.1);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch (e) {}
  };

  // --- KELEBEK ETKİSİ ---
  const butterflyBanner = lisStage.querySelector('#lisButterflyBanner');
  let butterflyTimeout = null;

  function triggerButterflyEffect() {
    clearTimeout(butterflyTimeout);
    butterflyBanner.classList.add('visible');
    playCameraClick();
    butterflyTimeout = setTimeout(() => {
      butterflyBanner.classList.remove('visible');
    }, 3800);
  }

  // --- ZAMANI GERİ SARMA (REWIND) MOTORU ---
  const rewindOverlay = lisStage.querySelector('#lisRewindOverlay');

  const startRewind = () => {
    if (isRewinding) return;
    isRewinding = true;
    document.body.classList.add('lis-rewinding-shake');
    rewindOverlay.classList.add('active');
    playRewindSfx();
    rewindInterval = setInterval(playRewindSfx, 350);
  };

  const stopRewind = () => {
    if (!isRewinding) return;
    isRewinding = false;
    clearInterval(rewindInterval);
    document.body.classList.remove('lis-rewinding-shake');
    rewindOverlay.classList.remove('active');
    triggerButterflyEffect();
  };

  // --- SEKME GEÇİŞLERİ ---
  const navBtns = lisStage.querySelectorAll('.lis-nav-tab');
  const views = {
    services: lisStage.querySelector('#viewLisServices'),
    telemetry: lisStage.querySelector('#viewLisTelemetry'),
    diary: lisStage.querySelector('#viewLisDiary')
  };

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.target;
      Object.values(views).forEach(v => { if (v) v.style.display = 'none'; });
      if (views[activeTab]) views[activeTab].style.display = 'block';
      playCameraClick();
    });
  });

  // --- DİNAMİK SERVİSLERİ YÜKLE (POLAROID KARTLARI) ---
  async function fetchAndRenderServices() {
    const grid = lisStage.querySelector('#lisDynamicServicesGrid');
    const badge = lisStage.querySelector('#lisServiceCount');
    if (!grid) return;

    try {
      const data = await loadServices(true);
      const core = data?.core || [];
      const privileged = data?.privileged || [];
      const allServices = [...core, ...(currentUser.isLoggedIn ? privileged : [])];

      if (badge) badge.textContent = `${allServices.length} SNAPSHOTS READY`;
      grid.innerHTML = '';

      if (allServices.length === 0) {
        grid.innerHTML = `<p style="font-family: 'Caveat'; font-size: 1.4rem;">No photos or services found in this chapter.</p>`;
        return;
      }

      allServices.forEach(service => {
        const isMaintenance = service.status === 'maintenance';
        const card = document.createElement('div');
        card.className = 'lis-service-polaroid';
        card.innerHTML = `
          <div class="lis-tape-corner"></div>
          <div class="lis-polaroid-photo">${service.icon || '📷'}</div>
          <div class="lis-polaroid-caption">
            <h4>${service.title}</h4>
            <p>${service.desc || 'No journal entry available.'}</p>
          </div>
          <span class="lis-polaroid-tag">${service.tag || 'SNAPSHOT'} &rarr;</span>
        `;

        card.addEventListener('click', () => {
          triggerButterflyEffect();
          handleServiceClick(service);
        });

        grid.appendChild(card);
      });

    } catch (err) {
      grid.innerHTML = `<p>Failed to load services.</p>`;
    }
  }

  // --- KULLANICI OTURUMU SENKRONİZASYONU ---
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
          currentUser = {
            isLoggedIn: true,
            username: u.user_name,
            role: (u.relation || 'USER').toUpperCase(),
            nodeId: `#${u.id ? String(u.id).slice(0, 4) : '8921'}-X`,
            avatar: u.profile_pic_path || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.user_name}`
          };
        }
      } catch (err) {}
    }

    const avatar = lisStage.querySelector('#lisUserAvatar');
    const name = lisStage.querySelector('#lisUsernameText');
    const role = lisStage.querySelector('#lisUserRole');
    const node = lisStage.querySelector('#lisUserNode');
    const actions = lisStage.querySelector('#lisAccountActions');

    if (avatar) avatar.src = currentUser.avatar;
    if (name) name.textContent = currentUser.username;
    if (role) role.textContent = currentUser.role;
    if (node) node.textContent = currentUser.nodeId;

    if (currentUser.isLoggedIn) {
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="lis-action-btn rewind-trigger" id="btnLisRewind">🌀 REWIND [R]</button>
          <button type="button" class="lis-action-btn" id="btnLisAccount">SETTINGS</button>
          <button type="button" class="lis-action-btn danger" id="btnLisLogout">LOGOUT</button>
        `;
        lisStage.querySelector('#btnLisAccount')?.addEventListener('click', () => window.location.href = '/account');
        lisStage.querySelector('#btnLisLogout')?.addEventListener('click', () => {
          localStorage.removeItem('token');
          window.location.reload();
        });
        const btnRw = lisStage.querySelector('#btnLisRewind');
        btnRw?.addEventListener('mousedown', startRewind);
      }
    } else {
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="lis-action-btn rewind-trigger" id="btnLisRewind">🌀 REWIND [R]</button>
          <button type="button" class="lis-action-btn" id="btnLisLogin">SIGN IN</button>
          <button type="button" class="lis-action-btn" id="btnLisRegister">REGISTER</button>
        `;
        lisStage.querySelector('#btnLisLogin')?.addEventListener('click', () => window.location.href = '/login');
        lisStage.querySelector('#btnLisRegister')?.addEventListener('click', () => window.location.href = '/login#register');
        const btnRw = lisStage.querySelector('#btnLisRewind');
        btnRw?.addEventListener('mousedown', startRewind);
      }
    }

    lisStage.querySelector('#lisAvatarBtn')?.addEventListener('click', () => {
      window.location.href = currentUser.isLoggedIn ? '/account' : '/login';
    });
  }

  // --- WALKMAN MÜZİK KONTROLÜ ---
  const btnToggleMusic = lisStage.querySelector('#btnLisToggleMusic');
  const gearL = lisStage.querySelector('#lisGearL');
  const gearR = lisStage.querySelector('#lisGearR');
  const trackStatus = lisStage.querySelector('#lisTrackStatus');
  let isPlaying = true;

  btnToggleMusic.addEventListener('click', () => {
    isPlaying = !isPlaying;
    gearL.classList.toggle('spin', isPlaying);
    gearR.classList.toggle('spin', isPlaying);
    btnToggleMusic.textContent = isPlaying ? '⏸' : '▶';
    trackStatus.textContent = isPlaying ? 'To All of You • 02:44' : 'Paused';
    playCameraClick();
  });

  // --- KLAVYE KISAYOLLARI ([R] Rewind) ---
  const onKeyDown = (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'KeyR' && !e.repeat) startRewind();
  };

  const onKeyUp = (e) => {
    if (e.code === 'KeyR') stopRewind();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mouseup', stopRewind);

  (async () => {
    await syncUserSession();
    await fetchAndRenderServices();
  })();

  return {
    destroy: () => {
      clearInterval(rewindInterval);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mouseup', stopRewind);
      lisStage.remove();
    }
  };
}