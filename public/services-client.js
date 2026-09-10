// public/services-client.js

let cachedServices = null;

export async function loadServices(forceRefresh = false) {
  if (cachedServices && !forceRefresh) {
    return cachedServices;
  }

  let token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token && token !== 'null' && token !== 'undefined') {
    token = token.replace(/^["']|["']$/g, '').trim();
    if (token.startsWith('Bearer ')) {
      token = token.substring(7).trim();
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch('/api/services', {
      method: 'GET',
      headers
    });
    const result = await res.json();

    if (res.ok && result.status === 'success') {
      cachedServices = result.data;
      return cachedServices;
    }
    throw new Error(result.message || 'Services load failed');
  } catch (err) {
    console.error('[services-client] Error fetching /api/services:', err);
    return { isLoggedIn: false, userRole: 'GUEST', core: [], privileged: [] };
  }
}

export function handleServiceClick(service) {
  // Bakımdaysa hiçbir şey yapma
  if (service.status === 'maintenance') {
    return;
  }

  // Giriş gerekiyorsa uyarı vermeden doğrudan login sayfasına yönlendir
  if (service.status === 'login_required') {
    window.location.href = '/login';
    return;
  }

  // Aktifse sayfayı aç
  window.location.href = service.route;
}

export function clearServicesCache() {
  cachedServices = null;
}