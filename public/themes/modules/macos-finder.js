export function init() {
  const macStage = document.createElement('div');
  macStage.id = 'macosDesktopLayer';
  macStage.className = 'mac-desktop-environment';
  macStage.innerHTML = `
    <!-- Top macOS Menu Bar -->
    <header class="mac-menu-bar">
      <div class="mac-menu-left">
        <span class="mac-apple-logo" id="macAppleLogo"></span>
        <strong>Finder</strong>
        <span id="menuOpenTerminal">Terminal</span>
        <span id="menuOpenBooth">Photo Booth</span>
        <span id="menuOpenInstances">Instances</span>
        <span id="menuOpenTelemetry">Telemetry</span>
      </div>
      <div class="mac-menu-right">
        <span id="macAuthStatus">👤 onur (ADMIN)</span>
        <span>100% 🔋</span>
        <span id="macClock">9:41 AM</span>
      </div>
    </header>

    <!-- Apple Dropdown Menüsü -->
    <div class="mac-apple-menu" id="macAppleMenu" style="display: none;">
      <div class="apple-item" id="appleItemAbout">About This Cluster</div>
      <div class="apple-sep"></div>
      <div class="apple-item" id="appleItemPalette">Theme Palette (⌘K)</div>
      <div class="apple-item" id="appleItemStudio">Theme Studio Pro</div>
      <div class="apple-sep"></div>
      <div class="apple-item" id="appleItemSwitchUser">Switch to Guest</div>
      <div class="apple-item" id="appleItemLogout">Log Out...</div>
    </div>

    <!-- macOS Dock (Alt Çekmece) -->
    <div class="mac-dock">
      <div class="dock-item" id="dockFinder" title="Finder (Instances)">🗂️</div>
      <div class="dock-item" id="dockTerminal" title="Terminal (zsh)">💻</div>
      <div class="dock-item" id="dockPhotoBooth" title="Photo Booth">📷</div>
      <div class="dock-item" id="dockTelemetry" title="Activity Telemetry">📊</div>
      <div class="dock-item" id="dockUserProfile" title="User Profile">👤</div>
      <div class="dock-sep"></div>
      <div class="dock-item" id="dockThemeStudio" title="Theme Studio">🎨</div>
      <div class="dock-item" id="dockTrash" title="Trash">🗑️</div>
    </div>
  `;

  document.body.appendChild(macStage);

  const windowsRegistry = [];
  let highestZ = 120;

  function bringToFront(winObj) {
    highestZ += 2;
    winObj.wrapper.style.zIndex = highestZ;
    document.querySelectorAll('.mac-window').forEach(w => w.classList.remove('active-window'));
    winObj.wrapper.classList.add('active-window');
  }

  function createMacWindow({ id, title, left, top, width, height, innerHtmlContent, targetElement = null, isTerminal = false }) {
    const winWrapper = document.createElement('div');
    winWrapper.className = `mac-window active-window ${isTerminal ? 'mac-terminal-window' : ''}`;
    winWrapper.id = `macWin_${id}`;
    winWrapper.style.left = `${left}px`;
    winWrapper.style.top = `${top}px`;
    winWrapper.style.width = `${width}px`;
    winWrapper.style.height = `${height}px`;

    const titleBar = document.createElement('div');
    titleBar.className = 'mac-titlebar';
    titleBar.innerHTML = `
      <div class="mac-traffic-lights">
        <button type="button" class="t-btn close" title="Close"></button>
        <button type="button" class="t-btn min" title="Minimize"></button>
        <button type="button" class="t-btn max" title="Maximize"></button>
      </div>
      <span class="mac-win-title">${title}</span>
    `;

    const winBody = document.createElement('div');
    winBody.className = 'mac-win-body';

    if (targetElement) {
      targetElement.parentNode.insertBefore(winWrapper, targetElement);
      winBody.appendChild(targetElement);
      targetElement.style.display = 'flex';
    } else {
      winBody.innerHTML = innerHtmlContent || '';
      document.body.appendChild(winWrapper);
    }

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'mac-resize-handle';

    winWrapper.appendChild(titleBar);
    winWrapper.appendChild(winBody);
    winWrapper.appendChild(resizeHandle);

    const winObj = { id, title, wrapper: winWrapper, titleBar, isMax: false, prevBounds: null };
    windowsRegistry.push(winObj);

    initMacWindowInteractions(winObj, resizeHandle);
    bringToFront(winObj);

    return winObj;
  }

  function initMacWindowInteractions(winObj, resizeHandle) {
    const el = winObj.wrapper;
    const header = winObj.titleBar;

    el.addEventListener('mousedown', () => bringToFront(winObj));

    let isDragging = false;
    let startX, startY, initLeft, initTop;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.mac-traffic-lights')) return;
      isDragging = true;
      bringToFront(winObj);
      startX = e.clientX;
      startY = e.clientY;
      initLeft = el.offsetLeft;
      initTop = el.offsetTop;
      document.body.classList.add('mac-unselectable');
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
      document.body.classList.add('mac-unselectable');
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging && !winObj.isMax) {
        el.style.left = `${Math.max(0, initLeft + (e.clientX - startX))}px`;
        el.style.top = `${Math.max(30, initTop + (e.clientY - startY))}px`;
      }
      if (isResizing && !winObj.isMax) {
        el.style.width = `${Math.max(320, initW + (e.clientX - startX))}px`;
        el.style.height = `${Math.max(180, initH + (e.clientY - startY))}px`;
      }
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
      isResizing = false;
      document.body.classList.remove('mac-unselectable');
    });

    header.querySelector('.t-btn.close').addEventListener('click', () => {
      el.style.display = 'none';
    });

    header.querySelector('.t-btn.min').addEventListener('click', () => {
      el.style.display = 'none';
    });

    header.querySelector('.t-btn.max').addEventListener('click', () => {
      if (!winObj.isMax) {
        winObj.prevBounds = { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height };
        el.style.left = '0px';
        el.style.top = '28px';
        el.style.width = '100vw';
        el.style.height = 'calc(100vh - 84px)';
        winObj.isMax = true;
      } else {
        el.style.left = winObj.prevBounds.left;
        el.style.top = winObj.prevBounds.top;
        el.style.width = winObj.prevBounds.width;
        el.style.height = winObj.prevBounds.height;
        winObj.isMax = false;
      }
    });
  }

  // --- 1. MACOS TERMINAL PENCERESİ (Terminal.app) ---
  const winTerminal = createMacWindow({
    id: 'terminal',
    title: 'onur — -zsh — 80×24',
    left: 40,
    top: 50,
    width: 600,
    height: 380,
    isTerminal: true,
    innerHtmlContent: `
      <div class="mac-terminal-app" id="macTerminalApp">
        <div class="mac-term-history" id="macTermHistory">
          <div class="mac-term-line dim">Last login: ${new Date().toDateString()} on ttys001</div>
          <div class="mac-term-line">System Cluster Engine [Darwin Kernel Version 23.4.0]</div>
          <div class="mac-term-line highlight">Type 'help', 'whoami', 'neofetch' or 'clear'</div>
        </div>
        <form class="mac-term-prompt-line" id="macTermForm" onsubmit="return false;">
          <span class="mac-prompt-tag" id="macPromptTag">onur@MacBook-Pro ~ %</span>
          <input type="text" class="mac-term-input" id="macTermInput" spellcheck="false" autocomplete="off" />
        </form>
      </div>
    `
  });

  // Terminal Komut Yorumlayıcısı[cite: 4]
  const termHistory = document.getElementById('macTermHistory');
  const termForm = document.getElementById('macTermForm');
  const termInput = document.getElementById('macTermInput');
  const promptTag = document.getElementById('macPromptTag');

  function appendMacLog(text, isHighlight = false) {
    if (!termHistory) return;
    const div = document.createElement('div');
    div.className = `mac-term-line ${isHighlight ? 'highlight' : ''}`;
    div.innerHTML = text;
    termHistory.appendChild(div);
    termHistory.scrollTop = termHistory.scrollHeight;
  }

  if (termForm) {
    termForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = termInput.value.trim();
      if (!raw) return;
      termInput.value = '';

      const currentUser = document.getElementById('lblUsername')?.textContent || 'onur';
      appendMacLog(`<span class="prompt-prefix">${currentUser}@MacBook-Pro ~ %</span> ${raw}`);

      const parts = raw.split(' ');
      const cmd = parts[0].toLowerCase();
      const arg = parts[1] ? parts[1].toLowerCase() : null;

      if (cmd === 'help') {
        appendMacLog(`Commands: help, whoami, neofetch, login &lt;user&gt;, logout, clear, photobooth, ls`);
      } else if (cmd === 'whoami') {
        const user = document.getElementById('lblUsername')?.textContent || 'onur';
        const role = document.getElementById('lblRole')?.textContent || 'ADMIN';
        appendMacLog(`user: ${user} | role: ${role} | shell: /bin/zsh`);
      } else if (cmd === 'neofetch') {
        appendMacLog(`
<pre class="mac-ascii-logo">
                    'c.          onur@MacBook-Pro
                 ,xNMM.          ----------------
               .OMMMMo           OS: macOS Sequoia 15.0 x86_64
               OMMM0,            Host: Cluster Node #8921-X
     .;loddo:-.  .olloddol;.     Kernel: 23.4.0
   cKMMMMMMMMMMNWMMMMMMMMMM0:    Uptime: 42 mins
 .KMMMMMMMMMMMMMMMMMMMMMMMWd.    Shell: zsh 5.9
 XMMMMMMMMMMMMMMMMMMMMMMMX.      Terminal: Terminal.app
;MMMMMMMMMMMMMMMMMMMMMMMM:       CPU: Apple M3 Max
:MMMMMMMMMMMMMMMMMMMMMMMM:       Memory: 312MB / 1024MB
.MMMMMMMMMMMMMMMMMMMMMMMMX.
 kMMMMMMMMMMMMMMMMMMMMMMMMWd.
 .XMMMMMMMMMMMMMMMMMMMMMMMMMMk
  .XMMMMMMMMMMMMMMMMMMMMMMMMK.
    kMMMMMMMMMMMMMMMMMMMMMMd
     ;KMMMMMMMWXXWMMMMMMMk.
       .cooc,.    .,coo:.
</pre>`, true);
      } else if (cmd === 'clear') {
        termHistory.innerHTML = '';
      } else if (cmd === 'ls') {
        appendMacLog(`Applications/  Documents/  PhotoVault/  ClusterInstances/`);
      } else if (cmd === 'photobooth') {
        winPhotoBooth.wrapper.style.display = 'flex';
        bringToFront(winPhotoBooth);
        loadPhotoBoothData();
      } else if (cmd === 'login') {
        if (arg === 'onur' || arg === 'admin') {
          document.getElementById('btnGuiLoginAdmin')?.click();
          appendMacLog(`[AUTH] Switched session to onur (ADMIN)`, true);
          promptTag.textContent = `onur@MacBook-Pro ~ %`;
          loadPhotoBoothData();
        } else if (arg) {
          document.getElementById('btnGuiLoginGuest')?.click();
          appendMacLog(`[AUTH] Switched session to ${arg} (GUEST)`, true);
          promptTag.textContent = `${arg}@MacBook-Pro ~ %`;
          loadPhotoBoothData();
        } else {
          appendMacLog(`[ERR] Usage: login onur or login guest`);
        }
      } else if (cmd === 'logout') {
        document.getElementById('btnGuiLogout')?.click();
        appendMacLog(`[AUTH] Session terminated. Switched to guest.`);
        promptTag.textContent = `guest@MacBook-Pro ~ %`;
        loadPhotoBoothData();
      } else {
        appendMacLog(`zsh: command not found: ${cmd}`);
      }
    });
  }

  // --- 2. DİĞER MACOS PENCERELERİ ---
  // A. Kullanıcı Profili Penceresi
  const guiPanel = document.getElementById('guiUserPanel');
  let winUser = null;
  if (guiPanel) {
    winUser = createMacWindow({
      id: 'user',
      title: 'User Profile & Identity',
      left: 660,
      top: 50,
      width: 480,
      height: 240,
      targetElement: guiPanel
    });
  }

  // B. Cluster Instances / Finder Penceresi[cite: 3]
  const winInstances = createMacWindow({
    id: 'instances',
    title: 'Finder - Cluster Instances',
    left: 360,
    top: 90,
    width: 600,
    height: 340,
    innerHtmlContent: `
      <div class="mac-finder-view">
        <div class="mac-finder-sidebar">
          <div class="sidebar-title">Favorites</div>
          <div class="sidebar-item active">📁 Applications</div>
          <div class="sidebar-item">☁️ Cloud Storage</div>
          <div class="sidebar-item">🖧 Remote Nodes</div>
        </div>
        <div class="mac-finder-content">
          <div class="mac-grid-item" onclick="window.location.href='/remote-control'">
            <div class="mac-grid-icon">🎛️</div>
            <span>Remote Control</span>
          </div>
          <div class="mac-grid-item" onclick="window.location.href='/song-share'">
            <div class="mac-grid-icon">🎵</div>
            <span>Song Share</span>
          </div>
          <div class="mac-grid-item" onclick="window.location.href='/file-storage'">
            <div class="mac-grid-icon">📁</div>
            <span>File Storage</span>
          </div>
          <div class="mac-grid-item disabled" onclick="alert('Staging Module!')">
            <div class="mac-grid-icon">🧪</div>
            <span>Automation Lab</span>
          </div>
        </div>
      </div>
    `
  });

  // C. Telemetri Penceresi[cite: 3]
  const winTelemetry = createMacWindow({
    id: 'telemetry',
    title: 'Activity Monitor - Telemetry',
    left: 200,
    top: 380,
    width: 540,
    height: 260,
    innerHtmlContent: `
      <div class="mac-telemetry-view">
        <div class="mac-stat-box">
          <label>REST THROUGHPUT</label>
          <div class="mac-val"><strong>148</strong> req/s</div>
          <small>Network Pool: 99.99% OK</small>
        </div>
        <div class="mac-stat-box">
          <label>POSTGRES POOL</label>
          <div class="mac-val"><strong>4 / 20</strong> conn</div>
          <div class="mac-bar"><div class="mac-bar-fill" style="width: 20%;"></div></div>
        </div>
        <div class="mac-stat-box">
          <label>RAM USAGE</label>
          <div class="mac-val"><strong>312</strong> MB</div>
          <div class="mac-bar"><div class="mac-bar-fill" style="width: 32%;"></div></div>
        </div>
        <div class="mac-stat-box">
          <label>SOCKET STREAM</label>
          <div class="mac-val" style="color: #0071e3;">#global-stream</div>
          <small>Status: Live Listening</small>
        </div>
      </div>
    `
  });

  // D. Photo Booth Penceresi[cite: 1]
  const winPhotoBooth = createMacWindow({
    id: 'photobooth',
    title: 'Photo Booth',
    left: 540,
    top: 140,
    width: 580,
    height: 420,
    innerHtmlContent: `
      <div class="booth-container">
        <div class="booth-display-frame" id="boothDisplayFrame">
          <img id="boothActiveImg" class="booth-active-image" src="" alt="Snapshot" style="display: none;" />
          <div class="booth-status-message" id="boothStatusMsg">Loading Vault...</div>
        </div>

        <div class="booth-strip-container">
          <div class="booth-strip-header">
            <span id="boothCountBadge">0 Photos in Vault</span>
            <button type="button" class="booth-refresh-btn" id="btnRefreshBooth">🔄 Reload</button>
          </div>
          <div class="booth-thumbnails" id="boothThumbnails"></div>
        </div>
      </div>
    `
  });
  winPhotoBooth.wrapper.style.display = 'none';

  // Photo Booth Verilerini Backend'den Çek[cite: 1]
  async function loadPhotoBoothData() {
    const statusMsg = document.getElementById('boothStatusMsg');
    const activeImg = document.getElementById('boothActiveImg');
    const thumbsContainer = document.getElementById('boothThumbnails');
    const countBadge = document.getElementById('boothCountBadge');
    const authStatus = document.getElementById('macAuthStatus');

    const currentUser = document.getElementById('lblUsername')?.textContent || 'onur';
    const currentRole = document.getElementById('lblRole')?.textContent || 'ADMIN';

    authStatus.textContent = `👤 ${currentUser} (${currentRole})`;

    try {
      const res = await fetch(`/api/themes/photobooth-snaps?userId=${currentUser}`, {
        headers: {
          'x-user-name': currentUser,
          'x-user-role': currentRole
        }
      });
      const data = await res.json();

      thumbsContainer.innerHTML = '';

      if (!data.isAuthenticated) {
        activeImg.style.display = 'none';
        statusMsg.style.display = 'block';
        statusMsg.innerHTML = `
          <span style="font-size: 2.2rem; display: block; margin-bottom: 6px;">🔒</span>
          <strong>${data.message || 'Log in to see some pictures'}</strong>
          <p style="font-size: 0.68rem; color: #86868b; margin-top: 4px;">Please login to your account to view the vault.</p>
        `;
        countBadge.textContent = 'Locked (Login Required)';
        return;
      }

      if (!data.photos || data.photos.length === 0) {
        activeImg.style.display = 'none';
        statusMsg.style.display = 'block';
        statusMsg.textContent = data.message || 'Şu anda fotoğraf görüntülenemiyor';
        countBadge.textContent = '0 Photos Available';
        return;
      }

      statusMsg.style.display = 'none';
      activeImg.style.display = 'block';
      activeImg.src = data.photos[0].url;
      countBadge.textContent = `${data.photos.length} Photos in Cloud Vault`;

      data.photos.forEach((photo, idx) => {
        const thumb = document.createElement('img');
        thumb.src = photo.url;
        thumb.className = `booth-thumb ${idx === 0 ? 'active' : ''}`;
        thumb.title = photo.caption || `Snap #${photo.id}`;

        thumb.addEventListener('click', () => {
          document.querySelectorAll('.booth-thumb').forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
          activeImg.src = photo.url;
        });

        thumbsContainer.appendChild(thumb);
      });
    } catch (err) {
      activeImg.style.display = 'none';
      statusMsg.style.display = 'block';
      statusMsg.textContent = 'Şu anda fotoğraf görüntülenemiyor';
      countBadge.textContent = 'Connection Error';
    }
  }

  document.getElementById('btnRefreshBooth')?.addEventListener('click', loadPhotoBoothData);

  // Dock ve Menü Tıklamaları[cite: 14]
  document.getElementById('dockTerminal')?.addEventListener('click', () => { winTerminal.wrapper.style.display = 'flex'; bringToFront(winTerminal); termInput.focus(); });
  document.getElementById('dockFinder')?.addEventListener('click', () => { winInstances.wrapper.style.display = 'flex'; bringToFront(winInstances); });
  document.getElementById('dockPhotoBooth')?.addEventListener('click', () => { winPhotoBooth.wrapper.style.display = 'flex'; bringToFront(winPhotoBooth); loadPhotoBoothData(); });
  document.getElementById('dockTelemetry')?.addEventListener('click', () => { winTelemetry.wrapper.style.display = 'flex'; bringToFront(winTelemetry); });
  document.getElementById('dockUserProfile')?.addEventListener('click', () => { if (winUser) { winUser.wrapper.style.display = 'flex'; bringToFront(winUser); } });
  document.getElementById('dockThemeStudio')?.addEventListener('click', () => { document.getElementById('btnOpenThemeStudio')?.click(); });
  document.getElementById('dockTrash')?.addEventListener('click', () => alert('Trash is empty!'));

  document.getElementById('menuOpenTerminal')?.addEventListener('click', () => { winTerminal.wrapper.style.display = 'flex'; bringToFront(winTerminal); termInput.focus(); });
  document.getElementById('menuOpenBooth')?.addEventListener('click', () => { winPhotoBooth.wrapper.style.display = 'flex'; bringToFront(winPhotoBooth); loadPhotoBoothData(); });
  document.getElementById('menuOpenInstances')?.addEventListener('click', () => { winInstances.wrapper.style.display = 'flex'; bringToFront(winInstances); });
  document.getElementById('menuOpenTelemetry')?.addEventListener('click', () => { winTelemetry.wrapper.style.display = 'flex'; bringToFront(winTelemetry); });

  // Apple Menü[cite: 14]
  const appleLogo = macStage.querySelector('#macAppleLogo');
  const appleMenu = macStage.querySelector('#macAppleMenu');
  appleLogo.addEventListener('click', (e) => {
    e.stopPropagation();
    appleMenu.style.display = appleMenu.style.display === 'flex' ? 'none' : 'flex';
  });

  window.addEventListener('click', () => { appleMenu.style.display = 'none'; });

  document.getElementById('appleItemPalette')?.addEventListener('click', () => document.getElementById('themeModalOpenBtn')?.click());
  document.getElementById('appleItemStudio')?.addEventListener('click', () => document.getElementById('btnOpenThemeStudio')?.click());
  document.getElementById('appleItemSwitchUser')?.addEventListener('click', () => { document.getElementById('btnGuiLoginGuest')?.click(); loadPhotoBoothData(); });
  document.getElementById('appleItemLogout')?.addEventListener('click', () => { document.getElementById('btnGuiLogout')?.click(); loadPhotoBoothData(); });

  // Saat[cite: 14]
  const clockEl = macStage.querySelector('#macClock');
  const updateClock = () => {
    const d = new Date();
    clockEl.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  updateClock();
  const clockTimer = setInterval(updateClock, 1000);

  bringToFront(winTerminal);

  return {
    destroy: () => {
      clearInterval(clockTimer);
      windowsRegistry.forEach(w => {
        const bodyEl = w.wrapper.querySelector('.mac-win-body > #guiUserPanel');
        if (bodyEl) bodyEl.parentNode.insertBefore(bodyEl, w.wrapper);
        w.wrapper.remove();
      });
      macStage.remove();
    }
  };
}