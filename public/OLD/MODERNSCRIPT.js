// Mock User Directory
const MOCK_USERS = {
  onur: {
    username: "onur",
    role: "ADMIN",
    nodeId: "#8921-X",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80"
  },
  guest: {
    username: "guest_user",
    role: "GUEST",
    nodeId: "#1044-G",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
  }
};

let currentSession = { ...MOCK_USERS.onur };

document.addEventListener('DOMContentLoaded', () => {
  initTimestamps();
  initThemeManager();
  initResponsiveFixedGrid();
  initCliAuth();
  initLiveTelemetrySimulation();
  initScrollOpacityController();

  applyUserSession(currentSession);
  scrollToTerminalBottom();
});

// Canlı Log Zaman Damgaları
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

// Sayfa Kaydırıldıkça Arka Plan Izgarasının Opaklığını Kısma
function initScrollOpacityController() {
  const bgLayer = document.getElementById('bgGridLayer');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 80) {
      bgLayer.classList.add('scrolled-down');
    } else {
      bgLayer.classList.remove('scrolled-down');
    }
  });
}

function scrollToTerminalBottom() {
  const history = document.getElementById('terminalHistory');
  if (history) {
    history.scrollTop = history.scrollHeight;
  }
}

function appendTerminalLog(text, isHighlight = false) {
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

function initCliAuth() {
  const form = document.getElementById('cliForm');
  const input = document.getElementById('cliInput');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const cmd = input.value.trim();
    if (!cmd) return;
    input.value = '';

    appendTerminalLog(`$ ${cmd}`);

    const parts = cmd.split(' ');
    const action = parts[0].toLowerCase();
    const arg = parts[1] ? parts[1].toLowerCase() : null;

    if (action === 'login') {
      if (arg === 'onur' || arg === 'admin') {
        execDemoLogin('onur', 'ADMIN');
        appendTerminalLog(`[AUTH] Switched session to onur (ADMIN)`, true);
      } else if (arg) {
        execDemoLogin(arg, 'GUEST');
        appendTerminalLog(`[AUTH] Switched session to ${arg} (GUEST)`, true);
      } else {
        appendTerminalLog(`[ERR] Username required -> e.g. login onur or login guest`);
      }
    } else if (action === 'logout') {
      execDemoLogout();
      appendTerminalLog(`[AUTH] Session terminated. Switched to anonymous.`);
    } else if (action === 'clear') {
      const history = document.getElementById('terminalHistory');
      if (history) history.innerHTML = '';
      appendTerminalLog(`[TERMINAL] Buffer cleared.`);
    } else if (action === 'help') {
      appendTerminalLog(`COMMANDS: login &lt;user&gt;, logout, whoami, clear`);
    } else if (action === 'whoami') {
      appendTerminalLog(`USER: ${currentSession.username} | ROLE: ${currentSession.role} | NODE: ${currentSession.nodeId}`);
    } else {
      appendTerminalLog(`[ERR] Command not found: ${action}. Type 'help' for commands.`);
    }
  });
}

function execDemoLogin(username, role = 'USER') {
  currentSession = {
    username: username,
    role: role,
    nodeId: "#" + Math.floor(1000 + Math.random() * 9000) + "-X",
    avatar: username.toLowerCase() === 'onur' 
      ? MOCK_USERS.onur.avatar 
      : `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`
  };

  applyUserSession(currentSession);
}

function execDemoLogout() {
  currentSession = {
    username: "anonymous",
    role: "GUEST",
    nodeId: "#OFFLINE",
    avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=off"
  };

  applyUserSession(currentSession);
}

function applyUserSession(user) {
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
  if (promptEl) promptEl.textContent = `${user.username}@cluster:~$`;

  if (statusEl) {
    if (user.username === 'anonymous') {
      statusEl.textContent = 'UNAUTHENTICATED';
      statusEl.className = 'status-offline';
    } else {
      statusEl.textContent = 'HEALTHY';
      statusEl.className = 'status-online';
    }
  }

  renderDynamicModules(user.role);
}

function renderDynamicModules(role) {
  const container = document.getElementById('dynamicRoleFeatures');
  if (!container) return;

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
      title: "Personal Bookmarks",
      desc: "Achievement checklists and local development quick-links.",
      tag: "USER",
      minRole: "USER",
      route: "/user/bookmarks"
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

function initThemeManager() {
  const toggleBtn = document.getElementById('themeToggleBtn');
  const themeMenu = document.getElementById('themeMenu');
  const themeLabel = document.getElementById('currentThemeName');
  const options = document.querySelectorAll('.theme-option');

  const savedTheme = localStorage.getItem('app-theme') || 'supabase-dark';
  setTheme(savedTheme);

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    themeMenu.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    themeMenu.classList.remove('show');
  });

  options.forEach(opt => {
    opt.addEventListener('click', () => {
      const theme = opt.dataset.theme;
      setTheme(theme);
      localStorage.setItem('app-theme', theme);
    });
  });

  function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    themeLabel.textContent = `THEME: ${themeName.toUpperCase().replace('-', '_')}`;
    options.forEach(opt => opt.classList.toggle('active', opt.dataset.theme === themeName));
  }
}