
const homeRows = document.getElementById('homeActivityRows');

function escapeHome(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function timeAgo(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;

  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function homeUserRow(user, online = false) {
  const username = escapeHome(user.user_name || 'Unknown');
  const realName = escapeHome(user.real_name || user.user_name || '');
  const role = escapeHome(user.role || 'USER');

  const activity = online
    ? escapeHome(user.activity?.activity || 'Browsing')
    : 'Last login';

  const timestamp = online
    ? user.connectedAt
    : user.logged_in_at;

  const status = online
    ? '<span class="pill verified">ONLINE</span>'
    : `<span class="home-time">${escapeHome(timeAgo(timestamp))}</span>`;

  return `
    <tr>
      <td>
        <div class="user-cell">
          <span class="avatar">${escapeHome(username.slice(0, 2).toUpperCase())}</span>
          <div>
            <strong>${username}</strong>
            <small>${realName}</small>
          </div>
        </div>
      </td>
      <td>${role}</td>
      <td>${activity}</td>
      <td>${status}</td>
    </tr>
  `;
}

let homeRefreshInterval = null;
let homeLoading = false;

async function loadAdminHome() {
  if (homeLoading || !homeRows) return;

  homeLoading = true;

  try {
    const [onlineResponse, loginResponse] = await Promise.all([
      fetch('/api/admin/presence/online', {
        credentials: 'same-origin',
        cache: 'no-store'
      }),
      fetch('/api/admin/presence/logins?limit=15', {
        credentials: 'same-origin',
        cache: 'no-store'
      })
    ]);

    if (!onlineResponse.ok || !loginResponse.ok) {
      throw new Error('Could not load platform activity.');
    }

    const onlineResult = await onlineResponse.json();
    const loginResult = await loginResponse.json();

    const onlineUsers = onlineResult.data?.online || [];
    const recentLogins = loginResult.data?.logins || [];

    document.getElementById('homeOnlineCount').textContent = onlineUsers.length;
    document.getElementById('homeLoginCount').textContent = recentLogins.length;
    document.getElementById('homeActivityStatus').textContent =
      onlineUsers.length ? 'LIVE' : 'IDLE';

    if (onlineUsers.length > 0) {
      document.getElementById('homeListTitle').textContent =
        'Currently online';

      document.getElementById('homeListDescription').textContent =
        `${onlineUsers.length} user(s) currently connected.`;

      homeRows.innerHTML = onlineUsers
        .map(user => homeUserRow(user, true))
        .join('');

      document.getElementById('homeRefreshLabel').textContent = 'LIVE';
    } else if (recentLogins.length > 0) {
      document.getElementById('homeListTitle').textContent =
        'Recent logins';

      document.getElementById('homeListDescription').textContent =
        'No users are online. Showing the last 15 sign-ins.';

      homeRows.innerHTML = recentLogins
        .map(user => homeUserRow(user, false))
        .join('');

      document.getElementById('homeRefreshLabel').textContent = 'RECENT';
    } else {
      document.getElementById('homeListTitle').textContent =
        'No activity yet';

      document.getElementById('homeListDescription').textContent =
        'No online users or login records were found.';

      homeRows.innerHTML =
        '<tr><td colspan="4" class="empty">No activity available.</td></tr>';
    }
  } catch (error) {
    console.error('[Admin Home]', error);

    homeRows.innerHTML =
      `<tr><td colspan="4" class="empty">${escapeHome(error.message)}</td></tr>`;
  } finally {
    homeLoading = false;
  }
}

window.loadAdminHome = loadAdminHome;

if (homeRefreshInterval) clearInterval(homeRefreshInterval);

homeRefreshInterval = setInterval(() => {
  const homeView = document.getElementById('homeView');

  if (homeView && !homeView.hidden) {
    loadAdminHome();
  }
}, 15000);
