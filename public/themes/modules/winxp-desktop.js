export function init() {
  const xpStage = document.createElement('div');
  xpStage.id = 'winxpDesktopLayer';
  xpStage.className = 'xp-desktop-environment';
  xpStage.innerHTML = `
    <!-- Masaüstü Simgeleri (Desktop Icons) -->
    <div class="xp-desktop-icons" id="xpDesktopIcons">
      <div class="xp-icon-item" id="iconMyComputer" title="My Computer">
        <div class="icon-img">💻</div>
        <span>My Computer</span>
      </div>
      <div class="xp-icon-item" id="iconNotepad" title="Notepad">
        <div class="icon-img">📝</div>
        <span>Notepad</span>
      </div>
      <div class="xp-icon-item" id="iconMinesweeper" title="Minesweeper">
        <div class="icon-img">💣</div>
        <span>Minesweeper</span>
      </div>
      <div class="xp-icon-item" id="iconThemeStudio" title="Theme Studio">
        <div class="icon-img">🎨</div>
        <span>Theme Studio</span>
      </div>
      <div class="xp-icon-item" id="iconRecycleBin" title="Recycle Bin">
        <div class="icon-img">🗑️</div>
        <span>Recycle Bin</span>
      </div>
    </div>

    <!-- Mavi Seçim Kutusu (Marquee Drag Selection) -->
    <div class="xp-marquee-selection" id="xpMarquee" style="display: none;"></div>

    <!-- Masaüstü Sağ Tık Menüsü (Context Menu) -->
    <div class="xp-context-menu" id="xpContextMenu" style="display: none;">
      <div class="ctx-item" id="ctxRefresh"><span>🔄</span> Refresh</div>
      <div class="ctx-sep"></div>
      <div class="ctx-item" id="ctxOpenNotepad"><span>📝</span> Open Notepad</div>
      <div class="ctx-item" id="ctxOpenMine"><span>💣</span> Play Minesweeper</div>
      <div class="ctx-item" id="ctxOpenPalette"><span>🎨</span> Theme Palette</div>
      <div class="ctx-sep"></div>
      <div class="ctx-item" id="ctxProperties"><span>⚙️</span> Display Properties</div>
    </div>

    <!-- Clippy / Asistan Widget -->
    <div class="xp-clippy-widget" id="xpClippy">
      <div class="clippy-bubble" id="clippyBubble">
        <p id="clippyText">It looks like you're managing a cluster! Need some assistance?</p>
        <div class="clippy-btn-row">
          <button type="button" id="btnClippyDismiss">Thanks</button>
          <button type="button" id="btnClippyHelp">Help me</button>
        </div>
      </div>
      <div class="clippy-avatar" id="clippyAvatar" title="Click Clippy for tips!">📎</div>
    </div>

    <!-- Başlat Menüsü -->
    <div class="xp-start-menu" id="xpStartMenu" style="display: none;">
      <div class="start-header">
        <img class="start-user-pic" src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80" alt="User" />
        <span class="start-username">onur</span>
      </div>
      <div class="start-columns">
        <div class="start-left-col">
          <div class="start-item" id="startOpenNotepad">
            <span class="start-icon">📝</span>
            <div class="start-item-txt"><strong>Notepad</strong><small>Text Editor</small></div>
          </div>
          <div class="start-item" id="startOpenMinesweeper">
            <span class="start-icon">💣</span>
            <div class="start-item-txt"><strong>Minesweeper</strong><small>Classic Game</small></div>
          </div>
          <div class="start-item" id="startOpenThemePalette">
            <span class="start-icon">🎨</span>
            <div class="start-item-txt"><strong>Theme Palette (⌘K)</strong><small>Switch cluster themes</small></div>
          </div>
          <div class="start-item" id="startOpenThemeStudio">
            <span class="start-icon">🛠️</span>
            <div class="start-item-txt"><strong>Theme Studio Pro</strong><small>Create &amp; edit live styles</small></div>
          </div>
          <div class="start-sep"></div>
          <div class="start-item" onclick="window.location.href='/remote-control'">
            <span class="start-icon">🎛️</span>
            <div class="start-item-txt"><strong>Device Manager</strong><small>ESP32 &amp; Matrix Panel</small></div>
          </div>
          <div class="start-item" onclick="window.location.href='/song-share'">
            <span class="start-icon">🎵</span>
            <div class="start-item-txt"><strong>Song Share</strong><small>Live Audio Stream</small></div>
          </div>
          <div class="start-item" onclick="window.location.href='/file-storage'">
            <span class="start-icon">📁</span>
            <div class="start-item-txt"><strong>File Storage (C:)</strong><small>Blobs &amp; Database dumps</small></div>
          </div>
        </div>
        <div class="start-right-col">
          <div class="start-side-item" id="startOpenUserWindow">👤 My Profile</div>
          <div class="start-side-item" id="startOpenServicesWindow">🗂️ Cluster Instances</div>
          <div class="start-side-item" id="startOpenTelemetryWindow">📊 System Telemetry</div>
          <div class="start-sep"></div>
          <div class="start-side-item" id="startLoginGuest">👥 Switch to Guest</div>
          <div class="start-side-item" id="startLogout">🔒 Log Off</div>
        </div>
      </div>
      <div class="start-footer">
        <button type="button" class="xp-btn-shutdown" id="btnXpLogoff"><span>⏻</span> Turn Off Computer</button>
      </div>
    </div>

    <!-- Mavi Luna Taskbar -->
    <div class="xp-taskbar" id="xpTaskbar">
      <button type="button" class="xp-start-btn" id="btnXpStart">
        <svg class="xp-flag" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/>
        </svg>
        <span>start</span>
      </button>

      <div class="xp-task-tabs" id="xpTaskTabs"></div>

      <div class="xp-system-tray">
        <span class="tray-icon" title="Network: Connected (1 Gbps)">🌐</span>
        <span class="tray-icon" id="traySoundBtn" title="Sound: On">🔊</span>
        <div class="xp-clock" id="xpClock">12:00 PM</div>
      </div>
    </div>
  `;

  document.body.appendChild(xpStage);

  // --- 1. WEB AUDIO API SES MOTORU (XP AÇILIŞ & HATA SESLERİ) ---
  let audioCtx = null;
  const initAudio = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  };

  const playTone = (freq, duration, type = 'sine', gainVal = 0.2, delay = 0) => {
    try {
      initAudio();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime + delay;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  };

  // XP Startup Akoru (Eb Major Arpeggio)
  const playXpStartupSound = () => {
    const notes = [
      { f: 311.13, d: 0.8, t: 'sine', g: 0.25, time: 0 },
      { f: 466.16, d: 0.9, t: 'triangle', g: 0.2, time: 0.12 },
      { f: 622.25, d: 1.2, t: 'sine', g: 0.25, time: 0.26 },
      { f: 932.33, d: 1.5, t: 'sine', g: 0.15, time: 0.42 },
      { f: 1244.5, d: 2.0, t: 'sine', g: 0.18, time: 0.58 }
    ];
    notes.forEach(n => playTone(n.f, n.d, n.t, n.g, n.time));
  };

  const playXpErrorSound = () => {
    playTone(180, 0.25, 'sawtooth', 0.3);
    playTone(135, 0.35, 'square', 0.2, 0.05);
  };

  setTimeout(playXpStartupSound, 400);

  // --- 2. PENCERE VE TASKBAR MOTORU ---
  const windowsRegistry = [];
  let highestZ = 120;

  function bringToFront(winObj) {
    highestZ += 2;
    winObj.wrapper.style.zIndex = highestZ;
    document.querySelectorAll('.xp-window').forEach(w => w.classList.remove('active-window'));
    winObj.wrapper.classList.add('active-window');

    document.querySelectorAll('.xp-tab-btn').forEach(t => t.classList.remove('active'));
    const tab = document.getElementById(`tab_${winObj.id}`);
    if (tab) tab.classList.add('active');
  }

  function createWindow({ id, title, icon, left, top, width, height, innerHtmlContent, targetElement = null }) {
    const winWrapper = document.createElement('div');
    winWrapper.className = 'xp-window active-window';
    winWrapper.id = `xpWin_${id}`;
    winWrapper.style.left = `${left}px`;
    winWrapper.style.top = `${top}px`;
    winWrapper.style.width = `${width}px`;
    winWrapper.style.height = `${height}px`;

    const titleBar = document.createElement('div');
    titleBar.className = 'xp-titlebar';
    titleBar.innerHTML = `
      <div class="xp-title-content">
        <span class="xp-win-icon">${icon}</span>
        <span class="xp-win-title-text">${title}</span>
      </div>
      <div class="xp-win-controls">
        <button type="button" class="win-btn min" title="Minimize">_</button>
        <button type="button" class="win-btn max" title="Maximize">□</button>
        <button type="button" class="win-btn close" title="Close">×</button>
      </div>
    `;

    const winBody = document.createElement('div');
    winBody.className = 'xp-win-body';

    if (targetElement) {
      targetElement.parentNode.insertBefore(winWrapper, targetElement);
      winBody.appendChild(targetElement);
      targetElement.style.display = 'flex';
    } else {
      winBody.innerHTML = innerHtmlContent || '';
      document.body.appendChild(winWrapper);
    }

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'xp-resize-handle';

    winWrapper.appendChild(titleBar);
    winWrapper.appendChild(winBody);
    winWrapper.appendChild(resizeHandle);

    const winObj = { id, title, icon, wrapper: winWrapper, titleBar, isMax: false, prevBounds: null };
    windowsRegistry.push(winObj);

    initWindowInteractions(winObj, resizeHandle);
    createTaskTab(winObj);
    bringToFront(winObj);

    return winObj;
  }

  function initWindowInteractions(winObj, resizeHandle) {
    const el = winObj.wrapper;
    const header = winObj.titleBar;

    el.addEventListener('mousedown', () => bringToFront(winObj));

    let isDragging = false;
    let startX, startY, initLeft, initTop;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.xp-win-controls')) return;
      isDragging = true;
      bringToFront(winObj);
      startX = e.clientX;
      startY = e.clientY;
      initLeft = el.offsetLeft;
      initTop = el.offsetTop;
      document.body.classList.add('xp-unselectable');
    });

    let isResizing = false;
    let initW, initH;

    resizeHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      isResizing = true;
      bringToFront(winObj);
      startX = e.clientX;
      startY = e.clientY;
      initW = el.offsetWidth;
      initH = el.offsetHeight;
      document.body.classList.add('xp-unselectable');
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging && !winObj.isMax) {
        el.style.left = `${Math.max(0, initLeft + (e.clientX - startX))}px`;
        el.style.top = `${Math.max(0, initTop + (e.clientY - startY))}px`;
      }
      if (isResizing && !winObj.isMax) {
        el.style.width = `${Math.max(260, initW + (e.clientX - startX))}px`;
        el.style.height = `${Math.max(140, initH + (e.clientY - startY))}px`;
      }
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
      isResizing = false;
      document.body.classList.remove('xp-unselectable');
    });

    header.querySelector('.win-btn.min').addEventListener('click', () => {
      el.style.display = 'none';
      const tab = document.getElementById(`tab_${winObj.id}`);
      if (tab) tab.classList.remove('active');
    });

    header.querySelector('.win-btn.max').addEventListener('click', () => {
      if (!winObj.isMax) {
        winObj.prevBounds = { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height };
        el.style.left = '0px';
        el.style.top = '0px';
        el.style.width = '100vw';
        el.style.height = 'calc(100vh - 36px)';
        winObj.isMax = true;
      } else {
        el.style.left = winObj.prevBounds.left;
        el.style.top = winObj.prevBounds.top;
        el.style.width = winObj.prevBounds.width;
        el.style.height = winObj.prevBounds.height;
        winObj.isMax = false;
      }
    });

    header.querySelector('.win-btn.close').addEventListener('click', () => {
      el.style.display = 'none';
      const tab = document.getElementById(`tab_${winObj.id}`);
      if (tab) tab.classList.remove('active');
    });
  }

  function createTaskTab(winObj) {
    const tabsContainer = xpStage.querySelector('#xpTaskTabs');
    const tab = document.createElement('button');
    tab.className = 'xp-tab-btn active';
    tab.id = `tab_${winObj.id}`;
    tab.innerHTML = `<span>${winObj.icon}</span><span class="tab-label">${winObj.title}</span>`;

    tab.addEventListener('click', () => {
      if (winObj.wrapper.style.display === 'none') {
        winObj.wrapper.style.display = 'flex';
        bringToFront(winObj);
      } else if (winObj.wrapper.classList.contains('active-window')) {
        winObj.wrapper.style.display = 'none';
        tab.classList.remove('active');
      } else {
        bringToFront(winObj);
      }
    });

    tabsContainer.appendChild(tab);
  }

  // --- 3. UYGULAMA PENCERELERİ ---
  // A. Kullanıcı Profili Penceresi
  const guiPanel = document.getElementById('guiUserPanel');
  let winUser = null;
  if (guiPanel) {
    winUser = createWindow({
      id: 'user',
      title: 'User Profile & Node Manager',
      icon: '👤',
      left: 140,
      top: 50,
      width: 500,
      height: 250,
      targetElement: guiPanel
    });
  }

  // B. Cluster Instances Penceresi[cite: 3]
  let winServices = createWindow({
    id: 'services',
    title: 'Cluster Instances (C:\\Directory)',
    icon: '🗂️',
    left: 450,
    top: 70,
    width: 620,
    height: 380,
    innerHtmlContent: `
      <div class="xp-explorer-view">
        <div class="xp-explorer-toolbar">
          <button type="button" class="xp-tool-btn" onclick="window.location.reload()">🔄 Refresh</button>
          <button type="button" class="xp-tool-btn" onclick="window.location.href='/remote-control'">⚙ Manage</button>
          <div class="xp-path-bar">
            <span>Address:</span>
            <input type="text" value="C:\\Cluster\\ManagedInstances" readonly />
          </div>
        </div>
        <div class="xp-app-grid">
          <div class="xp-app-item" onclick="window.location.href='/remote-control'">
            <div class="xp-app-icon">🎛️</div>
            <div class="xp-app-meta"><strong>Remote Control</strong><small>ESP32 &amp; Matrix Panel config</small></div>
          </div>
          <div class="xp-app-item" onclick="window.location.href='/song-share'">
            <div class="xp-app-icon">🎵</div>
            <div class="xp-app-meta"><strong>Song Share</strong><small>Audio stream &amp; group queue</small></div>
          </div>
          <div class="xp-app-item" onclick="window.location.href='/file-storage'">
            <div class="xp-app-icon">📁</div>
            <div class="xp-app-meta"><strong>File Storage</strong><small>Binary dumps &amp; DB archives</small></div>
          </div>
          <div class="xp-app-item disabled" onclick="alert('Module in Staging!')">
            <div class="xp-app-icon">🧪</div>
            <div class="xp-app-meta"><strong>Automation Lab</strong><small>FFmpeg queue [STAGING]</small></div>
          </div>
        </div>
      </div>
    `
  });

  // C. System Telemetry Penceresi[cite: 3]
  let winTelemetry = createWindow({
    id: 'telemetry',
    title: 'Windows Task & Performance Telemetry',
    icon: '📊',
    left: 260,
    top: 320,
    width: 560,
    height: 280,
    innerHtmlContent: `
      <div class="xp-telemetry-view">
        <div class="xp-stat-cards">
          <div class="xp-stat-card">
            <label>REST THROUGHPUT</label>
            <div class="stat-value"><strong>148</strong> req/s</div>
            <div class="stat-status">Status: Healthy (99.99%)</div>
          </div>
          <div class="xp-stat-card">
            <label>POSTGRES POOL</label>
            <div class="stat-value"><strong>4 / 20</strong> conn</div>
            <div class="xp-progress"><div class="xp-progress-bar" style="width: 20%;"></div></div>
          </div>
          <div class="xp-stat-card">
            <label>RAM USAGE</label>
            <div class="stat-value"><strong>312</strong> MB</div>
            <div class="xp-progress"><div class="xp-progress-bar" style="width: 30%;"></div></div>
          </div>
          <div class="xp-stat-card">
            <label>REALTIME CHANNEL</label>
            <div class="stat-value highlight">#global-stream</div>
            <div class="stat-status">Socket: Connected</div>
          </div>
        </div>
      </div>
    `
  });

  // D. Notepad (Gerçek Not Tutma Uygulaması)
  let winNotepad = createWindow({
    id: 'notepad',
    title: 'Untitled - Notepad',
    icon: '📝',
    left: 320,
    top: 140,
    width: 440,
    height: 300,
    innerHtmlContent: `
      <div class="xp-notepad-container">
        <div class="xp-notepad-menu">
          <span>File</span><span>Edit</span><span>Format</span><span>View</span><span>Help</span>
        </div>
        <textarea class="xp-notepad-area" id="xpNotepadArea" placeholder="Type notes here... Saves automatically."></textarea>
      </div>
    `
  });
  winNotepad.wrapper.style.display = 'none';

  const notepadArea = document.getElementById('xpNotepadArea');
  if (notepadArea) {
    notepadArea.value = localStorage.getItem('xp-notepad-data') || '';
    notepadArea.addEventListener('input', (e) => {
      localStorage.setItem('xp-notepad-data', e.target.value);
    });
  }

  // E. Minesweeper (Mayın Tarlası Mini Oyunu)
  let winMinesweeper = createWindow({
    id: 'minesweeper',
    title: 'Minesweeper',
    icon: '💣',
    left: 480,
    top: 180,
    width: 260,
    height: 330,
    innerHtmlContent: `
      <div class="xp-minesweeper-frame">
        <div class="ms-header">
          <div class="ms-digital" id="msMinesLeft">010</div>
          <button type="button" class="ms-face-btn" id="msFaceBtn">🙂</button>
          <div class="ms-digital" id="msTimer">000</div>
        </div>
        <div class="ms-grid" id="msGrid"></div>
      </div>
    `
  });
  winMinesweeper.wrapper.style.display = 'none';

  // Minesweeper Motoru
  const msGrid = document.getElementById('msGrid');
  const msFace = document.getElementById('msFaceBtn');
  const msMinesLeft = document.getElementById('msMinesLeft');
  const msTimerEl = document.getElementById('msTimer');
  let msBoard = [];
  let msRows = 8, msCols = 8, msTotalMines = 10;
  let msGameOver = false;
  let msTime = 0, msTimerInterval = null;

  function initMinesweeper() {
    msGrid.innerHTML = '';
    msBoard = [];
    msGameOver = false;
    msTime = 0;
    clearInterval(msTimerInterval);
    msTimerEl.textContent = '000';
    msMinesLeft.textContent = '010';
    msFace.textContent = '🙂';

    for (let r = 0; r < msRows; r++) {
      msBoard[r] = [];
      for (let c = 0; c < msCols; c++) {
        msBoard[r][c] = { r, c, isMine: false, revealed: false, flagged: false, count: 0 };
      }
    }

    let placed = 0;
    while (placed < msTotalMines) {
      let rr = Math.floor(Math.random() * msRows);
      let cc = Math.floor(Math.random() * msCols);
      if (!msBoard[rr][cc].isMine) {
        msBoard[rr][cc].isMine = true;
        placed++;
      }
    }

    for (let r = 0; r < msRows; r++) {
      for (let c = 0; c < msCols; c++) {
        if (!msBoard[r][c].isMine) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              let nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < msRows && nc >= 0 && nc < msCols && msBoard[nr][nc].isMine) count++;
            }
          }
          msBoard[r][c].count = count;
        }
      }
    }

    for (let r = 0; r < msRows; r++) {
      for (let c = 0; c < msCols; c++) {
        const cell = document.createElement('button');
        cell.className = 'ms-cell';
        cell.dataset.r = r;
        cell.dataset.c = c;

        cell.addEventListener('click', () => revealCell(r, c));
        cell.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          toggleFlag(r, c);
        });

        msGrid.appendChild(cell);
      }
    }

    msTimerInterval = setInterval(() => {
      if (!msGameOver) {
        msTime++;
        msTimerEl.textContent = String(msTime).padStart(3, '0');
      }
    }, 1000);
  }

  function revealCell(r, c) {
    if (msGameOver || msBoard[r][c].revealed || msBoard[r][c].flagged) return;
    const cellData = msBoard[r][c];
    cellData.revealed = true;
    const cellEl = msGrid.children[r * msCols + c];
    cellEl.classList.add('revealed');

    if (cellData.isMine) {
      msGameOver = true;
      cellEl.classList.add('mine');
      cellEl.textContent = '💣';
      msFace.textContent = '😵';
      playXpErrorSound();
      revealAllMines();
      return;
    }

    playTone(600, 0.04, 'triangle');
    if (cellData.count > 0) {
      cellEl.textContent = cellData.count;
      cellEl.dataset.num = cellData.count;
    } else {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          let nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < msRows && nc >= 0 && nc < msCols) revealCell(nr, nc);
        }
      }
    }
  }

  function toggleFlag(r, c) {
    if (msGameOver || msBoard[r][c].revealed) return;
    const cellData = msBoard[r][c];
    cellData.flagged = !cellData.flagged;
    const cellEl = msGrid.children[r * msCols + c];
    cellEl.textContent = cellData.flagged ? '🚩' : '';
    playTone(400, 0.04, 'square');
  }

  function revealAllMines() {
    for (let r = 0; r < msRows; r++) {
      for (let c = 0; c < msCols; c++) {
        if (msBoard[r][c].isMine) {
          const el = msGrid.children[r * msCols + c];
          el.classList.add('revealed', 'mine');
          el.textContent = '💣';
        }
      }
    }
  }

  msFace.addEventListener('click', initMinesweeper);
  initMinesweeper();

  // --- 4. MASAÜSTÜ SİMGELERİ VE SEÇİM KUTUSU (MARQUEE) ---
  const iconDesk = xpStage.querySelector('#xpDesktopIcons');
  const marquee = xpStage.querySelector('#xpMarquee');
  let isSelecting = false;
  let mStartX, mStartY;

  window.addEventListener('mousedown', (e) => {
    if (e.target.closest('.xp-window') || e.target.closest('.xp-taskbar') || e.target.closest('.xp-start-menu') || e.target.closest('.xp-context-menu') || e.target.closest('.xp-clippy-widget')) return;
    isSelecting = true;
    mStartX = e.clientX;
    mStartY = e.clientY;
    marquee.style.left = `${mStartX}px`;
    marquee.style.top = `${mStartY}px`;
    marquee.style.width = '0px';
    marquee.style.height = '0px';
    marquee.style.display = 'block';

    if (!e.target.closest('.xp-icon-item')) {
      document.querySelectorAll('.xp-icon-item').forEach(i => i.classList.remove('selected'));
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isSelecting) return;
    const curX = e.clientX;
    const curY = e.clientY;
    const left = Math.min(mStartX, curX);
    const top = Math.min(mStartY, curY);
    const width = Math.abs(curX - mStartX);
    const height = Math.abs(curY - mStartY);

    marquee.style.left = `${left}px`;
    marquee.style.top = `${top}px`;
    marquee.style.width = `${width}px`;
    marquee.style.height = `${height}px`;
  });

  window.addEventListener('mouseup', () => {
    if (isSelecting) {
      isSelecting = false;
      marquee.style.display = 'none';
    }
  });

  // Masaüstü İkonlarına Çift Tıklama Olayları
  document.querySelectorAll('.xp-icon-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.xp-icon-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
    });
  });

  document.getElementById('iconMyComputer').addEventListener('dblclick', () => {
    winServices.wrapper.style.display = 'flex';
    bringToFront(winServices);
  });
  document.getElementById('iconNotepad').addEventListener('dblclick', () => {
    winNotepad.wrapper.style.display = 'flex';
    bringToFront(winNotepad);
  });
  document.getElementById('iconMinesweeper').addEventListener('dblclick', () => {
    winMinesweeper.wrapper.style.display = 'flex';
    bringToFront(winMinesweeper);
  });
  document.getElementById('iconThemeStudio').addEventListener('dblclick', () => {
    const btn = document.getElementById('btnOpenThemeStudio');
    if (btn) btn.click();
  });
  document.getElementById('iconRecycleBin').addEventListener('dblclick', () => {
    alert('Recycle Bin is empty!');
  });

  // --- 5. SAĞ TIK CONTEXT MENÜSÜ ---
  const ctxMenu = xpStage.querySelector('#xpContextMenu');
  window.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.xp-window') || e.target.closest('.xp-taskbar') || e.target.closest('.xp-start-menu')) return;
    e.preventDefault();
    ctxMenu.style.left = `${e.clientX}px`;
    ctxMenu.style.top = `${e.clientY}px`;
    ctxMenu.style.display = 'block';
  });

  window.addEventListener('click', () => { ctxMenu.style.display = 'none'; });

  document.getElementById('ctxRefresh').addEventListener('click', () => playTone(800, 0.08, 'triangle'));
  document.getElementById('ctxOpenNotepad').addEventListener('click', () => {
    winNotepad.wrapper.style.display = 'flex';
    bringToFront(winNotepad);
  });
  document.getElementById('ctxOpenMine').addEventListener('click', () => {
    winMinesweeper.wrapper.style.display = 'flex';
    bringToFront(winMinesweeper);
  });
  document.getElementById('ctxOpenPalette').addEventListener('click', () => {
    const btn = document.getElementById('themeModalOpenBtn');
    if (btn) btn.click();
  });
  document.getElementById('ctxProperties').addEventListener('click', () => {
    const btn = document.getElementById('btnOpenThemeStudio');
    if (btn) btn.click();
  });

  // --- 6. CLIPPY SİSTEM ASİSTANI ---
  const clippy = xpStage.querySelector('#xpClippy');
  const clippyBubble = xpStage.querySelector('#clippyBubble');
  const clippyText = xpStage.querySelector('#clippyText');

  const clippyTips = [
    "It looks like your PostgreSQL connection pool is healthy at 4/20 connections!",
    "Did you know you can drag and resize any window from its title bar and corners?",
    "Tip: You can double-click Notepad on the desktop to take quick notes!",
    "Need to change the background or colors? Open Theme Studio from the Start Menu!"
  ];

  clippy.querySelector('#clippyAvatar').addEventListener('click', () => {
    playTone(900, 0.1, 'sine');
    clippyBubble.style.display = 'flex';
    clippyText.textContent = clippyTips[Math.floor(Math.random() * clippyTips.length)];
  });

  document.getElementById('btnClippyDismiss').addEventListener('click', () => { clippyBubble.style.display = 'none'; });
  document.getElementById('btnClippyHelp').addEventListener('click', () => {
    winServices.wrapper.style.display = 'flex';
    bringToFront(winServices);
    clippyBubble.style.display = 'none';
  });

  // --- 7. BAŞLAT MENÜSÜ & SAAT ---
  const startBtn = xpStage.querySelector('#btnXpStart');
  const startMenu = xpStage.querySelector('#xpStartMenu');

  startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isShown = startMenu.style.display === 'flex';
    startMenu.style.display = isShown ? 'none' : 'flex';
    startBtn.classList.toggle('active', !isShown);
    playTone(500, 0.05, 'triangle');
  });

  window.addEventListener('click', (e) => {
    if (!startMenu.contains(e.target) && e.target !== startBtn) {
      startMenu.style.display = 'none';
      startBtn.classList.remove('active');
    }
  });

  document.getElementById('startOpenNotepad').addEventListener('click', () => {
    winNotepad.wrapper.style.display = 'flex';
    bringToFront(winNotepad);
    startMenu.style.display = 'none';
  });
  document.getElementById('startOpenMinesweeper').addEventListener('click', () => {
    winMinesweeper.wrapper.style.display = 'flex';
    bringToFront(winMinesweeper);
    startMenu.style.display = 'none';
  });
  document.getElementById('startOpenThemePalette').addEventListener('click', () => {
    const btn = document.getElementById('themeModalOpenBtn');
    if (btn) btn.click();
    startMenu.style.display = 'none';
  });
  document.getElementById('startOpenThemeStudio').addEventListener('click', () => {
    const btn = document.getElementById('btnOpenThemeStudio');
    if (btn) btn.click();
    startMenu.style.display = 'none';
  });
  document.getElementById('startOpenUserWindow').addEventListener('click', () => {
    if (winUser) { winUser.wrapper.style.display = 'flex'; bringToFront(winUser); }
    startMenu.style.display = 'none';
  });
  document.getElementById('startOpenServicesWindow').addEventListener('click', () => {
    winServices.wrapper.style.display = 'flex';
    bringToFront(winServices);
    startMenu.style.display = 'none';
  });
  document.getElementById('startOpenTelemetryWindow').addEventListener('click', () => {
    winTelemetry.wrapper.style.display = 'flex';
    bringToFront(winTelemetry);
    startMenu.style.display = 'none';
  });
  document.getElementById('startLoginGuest').addEventListener('click', () => {
    const btn = document.getElementById('btnGuiLoginGuest');
    if (btn) btn.click();
    startMenu.style.display = 'none';
  });
  document.getElementById('startLogout').addEventListener('click', () => {
    const btn = document.getElementById('btnGuiLogout');
    if (btn) btn.click();
    startMenu.style.display = 'none';
  });
  document.getElementById('btnXpLogoff').addEventListener('click', () => {
    playXpErrorSound();
    alert('Windows is shutting down...');
    startMenu.style.display = 'none';
  });

  const clockEl = xpStage.querySelector('#xpClock');
  const updateClock = () => {
    const d = new Date();
    clockEl.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  updateClock();
  const clockInterval = setInterval(updateClock, 1000);

  return {
    destroy: () => {
      clearInterval(clockInterval);
      clearInterval(msTimerInterval);
      windowsRegistry.forEach(w => {
        const bodyEl = w.wrapper.querySelector('.xp-win-body > #guiUserPanel');
        if (bodyEl) w.wrapper.parentNode.insertBefore(bodyEl, w.wrapper);
        w.wrapper.remove();
      });
      xpStage.remove();
    }
  };
}

const accountLayout = document.querySelector('.account-layout');
if (accountLayout) {
  createWindow({
    id: 'accountWin',
    title: 'Account Settings // Control Panel',
    icon: '⚙️',
    left: 80,
    top: 40,
    width: 900,
    height: 560,
    targetElement: accountLayout
  });
}

// 2. Login sayfasındaki kartı XP penceresi yap
const loginCard = document.getElementById('loginCard');
if (loginCard) {
  createWindow({
    id: 'loginWin',
    title: 'Log On to Windows (Sys-Cluster)',
    icon: '🔒',
    left: (window.innerWidth - 460) / 2,
    top: 120,
    width: 460,
    height: 380,
    targetElement: loginCard
  });
}


