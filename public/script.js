// public/script.js
import { ThemeManager } from './themes/theme-registry.js';

export let currentSession = {
  isLoggedIn: false,
  username: "anonymous",
  role: "GUEST",
  nodeId: "#OFFLINE",
  avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=off"
};

document.addEventListener('DOMContentLoaded', async () => {
  initTimestamps();
  initResponsiveFixedGrid();
  initCliAuth();
  initLiveTelemetrySimulation();
  initScrollOpacityController();

  // Modüler Theme Manager
  new ThemeManager();

  // Gerçek Oturum Kontrolü
  await checkActiveSession();
  scrollToTerminalBottom();
});

// Gerçek JWT Oturum Denetimi
async function checkActiveSession() {
  const token = localStorage.getItem('token');

  if (!token) {
    currentSession = {
      isLoggedIn: false,
      username: "anonymous",
      role: "GUEST",
      nodeId: "#OFFLINE",
      avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=off"
    };
    applyUserSession(currentSession);
    lockdownServices();
    appendTerminalLog(`[AUTH_REQUIRED] No active JWT bearer token found.`, true);
    appendTerminalLog(`[NOTICE] Features are locked. Type 'login' or use the interface buttons to authenticate.`);
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
        nodeId: `#${u.id?.slice ? u.id.slice(0, 4) : '8921'}-X`,
        avatar: u.profile_pic_path || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.user_name}`
      };
      applyUserSession(currentSession);
      unlockServices();
      appendTerminalLog(`[AUTH] Session validated: ${currentSession.username} [${currentSession.role}]`, true);
    } else {
      throw new Error();
    }
  } catch (err) {
    localStorage.removeItem('token');
    currentSession = {
      isLoggedIn: false,
      username: "anonymous",
      role: "GUEST",
      nodeId: "#EXPIRED",
      avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=off"
    };
    applyUserSession(currentSession);
    lockdownServices();
    appendTerminalLog(`[AUTH_EXPIRED] Session token expired. Type 'login' to reconnect.`, true);
  }
}

export function applyUserSession(user) {
  // 1. CLI Elemanları
  const nameEl = document.getElementById('lblUsername');
  const roleEl = document.getElementById('lblRole');
  const sessionEl = document.getElementById('lblSessionId');
  const statusEl = document.getElementById('lblStatus');
  const avatarEl = document.getElementById('userAvatar');
  const promptEl = document.getElementById('lblCliPrompt');

  if (nameEl) nameEl.textContent = user.username;
  if (roleEl) roleEl.textContent = user.role;
  if (sessionEl) sessionEl.textContent = user.nodeId;
  if (avatarEl) avatarEl.src = user.avatar;

  if (!user.isLoggedIn) {
    if (statusEl) { statusEl.textContent = 'OFFLINE'; statusEl.className = 'status-offline'; }
    if (promptEl) promptEl.textContent = `guest@cluster:~$`;
  } else {
    if (statusEl) { statusEl.textContent = 'HEALTHY'; statusEl.className = 'status-online'; }
    if (promptEl) promptEl.textContent = `${user.username}@cluster:~$`;
  }

  // 2. GUI Paneli Elemanları
  const guiAvatar = document.getElementById('guiUserAvatar');
  const guiName = document.getElementById('guiLblUsername');
  const guiRole = document.getElementById('guiLblRole');
  const guiSession = document.getElementById('guiLblSession');
  const guiStatus = document.getElementById('guiLblStatus');
  const guiDot = document.getElementById('guiStatusDot');
  const guiActionsBar = document.getElementById('guiActionsBar');

  if (guiAvatar) guiAvatar.src = user.avatar;
  if (guiRole) guiRole.textContent = user.role;
  if (guiSession) guiSession.textContent = user.nodeId;

  if (!user.isLoggedIn) {
    if (guiName) guiName.textContent = 'AUTHENTICATION_REQUIRED';
    if (guiStatus) guiStatus.textContent = 'UNAUTHENTICATED';
    if (guiDot) guiDot.className = 'gui-status-indicator offline';

    // Logged Out Butonları
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

    // Logged In Butonları
    if (guiActionsBar) {
      guiActionsBar.innerHTML = `
        <button type="button" class="gui-action-btn primary" id="btnGuiGoAccount">⚙️ Account Console</button>
        <button type="button" class="gui-action-btn logout" id="btnGuiLogout">Logout</button>
      `;
      document.getElementById('btnGuiGoAccount')?.addEventListener('click', () => window.location.href = '/account');
      document.getElementById('btnGuiLogout')?.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.reload();
      });
    }
  }

  renderDynamicModules(user.role, user.isLoggedIn);
}

function lockdownServices() {
  const blocks = document.querySelectorAll('#coreServices .service-block');
  blocks.forEach(block => {
    block.classList.add('locked');
    block.onclick = (e) => {
      e.preventDefault();
      alert('🔒 Authentication Required! Please log in to access this cluster module.');
      window.location.href = '/login';
    };
  });
}

function unlockServices() {
  const coreRoutes = {
    'Device Manager': '/remote-control',
    'Song Share': '/song-share',
    'File Storage': '/file-storage'
  };

  const blocks = document.querySelectorAll('#coreServices .service-block');
  blocks.forEach(block => {
    const title = block.querySelector('h3')?.textContent.trim();
    if (coreRoutes[title]) {
      block.classList.remove('locked');
      block.onclick = () => window.location.href = coreRoutes[title];
    }
  });
}

function renderDynamicModules(role, isLoggedIn) {
  const container = document.getElementById('dynamicRoleFeatures');
  if (!container) return;

  if (!isLoggedIn) {
    container.innerHTML = `
      <div class="service-block locked" style="grid-column: 1 / -1;" onclick="window.location.href='/login'">
        <div class="block-header">
          <span class="tag">RESTRICTED_ACCESS</span>
          <span class="dot offline"></span>
        </div>
        <h3>Privileged Services Locked</h3>
        <p>Authenticate with an authorized bearer token to reveal scoped telemetry modules and hardware routing.</p>
      </div>
    `;
    return;
  }

  const modules = [
    {
      title: "System Metrics",
      desc: "PostgreSQL pool, thread allocation, CPU load, and socket telemetry.",
      tag: "ADMIN_METRICS",
      minRole: "ADMIN",
      route: "/admin/metrics"
    },
    {
      title: "Device Provisioning",
      desc: "OTA flashes and configuration maps for ESP32 and Matrix displays.",
      tag: "HW_DISCOVERY",
      minRole: "ADMIN",
      route: "/admin/devices"
    },
    {
      title: "Account Settings & Vault",
      desc: "Identity parameters, 2D avatar vault, and JWT token rotation.",
      tag: "USER_META",
      minRole: "USER",
      route: "/account"
    }
  ];

  container.innerHTML = '';
  modules.forEach(mod => {
    const hasAccess = (role === 'ADMIN') || (mod.minRole === 'USER' && (role === 'USER' || role === 'ADMIN'));
    if (hasAccess) {
      const card = document.createElement('div');
      card.className = 'service-block';
      card.onclick = () => window.location.href = mod.route;
      card.innerHTML = `
        <div class="block-header">
          <span class="tag">${mod.tag}</span>
          <span class="dot online"></span>
        </div>
        <h3>${mod.title}</h3>
        <p>${mod.desc}</p>
      `;
      container.appendChild(card);
    }
  });
}

function initCliAuth() {
  const form = document.getElementById('cliForm');
  const input = document.getElementById('cliInput');
  if (!form || !input) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const cmd = input.value.trim();
    if (!cmd) return;
    input.value = '';

    appendTerminalLog(`$ ${cmd}`);

    const parts = cmd.split(' ');
    const action = parts[0].toLowerCase();

    if (action === 'login') {
      window.location.href = '/login';
    } else if (action === 'account') {
      if (!currentSession.isLoggedIn) {
        appendTerminalLog(`[AUTH_ERR] Login required to open account console.`, true);
      } else {
        window.location.href = '/account';
      }
    } else if (action === 'logout') {
      localStorage.removeItem('token');
      appendTerminalLog(`[AUTH] Session terminated. Redirecting...`);
      setTimeout(() => window.location.reload(), 400);
    } else if (action === 'clear') {
      const history = document.getElementById('terminalHistory');
      if (history) history.innerHTML = '';
      appendTerminalLog(`[TERMINAL] Buffer cleared.`);
    } else if (action === 'help') {
      appendTerminalLog(`COMMANDS: login, account, logout, whoami, clear`);
    } else if (action === 'whoami') {
      appendTerminalLog(`USER: ${currentSession.username} | ROLE: ${currentSession.role} | NODE: ${currentSession.nodeId}`);
    } else {
      appendTerminalLog(`[ERR] Command not found: ${action}. Type 'help' for commands.`);
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
  const desktopBlueprint = [
    [0, 1, 2, 1, 2, 1, 1],
    [0, 0, 1, 1, 2, 2],
    [0, 0, 1, 2, 1, 1],
    [0, 0, 0, 2, 1],
    [0, 0, 0, 1, 2],
    [0, 0, 0, 0, 1]
  ];

  const meta = {
    "0-4": { tag: "▲ REST_GATEWAY", dot: true },
    "1-5": { tag: "▼ DB_CLUSTER", dot: false },
    "3-3": { tag: "▲ REALTIME", dot: true }
  };

  drawFixedGrid(desktopBlueprint, meta);
}

function renderTabletGrid() {
  const tabletBlueprint = [
    [0, 1, 2, 1, 1],
    [0, 0, 2, 2],
    [0, 0, 1, 2],
    [0, 0, 0, 1]
  ];

  const meta = {
    "0-2": { tag: "▲ REST", dot: true }
  };

  drawFixedGrid(tabletBlueprint, meta);
}

function renderMobileGrid() {
  const mobileBlueprint = [
    [0, 1, 2, 1],
    [0, 2, 2],
    [0, 1, 2]
  ];

  drawFixedGrid(mobileBlueprint, {});
}

function drawFixedGrid(blueprint, meta) {
  const container = document.getElementById('cornerGrid');
  if (!container) return;

  container.innerHTML = '';

  blueprint.forEach((row, rIdx) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'corner-row';

    row.forEach((cellType, cIdx) => {
      const cell = document.createElement('div');

      if (cellType === 0) {
        cell.className = 'corner-unit spacer';
      } else if (cellType === 1) {
        cell.className = 'corner-unit wireframe';
      } else if (cellType === 2) {
        cell.className = 'corner-unit solid-box';

        const metaKey = `${rIdx}-${cIdx}`;
        if (meta[metaKey]) {
          cell.innerHTML = `
            <span class="subtle-tag">${meta[metaKey].tag}</span>
            ${meta[metaKey].dot ? '<span class="subtle-dot"></span>' : ''}
          `;
        }
      }

      rowEl.appendChild(cell);
    });

    container.appendChild(rowEl);
  });
}