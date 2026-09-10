// public/themes/modules/avatar-pandora.js
import { loadServices, handleServiceClick } from '../../services-client.js';

export function init() {
  let audioCtx = null;
  const getAudio = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  };

  const SoundFX = {
    bansheeCry: () => {
      try {
        const ctx = getAudio();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(1600, now + 0.25);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.7);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.75);
      } catch (e) {}
    },
    eywaChime: () => {
      try {
        const ctx = getAudio();
        const now = ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.08);
          gain.gain.setValueAtTime(0.12, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.5);
        });
      } catch (e) {}
    }
  };

  let currentUser = {
    isLoggedIn: false,
    username: 'TORUK_MAKTO',
    role: 'OMATICAYA CLAN LEADER',
    nodeId: '#EYWA-LINK-01',
    avatar: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=160&auto=format&fit=crop&q=80'
  };

  // 1. ATOKIRINA (WOODSPRITES) PARÇACIK CANVAS KATMANI
  const canvas = document.createElement('canvas');
  canvas.className = 'avatar-woodsprites-canvas';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const sprites = [];
  for (let i = 0; i < 45; i++) {
    sprites.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      radius: 2 + Math.random() * 3,
      speedY: 0.3 + Math.random() * 0.8,
      wobble: Math.random() * Math.PI * 2,
      color: Math.random() < 0.6 ? 'rgba(0, 229, 255,' : 'rgba(168, 85, 247,'
    });
  }

  let animFrameId = null;
  function renderWoodsprites() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    sprites.forEach(s => {
      s.y -= s.speedY;
      s.wobble += 0.02;
      s.x += Math.sin(s.wobble) * 0.6;

      if (s.y < -20) {
        s.y = canvas.height + 20;
        s.x = Math.random() * canvas.width;
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fillStyle = s.color + '0.85)';
      ctx.shadowColor = s.color + '1)';
      ctx.shadowBlur = 12;
      ctx.fill();

      // İnce lifler
      for (let j = 0; j < 4; j++) {
        const ang = (Math.PI / 2) + (j - 1.5) * 0.4;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + Math.cos(ang) * 9, s.y + Math.sin(ang) * 9);
        ctx.strokeStyle = s.color + '0.45)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    });

    animFrameId = requestAnimationFrame(renderWoodsprites);
  }
  animFrameId = requestAnimationFrame(renderWoodsprites);

  // 2. TSAHEYLU OVERLAY
  const tsaheyluLayer = document.createElement('div');
  tsaheyluLayer.className = 'avatar-tsaheylu-layer';
  document.body.appendChild(tsaheyluLayer);

  const triggerTsaheylu = () => {
    tsaheyluLayer.classList.add('active');
    SoundFX.bansheeCry();
    setTimeout(() => {
      tsaheyluLayer.classList.remove('active');
    }, 1200);
  };

  // 3. SHOWCASE & GENİŞ HESAP BARI
  const showcaseContainer = document.createElement('div');
  showcaseContainer.id = 'avatarShowcase';
  showcaseContainer.className = 'avatar-showcase-container';
  showcaseContainer.innerHTML = `
    <!-- Top HUD -->
    <div class="avatar-top-hud">
      <div class="avatar-hud-left">
        <span class="avatar-eywa-icon">🌸</span>
        <span class="avatar-hud-title">PANDORA // BIOLUMINESCENT MATRIX</span>
      </div>

      <div class="avatar-hud-chips">
        <span class="avatar-chip">EYWA LINK: <strong>SYNCHRONIZED</strong></span>
        <span class="avatar-chip purple">TREE OF SOULS: <strong>ACTIVE</strong></span>
      </div>
    </div>

    <!-- Tsaheylu Banshee Card -->
    <div class="avatar-biolum-card">
      <div class="avatar-biolum-info">
        <h4>TSAHEYLU // NEURAL LINK BOND</h4>
        <p>Connect with your Ikran (Mountain Banshee) and soar above the Hallelujah Mountains.</p>
      </div>
      <div style="display:flex; gap:10px;">
        <button type="button" class="avatar-action-btn purple" id="btnEywaBlessing">🌸 EYWA BLESSING</button>
        <button type="button" class="avatar-action-btn" id="btnBansheeBond">🦅 BOND WITH IKRAN [B]</button>
      </div>
    </div>

    <!-- SAĞ ALT OMATICAYA KLAN HESAP BARI -->
    <div class="avatar-wide-account-bar">
      <div class="avatar-acc-left">
        <div class="avatar-avatar-wrap" id="btnAvatarProfile" title="Open Clan Records">
          <img id="avatarUserImg" src="${currentUser.avatar}" alt="Na'vi Warrior" />
        </div>
        <div class="avatar-acc-details">
          <div class="avatar-acc-name" id="avatarUsername">TORUK MAKTO</div>
          <div class="avatar-acc-sub">
            <span>CLAN: <strong id="avatarRole">OMATICAYA</strong></span>
            <span>NODE: <strong id="avatarNode">#EYWA-LINK-01</strong></span>
          </div>
        </div>
      </div>
      <div class="avatar-acc-actions" id="avatarAccountActions"></div>
    </div>
  `;

  const servicesSection = document.getElementById('servicesSection');
  if (servicesSection && servicesSection.parentNode) {
    servicesSection.parentNode.insertBefore(showcaseContainer, servicesSection);
  }

  showcaseContainer.querySelector('#btnBansheeBond')?.addEventListener('click', triggerTsaheylu);
  showcaseContainer.querySelector('#btnEywaBlessing')?.addEventListener('click', () => {
    SoundFX.eywaChime();
  });

  // [B] Tuşu: Banshee Bond
  const onKeyDown = (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'KeyB') triggerTsaheylu();
  };
  window.addEventListener('keydown', onKeyDown);

  // Oturum Senkronizasyonu
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
          currentUser.isLoggedIn = true;
          currentUser.username = u.user_name.toUpperCase();
          currentUser.role = (u.relation || 'NA\'VI WARRIOR').toUpperCase();
          currentUser.nodeId = `#${u.id ? String(u.id).slice(0, 4) : '8921'}-PANDORA`;
          currentUser.avatar = u.profile_pic_path || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.user_name}`;
        }
      } catch (err) {}
    }

    const avatar = showcaseContainer.querySelector('#avatarUserImg');
    const name = showcaseContainer.querySelector('#avatarUsername');
    const role = showcaseContainer.querySelector('#avatarRole');
    const node = showcaseContainer.querySelector('#avatarNode');
    const actions = showcaseContainer.querySelector('#avatarAccountActions');

    if (avatar) avatar.src = currentUser.avatar;
    if (name) name.textContent = currentUser.username;
    if (role) role.textContent = currentUser.role;
    if (node) node.textContent = currentUser.nodeId;

    if (currentUser.isLoggedIn) {
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="avatar-action-btn" id="btnAvatarAccount">ACCOUNT</button>
          <button type="button" class="avatar-action-btn purple" id="btnAvatarLogout">LOGOUT</button>
        `;
        showcaseContainer.querySelector('#btnAvatarAccount')?.addEventListener('click', () => window.location.href = '/account');
        showcaseContainer.querySelector('#btnAvatarLogout')?.addEventListener('click', () => {
          localStorage.removeItem('token');
          window.location.reload();
        });
      }
    } else {
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="avatar-action-btn" id="btnAvatarLogin">SIGN IN</button>
          <button type="button" class="avatar-action-btn purple" id="btnAvatarRegister">ENLIST</button>
        `;
        showcaseContainer.querySelector('#btnAvatarLogin')?.addEventListener('click', () => window.location.href = '/login');
        showcaseContainer.querySelector('#btnAvatarRegister')?.addEventListener('click', () => window.location.href = '/login#register');
      }
    }

    showcaseContainer.querySelector('#btnAvatarProfile')?.addEventListener('click', () => {
      window.location.href = currentUser.isLoggedIn ? '/account' : '/login';
    });
  }

  syncUserSession();

  return {
    destroy: () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', resizeCanvas);
      if (animFrameId) cancelAnimationFrame(animFrameId);
      canvas.remove();
      tsaheyluLayer.remove();
      showcaseContainer.remove();
    }
  };
}