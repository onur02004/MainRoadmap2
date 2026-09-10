import { loadServices, handleServiceClick } from '../../services-client.js';

export function init() {
  let activeTab = 'services';
  let isFlareFired = false;
  let audioCtx = null;
  let quoteIndex = 0;

  // Eren Yeager'ın İkonik Sözleri
  const erenQuotes = [
    { jp: "戦わなければ勝てない。戦え、戦え！", en: "If you don't fight, you can't win. Fight. Fight!", key: "TATAKAE" },
    { jp: "オレがこの世に生まれたからだ！", en: "Because I was born into this world!", key: "FREEDOM" },
    { jp: "駆逐してやる…この世から、一匹残らず！", en: "I'll destroy them... Every last one of those animals that's on this earth!", key: "WRATH" },
    { jp: "海を見て、自由になれると思った…", en: "If we kill all our enemies over there... will we finally be free?", key: "THE SEA" },
    { jp: "進み続けるんだ。敵を駆逐するまで。", en: "I just keep moving forward. Until all my enemies are destroyed.", key: "FOUNDER" }
  ];

  let currentSoldier = {
    isLoggedIn: false,
    username: 'Eren Yeager',
    role: 'ATTACK TITAN // SCOUT',
    nodeId: '#SHIGANSHINA',
    avatar: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=160&auto=format&fit=crop&q=80'
  };

  const aotStage = document.createElement('div');
  aotStage.id = 'aotRegimentLayer';
  aotStage.className = 'aot-stage-layer';
  aotStage.innerHTML = `
    <!-- Sinyal Fişeği ve Titan Yıldırımı Katmanı -->
    <div class="aot-flare-layer" id="aotFlareOverlay"></div>

    <!-- 1. ÜST ASKERİ KARARGAH BARI -->
    <header class="aot-top-bar">
      <div class="aot-brand-group">
        <span class="aot-crest-icon">⚔️</span>
        <span class="aot-header-title">SURVEY CORPS // SCOUT REGIMENT HQ</span>
      </div>

      <div class="aot-wall-status">
        <span class="aot-wall-dot"></span>
        <span id="aotWallDefence">WALL ROSE: DEFENSE ACTIVE</span>
      </div>

      <div class="aot-top-chips">
        <div class="aot-chip">ODMG GAS: <strong>98.5%</strong></div>
        <div class="aot-chip">TITAN SHIFTER: <strong>READY [T]</strong></div>
      </div>
    </header>

    <!-- 2. ANA ASKERİ DÜZEN -->
    <main class="aot-main-grid">
      
      <!-- Sol Sütun: Protokoller & ODMG Telgraf Terminali -->
      <aside class="aot-left-column">
        <nav class="aot-side-nav">
          <div class="aot-nav-label">// REGIMENT PROTOCOLS</div>

          <button type="button" class="aot-nav-btn active" data-target="services">
            <span class="aot-nav-idx">01</span>
            <span>CLUSTER SERVICES</span>
          </button>

          <button type="button" class="aot-nav-btn" data-target="telemetry">
            <span class="aot-nav-idx">02</span>
            <span>WALL TELEMETRY</span>
          </button>

          <button type="button" class="aot-nav-btn" data-target="regiment">
            <span class="aot-nav-idx">03</span>
            <span>EREN'S MANIFESTO</span>
          </button>
        </nav>

        <!-- Askeri Telgraf / CLI -->
        <div class="aot-military-terminal">
          <div class="aot-term-header">
            <span>MILITARY TELEGRAPH</span>
            <span class="aot-gas-status">ONLINE</span>
          </div>

          <div class="aot-term-logs" id="aotTermLogs">
            <div class="aot-log-row dim">[LOG] Scout telegraph dispatch linked.</div>
            <div class="aot-log-row ready">&gt;&gt; Type 'tatakae', 'quote', 'services' or click.</div>
          </div>

          <form class="aot-term-input-row" id="aotTermForm" onsubmit="return false;">
            <span class="aot-prompt" id="aotPromptPrefix">eren@scout:~$</span>
            <input type="text" id="aotCliInput" placeholder="tatakae, quote, help, login..." spellcheck="false" autocomplete="off" />
          </form>

          <div class="aot-quick-chips">
            <span class="aot-quick-btn" data-cmd="tatakae">🔥 tatakae</span>
            <span class="aot-quick-btn" data-cmd="quote">💬 quote</span>
            <span class="aot-quick-btn" data-cmd="services">services</span>
            <span class="aot-quick-btn" data-cmd="telemetry">telemetry</span>
            <span class="aot-quick-btn" data-cmd="account">records</span>
            <span class="aot-quick-btn" data-cmd="clear">clear</span>
          </div>
        </div>
      </aside>

      <!-- Sağ Sütun: Dinamik Görünüm + Geniş Askeri Sicil Barı -->
      <section class="aot-right-column">
        
        <div class="aot-viewport-pane">

          <!-- EREN YEAGER CANLI ALINTI BANDI -->
          <div class="aot-quote-banner" id="aotQuoteBanner">
            <div class="aot-quote-text" id="aotQuoteText">
              <span>"TATAKAE"</span> — If you win, you live. If you lose, you die. If you don't fight, you can't win!
            </div>
            <div class="aot-quote-author" id="aotQuoteAuthor">// EREN YEAGER</div>
          </div>

          <!-- SEKME 1: DİNAMİK SERVİSLER -->
          <div class="aot-view-group active" id="viewAotServices">
            <div class="aot-pane-header">
              <h3>ACTIVE MILITARY &amp; CLUSTER SERVICES</h3>
              <span id="aotServiceCount">FETCHING ENDPOINTS...</span>
            </div>
            <div class="aot-services-grid" id="aotDynamicServicesGrid"></div>
          </div>

          <!-- SEKME 2: TELEMETRY -->
          <div class="aot-view-group" id="viewAotTelemetry" style="display: none;">
            <div class="aot-pane-header">
              <h3>SURVEY CORPS LOGISTICS &amp; TELEMETRY</h3>
              <span>LATENCY: 12ms</span>
            </div>
            <div style="font-family: 'MedievalSharp', cursive; font-size: 1.15rem; line-height: 1.8; color: #c4cebe;">
              <p>• <strong>Telegraph Throughput:</strong> 148 signals/sec (Postgres Pool: 99.9% health)</p>
              <p>• <strong>Scout Database Connection Pool:</strong> 4 / 20 active channels</p>
              <p>• <strong>Supply Wagon Allocation:</strong> 312 MB memory locked</p>
              <p>• <strong>Global Scout Stream:</strong> #global-stream synchronized</p>
            </div>
          </div>

          <!-- SEKME 3: EREN'İN BİLDİRİSİ -->
          <div class="aot-view-group" id="viewAotRegiment" style="display: none;">
            <div class="aot-pane-header">
              <h3>THE FIGHT FOR FREEDOM</h3>
              <span>FREEDOM // SHINZOU WO SASAGEYO</span>
            </div>
            <div style="font-family: 'MedievalSharp', cursive; font-size: 1.25rem; line-height: 1.7; color: #ede4d1;">
              <p>"I have rid myself of hesitation. I will move forward. No matter what stands in my way, I will keep moving until all enemies are gone."</p>
              <p style="color: #ff3b30; font-family: 'Cinzel'; font-size: 1.1rem; margin-top: 10px;">
                "TATAKAE. TATAKAE. (戦え、戦え)"
              </p>
            </div>
          </div>
        </div>

        <!-- SAĞ ALTTA HER ZAMAN GÖRÜNÜR GENİŞ ASKERİ HESAP BARI -->
        <div class="aot-wide-soldier-bar">
          <div class="aot-soldier-left">
            <div class="aot-soldier-avatar-wrap" id="aotAvatarBtn" title="Regiment Account Records">
              <img id="aotSoldierAvatar" class="aot-soldier-avatar" src="${currentSoldier.avatar}" alt="Soldier Avatar" />
              <span id="aotSoldierDot" class="aot-soldier-status-dot online"></span>
            </div>

            <div class="aot-soldier-details">
              <div class="aot-soldier-name-row">
                <span class="aot-soldier-name" id="aotSoldierName">EREN YEAGER</span>
                <span class="aot-soldier-regiment" id="aotSoldierRole">ATTACK TITAN</span>
              </div>
              <div class="aot-soldier-meta-sub">
                <span>SECTOR: <strong id="aotSoldierNode">#SHIGANSHINA</strong></span>
                <span>STATE: <strong id="aotSoldierStatus">TATAKAE ACTIVE</strong></span>
              </div>
            </div>
          </div>

          <div class="aot-soldier-actions" id="aotSoldierActions">
            <!-- Dinamik Giriş / Çıkış / Sasageyo Butonları -->
          </div>
        </div>

      </section>

    </main>
  `;

  document.body.appendChild(aotStage);

  // --- AUDIO SFX ---
  const initAudio = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  };

  const playBladeSound = () => {
    try {
      initAudio();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {}
  };

  const playTitanRoar = () => {
    try {
      initAudio();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.25);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.6);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    } catch (e) {}
  };

  // --- TATAKAE / EREN YEAGER TRANSFORMATION (T TUŞU) ---
  const flareOverlay = aotStage.querySelector('#aotFlareOverlay');
  const quoteText = aotStage.querySelector('#aotQuoteText');

  const triggerTatakae = () => {
    if (isFlareFired) return;
    isFlareFired = true;

    // Kırmızı titan yıldırımı ve kamera sallantısı
    document.body.classList.add('aot-tatakae-active');
    flareOverlay.className = 'aot-flare-layer titan-lightning';
    playTitanRoar();

    // Eren'in sıradaki sözüne geç
    const q = erenQuotes[quoteIndex % erenQuotes.length];
    quoteIndex++;
    if (quoteText) {
      quoteText.innerHTML = `<span>"${q.key}"</span> — ${q.en} <em>(${q.jp})</em>`;
    }

    appendLog(`[EREN] "${q.en}" (${q.jp})`, true);

    setTimeout(() => {
      document.body.classList.remove('aot-tatakae-active');
      flareOverlay.className = 'aot-flare-layer';
      isFlareFired = false;
    }, 1400);
  };

  // Otomatik Söz Döndürücü
  setInterval(() => {
    if (!isFlareFired && quoteText) {
      const q = erenQuotes[quoteIndex % erenQuotes.length];
      quoteIndex++;
      quoteText.innerHTML = `<span>"${q.key}"</span> — ${q.en}`;
    }
  }, 9000);

  // --- SEKME GEÇİŞLERİ ---
  const navBtns = aotStage.querySelectorAll('.aot-nav-btn');
  const views = {
    services: aotStage.querySelector('#viewAotServices'),
    telemetry: aotStage.querySelector('#viewAotTelemetry'),
    regiment: aotStage.querySelector('#viewAotRegiment')
  };

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.target;
      Object.values(views).forEach(v => { if (v) v.style.display = 'none'; });
      if (views[activeTab]) views[activeTab].style.display = 'block';
      playBladeSound();
    });
  });

  // --- DİNAMİK SERVİSLERİ VERİTABANINDAN ÇEK ---
  async function fetchAndRenderServices() {
    const grid = aotStage.querySelector('#aotDynamicServicesGrid');
    const badge = aotStage.querySelector('#aotServiceCount');
    if (!grid) return;

    try {
      const data = await loadServices(true);
      const core = data?.core || [];
      const privileged = data?.privileged || [];
      const allServices = [...core, ...(currentSoldier.isLoggedIn ? privileged : [])];

      if (badge) badge.textContent = `${allServices.length} CORPS SERVICES ONLINE`;
      grid.innerHTML = '';

      if (allServices.length === 0) {
        grid.innerHTML = `<div class="aot-service-card" style="grid-column: 1 / -1;"><p>No scout missions or services currently assigned.</p></div>`;
        return;
      }

      allServices.forEach(service => {
        const isMaintenance = service.status === 'maintenance';
        const isLoginReq = service.status === 'login_required';

        const card = document.createElement('div');
        card.className = 'aot-service-card';
        card.innerHTML = `
          <div class="aot-card-tag">${service.tag || 'REGIMENT'}</div>
          <div class="aot-card-icon">${service.icon || '⚔️'}</div>
          <div class="aot-card-info">
            <h4>${service.title}</h4>
            <p>${service.desc || 'Assigned Survey Corps endpoint.'}</p>
          </div>
          <span class="aot-card-action">
            ${isMaintenance ? 'MAINTENANCE' : (isLoginReq && !currentSoldier.isLoggedIn ? 'AUTH REQUIRED &gt;&gt;' : 'EXECUTE &gt;&gt;')}
          </span>
        `;

        card.addEventListener('click', () => {
          playBladeSound();
          handleServiceClick(service);
        });

        grid.appendChild(card);
      });
    } catch (err) {
      grid.innerHTML = `<p>Failed to query regiment services.</p>`;
    }
  }

  // --- KULLANICI / ASKER OTURUMU SENKRONİZASYONU ---
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
          currentSoldier = {
            isLoggedIn: true,
            username: u.user_name,
            role: (u.relation || 'SCOUT').toUpperCase(),
            nodeId: `#${u.id ? String(u.id).slice(0, 4) : '8921'}-HQ`,
            avatar: u.profile_pic_path || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.user_name}`
          };
        }
      } catch (err) {}
    }

    const avatar = aotStage.querySelector('#aotSoldierAvatar');
    const dot = aotStage.querySelector('#aotSoldierDot');
    const name = aotStage.querySelector('#aotSoldierName');
    const role = aotStage.querySelector('#aotSoldierRole');
    const node = aotStage.querySelector('#aotSoldierNode');
    const status = aotStage.querySelector('#aotSoldierStatus');
    const actions = aotStage.querySelector('#aotSoldierActions');
    const promptPrefix = aotStage.querySelector('#aotPromptPrefix');

    if (avatar) avatar.src = currentSoldier.avatar;
    if (name) name.textContent = currentSoldier.username;
    if (role) role.textContent = currentSoldier.role;
    if (node) node.textContent = currentSoldier.nodeId;

    if (currentSoldier.isLoggedIn) {
      if (dot) dot.className = 'aot-soldier-status-dot online';
      if (status) status.textContent = 'ACTIVE DUTY';
      if (promptPrefix) promptPrefix.textContent = `${currentSoldier.username}@scout-hq:~$`;
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="aot-btn-action sasageyo" id="btnAotTatakae">🔥 TATAKAE [T]</button>
          <button type="button" class="aot-btn-action" id="btnAotAccount">RECORDS</button>
          <button type="button" class="aot-btn-action danger" id="btnAotLogout">LOGOUT</button>
        `;
        aotStage.querySelector('#btnAotTatakae')?.addEventListener('click', triggerTatakae);
        aotStage.querySelector('#btnAotAccount')?.addEventListener('click', () => window.location.href = '/account');
        aotStage.querySelector('#btnAotLogout')?.addEventListener('click', () => {
          localStorage.removeItem('token');
          window.location.reload();
        });
      }
    } else {
      if (dot) dot.className = 'aot-soldier-status-dot offline';
      if (status) status.textContent = 'UNAUTHENTICATED';
      if (promptPrefix) promptPrefix.textContent = `recruit@wall-rose:~$`;
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="aot-btn-action sasageyo" id="btnAotTatakae">🔥 TATAKAE [T]</button>
          <button type="button" class="aot-btn-action" id="btnAotLogin">SIGN IN</button>
          <button type="button" class="aot-btn-action" id="btnAotRegister">ENLIST</button>
        `;
        aotStage.querySelector('#btnAotTatakae')?.addEventListener('click', triggerTatakae);
        aotStage.querySelector('#btnAotLogin')?.addEventListener('click', () => window.location.href = '/login');
        aotStage.querySelector('#btnAotRegister')?.addEventListener('click', () => window.location.href = '/login#register');
      }
    }

    aotStage.querySelector('#aotAvatarBtn')?.addEventListener('click', () => {
      window.location.href = currentSoldier.isLoggedIn ? '/account' : '/login';
    });
  }

  // --- TERMINAL ENGINE ---
  const termLogs = aotStage.querySelector('#aotTermLogs');
  const termForm = aotStage.querySelector('#aotTermForm');
  const termInput = aotStage.querySelector('#aotCliInput');

  function appendLog(text, isReady = false) {
    if (!termLogs) return;
    const row = document.createElement('div');
    row.className = `aot-log-row ${isReady ? 'ready' : ''}`;
    row.innerHTML = text;
    termLogs.appendChild(row);
    termLogs.scrollTop = termLogs.scrollHeight;
  }

  async function executeCliCommand(rawCmd) {
    const raw = rawCmd.trim();
    if (!raw) return;

    appendLog(`<span class="aot-log-cmd">&gt; ${raw}</span>`);
    const parts = raw.split(' ').filter(Boolean);
    const cmd = parts[0].toLowerCase();

    if (cmd === 'help') {
      appendLog('Commands: tatakae, quote, services, telemetry, login &lt;u&gt; &lt;p&gt;, account, logout, clear');
    } else if (cmd === 'tatakae' || cmd === 'fight' || cmd === 'quote') {
      triggerTatakae();
    } else if (cmd === 'whoami') {
      appendLog(`SOLDIER: ${currentSoldier.username} | REGIMENT: ${currentSoldier.role} | SECTOR: ${currentSoldier.nodeId}`, true);
    } else if (cmd === 'clear') {
      termLogs.innerHTML = '';
    } else if (cmd === 'services') {
      navBtns[0]?.click();
    } else if (cmd === 'telemetry') {
      navBtns[1]?.click();
    } else if (cmd === 'account') {
      window.location.href = currentSoldier.isLoggedIn ? '/account' : '/login';
    } else if (cmd === 'logout') {
      localStorage.removeItem('token');
      appendLog('[AUTH] Logged out.');
      setTimeout(() => window.location.reload(), 300);
    } else if (cmd === 'login') {
      if (parts.length >= 3) {
        const u = parts[1];
        const p = parts.slice(2).join(' ');
        appendLog(`[AUTH] Verifying soldier credentials for '${u}'...`);
        try {
          const res = await fetch('/api/users/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_name: u, password: p })
          });
          const data = await res.json();
          if (res.ok && data.token) {
            localStorage.setItem('token', data.token);
            appendLog(`[AUTH_OK] Welcome, ${u}!`, true);
            await syncUserSession();
            await fetchAndRenderServices();
          } else {
            appendLog(`[AUTH_ERR] ${data.message || 'Invalid credentials.'}`);
          }
        } catch (e) {
          appendLog('[AUTH_ERR] Network failure.');
        }
      } else {
        window.location.href = '/login';
      }
    } else {
      appendLog(`Unknown command: '${cmd}'. Type 'help' or 'tatakae'`);
    }
  }

  if (termForm) {
    termForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = termInput.value;
      termInput.value = '';
      executeCliCommand(val);
    });
  }

  aotStage.querySelectorAll('.aot-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => executeCliCommand(btn.dataset.cmd));
  });

  // Klavye kısayolu ([T] tuşu: Tatakae / Eren Roar)
  const onKeyDown = (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'KeyT') triggerTatakae();
  };

  window.addEventListener('keydown', onKeyDown);

  (async () => {
    await syncUserSession();
    await fetchAndRenderServices();
  })();

  return {
    destroy: () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('aot-tatakae-active');
      aotStage.remove();
    }
  };
}