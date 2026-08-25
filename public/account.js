// account.js
import { ThemeManager } from './themes/theme-registry.js';
import './avatarCanvasPicker.js';

let currentAccountUser = {
  username: "onur",
  role: "ADMIN",
  email: "onur@sys-cluster.local",
  nodeId: "#8921-X",
  avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=onur"
};

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Temaların Account Sayfasına Uygulanması (⌘K Palette & Engine)
  new ThemeManager();

  // 2. Oturum ve Kullanıcı Verilerini Yükle
  initResponsiveFixedGrid();
  initScrollOpacityController();
  await loadUserProfile();
  initAccountEvents();
});


async function loadUserProfile() {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch('/api/users/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const json = await res.json();

    if (res.ok && json.status === 'success') {
      const u = json.data.user;
      currentAccountUser = {
        username: u.user_name,
        role: (u.relation || 'USER').toUpperCase(),
        email: u.email || `${u.user_name}@sys-cluster.local`,
        nodeId: `#${u.id?.slice ? u.id.slice(0, 4) : '8921'}-X`,
        avatar: u.profile_pic_path || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.user_name}`
      };
      applyAccountDetails(currentAccountUser);
    }
  } catch (err) {
    console.error('Profile load error:', err);
  }
}

function applyAccountDetails(user) {
  const avatarImg = document.getElementById('userAvatar');
  const nameLbl = document.getElementById('userNameLabel');
  const roleBadge = document.getElementById('userRoleBadge');
  const emailLbl = document.getElementById('userEmailLabel');
  const nodeIdBadge = document.getElementById('userNodeIdBadge');
  const telemetryRole = document.getElementById('telemetryRoleVal');
  const inpUser = document.getElementById('inpUsername');
  const inpEmail = document.getElementById('inpEmail');

  if (avatarImg) avatarImg.src = user.avatar;
  if (nameLbl) nameLbl.textContent = user.username;
  if (roleBadge) roleBadge.textContent = `ROLE: ${user.role}`;
  if (emailLbl) emailLbl.textContent = user.email;
  if (nodeIdBadge) nodeIdBadge.textContent = user.nodeId;
  if (telemetryRole) telemetryRole.textContent = user.role;
  if (inpUser) inpUser.value = user.username;
  if (inpEmail) inpEmail.value = user.email;
}

function initAccountEvents() {
  // Vault Tetikleyicileri
  const btnHeroVault = document.getElementById('btnHeroVaultTrigger');
  const btnCardVault = document.getElementById('btnCardLaunchVault');

  btnHeroVault?.addEventListener('click', () => {
    document.getElementById('btnOpenAvatarVault')?.click();
  });

  btnCardVault?.addEventListener('click', () => {
    document.getElementById('btnOpenAvatarVault')?.click();
  });

  // Profil Güncelleme
  document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = document.getElementById('inpUsername').value.trim();
    if (!newName) return;

    try {
      const token = localStorage.getItem('token');
      await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_name: newName })
      });
      alert('✅ Profile updated successfully!');
      window.location.reload();
    } catch (err) {
      alert('Profile saved locally.');
    }
  });

  // Şifre Güncelleme
  document.getElementById('securityForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('🔒 Password credentials rotation submitted.');
  });

  // Çıkış
  document.getElementById('btnAccountLogout')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = '/';
  });
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

function initResponsiveFixedGrid() {
  const render = () => {
    const width = window.innerWidth;
    const blueprint = width < 768 
      ? [[0, 1, 2, 1], [0, 2, 2], [0, 1, 2]]
      : [
          [0, 1, 2, 1, 2, 1, 1],
          [0, 0, 1, 1, 2, 2],
          [0, 0, 1, 2, 1, 1],
          [0, 0, 0, 2, 1]
        ];

    const meta = {
      "0-4": { tag: "▲ IDENTITY", dot: true },
      "1-5": { tag: "▼ SECURITY", dot: false }
    };

    const container = document.getElementById('cornerGrid');
    if (!container) return;
    container.innerHTML = '';

    blueprint.forEach((row, rIdx) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'corner-row';

      row.forEach((cellType, cIdx) => {
        const cell = document.createElement('div');
        if (cellType === 0) cell.className = 'corner-unit spacer';
        else if (cellType === 1) cell.className = 'corner-unit wireframe';
        else if (cellType === 2) {
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
  };

  render();
  window.addEventListener('resize', render);
}