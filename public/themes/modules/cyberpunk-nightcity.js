export function init() {
  let activeTab = 'instances';
  let isOverclocked = false;

  const cpStage = document.createElement('div');
  cpStage.id = 'cyberpunkHudLayer';
  cpStage.className = 'cp-hud-layer';
  cpStage.innerHTML = `
    <!-- CRT Scanlines -->
    <div class="cp-crt-scanlines"></div>

    <!-- 1. ÜST KIROSHI BAR -->
    <header class="cp-top-bar">
      <div class="cp-brand-group">
        <span class="cp-arasaka-logo">▲ ARASAKA</span>
        <span class="cp-hud-title">KIROSHI NETLINK V4.2</span>
      </div>

      <div class="cp-status-pill">
        <span class="cp-pulse-dot"></span>
        <span id="cpSessionUser">NETRUNNER: ONUR (ADMIN)</span>
      </div>

      <div class="cp-header-actions">
        <div class="cp-chip eddy">€$ <strong>142,850</strong></div>
        <div class="cp-chip cred">SC: <strong>50</strong></div>
      </div>
    </header>

    <!-- 2. ANA CYBERPUNK SEÇİM DÜZENİ -->
    <main class="cp-main-grid" id="cpMainGrid">
      
      <!-- Sol Sütun: Protokol Menüsü + Entegre Kiroshi CLI -->
      <aside class="cp-left-column">
        <nav class="cp-side-nav">
          <div class="cp-nav-label">// DIRECTORY PROTOCOLS</div>

          <button type="button" class="cp-nav-item active" data-target="instances">
            <span class="nav-idx">01</span>
            <div class="nav-meta">
              <strong>CLUSTER INSTANCES</strong>
              <small>Active node endpoints</small>
            </div>
          </button>

          <button type="button" class="cp-nav-item" data-target="telemetry">
            <span class="nav-idx">02</span>
            <div class="nav-meta">
              <strong>SYSTEM TELEMETRY</strong>
              <small>REST &amp; RAM diagnostic</small>
            </div>
          </button>

          <button type="button" class="cp-nav-item" data-target="identity">
            <span class="nav-idx">03</span>
            <div class="nav-meta">
              <strong>NETRUNNER PROFILE</strong>
              <small>Session credentials</small>
            </div>
          </button>

          <button type="button" class="cp-nav-item" data-target="tools">
            <span class="nav-idx">04</span>
            <div class="nav-meta">
              <strong>NEURAL TOOLS</strong>
              <small>Theme Studio &amp; Palette</small>
            </div>
          </button>
        </nav>

        <!-- Sol Altta Düzgün Entegre Kiroshi Netrunner Terminali -->
        <div class="cp-mini-terminal">
          <div class="cp-term-header">
            <span>KIROSHI CONSOLE // SH-23</span>
            <span class="term-status-live">ONLINE</span>
          </div>
          <div class="cp-term-logs" id="cpTermLogs">
            <div class="term-row dim">20:24:21 [POSTGRES] POOL_CONNECTED (4/20)</div>
            <div class="term-row dim">20:24:24 [REALTIME] #global-stream LIVE</div>
            <div class="term-row ready">>> INSTANCE READY (EMERALD PHOSPHOR)</div>
          </div>
          <form class="cp-term-input-row" id="cpTermForm" onsubmit="return false;">
            <span class="cp-prompt">onur@cluster:~$</span>
            <input type="text" id="cpCliInput" placeholder="type 'help', 'login', 'clear'..." spellcheck="false" autocomplete="off" />
          </form>
        </div>
      </aside>

      <!-- Sağ Sütun: Dinamik İçerik Paneli -->
      <section class="cp-viewport-pane">

        <!-- SEKME 1: CLUSTER INSTANCES -->
        <div class="cp-view-group active" id="viewInstances">
          <div class="cp-pane-header">
            <h3>ACTIVE HARDWARE &amp; SERVICES</h3>
            <span>4 NODES ONLINE</span>
          </div>

          <div class="cp-services-matrix">
            <div class="cp-card" onclick="window.location.href='/remote-control'">
              <div class="cp-card-badge">PORT: 8080 // WS</div>
              <div class="cp-card-icon">🎛️</div>
              <div class="cp-card-info">
                <h4>DEVICE MANAGER</h4>
                <p>ESP32 LED Matrix display &amp; ambient room lighting controller.</p>
              </div>
              <span class="cp-action-tag">EXECUTE LINK &gt;&gt;</span>
            </div>

            <div class="cp-card" onclick="window.location.href='/song-share'">
              <div class="cp-card-badge">CHANNEL: #AUDIO</div>
              <div class="cp-card-icon">🎵</div>
              <div class="cp-card-info">
                <h4>SONG SHARE ENGINE</h4>
                <p>Realtime synchronized audio stream &amp; group listening queue.</p>
              </div>
              <span class="cp-action-tag">STREAM &gt;&gt;</span>
            </div>

            <div class="cp-card" onclick="window.location.href='/file-storage'">
              <div class="cp-card-badge">CIPHER: AES-256</div>
              <div class="cp-card-icon">📁</div>
              <div class="cp-card-info">
                <h4>FILE STORAGE (C:)</h4>
                <p>Database backup dumps, binary blobs &amp; static file vault.</p>
              </div>
              <span class="cp-action-tag">ACCESS VAULT &gt;&gt;</span>
            </div>

            <div class="cp-card disabled" onclick="alert('Automation Lab currently in Staging.')">
              <div class="cp-card-badge">STAGING // OFF</div>
              <div class="cp-card-icon">🧪</div>
              <div class="cp-card-info">
                <h4>AUTOMATION LAB</h4>
                <p>FFmpeg video rendering pipeline &amp; cron automations.</p>
              </div>
              <span class="cp-action-tag locked">LOCKED</span>
            </div>
          </div>
        </div>

        <!-- SEKME 2: TELEMETRY -->
        <div class="cp-view-group" id="viewTelemetry" style="display: none;">
          <div class="cp-pane-header">
            <h3>SYSTEM PERFORMANCE &amp; THROUGHPUT</h3>
            <span>LATENCY: 12ms</span>
          </div>

          <div class="cp-diag-grid">
            <div class="cp-diag-box">
              <label>REST THROUGHPUT</label>
              <div class="diag-val">148 <small>req/s</small></div>
              <div class="diag-status">STATUS: OPTIMAL (99.99%)</div>
            </div>

            <div class="cp-diag-box">
              <label>POSTGRES POOL</label>
              <div class="diag-val">4 / 20 <small>conn</small></div>
              <div class="cp-bar-track"><div class="cp-bar-fill" style="width: 20%;"></div></div>
            </div>

            <div class="cp-diag-box">
              <label>RAM USAGE</label>
              <div class="diag-val">312 <small>MB</small></div>
              <div class="cp-bar-track"><div class="cp-bar-fill" style="width: 32%;"></div></div>
            </div>

            <div class="cp-diag-box highlight">
              <label>WEBSOCKET SUBSCRIBERS</label>
              <div class="diag-val cyan">#global-stream</div>
              <div class="diag-status">SOCKET: CONNECTED</div>
            </div>
          </div>
        </div>

        <!-- SEKME 3: IDENTITY -->
        <div class="cp-view-group" id="viewIdentity" style="display: none;">
          <div class="cp-pane-header">
            <h3>NETRUNNER CREDENTIALS</h3>
            <span>SECURITY LEVEL: 0</span>
          </div>

          <div class="cp-profile-card">
            <div class="cp-avatar-box">
              <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&auto=format&fit=crop&q=80" alt="Avatar" />
              <span class="avatar-tag">CYBERWARE SYNCED</span>
            </div>

            <div class="cp-profile-details">
              <h4>ONUR DÖNMEZ</h4>
              <p>Role: <strong>ADMINISTRATOR (CLUSTER NODE #8921-X)</strong></p>
              <p>Active Session: <strong>Bearer JWT [Encrypted]</strong></p>

              <div class="cp-btn-row">
                <button type="button" class="cp-action-btn" id="btnCpSwitchGuest">SWITCH TO GUEST</button>
                <button type="button" class="cp-action-btn danger" id="btnCpLogout">TERMINATE SESSION</button>
              </div>
            </div>
          </div>
        </div>

        <!-- SEKME 4: NEURAL TOOLS -->
        <div class="cp-view-group" id="viewTools" style="display: none;">
          <div class="cp-pane-header">
            <h3>DEVELOPER &amp; CUSTOMIZATION TOOLS</h3>
            <span>VERSION 2.4.0</span>
          </div>

          <div class="cp-tools-list">
            <div class="cp-tool-item" id="btnCpOpenPalette">
              <div class="tool-icon">🎨</div>
              <div class="tool-meta">
                <strong>THEME PALETTE (⌘K)</strong>
                <p>Switch between Matrix, Windows XP, Danganronpa and Cyberpunk.</p>
              </div>
              <button type="button" class="cp-action-btn">LAUNCH</button>
            </div>

            <div class="cp-tool-item" id="btnCpOpenStudio">
              <div class="tool-icon">🛠️</div>
              <div class="tool-meta">
                <strong>THEME STUDIO PRO</strong>
                <p>Live CSS generator, variable editor and background importer.</p>
              </div>
              <button type="button" class="cp-action-btn">OPEN STUDIO</button>
            </div>
          </div>
        </div>

      </section>
    </main>

    <!-- 3. ALT OVERCLOCK FOOTER -->
    <footer class="cp-bottom-bar">
      <div class="cp-footer-hints">
        <span>[TAB] <strong>QUICK SWITCH</strong></span>
        <span>[E] <strong>OVERCLOCK SANDEVISTAN</strong></span>
      </div>

      <button type="button" class="cp-overclock-btn" id="btnOverclock">
        <span class="overclock-icon">⚡</span>
        <span id="lblOverclock">OVERCLOCK HUD [E]</span>
      </button>
    </footer>
  `;

  document.body.appendChild(cpStage);

  // --- AUDIO SYNTHESIZER ---
  let audioCtx = null;
  const initAudio = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  };

  const playUiSfx = (freq, duration, type = 'sawtooth') => {
    try {
      initAudio();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  };

  // --- SEKMELER ARASI GEÇİŞ ---
  const navBtns = cpStage.querySelectorAll('.cp-nav-item');
  const views = {
    instances: cpStage.querySelector('#viewInstances'),
    telemetry: cpStage.querySelector('#viewTelemetry'),
    identity: cpStage.querySelector('#viewIdentity'),
    tools: cpStage.querySelector('#viewTools')
  };

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.target;

      Object.values(views).forEach(v => v.style.display = 'none');
      if (views[activeTab]) views[activeTab].style.display = 'block';

      playUiSfx(620, 0.06, 'sawtooth');
    });
  });

  // --- ENTEGRE CLI KONSOL MOTORU ---
  const termLogs = cpStage.querySelector('#cpTermLogs');
  const termForm = cpStage.querySelector('#cpTermForm');
  const termInput = cpStage.querySelector('#cpCliInput');

  function appendTerminalRow(text, isHighlight = false) {
    const div = document.createElement('div');
    div.className = `term-row ${isHighlight ? 'ready' : ''}`;
    div.innerHTML = text;
    termLogs.appendChild(div);
    termLogs.scrollTop = termLogs.scrollHeight;
  }

  if (termForm) {
    termForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = termInput.value.trim();
      if (!raw) return;
      termInput.value = '';

      appendTerminalRow(`<span class="term-cmd">> ${raw}</span>`);
      const parts = raw.split(' ');
      const cmd = parts[0].toLowerCase();
      const arg = parts[1] ? parts[1].toLowerCase() : null;

      if (cmd === 'help') {
        appendTerminalRow('Commands: help, whoami, clear, login &lt;user&gt;, logout, instances, telemetry');
      } else if (cmd === 'whoami') {
        const user = document.getElementById('lblUsername')?.textContent || 'onur';
        appendTerminalRow(`NETRUNNER: ${user} | ROLE: ADMIN | ICE: SECURE`, true);
      } else if (cmd === 'clear') {
        termLogs.innerHTML = '';
      } else if (cmd === 'instances') {
        navBtns[0].click();
      } else if (cmd === 'telemetry') {
        navBtns[1].click();
      } else if (cmd === 'login') {
        if (arg === 'onur' || arg === 'admin') {
          document.getElementById('btnGuiLoginAdmin')?.click();
          appendTerminalRow('[AUTH] Switched session to onur (ADMIN)', true);
          document.getElementById('cpSessionUser').textContent = 'NETRUNNER: ONUR (ADMIN)';
        } else if (arg) {
          document.getElementById('btnGuiLoginGuest')?.click();
          appendTerminalRow(`[AUTH] Switched session to ${arg} (GUEST)`, true);
          document.getElementById('cpSessionUser').textContent = `NETRUNNER: ${arg.toUpperCase()}`;
        }
      } else if (cmd === 'logout') {
        document.getElementById('btnGuiLogout')?.click();
        appendTerminalRow('[AUTH] Session terminated.');
        document.getElementById('cpSessionUser').textContent = 'NETRUNNER: ANONYMOUS';
      } else {
        appendTerminalRow(`Unknown protocol: ${cmd}`);
      }
    });
  }

  // --- SİTE AKSİYONLARI ---
  cpStage.querySelector('#btnCpOpenPalette').addEventListener('click', () => {
    document.getElementById('themeModalOpenBtn')?.click();
  });

  cpStage.querySelector('#btnCpOpenStudio').addEventListener('click', () => {
    document.getElementById('btnOpenThemeStudio')?.click();
  });

  cpStage.querySelector('#btnCpSwitchGuest').addEventListener('click', () => {
    document.getElementById('btnGuiLoginGuest')?.click();
    document.getElementById('cpSessionUser').textContent = 'NETRUNNER: GUEST';
    playUiSfx(400, 0.1, 'triangle');
  });

  cpStage.querySelector('#btnCpLogout').addEventListener('click', () => {
    document.getElementById('btnGuiLogout')?.click();
    document.getElementById('cpSessionUser').textContent = 'NETRUNNER: ANONYMOUS';
    playUiSfx(200, 0.2, 'sawtooth');
  });

  // --- OVERCLOCK (SANDEVISTAN) ---
  const btnOverclock = cpStage.querySelector('#btnOverclock');
  const lblOverclock = cpStage.querySelector('#lblOverclock');

  const triggerOverclock = () => {
    if (isOverclocked) return;
    isOverclocked = true;
    document.body.classList.add('cp-overclocked');
    lblOverclock.textContent = 'SANDEVISTAN OVERCLOCKED (5s)';
    playUiSfx(920, 0.4, 'square');

    setTimeout(() => {
      document.body.classList.remove('cp-overclocked');
      lblOverclock.textContent = 'COOLDOWN (8s)';
      setTimeout(() => {
        isOverclocked = false;
        lblOverclock.textContent = 'OVERCLOCK HUD [E]';
      }, 8000);
    }, 5000);
  };

  btnOverclock.addEventListener('click', triggerOverclock);

  const onKeyDown = (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'KeyE') triggerOverclock();
    if (e.code === 'Tab') {
      e.preventDefault();
      const keys = Object.keys(views);
      const nextIdx = (keys.indexOf(activeTab) + 1) % keys.length;
      navBtns[nextIdx].click();
    }
  };

  window.addEventListener('keydown', onKeyDown);

  return {
    destroy: () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('cp-overclocked');
      cpStage.remove();
    }
  };
}