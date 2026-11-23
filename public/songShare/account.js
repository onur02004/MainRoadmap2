const accountState = { loaded: false, loading: false, topRange: 'short_term' };

function accountEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function accountHeaders() {
  const headers = {};
  const token = localStorage.getItem('token');
  if (token && token !== 'cookie-session') headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function accountFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...accountHeaders(), ...(options.headers || {}) },
    credentials: 'include'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status === 'error') {
    const error = new Error(data.message || `İstek başarısız oldu (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function accountToast(message, type = 'info') {
  if (window.showSongShareToast) window.showSongShareToast(message, type);
}

function renderAccountTracks(targetId, tracks, emptyMessage) {
  const target = document.getElementById(targetId);
  if (!target) return;
  if (!tracks?.length) {
    target.innerHTML = `<div class="account-empty-state">${accountEscape(emptyMessage)}</div>`;
    return;
  }
  target.innerHTML = tracks.map((track, index) => {
    const image = track.albumArt || '';
    const href = track.url || '#';
    return `<a class="account-track-row" href="${accountEscape(href)}" target="_blank" rel="noopener noreferrer">
      <span class="account-track-rank">${String(index + 1).padStart(2, '0')}</span>
      <img src="${accountEscape(image)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <span class="account-track-copy"><strong>${accountEscape(track.title)}</strong><small>${accountEscape(track.artist)}${track.album ? ` · ${accountEscape(track.album)}` : ''}</small></span>
      <i class="fa-brands fa-spotify" aria-hidden="true"></i>
    </a>`;
  }).join('');
}

function setAccountConnection({ connected, usable, displayName, image, country, product, followers }) {
  const pill = document.getElementById('accountConnectionPill');
  const name = document.getElementById('accountSpotifyName');
  const description = document.getElementById('accountSpotifyDescription');
  const connect = document.getElementById('accountSpotifyConnect');
  const disconnect = document.getElementById('accountSpotifyDisconnect');
  const profile = document.getElementById('accountSpotifyProfile');
  const mark = document.getElementById('accountSpotifyMark');
  const facts = document.getElementById('accountSpotifyFacts');
  if (pill) {
    pill.textContent = !connected ? 'Bağlı değil' : usable ? 'Spotify bağlı' : 'Yeniden bağlanmalı';
    pill.dataset.state = !connected ? 'off' : usable ? 'on' : 'warning';
  }
  if (name) name.textContent = connected ? (displayName || 'Spotify hesabın') : 'Spotify bağlı değil';
  if (description) description.textContent = !connected
    ? 'Favorilerini ve dinleme istatistiklerini görmek için Spotify hesabını bağla.'
    : usable
      ? 'Spotify hesabın Song Share ile bağlı. Beğendiğin şarkılar ve dinleme tercihlerin aşağıda.'
      : 'Spotify bağlantın kayıtlı ancak erişim doğrulanamadı. Yeniden bağlanarak izinleri yenile.';
  if (connect) {
    connect.hidden = false;
    connect.textContent = connected && usable ? 'Bağlantıyı yenile' : connected ? 'Yeniden bağlan' : 'Spotify\'ı bağla';
  }
  if (disconnect) disconnect.hidden = !connected;
  if (profile) profile.dataset.state = !connected ? 'off' : usable ? 'on' : 'warning';
  if (mark) mark.innerHTML = connected && image ? `<img src="${accountEscape(image)}" alt="Spotify profil fotoğrafı">` : '<i class="fa-brands fa-spotify"></i>';
  if (facts) facts.innerHTML = connected && usable ? [country && `Ülke: ${accountEscape(country)}`, product && `Plan: ${accountEscape(product)}`, Number.isFinite(followers) && `Takipçi: ${followers.toLocaleString('tr-TR')}`].filter(Boolean).map(item => `<span>${item}</span>`).join('') : '';
}

async function loadAccountSpotifyStatus() {
  try {
    const status = await accountFetch('/api/spotify/status');
    setAccountConnection({
      connected: Boolean(status.connected),
      usable: Boolean(status.usable),
      displayName: status.account?.displayName,
      image: status.account?.image,
      country: status.account?.country,
      product: status.account?.product,
      followers: status.account?.followers
    });
    if (!status.connected || !status.usable) {
      renderAccountTracks('savedTracksGrid', [], status.connected ? 'Spotify erişimi yenilenmeli.' : 'Spotify hesabını bağladığında favori şarkıların burada görünecek.');
      renderAccountTracks('topTracksGrid', [], status.connected ? 'Spotify erişimi yenilenmeli.' : 'Spotify hesabını bağladığında en çok dinlediklerin burada görünecek.');
      document.getElementById('savedTracksCount').textContent = '—';
      return false;
    }
    return true;
  } catch (error) {
    setAccountConnection({ connected: false, usable: false });
    accountToast(error.message || 'Spotify bağlantı durumu kontrol edilemedi.', 'error');
    return false;
  }
}

async function loadSavedTracks() {
  const count = document.getElementById('savedTracksCount');
  const grid = document.getElementById('savedTracksGrid');
  if (grid) grid.innerHTML = '<div class="account-empty-state">Favoriler yükleniyor…</div>';
  try {
    const data = await accountFetch('/api/spotify/saved-tracks');
    renderAccountTracks('savedTracksGrid', data.tracks, 'Spotify Beğenilen Şarkılar listende henüz parça yok.');
    if (count) count.textContent = `${data.total ?? data.tracks?.length ?? 0} ŞARKI`;
  } catch (error) {
    renderAccountTracks('savedTracksGrid', [], error.status === 403
      ? 'Spotify favorilerine erişim izni yok. Spotify bağlantını yenile.'
      : error.message || 'Favoriler yüklenemedi.');
    if (error.status === 401 || error.status === 403) accountToast(error.message, 'error');
  }
}

async function loadTopTracks(range = accountState.topRange) {
  accountState.topRange = range;
  const grid = document.getElementById('topTracksGrid');
  if (grid) grid.innerHTML = '<div class="account-empty-state">Dinleme istatistikleri yükleniyor…</div>';
  try {
    const data = await accountFetch(`/api/spotify/top-tracks?time_range=${encodeURIComponent(range)}&limit=10`);
    renderAccountTracks('topTracksGrid', data.topTracks, 'Bu dönem için Spotify dinleme verisi bulunamadı.');
  } catch (error) {
    renderAccountTracks('topTracksGrid', [], error.message || 'Dinleme istatistikleri yüklenemedi.');
    if (error.status === 401 || error.status === 403) accountToast(error.message, 'error');
  }
}

async function refreshAccountView() {
  if (accountState.loading) return;
  accountState.loading = true;
  try {
    const usable = await loadAccountSpotifyStatus();
    if (usable) await Promise.all([loadSavedTracks(), loadTopTracks(accountState.topRange)]);
  } finally {
    accountState.loaded = true;
    accountState.loading = false;
  }
}

async function beginSpotifyConnect() {
  const button = document.getElementById('accountSpotifyConnect');
  if (button) { button.disabled = true; button.textContent = 'Spotify açılıyor…'; }
  try {
    const data = await accountFetch('/api/spotify/login-url');
    if (!data.url) throw new Error('Spotify bağlantı adresi oluşturulamadı.');
    window.location.assign(data.url);
  } catch (error) {
    accountToast(error.message || 'Spotify bağlantısı başlatılamadı.', 'error');
    if (button) { button.disabled = false; button.textContent = 'Tekrar dene'; }
  }
}

async function disconnectSpotify() {
  const button = document.getElementById('accountSpotifyDisconnect');
  if (button) { button.disabled = true; button.textContent = 'Kaldırılıyor…'; }
  try {
    await accountFetch('/api/spotify/connection', { method: 'DELETE' });
    setAccountConnection({ connected: false, usable: false });
    renderAccountTracks('savedTracksGrid', [], 'Spotify hesabını bağladığında favori şarkıların burada görünecek.');
    renderAccountTracks('topTracksGrid', [], 'Spotify hesabını bağladığında en çok dinlediklerin burada görünecek.');
    document.getElementById('savedTracksCount').textContent = '—';
    accountToast('Spotify bağlantısı kaldırıldı.', 'success');
    window.dispatchEvent(new CustomEvent('songshare:spotify-disconnected'));
  } catch (error) {
    accountToast(error.message || 'Spotify bağlantısı kaldırılamadı.', 'error');
  } finally {
    if (button) { button.disabled = false; button.textContent = 'Bağlantıyı kaldır'; }
  }
}

document.getElementById('accountSpotifyConnect')?.addEventListener('click', beginSpotifyConnect);
document.getElementById('accountSpotifyDisconnect')?.addEventListener('click', disconnectSpotify);
document.querySelectorAll('[data-top-range]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-top-range]').forEach(item => item.classList.toggle('is-active', item === button));
    loadTopTracks(button.dataset.topRange);
  });
});
window.addEventListener('songshare:account-view', refreshAccountView);
if (window.location.hash === '#account') refreshAccountView();
window.addEventListener('songshare:spotify-disconnected', () => { accountState.loaded = false; });

// Spotify OAuth returns directly to the Song Share account view. Convert its
// result into a small toast, then remove the query string from the address bar.
const callbackUrl = new URL(window.location.href);
const callbackStatus = callbackUrl.searchParams.get('spotify');
const callbackError = callbackUrl.searchParams.get('spotify_error');
if (callbackStatus === 'connected') accountToast('Spotify hesabın başarıyla bağlandı.', 'success');
if (callbackError) {
  const messages = {
    denied: 'Spotify bağlantısına izin vermedin.',
    authorization: 'Spotify yetkilendirmesi tamamlanamadı.',
    session: 'Oturum doğrulanamadı. Song Share hesabına tekrar giriş yap.',
    state: 'Güvenlik doğrulaması başarısız oldu. Lütfen yeniden dene.',
    expired: 'Spotify yetkilendirme kodunun süresi dolmuş. Yeniden bağlan.',
    token: 'Spotify token bilgileri alınamadı. Biraz sonra tekrar dene.',
    refresh: 'Spotify yenileme izni alınamadı. Yeniden bağlanmayı dene.',
    profile: 'Spotify profilin okunamadı. Yeniden bağlanmayı dene.',
    server: 'Spotify bağlantısı kaydedilemedi. Sunucu loglarını kontrol et.'
  };
  accountToast(messages[callbackError] || 'Spotify bağlantısı tamamlanamadı.', 'error');
}
if (callbackStatus || callbackError) {
  callbackUrl.searchParams.delete('spotify');
  callbackUrl.searchParams.delete('spotify_error');
  history.replaceState({}, '', `${callbackUrl.pathname}${callbackUrl.search}#account`);
}
