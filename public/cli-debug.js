// public/cli-debug.js
// Friendly command palette + read-only backend diagnostics for the MainRoadmap2 console.
(() => {
  const $ = (id) => document.getElementById(id);
  const output = () => $('cliDebugOutput');
  const token = () => {
    const value = (localStorage.getItem('token') || '').replace(/^["']|["']$/g, '').trim();
    return value.startsWith('Bearer ') ? value.slice(7).trim() : value;
  };

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function write(message, type = 'info') {
    const target = output();
    if (!target) return;
    const row = document.createElement('div');
    row.className = `cli-debug-line is-${type}`;
    row.textContent = message;
    target.appendChild(row);
    target.scrollTop = target.scrollHeight;
  }

  function pretty(value) {
    try { return JSON.stringify(value, null, 2); }
    catch { return String(value); }
  }

  async function request(label, path, options = {}) {
    const started = performance.now();
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    const jwt = token();
    if (jwt) headers.Authorization = `Bearer ${jwt}`;

    write(`▶ ${label} · ${options.method || 'GET'} ${path}`, 'info');
    try {
      const response = await fetch(path, {
        method: options.method || 'GET',
        headers,
        signal: AbortSignal.timeout(10000)
      });
      const elapsed = Math.round(performance.now() - started);
      const contentType = response.headers.get('content-type') || '';
      let body;
      if (contentType.includes('application/json')) {
        body = await response.json();
      } else {
        body = await response.text();
        if (body.length > 1800) body = body.slice(0, 1800) + '\n… (response truncated)';
      }

      write(`${response.ok ? '✓' : '!'} HTTP ${response.status} · ${elapsed} ms · ${label}`,
        response.ok ? 'success' : 'warn');
      const detail = document.createElement('pre');
      detail.className = 'cli-debug-json';
      detail.textContent = pretty(body);
      output()?.appendChild(detail);
      if (output()) output().scrollTop = output().scrollHeight;
      return { ok: response.ok, status: response.status, elapsed, body };
    } catch (error) {
      const elapsed = Math.round(performance.now() - started);
      write(`✕ ${label} · ${error.name === 'TimeoutError' ? 'Request timed out (10 s)' : error.message}`,
        'error');
      return { ok: false, elapsed, error: error.message };
    }
  }

  async function runCheck(id) {
    if (id === 'api-health') {
      // This app currently has no dedicated /health route, so test an existing public endpoint.
      await request('Public route /login', '/login');
    } else if (id === 'services') {
      await request('Services API (read-only)', '/api/services');
    } else if (id === 'session') {
      if (!token()) {
        write('No login token found. Sign in to test the protected profile endpoint.', 'warn');
        return;
      }
      await request('Current user profile', '/api/users/profile');
    } else if (id === 'debug') {
      if (!token()) {
        write('Login required: /api/debug is protected.', 'warn');
        return;
      }
      await request('Debug endpoint (read-only)', '/api/debug');
    } else if (id === 'logs') {
      if (!token()) {
        write('Login as an administrator to read server logs.', 'warn');
        return;
      }
      await request('Recent server logs (admin only)', '/api/admin/logs?limit=30');
    } else if (id === 'routes') {
      await request('Registered routes manifest', '/api/routes-manifest');
    } else if (id === 'all') {
      await request('Public route /login', '/login');
      await request('Services API', '/api/services');
      if (token()) await request('Current user profile', '/api/users/profile');
      else write('Skipped profile check: no active token.', 'warn');
    }
  }

  const commandMap = {
    help: () => {
      write('Quick actions: status, api test, services, whoami, account, logs, logs stop, clear, help', 'info');
      write('Tip: use the buttons below; commands are optional.', 'info');
    },
    status: () => runCheck('all'),
    'api test': () => runCheck('api-health'),
    services: () => runCheck('services'),
    whoami: () => {
      const name = $('lblUsername')?.textContent || 'anonymous';
      const role = $('lblRole')?.textContent || 'GUEST';
      const node = $('lblSessionId')?.textContent || '#OFFLINE';
      write(`USER: ${name} · ROLE: ${role} · NODE: ${node}`, 'success');
    },
    account: () => {
      if (!token()) {
        write('Login is required. Opening the login page…', 'warn');
        window.location.href = '/login';
      } else window.location.href = '/account';
    },
    logs: () => runCheck('logs'),
    'logs stop': () => document.dispatchEvent(new CustomEvent('cli-debug-stop-logs')),
    clear: () => { if (output()) output().replaceChildren(); },
    routes: () => runCheck('routes')
  };

  document.addEventListener('DOMContentLoaded', () => {
    const panel = $('cliDebugPanel');
    if (!panel) return;

    panel.querySelectorAll('[data-cli-check]').forEach((button) => {
      button.addEventListener('click', () => runCheck(button.dataset.cliCheck));
    });

    $('cliDebugClearBtn')?.addEventListener('click', () => {
      if (output()) output().replaceChildren();
      write('Debug output cleared.', 'info');
    });

    $('cliInput')?.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowUp' && !event.shiftKey) {
        // Keep normal input behavior unless command history is added later.
      }
    });

    // Wire into the existing terminal without replacing its authentication logic.
    document.addEventListener('cli-command', (event) => {
      const command = String(event.detail || '').trim().toLowerCase();
      const handler = commandMap[command];
      if (handler) handler();
    });

    write('Console ready. Choose a diagnostic below or type help.', 'success');
  });

  // Expose a tiny bridge for the existing CLI module; this is not a general-purpose eval surface.
  window.MainRoadmapCliDebug = {
    run: (command) => {
      const handler = commandMap[String(command || '').trim().toLowerCase()];
      if (handler) {
        handler();
        return true;
      }
      return false;
    },
    check: runCheck
  };
})();
