// public/themes/modules/pixel-gun-lobby.js
import { loadServices, handleServiceClick } from '../../services-client.js';

export function init() {
  let audioCtx = null;
  const getAudio = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  };

  const play8BitGunSfx = (freq = 440) => {
    try {
      const ctx = getAudio();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  };

  const WEAPONS = [
    { type: 'PRIMARY', name: 'FAST DEATH', icon: '🔫', grade: 'MYTHICAL', dmg: '142' },
    { type: 'BACKUP', name: 'EXTERMINATOR', icon: '⚡', grade: 'LEGENDARY', dmg: '198' },
    { type: 'MELEE', name: 'DARK FORCE SABER', icon: '🗡️', grade: 'EPIC', dmg: '110' },
    { type: 'SPECIAL', name: 'POISON DARTS', icon: '🎯', grade: 'MYTHICAL', dmg: '165' },
    { type: 'SNIPER', name: 'PROTOTYPE PSR-1', icon: '🔭', grade: 'LEGENDARY', dmg: '220' },
    { type: 'HEAVY', name: 'SOLAR RAY ROCKET', icon: '🚀', grade: 'MYTHICAL', dmg: '260' }
  ];

  let currentSoldier = {
    isLoggedIn: false,
    username: 'PIXEL_WARRIOR',
    role: 'LEVEL 65',
    coins: 2450,
    gems: 380,
    nodeId: '#EU-CENTRAL',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=PixelGunWarrior'
  };

  const showcaseContainer = document.createElement('div');
  showcaseContainer.id = 'pixelGunShowcase';
  showcaseContainer.className = 'pg-showcase-container';

  showcaseContainer.innerHTML = `
    <!-- 1. TOP CURRENCY & LEVEL HUD -->
    <div class="pg-top-lobby-bar">
      <div class="pg-lobby-left">
        <span class="pg-level-badge">LVL 65 MAX</span>
        <span style="font-size: 8px; color:#ffffff;">ARMORY LOADOUT // SQUAD 3D</span>
      </div>

      <div class="pg-currencies-row">
        <div class="pg-currency-pill coins">
          <span>🪙</span>
          <strong id="lblCoins">${currentSoldier.coins}</strong>
        </div>
        <div class="pg-currency-pill gems">
          <span>💎</span>
          <strong id="lblGems">${currentSoldier.gems}</strong>
        </div>
      </div>
    </div>

    <!-- 2. ARMORY WEAPON SLOTS -->
    <div class="pg-armory-section">
      <div class="pg-section-title-row">
        <span class="pg-section-title">&gt; EQUIPPED ARMORY LOADOUT</span>
        <span style="font-size: 7px; color: var(--pg-gem);">ALL WEAPONS UPGRADED</span>
      </div>

      <div class="pg-weapons-grid" id="pgWeaponsGrid"></div>
    </div>

    <!-- 3. SAĞ ALT BOYDAN BOYA GENİŞ HESAP BARI -->
    <div class="pg-wide-account-bar">
      <div class="pg-acc-left">
        <div class="pg-acc-avatar-box" id="btnPgAvatar" title="Open Account Settings">
          <img id="pgUserAvatar" src="${currentSoldier.avatar}" alt="Pixel Soldier" />
        </div>
        <div class="pg-acc-details">
          <div class="pg-acc-name" id="pgUsername">PIXEL_WARRIOR</div>
          <div class="pg-acc-sub">
            <span>RANK: <strong id="pgUserRank" style="color:var(--pg-gold);">VETERAN</strong></span>
            <span>NODE: <strong id="pgUserNode">#8921-X</strong></span>
          </div>
        </div>
      </div>

      <div class="pg-acc-actions" id="pgAccountActions"></div>
    </div>
  `;

  // Silah Slotlarını Doldur
  const weaponsGrid = showcaseContainer.querySelector('#pgWeaponsGrid');
  WEAPONS.forEach((w, idx) => {
    const slot = document.createElement('div');
    slot.className = `pg-weapon-slot ${idx === 0 ? 'active' : ''}`;
    slot.innerHTML = `
      <span class="pg-slot-type">${w.type}</span>
      <div class="pg-weapon-icon">${w.icon}</div>
      <div class="pg-weapon-name">${w.name}</div>
      <span class="pg-weapon-grade">${w.grade}</span>
    `;

    slot.addEventListener('click', () => {
      showcaseContainer.querySelectorAll('.pg-weapon-slot').forEach(s => s.classList.remove('active'));
      slot.classList.add('active');
      play8BitGunSfx(550 + idx * 80);
    });

    weaponsGrid.appendChild(slot);
  });

  const servicesSection = document.getElementById('servicesSection');
  if (servicesSection && servicesSection.parentNode) {
    servicesSection.parentNode.insertBefore(showcaseContainer, servicesSection);
  }

  // Kullanıcı Oturumu Senkronizasyonu
  async function syncUserSession() {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const res = await fetch('/api/users/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (res.ok && result.status === 'success') {
          const u = result.data.user;
          currentSoldier.isLoggedIn = true;
          currentSoldier.username = u.user_name.toUpperCase();
          currentSoldier.role = (u.relation || 'WARRIOR').toUpperCase();
          currentSoldier.nodeId = `#${u.id ? String(u.id).slice(0, 4) : '8921'}-X`;
          currentSoldier.avatar = u.profile_pic_path || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.user_name}`;
        }
      } catch (err) {}
    }

    const avatar = showcaseContainer.querySelector('#pgUserAvatar');
    const name = showcaseContainer.querySelector('#pgUsername');
    const rank = showcaseContainer.querySelector('#pgUserRank');
    const node = showcaseContainer.querySelector('#pgUserNode');
    const actions = showcaseContainer.querySelector('#pgAccountActions');

    if (avatar) avatar.src = currentSoldier.avatar;
    if (name) name.textContent = currentSoldier.username;
    if (rank) rank.textContent = currentSoldier.role;
    if (node) node.textContent = currentSoldier.nodeId;

    if (currentSoldier.isLoggedIn) {
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="pg-pixel-btn" id="btnPgAccount">ACCOUNT</button>
          <button type="button" class="pg-pixel-btn danger" id="btnPgLogout">LOGOUT</button>
        `;
        showcaseContainer.querySelector('#btnPgAccount')?.addEventListener('click', () => window.location.href = '/account');
        showcaseContainer.querySelector('#btnPgLogout')?.addEventListener('click', () => {
          localStorage.removeItem('token');
          window.location.reload();
        });
      }
    } else {
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="pg-pixel-btn" id="btnPgLogin">SIGN IN</button>
          <button type="button" class="pg-pixel-btn" id="btnPgRegister">ENLIST</button>
        `;
        showcaseContainer.querySelector('#btnPgLogin')?.addEventListener('click', () => window.location.href = '/login');
        showcaseContainer.querySelector('#btnPgRegister')?.addEventListener('click', () => window.location.href = '/login#register');
      }
    }

    showcaseContainer.querySelector('#btnPgAvatar')?.addEventListener('click', () => {
      window.location.href = currentSoldier.isLoggedIn ? '/account' : '/login';
    });
  }

  syncUserSession();

  return {
    destroy: () => {
      showcaseContainer.remove();
    }
  };
}