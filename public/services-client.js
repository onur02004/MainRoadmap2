// public/services-client.js

let cachedServices = null;

export async function loadServices(forceRefresh = false) {
  if (cachedServices && !forceRefresh) {
    return cachedServices;
  }

  const rawToken = localStorage.getItem('token');
  const token = typeof rawToken === 'string'
    ? rawToken.replace(/^Bearer\s+/i, '').replace(/^['"]|['"]$/g, '').trim()
    : '';
  const headers = { Accept: 'application/json' };

  // New sessions use an HttpOnly cookie and keep only the non-secret
  // `cookie-session` sentinel in localStorage. Never send that sentinel as a
  // Bearer credential; keep sending real legacy JWTs during migration.
  if (token && !['null', 'undefined', 'cookie-session'].includes(token)) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch('/api/services', {
      method: 'GET',
      headers,
      credentials: 'same-origin',
      cache: 'no-store'
    });
    const result = await res.json().catch(() => ({}));

    if (res.ok && result.status === 'success' && result.data) {
      cachedServices = result.data;
      return cachedServices;
    }
    throw new Error(result.message || `Services load failed (${res.status})`);
  } catch (err) {
    console.error('[services-client] Error fetching /api/services:', err);
    return { isLoggedIn: false, userRole: 'GUEST', core: [], privileged: [] };
  }
}

export function handleServiceClick(service) {
  if (service.status === 'maintenance') return;

  if (service.status === 'login_required') {
    window.location.href = '/login';
    return;
  }

  window.location.href = service.route;
}

export function clearServicesCache() {
  cachedServices = null;
}
