// public/cli-debug.js
// Allow-listed read-only diagnostics integrated into the existing CLI output.
(() => {
  function log(message, highlight = false) {
    if (typeof window.appendTerminalLog === 'function') {
      window.appendTerminalLog(String(message), highlight);
      return;
    }
    document.dispatchEvent(new CustomEvent('mainroadmap-cli-output', { detail: { message: String(message), highlight } }));
  }

  function getToken() {
    const value = (localStorage.getItem('token') || '').replace(/^["']|["']$/g, '').trim();
    return value.startsWith('Bearer ') ? value.slice(7).trim() : value;
  }

  async function request(label, path) {
    const started = performance.now();
    const headers = { Accept: 'application/json' };
    const jwt = getToken();
    if (jwt) headers.Authorization = 'Bearer ' + jwt;

    log('[TEST] ' + label + ' → GET ' + path);
    try {
      const response = await fetch(path, {
        method: 'GET',
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(10000)
      });
      const elapsed = Math.round(performance.now() - started);
      const type = response.headers.get('content-type') || '';
      let body;
      if (type.includes('application/json')) body = await response.json();
      else {
        body = await response.text();
        if (body.length > 1600) body = body.slice(0, 1600) + '\n… response truncated';
      }

      log('[' + (response.ok ? 'PASS' : 'FAIL') + '] HTTP ' + response.status + ' · ' + elapsed + ' ms · ' + label, !response.ok);
      const pretty = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
      String(pretty).split('\n').forEach(line => log('  ' + line));
      return response.ok;
    } catch (error) {
      const reason = error.name === 'TimeoutError' ? 'Timed out after 10 seconds' : (error.message || 'Network error');
      log('[FAIL] ' + label + ' · ' + reason, true);
      return false;
    }
  }

  async function check(name) {
    switch (name) {
      case 'health':
      case 'db':
        return request(name === 'db' ? 'Database connectivity' : 'Backend and database health', '/api/debug/health');
      case 'services':
        return request('Services API', '/api/services');
      case 'profile':
        if (!getToken()) {
          log('[SKIP] Sign in first to test /api/users/profile.', true);
          return false;
        }
        return request('Current user profile', '/api/users/profile');
      case 'debug':
        if (!getToken()) {
          log('[SKIP] Sign in first to test /api/debug.', true);
          return false;
        }
        return request('Authenticated debug endpoint', '/api/debug');
      case 'logs':
        if (!getToken()) {
          log('[SKIP] Server logs require an administrator session.', true);
          return false;
        }
        return request('Recent server logs (admin only)', '/api/admin/logs?limit=30');
      case 'all': {
        let ok = true;
        ok = await check('health') && ok;
        ok = await check('services') && ok;
        if (getToken()) {
          ok = await check('profile') && ok;
          ok = await check('debug') && ok;
        } else log('[INFO] Profile/debug checks skipped: no active token.');
        log(ok ? '[DONE] Diagnostic checks completed.' : '[DONE] One or more checks failed; inspect output above.', !ok);
        return ok;
      }
      default:
        return false;
    }
  }

  const commands = {
    status: () => check('all'),
    'api test': async () => { await check('health'); await check('services'); },
    'db test': () => check('db'),
    services: () => check('services'),
    'profile test': () => check('profile'),
    'debug test': () => check('debug'),
    'logs test': () => check('logs')
  };

  window.MainRoadmapCliDebug = {
    run(command) {
      const normalized = String(command || '').trim().toLowerCase().replace(/\\s+/g, ' ');
      if (!Object.prototype.hasOwnProperty.call(commands, normalized)) return false;
      void commands[normalized]();
      return true;
    },
    check
  };
})();
