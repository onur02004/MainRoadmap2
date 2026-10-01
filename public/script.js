// public/script.js
import { ThemeManager } from './themes/theme-registry.js';
import { loadServices, handleServiceClick, clearServicesCache } from './services-client.js';
import { renderAvatar, refreshAvatar } from './avatarRenderer.js';

export let currentSession = {
  isLoggedIn: false,
  username: "anonymous",
  role: "GUEST",
  nodeId: "#OFFLINE",
  avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=off"
};

// Spotify & Izgara Durum Yönetimi
let currentActiveFriendActivity = null;
let friendActivityPollTimer = null;
let currentGridBlueprint = null;
let currentGridMeta = null;

document.addEventListener('DOMContentLoaded', async () => {
  initTimestamps();
  initResponsiveFixedGrid();
  initCliAuth();
  initAvatarClickRedirect();
  initLiveTelemetrySimulation();
  initScrollOpacityController();

  // Kaydırma yönlendirme okunu başlat
  initScrollHintManager();

  new ThemeManager();

  await checkActiveSession();
  scrollToTerminalBottom();

  // Canlı Arkadaş Spotify Takibini Başlat
  startLiveFriendsSpotifySync();
});

// Akıllı Aşağı Kaydırma Oku Yöneticisi
function initScrollHintManager() {
  const hintEl = document.getElementById('scrollDownHint');
  const servicesSec = document.getElementById('servicesSection');
  if (!hintEl) return;

  const STORAGE_KEY = 'scroll_hint_seen_count';
  const MAX_DISPLAYS = 3; // Kullanıcıya en fazla 3 kez gösterilir

  let seenCount = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);

  if (seenCount < MAX_DISPLAYS) {
    hintEl.style.display = 'flex';
    localStorage.setItem(STORAGE_KEY, (seenCount + 1).toString());
  }

  // Tıklandığında servisler bölümüne yumuşakça kaydır
  hintEl.addEventListener('click', () => {
    servicesSec?.scrollIntoView({ behavior: 'smooth' });
    hideHint();
  });

  // Kullanıcı kendisi kaydırdığında oku gizle
  const onScrollHandler = () => {
    if (window.scrollY > 80) {
      hideHint();
      window.removeEventListener('scroll', onScrollHandler);
    }
  };

  function hideHint() {
    hintEl.style.opacity = '0';
    hintEl.style.pointerEvents = 'none';
    setTimeout(() => { hintEl.style.display = 'none'; }, 400);
  }

  window.addEventListener('scroll', onScrollHandler, { passive: true });
}

// Avatar Tıklandığında Login / Account Yönlendirmesi
function initAvatarClickRedirect() {
  const avatarBadge = document.getElementById('cliAvatarContainer');
  if (avatarBadge) {
    avatarBadge.addEventListener('click', () => {
      if (currentSession.isLoggedIn) {
        window.location.href = '/account';
      } else {
        window.location.href = '/login';
      }
    });
  }
}

