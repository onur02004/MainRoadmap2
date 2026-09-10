import { loadServices, handleServiceClick } from '../../services-client.js';

export function init() {
  let activeTab = 'instances';

  let currentUser = {
    isLoggedIn: false,
    username: 'GUEST',
    role: 'OFFLINE',
    nodeId: '#NO-AUTH',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=guest'
  };

  const cpStage = document.createElement('div');
  cpStage.id = 'cyberpunkHudLayer';
  cpStage.className = 'cp-hud-layer';
  cpStage.innerHTML = `
    <div class="cp-crt-scanlines"></div>

    <!-- 1. ÜST KIROSHI BAR -->
    <header class="cp-top-bar">
      <div class="cp-brand-group">
        <span class="cp-arasaka-logo">▲ CYBERDECK</span>
        <span class="cp-hud-title">PORT: 5432 // SECURE_LINK</span>
      </div>
      <div class="cp-status-pill">
        <span class="cp-pulse-dot"></span>
        <span id="cpTopStatusText">CLUSTER NODE READY</span>
      </div>
      <div class="cp-header-actions">
        <div class="cp-chip eddy">REGION: <strong>EU-CENTRAL</strong></div>
      </div>
    </header>

    <!-- 2. ANA CYBERPUNK IZGARASI -->
    <main class="cp-main-grid" id="cpMainGrid">
      
      <!-- Sol Sütun: Navigasyon ve Boydan Boya Ferah CLI -->
      <aside class="cp-left-column">
        <nav class="cp-side-nav">
          <div class="cp-nav-label">// DIRECTORY PROTOCOLS</div>

          <button type="button" class="cp-nav-item active" data-target="instances">
            <span class="nav-idx">01</span>
            <div class="nav-meta">
              <strong>SERVICES &amp; APPS</strong>
              <small>Dynamic database endpoints</small>
            </div>
          </button>

          <button type="button" class="cp-nav-item" data-target="telemetry">
            <span class="nav-idx">02</span>
            <div class="nav-meta">
              <strong>TELEMETRY</strong>
              <small>Real-time node diagnostic</small>
            </div>
          </button>

          <button type="button" class="cp-nav-item" data-target="tools">
            <span class="nav-idx">03</span>
            <div class="nav-meta">
              <strong>THEME STUDIO</strong>
              <small>Palette &amp; UI styling</small>
            </div>
          </button>
        </nav>

        <div class="cp-mini-terminal">
          <div class="cp-term-header">
            <span>TERMINAL CONSOLE</span>
            <span class="term-status-live">ONLINE</span>
          </div>
          <div class="cp-term-logs" id="cpTermLogs">
            <div class="term-row dim">[BOOT] Cyberdeck command bus connected.</div>
            <div class="term-row ready">&gt;&gt; Ready. Type command or click below.</div>
          </div>

          <form class="cp-term-input-row" id="cpTermForm" onsubmit="return false;">
            <span class="cp-prompt" id="cpPromptPrefix">user@cluster:~$</span>
            <input type="text" id="cpCliInput" placeholder="login, clear, help, services..." spellcheck="false" autocomplete="off" />
          </form>

          <div class="cp-term-quick-bar">
            <span class="cp-quick-chip" data-cmd="help">help</span>
            <span class="cp-quick-chip" data-cmd="services">services</span>
            <span class="cp-quick-chip" data-cmd="telemetry">telemetry</span>
            <span class="cp-quick-chip" data-cmd="account">account</span>
            <span class="cp-quick-chip" data-cmd="clear">clear</span>
          </div>
        </div>
      </aside>

      <!-- Sağ Sütun: Üstte İçerik, Altta Boydan Boya Geniş Hesap Kartı -->
      <section class="cp-right-column">
        
        <div class="cp-viewport-pane">
          <!-- SEKME 1: DİNAMİK SERVİSLER -->
          <div class="cp-view-group active" id="viewInstances">
            <div class="cp-pane-header">
              <h3>ACTIVE CLUSTER SERVICES</h3>
              <span id="cpServiceCount">FETCHING...</span>
            </div>
            <div class="cp-services-matrix" id="cpDynamicServices"></div>
          </div>

          <!-- SEKME 2: TELEMETRY -->
          <div class="cp-view-group" id="viewTelemetry" style="display: none;">
            <div class="cp-pane-header">
              <h3>TELEMETRY &amp; HARDWARE LOAD</h3>
              <span>LATENCY: 12ms</span>
            </div>
            <div class="cp-diag-grid">
              <div class="cp-diag-box">
                <label>REST THROUGHPUT</label>
                <div class="diag-val" id="cpMetricRest">148 <small>req/s</small></div>
                <div class="diag-status">STATUS: OPTIMAL</div>
              </div>
              <div class="cp-diag-box">
                <label>DATABASE POOL</label>
                <div class="diag-val" id="cpMetricPool">4 / 20 <small>conn</small></div>
                <div class="cp-bar-track"><div class="cp-bar-fill" style="width: 20%;"></div></div>
              </div>
              <div class="cp-diag-box">
                <label>MEMORY LOAD</label>
                <div class="diag-val" id="cpMetricRam">312 <small>MB</small></div>
                <div class="cp-bar-track"><div class="cp-bar-fill" style="width: 32%;"></div></div>
              </div>
              <div class="cp-diag-box highlight">
                <label>REALTIME WEBSOCKET</label>
                <div class="diag-val cyan">#global-stream</div>
                <div class="diag-status">SOCKET: CONNECTED</div>
              </div>
            </div>
          </div>

          <!-- SEKME 3: STÜDYO VE PALET -->
          <div class="cp-view-group" id="viewTools" style="display: none;">
            <div class="cp-pane-header">
              <h3>THEME ENGINE &amp; STUDIO</h3>
              <span>COMMUNITY PALETTE</span>
            </div>
            <div class="cp-tools-list">
              <div class="cp-tool-item" id="btnCpOpenPalette">
                <div class="tool-icon">🎨</div>
                <div class="tool-meta">
                  <strong>COMMAND PALETTE (⌘K)</strong>
                  <p>Browse themes: Matrix, Windows XP, FNAF, Cyberpunk and more.</p>
                </div>
                <button type="button" class="cp-action-btn">OPEN PALETTE</button>
              </div>
              <div class="cp-tool-item" id="btnCpOpenStudio">
                <div class="tool-icon">🛠️</div>
                <div class="tool-meta">
                  <strong>THEME STUDIO</strong>
                  <p>Customize colors, fonts, wallpaper, and CRT scanlines.</p>
                </div>
                <button type="button" class="cp-action-btn">LAUNCH STUDIO</button>
              </div>
            </div>
          </div>
        </div>

        <!-- SAĞ ALTTA HER ZAMAN DURAN GENİŞ HESAP BARI -->
        <div class="cp-wide-account-bar">
          <div class="cp-account-left">
            <div class="cp-account-avatar-frame" id="cpWideAvatarBtn" title="Open Account Console">
              <img id="cpWideAvatarImg" class="cp-account-avatar" src="${currentUser.avatar}" alt="Avatar" />
              <span id="cpWideDot" class="cp-account-dot offline"></span>
            </div>

            <div class="cp-account-details">
              <div class="cp-account-title-row">
                <span class="cp-account-name" id="cpWideName">GUEST USER</span>
                <span class="cp-account-role" id="cpWideRole">UNAUTHENTICATED</span>
              </div>
              <div class="cp-account-sub-info">
                <span>NODE: <strong id="cpWideNode">#NO-SESSION</strong></span>
                <span>STATUS: <strong id="cpWideStatus">OFFLINE</strong></span>
              </div>
            </div>
          </div>

          <div class="cp-account-right-actions" id="cpWideActions">
            <!-- Dinamik Butonlar -->
          </div>
        </div>

      </section>
    </main>
  `;

  document.body.appendChild(cpStage);

  // --- SEKME GEÇİŞLERİ ---
  const navBtns = cpStage.querySelectorAll('.cp-nav-item');
  const views = {
    instances: cpStage.querySelector('#viewInstances'),
    telemetry: cpStage.querySelector('#viewTelemetry'),
    tools: cpStage.querySelector('#viewTools')
  };

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.target;
      Object.values(views).forEach(v => { if (v) v.style.display = 'none'; });
      if (views[activeTab]) views[activeTab].style.display = 'block';
    });
  });

  // --- DİNAMİK SERVİSLERİ ÇEK (DATABASE'DEN) ---
  async function fetchAndRenderServices() {
    const container = cpStage.querySelector('#cpDynamicServices');
    const countBadge = cpStage.querySelector('#cpServiceCount');
    if (!container) return;

    try {
      const data = await loadServices(true);
      const core = data?.core || [];
      const privileged = data?.privileged || [];
      const allServices = [...core, ...(currentUser.isLoggedIn ? privileged : [])];

      if (countBadge) countBadge.textContent = `${allServices.length} SERVICES ONLINE`;
      container.innerHTML = '';

      if (allServices.length === 0) {
        container.innerHTML = `
          <div class="cp-card disabled" style="grid-column: 1 / -1;">
            <div class="cp-card-badge">EMPTY</div>
            <div class="cp-card-info">
              <h4>No Services Found</h4>
              <p>No endpoints available for this role level.</p>
            </div>
          </div>
        `;
        return;
      }

      allServices.forEach(service => {
        const isMaintenance = service.status === 'maintenance';
        const isLoginReq = service.status === 'login_required';

        const card = document.createElement('div');
        card.className = `cp-card ${isMaintenance ? 'disabled' : ''}`;
        card.innerHTML = `
          <div class="cp-card-badge">${service.tag || 'SYSTEM'}</div>
          <div class="cp-card-icon">${service.icon || '⚡'}</div>
          <div class="cp-card-info">
            <h4>${service.title}</h4>
            <p>${service.desc || 'System service endpoint.'}</p>
          </div>
          <span class="cp-action-tag ${isMaintenance ? 'locked' : ''}">
            ${isMaintenance ? 'MAINTENANCE' : (isLoginReq && !currentUser.isLoggedIn ? 'LOGIN REQUIRED &gt;&gt;' : 'LAUNCH &gt;&gt;')}
          </span>
        `;

        card.addEventListener('click', () => handleServiceClick(service));
        container.appendChild(card);
      });
    } catch (err) {
      container.innerHTML = `<div class="cp-card disabled"><p>Failed to query services.</p></div>`;
    }
  }

  // --- KULLANICI BİLGİSİNİ SAĞ ALT BARA YAZ ---
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

    const avatar = cpStage.querySelector('#cpWideAvatarImg');
    const dot = cpStage.querySelector('#cpWideDot');
    const name = cpStage.querySelector('#cpWideName');
    const role = cpStage.querySelector('#cpWideRole');
    const node = cpStage.querySelector('#cpWideNode');
    const status = cpStage.querySelector('#cpWideStatus');
    const actions = cpStage.querySelector('#cpWideActions');
    const promptPrefix = cpStage.querySelector('#cpPromptPrefix');

    if (avatar) avatar.src = currentUser.avatar;
    if (name) name.textContent = currentUser.username;
    if (role) role.textContent = currentUser.role;
    if (node) node.textContent = currentUser.nodeId;

    if (currentUser.isLoggedIn) {
      if (dot) dot.className = 'cp-account-dot online';
      if (status) status.textContent = 'SECURE_ACTIVE';
      if (promptPrefix) promptPrefix.textContent = `${currentUser.username}@cluster:~$`;
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="cp-btn-large" id="btnWideAccount">⚙️ ACCOUNT SETTINGS</button>
          <button type="button" class="cp-btn-large danger" id="btnWideLogout">LOGOUT</button>
        `;
        cpStage.querySelector('#btnWideAccount')?.addEventListener('click', () => window.location.href = '/account');
        cpStage.querySelector('#btnWideLogout')?.addEventListener('click', () => {
          localStorage.removeItem('token');
          window.location.reload();
        });
      }
    } else {
      if (dot) dot.className = 'cp-account-dot offline';
      if (status) status.textContent = 'UNAUTHENTICATED';
      if (promptPrefix) promptPrefix.textContent = `guest@cluster:~$`;
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="cp-btn-large" id="btnWideLogin">🔑 SIGN IN</button>
          <button type="button" class="cp-btn-large" id="btnWideRegister">REGISTER</button>
        `;
        cpStage.querySelector('#btnWideLogin')?.addEventListener('click', () => window.location.href = '/login');
        cpStage.querySelector('#btnWideRegister')?.addEventListener('click', () => window.location.href = '/login#register');
      }
    }

    cpStage.querySelector('#cpWideAvatarBtn')?.addEventListener('click', () => {
      window.location.href = currentUser.isLoggedIn ? '/account' : '/login';
    });
  }

  // --- TERMINAL ENGINE ---
  const termLogs = cpStage.querySelector('#cpTermLogs');
  const termForm = cpStage.querySelector('#cpTermForm');
  const termInput = cpStage.querySelector('#cpCliInput');

  function appendLog(text, isReady = false) {
    if (!termLogs) return;
    const row = document.createElement('div');
    row.className = `term-row ${isReady ? 'ready' : ''}`;
    row.innerHTML = text;
    termLogs.appendChild(row);
    termLogs.scrollTop = termLogs.scrollHeight;
  }

  async function executeCliCommand(rawCmd) {
    const raw = rawCmd.trim();
    if (!raw) return;

    appendLog(`<span class="term-cmd">&gt; ${raw}</span>`);
    const parts = raw.split(' ').filter(Boolean);
    const cmd = parts[0].toLowerCase();

    if (cmd === 'help') {
      appendLog('Commands: services, telemetry, login &lt;user&gt; &lt;pass&gt;, account, logout, clear, whoami');
    } else if (cmd === 'whoami') {
      appendLog(`USER: ${currentUser.username} | ROLE: ${currentUser.role} | NODE: ${currentUser.nodeId}`, true);
    } else if (cmd === 'clear') {
      termLogs.innerHTML = '';
    } else if (cmd === 'services') {
      navBtns[0]?.click();
    } else if (cmd === 'telemetry') {
      navBtns[1]?.click();
    } else if (cmd === 'account') {
      window.location.href = currentUser.isLoggedIn ? '/account' : '/login';
    } else if (cmd === 'logout') {
      localStorage.removeItem('token');
      appendLog('[AUTH] Logged out.');
      setTimeout(() => window.location.reload(), 300);
    } else if (cmd === 'login') {
      if (parts.length >= 3) {
        const u = parts[1];
        const p = parts.slice(2).join(' ');
        appendLog(`[AUTH] Authenticating as '${u}'...`);
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
            appendLog(`[AUTH_ERR] ${data.message || 'Login failed.'}`);
          }
        } catch (e) {
          appendLog('[AUTH_ERR] Network error.');
        }
      } else {
        window.location.href = '/login';
      }
    } else {
      appendLog(`Unknown command: '${cmd}'. Type 'help'`);
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

  cpStage.querySelectorAll('.cp-quick-chip').forEach(chip => {
    chip.addEventListener('click', () => executeCliCommand(chip.dataset.cmd));
  });

  cpStage.querySelector('#btnCpOpenPalette')?.addEventListener('click', () => {
    document.getElementById('themeModalOpenBtn')?.click();
  });
  cpStage.querySelector('#btnCpOpenStudio')?.addEventListener('click', () => {
    document.getElementById('btnOpenThemeStudio')?.click();
  });

  (async () => {
    await syncUserSession();
    await fetchAndRenderServices();
  })();

  return {
    destroy: () => cpStage.remove()
  };
}