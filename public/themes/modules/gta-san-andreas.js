// public/themes/modules/gta-san-andreas.js
import { loadServices, handleServiceClick } from '../../services-client.js';

export function init() {
  let audioCtx = null;
  const getAudio = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  };

  // Web Audio API Ses Sentezleyicileri
  const SoundFX = {
    missionPassed: () => {
      try {
        const ctx = getAudio();
        const now = ctx.currentTime;
        const notes = [293.66, 329.63, 369.99, 440.00, 587.33];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          gain.gain.setValueAtTime(0.18, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.45);
        });
      } catch (e) {}
    },
    gunShot: (type) => {
      try {
        const ctx = getAudio();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        if (type === 'spray') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1400, now);
          osc.frequency.linearRampToValueAtTime(900, now + 0.2);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        } else if (type === 'rpg') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(150, now);
          osc.frequency.exponentialRampToValueAtTime(40, now + 0.5);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        } else {
          osc.type = 'square';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        }
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
      } catch (e) {}
    },
    policeSiren: () => {
      try {
        const ctx = getAudio();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.linearRampToValueAtTime(950, now + 0.3);
        osc.frequency.linearRampToValueAtTime(650, now + 0.6);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.65);
      } catch (e) {}
    },
    radioStatic: () => {
      try {
        const ctx = getAudio();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(1100, now + 0.05);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
      } catch (e) {}
    },
    hydraulicBounce: () => {
      try {
        const ctx = getAudio();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      } catch (e) {}
    }
  };

  // Silah Havuzu (Q / E ile değiştirilebilir)
  const WEAPONS = [
    { name: 'Desert Eagle', icon: '🔫', ammo: '7-350', type: 'pistol' },
    { name: 'Sawed-off Shotgun', icon: '💥', ammo: '2-120', type: 'shotgun' },
    { name: 'Rocket Launcher', icon: '🚀', ammo: '8', type: 'rpg' },
    { name: 'Spray Can (Graffiti)', icon: '🥫', ammo: '500', type: 'spray' },
    { name: 'Brass Knuckles', icon: '🥊', ammo: '∞', type: 'melee' }
  ];
  let weaponIdx = 0;

  // Aranma Seviyesi (Wanted Stars)
  let wantedLevel = 0;
  let currentMoney = 350420;
  let playerHealth = 100;

  const RADIO_STATIONS = [
    { name: 'Radio Los Santos', track: 'Dr. Dre & Snoop - Nuthin\' But a G Thang' },
    { name: 'Radio X', track: 'Guns N\' Roses - Welcome to the Jungle' },
    { name: 'K-DST', track: 'Toto - Hold the Line' },
    { name: 'Bounce FM', track: 'Kool & The Gang - Hollywood Swinging' }
  ];
  let currentStationIdx = 0;

  const LOCATIONS_LIST = ['Ganton', 'Idlewood', 'Glen Park', 'The Johnson House', 'East Los Santos', 'Santa Maria Beach', 'Willowfield'];
  let locIdx = 0;

  const SUBTITLES_LIST = [
    'Carl, we gotta take back <span class="highlight-green">Grove Street</span> territory!',
    'Go check the <span class="highlight-gold">cluster database</span> at Johnson House.',
    'Head over to the <span class="highlight-red">crack dealer</span> and sort out the node.',
    'Ah shit, here we go again.'
  ];
  let subIdx = 0;

  let currentGangster = {
    isLoggedIn: false,
    username: 'CARL_JOHNSON',
    role: 'GROVE STREET OG',
    nodeId: '#GANTON-LOS-SANTOS',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&auto=format&fit=crop&q=80'
  };

  // 1. SAĞ ÜST GTA SA HUD (SİLAH, CAN, PARA, YILDIZLAR)
  const saHud = document.createElement('div');
  saHud.className = 'gta-sa-hud';
  saHud.innerHTML = `
    <div class="gta-hud-clock" id="gtaHudClock">14:52</div>
    
    <div class="gta-hud-weapon-row" id="gtaWeaponRow">
      <div class="gta-hud-weapon-icon" id="gtaWeaponIcon">${WEAPONS[0].icon}</div>
      <div class="gta-hud-ammo" id="gtaWeaponAmmo">${WEAPONS[0].ammo}</div>
    </div>

    <div class="gta-hud-bars">
      <div class="gta-hud-bar-fill health"><div class="inner-bar" id="gtaHealthBar"></div></div>
      <div class="gta-hud-bar-fill armour"><div class="inner-bar"></div></div>
    </div>

    <div class="gta-hud-money" id="gtaMoneyDisplay">$${String(currentMoney).padStart(8, '0')}</div>

    <div class="gta-wanted-stars-row" id="gtaWantedStars">
      <span class="gta-star">★</span><span class="gta-star">★</span><span class="gta-star">★</span><span class="gta-star">★</span><span class="gta-star">★</span><span class="gta-star">★</span>
    </div>
  `;
  document.body.appendChild(saHud);

  // 2. SOL ALT RADAR & MINIMAP
  const minimap = document.createElement('div');
  minimap.className = 'gta-minimap-shell';
  minimap.innerHTML = `
    <div class="gta-minimap-ocean">
      <div class="gta-minimap-road r1"></div>
      <div class="gta-minimap-road r2"></div>
      <div class="gta-minimap-road r3"></div>
      <div class="gta-radar-blip cj" title="Johnson House"></div>
      <div class="gta-radar-blip grove" title="Grove Street"></div>
      <div class="gta-minimap-player"></div>
    </div>
  `;
  document.body.appendChild(minimap);

  // 3. LOKASYON & SUBTITLE HUD
  const locBanner = document.createElement('div');
  locBanner.className = 'gta-location-banner';
  locBanner.id = 'gtaLocationBanner';
  locBanner.textContent = 'Ganton';
  document.body.appendChild(locBanner);

  const subtitleHud = document.createElement('div');
  subtitleHud.className = 'gta-subtitles-hud';
  subtitleHud.innerHTML = `<span>CJ:</span> <span id="gtaSubText">${SUBTITLES_LIST[0]}</span>`;
  document.body.appendChild(subtitleHud);

  // 4. MISSION PASSED & CHEAT MODAL
  const missionOverlay = document.createElement('div');
  missionOverlay.className = 'gta-mission-overlay';
  missionOverlay.innerHTML = `
    <div class="gta-mission-banner">
      <h1 class="gta-mission-title">MISSION PASSED!</h1>
      <span class="gta-respect-badge">RESPECT +</span>
    </div>
  `;
  document.body.appendChild(missionOverlay);

  const cheatPopup = document.createElement('div');
  cheatPopup.className = 'gta-cheat-popup';
  cheatPopup.id = 'gtaCheatPopup';
  document.body.appendChild(cheatPopup);

  function updateWantedStars() {
    const starEls = document.querySelectorAll('#gtaWantedStars .gta-star');
    starEls.forEach((el, idx) => {
      if (idx < wantedLevel) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    if (wantedLevel > 0) {
      document.body.classList.add('gta-cop-siren-active');
      SoundFX.policeSiren();
    } else {
      document.body.classList.remove('gta-cop-siren-active');
    }
  }

  function triggerMissionPassed() {
    missionOverlay.classList.add('active');
    SoundFX.missionPassed();
    currentMoney += 5000;
    document.getElementById('gtaMoneyDisplay').textContent = `$${String(currentMoney).padStart(8, '0')}`;
    setTimeout(() => {
      missionOverlay.classList.remove('active');
    }, 3200);
  }

  function triggerCheat(codeName) {
    cheatPopup.textContent = `CHEAT ACTIVATED: ${codeName}`;
    cheatPopup.classList.add('active');
    SoundFX.gunShot('melee');
    setTimeout(() => cheatPopup.classList.remove('active'), 2800);
  }

  function switchWeapon(direction = 1) {
    weaponIdx = (weaponIdx + direction + WEAPONS.length) % WEAPONS.length;
    const w = WEAPONS[weaponIdx];
    document.getElementById('gtaWeaponIcon').textContent = w.icon;
    document.getElementById('gtaWeaponAmmo').textContent = w.ammo;
    SoundFX.gunShot('melee');
  }

  // 5. İNTERAKTİF SHOWCASE (BIG SMOKE SİPARİŞİ, LOWRIDER HYDRAULICS, RADYO)
  const showcaseContainer = document.createElement('div');
  showcaseContainer.id = 'gtaShowcase';
  showcaseContainer.className = 'gta-showcase-container';
  showcaseContainer.innerHTML = `
    <div class="gta-interactive-grid">
      
      <!-- 1. Big Smoke Fast Food Order -->
      <div class="gta-action-panel">
        <div class="gta-panel-header-title">🍔 CLUCKIN' BELL DRIVE-THRU</div>
        <p class="gta-big-smoke-text">
          "I'll have two number 9s, a number 9 large, a number 6 with extra dip, a number 7, two number 45s, one with cheese, and a large soda."
        </p>
        <button type="button" class="gta-hud-btn gold" id="btnBigSmokeOrder">ORDER BIG SMOKE SPECIAL ($45)</button>
      </div>

      <!-- 2. Lowrider Hydraulics Challenge -->
      <div class="gta-action-panel">
        <div class="gta-panel-header-title">🚗 LOWRIDER HYDRAULICS</div>
        <p style="font-size:0.75rem; color:var(--gta-text-sub);">
          Süspansiyonları zıplat, ritmi yakala ve Los Santos sokaklarında saygınlık kazan!
        </p>
        <button type="button" class="gta-hud-btn" id="btnBounceHydraulics">BOUNCE HYDRAULICS [SPACE]</button>
      </div>

      <!-- 3. Radio Los Santos -->
      <div class="gta-action-panel">
        <div class="gta-panel-header-title">📻 RADIO LOS SANTOS</div>
        <div class="gta-radio-meta">
          <strong id="gtaRadioName" style="color:var(--gta-light-green); font-size:1.1rem;">${RADIO_STATIONS[0].name}</strong>
          <small id="gtaRadioTrack" style="display:block; margin-top:2px;">${RADIO_STATIONS[0].track}</small>
        </div>
        <button type="button" class="gta-hud-btn" id="btnChangeStation">TUNE STATION [R]</button>
      </div>

    </div>

    <!-- SAĞ ALT GROVE STREET HESAP BARI -->
    <div class="gta-wide-grove-bar">
      <div class="gta-cj-left">
        <div class="gta-avatar-box" id="btnGtaAvatar" title="Open Account Settings">
          <img id="gtaUserAvatar" src="${currentGangster.avatar}" alt="CJ" />
        </div>
        <div>
          <div class="gta-cj-name" id="gtaUsername">CARL JOHNSON</div>
          <div style="font-size:0.75rem; color:var(--gta-text-sub);">
            TERRITORY: <strong style="color:var(--gta-light-green);" id="gtaNodeId">#GANTON-LOS-SANTOS</strong>
          </div>
        </div>
      </div>
      <div id="gtaAccountActions"></div>
    </div>
  `;

  const servicesSection = document.getElementById('servicesSection');
  if (servicesSection && servicesSection.parentNode) {
    servicesSection.parentNode.insertBefore(showcaseContainer, servicesSection);
  }

  // Big Smoke Sipariş Olayı
  showcaseContainer.querySelector('#btnBigSmokeOrder')?.addEventListener('click', () => {
    if (currentMoney >= 45) {
      currentMoney -= 45;
      playerHealth = 100;
      document.getElementById('gtaMoneyDisplay').textContent = `$${String(currentMoney).padStart(8, '0')}`;
      document.getElementById('gtaHealthBar').style.width = '100%';
      SoundFX.gunShot('melee');
      const sub = document.getElementById('gtaSubText');
      if (sub) sub.innerHTML = '<span class="highlight-gold">Big Smoke:</span> "If you can eat your food while everyone else is losing theirs and blaming you, you straight, homie!"';
    }
  });

  // Lowrider Zıplatma Olayı
  showcaseContainer.querySelector('#btnBounceHydraulics')?.addEventListener('click', () => {
    SoundFX.hydraulicBounce();
    currentMoney += 200;
    document.getElementById('gtaMoneyDisplay').textContent = `$${String(currentMoney).padStart(8, '0')}`;
    const sub = document.getElementById('gtaSubText');
    if (sub) sub.innerHTML = '<span class="highlight-green">Sweet:</span> "Now that\'s what I call bouncing, CJ!"';
  });

  // Radio Değiştirici
  const btnRadio = showcaseContainer.querySelector('#btnChangeStation');
  const radioName = showcaseContainer.querySelector('#gtaRadioName');
  const radioTrack = showcaseContainer.querySelector('#gtaRadioTrack');

  const switchRadio = () => {
    SoundFX.radioStatic();
    currentStationIdx = (currentStationIdx + 1) % RADIO_STATIONS.length;
    const st = RADIO_STATIONS[currentStationIdx];
    radioName.textContent = st.name;
    radioTrack.textContent = st.track;
  };
  btnRadio?.addEventListener('click', switchRadio);

  // Sayfaya Tıklayarak Ateş Etme veya Sprey Graffiti Boyama
  document.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) return;

    const curWep = WEAPONS[weaponIdx];
    SoundFX.gunShot(curWep.type);

    // Eğer Sprey Boya seçiliyse duvara graffiti bas
    if (curWep.type === 'spray') {
      const tag = document.createElement('div');
      tag.className = 'gta-graffiti-tag';
      tag.textContent = 'GROVE ST 4 LIFE';
      tag.style.left = `${e.clientX - 60}px`;
      tag.style.top = `${e.clientY - 20}px`;
      document.body.appendChild(tag);
      setTimeout(() => tag.remove(), 4000);
    }
  });

  // Servis Tıklamalarında Mission Passed
  document.querySelectorAll('.service-block').forEach(card => {
    card.addEventListener('click', () => {
      triggerMissionPassed();
      locIdx = (locIdx + 1) % LOCATIONS_LIST.length;
      const banner = document.getElementById('gtaLocationBanner');
      if (banner) {
        banner.textContent = LOCATIONS_LIST[locIdx];
        banner.classList.add('active');
        setTimeout(() => banner.classList.remove('active'), 2500);
      }
    });
  });

  // Klavye Dinleyicileri ([Q]/[E]: Silah, [R]: Radyo, [W]: Aranma Seviyesi Artır)
  let keyBuffer = '';
  const onKeyDown = (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

    if (e.code === 'KeyQ') switchWeapon(-1);
    if (e.code === 'KeyE') switchWeapon(1);
    if (e.code === 'KeyR') switchRadio();

    // Hile Kodları
    keyBuffer += e.key.toUpperCase();
    if (keyBuffer.length > 15) keyBuffer = keyBuffer.slice(-15);

    if (keyBuffer.includes('HESOYAM')) {
      currentMoney += 250000;
      playerHealth = 100;
      wantedLevel = 0;
      document.getElementById('gtaMoneyDisplay').textContent = `$${String(currentMoney).padStart(8, '0')}`;
      document.getElementById('gtaHealthBar').style.width = '100%';
      updateWantedStars();
      triggerCheat('HESOYAM ($250K + HEALTH)');
      keyBuffer = '';
    } else if (keyBuffer.includes('AEZAKMI') || keyBuffer.includes('TURNDOWNTHEHEAT')) {
      wantedLevel = 0;
      updateWantedStars();
      triggerCheat('AEZAKMI (NO WANTED LEVEL)');
      keyBuffer = '';
    } else if (keyBuffer.includes('BRINGITON')) {
      wantedLevel = 6;
      updateWantedStars();
      triggerCheat('BRINGITON (6-STAR WANTED)');
      keyBuffer = '';
    }
  };
  window.addEventListener('keydown', onKeyDown);

  // Saat Güncelleyici
  const updateClock = () => {
    const d = new Date();
    const clockEl = document.getElementById('gtaHudClock');
    if (clockEl) {
      clockEl.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  };
  setInterval(updateClock, 1000);
  updateClock();

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
          currentGangster.isLoggedIn = true;
          currentGangster.username = u.user_name.toUpperCase();
          currentGangster.role = (u.relation || 'GROVE STREET OG').toUpperCase();
          currentGangster.nodeId = `#${u.id ? String(u.id).slice(0, 4) : '8921'}-LS`;
          currentGangster.avatar = u.profile_pic_path || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.user_name}`;
        }
      } catch (err) {}
    }

    const avatar = showcaseContainer.querySelector('#gtaUserAvatar');
    const name = showcaseContainer.querySelector('#gtaUsername');
    const node = showcaseContainer.querySelector('#gtaNodeId');
    const actions = showcaseContainer.querySelector('#gtaAccountActions');

    if (avatar) avatar.src = currentGangster.avatar;
    if (name) name.textContent = currentGangster.username;
    if (node) node.textContent = currentGangster.nodeId;

    if (currentGangster.isLoggedIn) {
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="gta-grove-btn" id="btnGtaAccount">ACCOUNT</button>
          <button type="button" class="gta-grove-btn danger" id="btnGtaLogout">LOGOUT</button>
        `;
        showcaseContainer.querySelector('#btnGtaAccount')?.addEventListener('click', () => window.location.href = '/account');
        showcaseContainer.querySelector('#btnGtaLogout')?.addEventListener('click', () => {
          localStorage.removeItem('token');
          window.location.reload();
        });
      }
    } else {
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="gta-grove-btn" id="btnGtaLogin">SIGN IN</button>
          <button type="button" class="gta-grove-btn" id="btnGtaRegister">REGISTER</button>
        `;
        showcaseContainer.querySelector('#btnGtaLogin')?.addEventListener('click', () => window.location.href = '/login');
        showcaseContainer.querySelector('#btnGtaRegister')?.addEventListener('click', () => window.location.href = '/login#register');
      }
    }

    showcaseContainer.querySelector('#btnGtaAvatar')?.addEventListener('click', () => {
      window.location.href = currentGangster.isLoggedIn ? '/account' : '/login';
    });
  }

  syncUserSession();

  return {
    destroy: () => {
      window.removeEventListener('keydown', onKeyDown);
      saHud.remove();
      minimap.remove();
      locBanner.remove();
      subtitleHud.remove();
      missionOverlay.remove();
      cheatPopup.remove();
      showcaseContainer.remove();
      document.body.classList.remove('gta-cop-siren-active');
    }
  };
}