async function checkActiveSession() {
  const token = localStorage.getItem('token');
  clearServicesCache();

  if (!token) {
    currentSession = {
      isLoggedIn: false,
      username: "anonymous",
      role: "GUEST",
      nodeId: "#OFFLINE",
      avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=off"
    };
    applyUserSession(currentSession);
    await renderServicesFromBackend();
    appendTerminalLog(`[AUTH_REQUIRED] No active JWT bearer token found.`, true);
    return;
  }

  try {
    const res = await fetch('/api/users/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();

    if (res.ok && result.status === 'success') {
      const u = result.data.user;
      currentSession = {
        isLoggedIn: true,
        username: u.user_name,
        role: (u.relation || 'USER').toUpperCase(),
        nodeId: `#${u.id ? String(u.id).slice(0, 4) : '8921'}-X`,

        avatar: u.profile_pic_path ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${u.user_name}`,

        avatar_type: u.avatar_type || 'photo',
        avatar_data: u.avatar_data || {},
        profile_pic_path: u.profile_pic_path || null
      };
      applyUserSession(currentSession);
      await renderServicesFromBackend();
      appendTerminalLog(`[AUTH] Session validated: ${currentSession.username} [${currentSession.role}]`, true);
    } else {
      throw new Error();
    }
  } catch (err) {
    localStorage.removeItem('token');
    clearServicesCache();
    currentSession = {
      isLoggedIn: false,
      username: "anonymous",
      role: "GUEST",
      nodeId: "#EXPIRED",
      avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=off"
    };
    applyUserSession(currentSession);
    await renderServicesFromBackend();
    appendTerminalLog(`[AUTH_EXPIRED] Session token expired. Please login again.`, true);
  }
}

export function applyUserSession(user) {
  const nameEl = document.getElementById('lblUsername');
  const roleEl = document.getElementById('lblRole');
  const sessionEl = document.getElementById('lblSessionId');
  const statusEl = document.getElementById('lblStatus');
  const promptEl = document.getElementById('lblCliPrompt');

  if (nameEl) nameEl.textContent = user.username;
  if (roleEl) roleEl.textContent = user.role;
  if (sessionEl) sessionEl.textContent = user.nodeId;
  const avatarEl = document.getElementById('userAvatar');

  if (avatarEl) {
    // Eski img ise global avatar container'a dönüştür
    if (avatarEl.tagName === 'IMG') {
      const container = document.createElement('div');

      container.id = avatarEl.id;
      container.className = avatarEl.className;
      container.dataset.avatar = '';
      container.dataset.avatarSize = '64';

      avatarEl.replaceWith(container);
    }

    const globalAvatar = document.getElementById('userAvatar');

    if (globalAvatar && currentSession.isLoggedIn) {
      renderAvatar(globalAvatar, {
        user_name: user.username,
        avatar_type: user.avatar_type || 'photo',
        avatar_data: user.avatar_data || {},
        profile_pic_path: user.profile_pic_path || user.avatar
      }, {
        size: 64
      });
    }
  }

  if (!user.isLoggedIn) {
    if (statusEl) { statusEl.textContent = 'OFFLINE'; statusEl.className = 'status-offline'; }
    if (promptEl) promptEl.textContent = `guest@cluster:~$`;
  } else {
    if (statusEl) { statusEl.textContent = 'HEALTHY'; statusEl.className = 'status-online'; }
    if (promptEl) promptEl.textContent = `${user.username}@cluster:~$`;
  }

  const guiAvatar = document.getElementById('guiUserAvatar');
  const guiName = document.getElementById('guiLblUsername');
  const guiRole = document.getElementById('guiLblRole');
  const guiSession = document.getElementById('guiLblSession');
  const guiStatus = document.getElementById('guiLblStatus');
  const guiDot = document.getElementById('guiStatusDot');
  const guiActionsBar = document.getElementById('guiActionsBar');

  if (guiAvatar && user.isLoggedIn) {
    renderAvatar(guiAvatar, {
      user_name: user.username,
      avatar_type: user.avatar_type || 'photo',
      avatar_data: user.avatar_data || {},
      profile_pic_path: user.profile_pic_path || user.avatar
    }, {
      size: guiAvatar.dataset.avatarSize || 96
    });
  }
  if (guiRole) guiRole.textContent = user.role;
  if (guiSession) guiSession.textContent = user.nodeId;

  if (!user.isLoggedIn) {
    if (guiName) guiName.textContent = 'AUTHENTICATION_REQUIRED';
    if (guiStatus) guiStatus.textContent = 'UNAUTHENTICATED';
    if (guiDot) guiDot.className = 'gui-status-indicator offline';

    if (guiActionsBar) {
      guiActionsBar.innerHTML = `
        <button type="button" class="gui-action-btn primary" id="btnGuiGoLogin">🔑 Login to Node</button>
        <button type="button" class="gui-action-btn" id="btnGuiGoRegister">Register Account</button>
      `;
      document.getElementById('btnGuiGoLogin')?.addEventListener('click', () => window.location.href = '/login');
      document.getElementById('btnGuiGoRegister')?.addEventListener('click', () => window.location.href = '/login#register');
    }
  } else {
    if (guiName) guiName.textContent = user.username;
    if (guiStatus) guiStatus.textContent = 'ACTIVE';
    if (guiDot) guiDot.className = 'gui-status-indicator online';

    if (guiActionsBar) {
      guiActionsBar.innerHTML = `
        <button type="button" class="gui-action-btn primary" id="btnGuiGoAccount">⚙️ Account Console</button>
        <button type="button" class="gui-action-btn logout" id="btnGuiLogout">Logout</button>
      `;
      document.getElementById('btnGuiGoAccount')?.addEventListener('click', () => window.location.href = '/account');
      document.getElementById('btnGuiLogout')?.addEventListener('click', () => {
        localStorage.removeItem('token');
        clearServicesCache();
        window.location.reload();
      });
    }
  }
}

async function renderServicesFromBackend() {
  const servicesData = await loadServices(true);
  const core = servicesData?.core || [];
  const privileged = servicesData?.privileged || [];

  const coreContainer = document.getElementById('coreServices');
  const privContainer = document.getElementById('dynamicRoleFeatures');

  if (coreContainer) {
    coreContainer.innerHTML = '';

    if (core.length === 0) {
      coreContainer.innerHTML = `
        <div class="service-block maintenance-card" style="grid-column: 1 / -1;">
          <div class="block-header">
            <span class="tag">NO_SERVICES // 404</span>
            <span class="dot offline"></span>
          </div>
          <h3>Servis Listesi Boş</h3>
          <p>Mevcut yetki seviyeniz için tanımlı servis bulunmuyor. Lütfen yöneticiye danışınız.</p>
        </div>
      `;
    } else {
      core.forEach(service => {
        const isMaintenance = service.status === 'maintenance';
        const isLoginReq = service.status === 'login_required';

        const card = document.createElement('div');
        card.className = `service-block ${isMaintenance ? 'locked maintenance-mode' : ''}`;
        card.onclick = () => handleServiceClick(service);

        card.innerHTML = `
          <div class="block-header">
            <span class="tag">${service.tag}</span>
            <span class="dot ${isMaintenance ? 'offline' : 'online'}"></span>
          </div>
          <h3>${service.title}</h3>
          <p>${service.desc}</p>
          ${isMaintenance ? `
            <span class="status-sub-badge maintenance">🛠️ Under Maintenance</span>
          ` : (isLoginReq ? `
            <span class="status-sub-badge login-hint">🔑 Login Required</span>
          ` : '')}
        `;
        coreContainer.appendChild(card);
      });
    }
  }

  if (privContainer) {
    privContainer.innerHTML = '';

    if (!currentSession.isLoggedIn) {
      privContainer.innerHTML = `
        <div class="service-block login-cta-card" style="grid-column: 1 / -1; cursor: pointer;" onclick="window.location.href='/login'">
          <div class="block-header">
            <span class="tag">RESTRICTED_ACCESS</span>
            <span class="dot offline"></span>
          </div>
          <h3>🔒 Login to Activate More Features</h3>
          <p>Hesabınıza atanmış ekstra araçları ve yönetim modüllerini açmak için giriş yapın.</p>
        </div>
      `;
      return;
    }

    if (privileged.length === 0) {
      privContainer.innerHTML = `
        <div class="service-block" style="grid-column: 1 / -1; opacity: 0.6;">
          <div class="block-header">
            <span class="tag">NO_SCOPED_MODULES</span>
            <span class="dot online"></span>
          </div>
          <h3>No Extended Services Available</h3>
          <p>Mevcut rolünüz (${currentSession.role}) için atanmış ek ayrıcalıklı servis bulunmuyor.</p>
        </div>
      `;
      return;
    }

    privileged.forEach(service => {
      const isMaintenance = service.status === 'maintenance';
      const card = document.createElement('div');
      card.className = `service-block ${isMaintenance ? 'locked maintenance-mode' : ''}`;
      card.onclick = () => handleServiceClick(service);

      card.innerHTML = `
        <div class="block-header">
          <span class="tag">${service.tag}</span>
          <span class="dot ${isMaintenance ? 'offline' : 'online'}"></span>
        </div>
        <h3>${service.title}</h3>
        <p>${service.desc}</p>
        ${isMaintenance ? `<span class="status-sub-badge maintenance">🛠️ Under Maintenance</span>` : ''}
      `;
      privContainer.appendChild(card);
    });
  }
}

// Terminal Komut Yöneticisi
function initCliAuth() {
  const form = document.getElementById('cliForm');
  const input = document.getElementById('cliInput');
  if (!form || !input) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawCmd = input.value.trim();
    if (!rawCmd) return;
    input.value = '';

    appendTerminalLog(`$ ${rawCmd}`);

    const parts = rawCmd.split(' ').filter(Boolean);
    const action = parts[0].toLowerCase();

    if (action === 'login') {
      if (parts[1] === '-a' || parts[1] === '--auto') {
        appendTerminalLog(`[AUTH] Redirecting to login portal...`);
        window.location.href = '/login';
        return;
      }

      if (parts.length >= 3) {
        const username = parts[1];
        const password = parts.slice(2).join(' ');

        appendTerminalLog(`[AUTH] Authenticating as '${username}'...`);

        try {
          const res = await fetch('/api/users/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_name: username, password: password })
          });
          const data = await res.json();

          if (res.ok && data.token) {
            localStorage.setItem('token', data.token);
            appendTerminalLog(`[AUTH_OK] Welcome, ${username}! Refreshing telemetry...`, true);
            await checkActiveSession();
            startLiveFriendsSpotifySync();
          } else {
            appendTerminalLog(`[AUTH_ERR] ${data.message || 'Invalid username or password.'}`, true);
          }
        } catch (err) {
          appendTerminalLog(`[AUTH_ERR] Connection failed: ${err.message}`, true);
        }
        return;
      }

      window.location.href = '/login';
    }
    else if (action === 'account') {
      if (!currentSession.isLoggedIn) {
        appendTerminalLog(`[AUTH_ERR] Login required to open account console.`, true);
      } else {
        window.location.href = '/account';
      }
    }
    else if (action === 'logout') {
      localStorage.removeItem('token');
      clearServicesCache();
      appendTerminalLog(`[AUTH] Session terminated. Redirecting...`);
      setTimeout(() => window.location.reload(), 400);
    }
    else if (action === 'clear') {
      const history = document.getElementById('terminalHistory');
      if (history) history.innerHTML = '';
      appendTerminalLog(`[TERMINAL] Buffer cleared.`);
    }
    else if (action === 'help') {
      appendTerminalLog(`COMMANDS:`);
      appendTerminalLog(`  login <username> <password>  Direct terminal authentication`);
      appendTerminalLog(`  login -a                     Open graphical login portal`);
      appendTerminalLog(`  account                      Open account settings`);
      appendTerminalLog(`  whoami                       Display current node session`);
      appendTerminalLog(`  logout                       Terminate cluster session`);
      appendTerminalLog(`  clear                        Clear terminal screen`);
    }
    else if (action === 'whoami') {
      appendTerminalLog(`USER: ${currentSession.username} | ROLE: ${currentSession.role} | NODE: ${currentSession.nodeId}`);
    }
    else {
      appendTerminalLog(`[ERR] Command not found: ${action}. Type 'help' for available commands.`);
    }
  });
}

function initTimestamps() {
  const updateTimes = () => {
    const now = new Date();
    const formatOffset = (sec) => {
      const d = new Date(now.getTime() - sec * 1000);
      return d.toTimeString().split(' ')[0];
    };

    const t1 = document.getElementById('logTime1');
    const t2 = document.getElementById('logTime2');
    const t3 = document.getElementById('logTime3');
    const t4 = document.getElementById('logTime4');

    if (t1) t1.textContent = formatOffset(15);
    if (t2) t2.textContent = formatOffset(12);
    if (t3) t3.textContent = formatOffset(7);
    if (t4) t4.textContent = formatOffset(2);
  };

  updateTimes();
  setInterval(updateTimes, 5000);
}

function initScrollOpacityController() {
  const bgLayer = document.getElementById('bgGridLayer');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 80) {
      bgLayer?.classList.add('scrolled-down');
    } else {
      bgLayer?.classList.remove('scrolled-down');
    }
  });
}

function scrollToTerminalBottom() {
  const history = document.getElementById('terminalHistory');
  if (history) {
    history.scrollTop = history.scrollHeight;
  }
}

export function appendTerminalLog(text, isHighlight = false) {
  const history = document.getElementById('terminalHistory');
  if (!history) return;

  const now = new Date().toTimeString().split(' ')[0];
  const div = document.createElement('div');
  div.className = 'log-entry';
  div.innerHTML = `<span class="log-time">${now}</span> ${isHighlight ? `<span class="highlight">${text}</span>` : text}`;

  history.appendChild(div);
  scrollToTerminalBottom();
}

function initLiveTelemetrySimulation() {
  const restEl = document.getElementById('metricRest');
  const poolEl = document.getElementById('metricPool');
  const poolBar = document.getElementById('poolBar');
  const ramEl = document.getElementById('metricRam');
  const ramBar = document.getElementById('ramBar');

  setInterval(() => {
    if (restEl) {
      const jitter = Math.floor(140 + Math.random() * 25);
      restEl.textContent = jitter;
    }

    if (poolEl && poolBar) {
      const activeConn = Math.floor(3 + Math.random() * 5);
      poolEl.textContent = `${activeConn} / 20`;
      poolBar.style.width = `${(activeConn / 20) * 100}%`;
    }

    if (ramEl && ramBar) {
      const ramUsage = Math.floor(300 + Math.random() * 30);
      ramEl.textContent = ramUsage;
      ramBar.style.width = `${(ramUsage / 1024) * 100}%`;
    }
  }, 3000);
}

// Spotify Arkadaş Aktivitesi Canlı Takip Motoru
function startLiveFriendsSpotifySync() {
  if (friendActivityPollTimer) clearInterval(friendActivityPollTimer);

  const fetchActivity = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch('/api/spotify/friends-activity', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;

      const result = await res.json();
      const activeFriends = (result.data || []).filter(item => item.isPlaying && item.albumArt);

      if (activeFriends.length > 0) {
        const randomFriend = activeFriends[Math.floor(Math.random() * activeFriends.length)];
        currentActiveFriendActivity = randomFriend;
      } else {
        currentActiveFriendActivity = null;
      }

      renderCurrentGrid();
    } catch (err) {
      console.warn('Spotify friend activity polling offline:', err);
    }
  };

  fetchActivity();
  friendActivityPollTimer = setInterval(fetchActivity, 15000);
}

function renderCurrentGrid() {
  if (currentGridBlueprint && currentGridMeta) {
    drawFixedGrid(currentGridBlueprint, currentGridMeta);
  }
}

function initResponsiveFixedGrid() {
  const render = () => {
    const width = window.innerWidth;
    if (width < 768) {
      renderMobileGrid();
    } else if (width < 1200) {
      renderTabletGrid();
    } else {
      renderDesktopGrid();
    }
  };

  render();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 150);
  });
}

function renderDesktopGrid() {
  currentGridBlueprint = [
    [0, 1, 2, 1, 2, 1, 1],
    [0, 0, 1, 1, 2, 2],
    [0, 0, 1, 2, 1, 1],
    [0, 0, 0, 2, 1],
    [0, 0, 0, 1, 2],
    [0, 0, 0, 0, 1]
  ];

  currentGridMeta = {
    "0-4": { tag: "▲ REST_GATEWAY", dot: true },
    "1-5": { tag: "▼ DB_CLUSTER", dot: false },
    "3-3": { tag: "▲ REALTIME", dot: true }
  };

  drawFixedGrid(currentGridBlueprint, currentGridMeta);
}

function renderTabletGrid() {
  currentGridBlueprint = [
    [0, 1, 2, 1, 1],
    [0, 0, 2, 2],
    [0, 0, 1, 2],
    [0, 0, 0, 1]
  ];

  currentGridMeta = {
    "0-2": { tag: "▲ REST", dot: true }
  };

  drawFixedGrid(currentGridBlueprint, currentGridMeta);
}

function renderMobileGrid() {
  currentGridBlueprint = [
    [0, 1, 2, 1],
    [0, 2, 2],
    [0, 1, 2]
  ];

  currentGridMeta = {};
  drawFixedGrid(currentGridBlueprint, currentGridMeta);
}

// Akıllı Çift Kareli (Dual-Tile) Spotify Izgara Çizimi
function drawFixedGrid(blueprint, meta) {
  const container = document.getElementById('cornerGrid');
  if (!container) return;

  container.innerHTML = '';

  let spotifyArtKey = null;
  let spotifyInfoKey = null;

  if (currentActiveFriendActivity) {
    const pairCandidates = [];

    blueprint.forEach((row, rIdx) => {
      for (let cIdx = 0; cIdx < row.length - 1; cIdx++) {
        if (row[cIdx] !== 0 && row[cIdx + 1] !== 0) {
          const priority = (rIdx >= 1 && rIdx <= 3) ? 2 : 1;
          pairCandidates.push({ rIdx, cIdx, priority });
        }
      }
    });

    if (pairCandidates.length > 0) {
      const highPriorityPairs = pairCandidates.filter(p => p.priority === 2);
      const chosenPair = highPriorityPairs.length > 0
        ? highPriorityPairs[Math.floor(Math.random() * highPriorityPairs.length)]
        : pairCandidates[Math.floor(Math.random() * pairCandidates.length)];

      spotifyArtKey = `${chosenPair.rIdx}-${chosenPair.cIdx}`;
      spotifyInfoKey = `${chosenPair.rIdx}-${chosenPair.cIdx + 1}`;
    }
  }

  blueprint.forEach((row, rIdx) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'corner-row';

    row.forEach((cellType, cIdx) => {
      const cell = document.createElement('div');
      const metaKey = `${rIdx}-${cIdx}`;

      // Albüm Kapağı Karesi
      if (metaKey === spotifyArtKey && currentActiveFriendActivity) {
        const act = currentActiveFriendActivity;
        cell.className = 'corner-unit solid-box spotify-art-tile';
        cell.style.backgroundImage = `url('${act.albumArt}')`;
        cell.title = `Spotify: ${act.title} - ${act.artist}`;
        cell.onclick = () => { if (act.songUrl) window.open(act.songUrl, '_blank'); };

        cell.innerHTML = `
          <div class="spotify-art-badge">
            <svg viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.516 17.307c-.217.356-.677.469-1.033.252-2.83-1.73-6.393-2.12-10.589-1.162-.408.093-.811-.161-.904-.569-.093-.408.161-.811.569-.904 4.582-1.047 8.528-.602 11.705 1.35.356.217.469.677.252 1.033zm1.474-3.273c-.273.444-.855.586-1.299.313-3.238-1.99-8.175-2.566-12.006-1.403-.497.151-1.026-.134-1.177-.631-.151-.497.134-1.026.631-1.177 4.383-1.33 9.824-.693 13.538 1.599.444.273.586.855.313 1.299zm.126-3.41c-3.882-2.305-10.285-2.518-13.992-1.392-.596.181-1.228-.157-1.409-.753-.181-.596.157-1.228.753-1.409 4.258-1.293 11.328-1.044 15.807 1.615.536.318.712 1.012.394 1.548-.318.536-1.012.712-1.548.394z"/></svg>
            <span>LIVE</span>
          </div>
          <div class="spotify-art-eq">
            <span></span><span></span><span></span>
          </div>
        `;
      }
      // Yanındaki Kullanıcı ve Şarkı Bilgi Karesi
      else if (metaKey === spotifyInfoKey && currentActiveFriendActivity) {
        const act = currentActiveFriendActivity;
        cell.className = 'corner-unit solid-box spotify-info-tile';
        cell.title = `Listening: ${act.title} - ${act.artist}`;
        cell.onclick = () => { if (act.songUrl) window.open(act.songUrl, '_blank'); };

        cell.innerHTML = `
          <div class="sp-info-header">
            <span class="sp-info-tag">NOW PLAYING</span>
            <span class="sp-pulse-dot"></span>
          </div>
          <div class="sp-user-block">
            <span class="sp-user-label">USER</span>
            <div class="sp-user-name">${act.username}</div>
          </div>
          <div class="sp-track-block">
            <span class="sp-song-title">${act.title}</span>
            <span class="sp-artist-name">${act.artist || 'Spotify'}</span>
          </div>
        `;
      }
      // Standart Bloklar
      else {
        if (cellType === 0) {
          cell.className = 'corner-unit spacer';
        } else if (cellType === 1) {
          cell.className = 'corner-unit wireframe';
        } else if (cellType === 2) {
          cell.className = 'corner-unit solid-box';
          if (meta[metaKey]) {
            cell.innerHTML = `
              <span class="subtle-tag">${meta[metaKey].tag}</span>
              ${meta[metaKey].dot ? '<span class="subtle-dot"></span>' : ''}
            `;
          }
        }
      }

      rowEl.appendChild(cell);
    });

    container.appendChild(rowEl);
  });
}