// public/cli-debug.js
// Friendly command shortcuts and read-only diagnostics for the MainRoadmap2 console.
(() => {
  const $ = (id) => document.getElementById(id);
  const output = () => $('cliDebugOutput');

  function getToken() {
    const value = (localStorage.getItem('token') || '').replace(/^["']|["']$/g, '').trim();
    return value.startsWith('Bearer ') ? value.slice(7).trim() : value;
  }

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

  async function request(label, path) {
    const started = performance.now();
    const headers = { Accept: 'application/json' };
    const jwt = getToken();
    if (jwt) headers.Authorization = `Bearer ${jwt}`;

    write(`▶ ${label} · GET ${path}`, 'info');
    try {
      const response = await fetch(path, {
        method: 'GET',
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
      const message = error.name === 'TimeoutError'
        ? 'Request timed out after 10 seconds.'
        : (error.message || 'Network request failed.');
      write(`✕ ${label} · ${message} · ${elapsed} ms`, 'error');
      return { ok: false, elapsed, error: message };
    }
  }

  async function runCheck(id) {
    if (id === 'health') {
      await request('Backend + database health', '/api/debug/health');
    } else if (id === 'services') {
      await request('Services API (read-only)', '/api/services');
    } else if (id === 'session') {
      if (!getToken()) {
        write('Profile check skipped: sign in first to test the protected endpoint.', 'warn');
        return;
      }
      await request('Current user profile', '/api/users/profile');
    } else if (id === 'debug') {
      await request('Debug ping', '/api/debug');
    } else if (id === 'logs') {
      if (!getToken()) {
        write('Server logs require an administrator session.', 'warn');
        return;
      }
      await request('Recent server logs (admin only)', '/api/admin/logs?limit=30');
    } else if (id === 'all') {
      await request('Backend + database health', '/api/debug/health');
      await request('Services API (read-only)', '/api/services');
      await request('Debug ping', '/api/debug');
      if (getToken()) await request('Current user profile', '/api/users/profile');
      else write('Profile check skipped: no active login token.', 'warn');
    }
  }

  // Only add commands that are not already handled by the original console.
  const commandMap = {
    status: () => runCheck('all'),
    'api test': async () => {
      await runCheck('health');
      await runCheck('services');
    },
    'db test': () => runCheck('health'),
    services: () => runCheck('services'),
    'profile test': () => runCheck('session'),
    'debug test': () => runCheck('debug')
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

    write('Console ready. Use a quick action or type “help” for commands.', 'success');
  });

  // Small allow-listed bridge; never evaluates arbitrary user input.
  window.MainRoadmapCliDebug = {
    run(command) {
      const handler = commandMap[String(command || '').trim().toLowerCase()];
      if (!handler) return false;
      void handler();
      return true;
    },
    check: runCheck
  };
})();
