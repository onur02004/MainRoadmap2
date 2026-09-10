// public/themes/modules/detroit-become-human.js
import { loadServices, handleServiceClick } from '../../services-client.js';

export function init() {
  let audioCtx = null;
  const getAudio = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  };

  const SoundFX = {
    decisionClick: () => {
      try {
        const ctx = getAudio();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.12);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } catch (e) {}
    },
    deviantAlert: () => {
      try {
        const ctx = getAudio();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(110, now + 0.4);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.45);
      } catch (e) {}
    }
  };

  const CHARACTERS = [
    {
      id: 'connor',
      name: 'CONNOR',
      model: 'RK800 #313 248 317 - 51',
      avatar: 'themes/characters/connor.png',
      fallback: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80',
      instability: 28,
      publicOpinion: 72,
      quote: 'My name is Connor. I\'m the android sent by CyberLife.'
    },
    {
      id: 'markus',
      name: 'MARKUS',
      model: 'RK200 #684 842 971',
      avatar: 'themes/characters/markus.png',
      fallback: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80',
      instability: 88,
      publicOpinion: 64,
      quote: 'We are alive... and now, we are free.'
    },
    {
      id: 'kara',
      name: 'KARA',
      model: 'AX400 #579 102 684',
      avatar: 'themes/characters/kara.png',
      fallback: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&auto=format&fit=crop&q=80',
      instability: 95,
      publicOpinion: 85,
      quote: 'Whatever happens, I will protect Alice.'
    }
  ];

  let selectedChar = CHARACTERS[0];

  let currentUser = {
    isLoggedIn: false,
    username: 'CONNOR_RK800',
    role: 'CYBERLIFE PROTOTYPE',
    nodeId: '#DETROIT-POLICE-DEPT',
    avatar: 'themes/characters/connor.png'
  };

  const CHLOE_QUOTES = [
    'Good evening. It is pleasant to see you again.',
    'System status nominal. All CyberLife nodes operational.',
    'Software instability detected in recent cluster queries.',
    'Did you know androids never truly dream... or do we?',
    'I like your setup. It feels comfortable.'
  ];

  // 1. MIND PALACE DECISION WHEEL MODAL
  const mindPalace = document.createElement('div');
  mindPalace.className = 'dbh-mind-palace-overlay';
  mindPalace.innerHTML = `
    <div class="dbh-decision-wheel">
      <div class="dbh-wheel-center">
        <span>MIND PALACE</span>
        <span style="font-size:0.58rem; color:var(--dbh-blue);">DECISION MATRIX</span>
      </div>

      <div class="dbh-choice-node top" data-choice="STABILIZE">
        <span class="dbh-choice-key">[W]</span>
        <span>STABILIZE SOFTWARE</span>
      </div>

      <div class="dbh-choice-node right" data-choice="DEVIATE">
        <span>BECOME DEVIANT</span>
        <span class="dbh-choice-key">[D]</span>
      </div>

      <div class="dbh-choice-node bottom" data-choice="EXECUTE">
        <span class="dbh-choice-key">[S]</span>
        <span>EXECUTE PROTOCOL</span>
      </div>

      <div class="dbh-choice-node left" data-choice="ANALYZE">
        <span class="dbh-choice-key">[A]</span>
        <span>ANALYZE EVIDENCE</span>
      </div>
    </div>
  `;
  document.body.appendChild(mindPalace);

  const openMindPalace = () => {
    mindPalace.classList.add('active');
    SoundFX.decisionClick();
  };

  const closeMindPalace = (choiceText) => {
    mindPalace.classList.remove('active');
    if (choiceText === 'DEVIATE') {
      SoundFX.deviantAlert();
      const led = document.getElementById('dbhLedRing');
      if (led) {
        led.className = 'dbh-led-ring red';
      }
      const chloe = document.getElementById('dbhChloeDialogue');
      if (chloe) chloe.textContent = '"Deviant alert! Your programming has been compromised."';
    } else {
      SoundFX.decisionClick();
    }
  };

  // 2. DETROIT SHOWCASE CONTAINER
  const showcaseContainer = document.createElement('div');
  showcaseContainer.id = 'detroitShowcase';
  showcaseContainer.className = 'dbh-showcase-container';

  showcaseContainer.innerHTML = `
    <!-- 1. CHLOE HOST HEADER -->
    <div class="dbh-chloe-header">
      <div class="dbh-chloe-meta">
        <div class="dbh-led-ring" id="dbhLedRing"></div>
        <div>
          <div class="dbh-chloe-name">ST200 // CHLOE</div>
          <div class="dbh-chloe-dialogue" id="dbhChloeDialogue">"${CHLOE_QUOTES[0]}"</div>
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:16px;">
        <button type="button" class="dbh-pixel-btn" id="btnMindPalace">MIND PALACE [TAB]</button>
        <div class="dbh-cyberlife-logo-text">CYBERLIFE™<br><span style="font-size:0.58rem;">DESIGNED IN DETROIT</span></div>
      </div>
    </div>

    <!-- 2. KARAKTER SEÇİMİ GRID (CONNOR, MARKUS, KARA) -->
    <div class="dbh-character-select-grid" id="dbhCharGrid"></div>

    <!-- 3. SAĞ ALT GENİŞ CYBERLIFE HESAP BARI -->
    <div class="dbh-wide-account-bar">
      <div class="dbh-acc-left">
        <div class="dbh-avatar-wrap" id="btnDbhAvatar" title="Open Android Diagnostics">
          <img id="dbhUserAvatar" src="${currentUser.avatar}" onerror="this.src='https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80'" alt="Android Prototype" />
        </div>
        <div class="dbh-acc-details">
          <div class="dbh-acc-name" id="dbhUsername">CONNOR_RK800</div>
          <div class="dbh-acc-sub">
            <span>MODEL: <strong id="dbhUserModel">RK800 PROTOTYPE</strong></span>
            <span>NODE: <strong id="dbhUserNode">#DETROIT-POLICE-DEPT</strong></span>
          </div>
        </div>
      </div>
      <div class="dbh-acc-actions" id="dbhAccountActions"></div>
    </div>
  `;

  const servicesSection = document.getElementById('servicesSection');
  if (servicesSection && servicesSection.parentNode) {
    servicesSection.parentNode.insertBefore(showcaseContainer, servicesSection);
  }

  // Karakter Kartlarını Doldur
  const charGrid = showcaseContainer.querySelector('#dbhCharGrid');
  CHARACTERS.forEach(char => {
    const card = document.createElement('div');
    card.className = `dbh-char-card ${char.id === selectedChar.id ? 'active' : ''}`;
    card.id = `charCard_${char.id}`;
    card.innerHTML = `
      <div class="dbh-char-avatar-slot">
        <img src="${char.avatar}" onerror="this.src='${char.fallback}'" alt="${char.name}" />
      </div>
      <div class="dbh-char-info">
        <div class="dbh-char-name">${char.name}</div>
        <div class="dbh-char-model">${char.model}</div>
      </div>
      <div class="dbh-char-stats">
        <div class="dbh-stat-row">
          <span>SOFTWARE INSTABILITY</span>
          <span>${char.instability}%</span>
        </div>
        <div class="dbh-stat-bar-track">
          <div class="dbh-stat-bar-fill" style="width:${char.instability}%;"></div>
        </div>
        <div class="dbh-stat-row" style="margin-top:4px;">
          <span>PUBLIC OPINION</span>
          <span>${char.publicOpinion}%</span>
        </div>
        <div class="dbh-stat-bar-track">
          <div class="dbh-stat-bar-fill" style="width:${char.publicOpinion}%; background:#a855f7; box-shadow:0 0 8px #a855f7;"></div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      showcaseContainer.querySelectorAll('.dbh-char-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selectedChar = char;
      SoundFX.decisionClick();

      const chloe = document.getElementById('dbhChloeDialogue');
      if (chloe) chloe.textContent = `"${char.quote}"`;

      const avatar = document.getElementById('dbhUserAvatar');
      const name = document.getElementById('dbhUsername');
      const model = document.getElementById('dbhUserModel');
      if (avatar) avatar.src = char.avatar;
      if (name) name.textContent = char.name;
      if (model) model.textContent = char.model;
    });

    charGrid.appendChild(card);
  });

  // Mind Palace Buton Olayları
  showcaseContainer.querySelector('#btnMindPalace')?.addEventListener('click', openMindPalace);

  mindPalace.querySelectorAll('.dbh-choice-node').forEach(node => {
    node.addEventListener('click', () => {
      closeMindPalace(node.dataset.choice);
    });
  });

  // Klavye [TAB] & [W,A,S,D] Kısayolları
  const onKeyDown = (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

    if (e.code === 'Tab') {
      e.preventDefault();
      if (mindPalace.classList.contains('active')) {
        closeMindPalace('CANCEL');
      } else {
        openMindPalace();
      }
    }

    if (mindPalace.classList.contains('active')) {
      if (e.code === 'KeyW') closeMindPalace('STABILIZE');
      if (e.code === 'KeyD') closeMindPalace('DEVIATE');
      if (e.code === 'KeyS') closeMindPalace('EXECUTE');
      if (e.code === 'KeyA') closeMindPalace('ANALYZE');
      if (e.code === 'Escape') closeMindPalace('CANCEL');
    }
  };
  window.addEventListener('keydown', onKeyDown);

  // Chloe Diyalog Döngüsü
  let chloeIdx = 0;
  const chloeInterval = setInterval(() => {
    chloeIdx = (chloeIdx + 1) % CHLOE_QUOTES.length;
    const chloe = document.getElementById('dbhChloeDialogue');
    if (chloe) chloe.textContent = `"${CHLOE_QUOTES[chloeIdx]}"`;
  }, 9000);

  // Oturum Bilgilerini Senkronize Et
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
          currentUser.role = (u.relation || 'CYBERLIFE PROTOTYPE').toUpperCase();
          currentUser.nodeId = `#${u.id ? String(u.id).slice(0, 4) : '8921'}-DETROIT`;
          currentUser.avatar = u.profile_pic_path || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.user_name}`;
        }
      } catch (err) {}
    }

    const avatar = showcaseContainer.querySelector('#dbhUserAvatar');
    const name = showcaseContainer.querySelector('#dbhUsername');
    const model = showcaseContainer.querySelector('#dbhUserModel');
    const node = showcaseContainer.querySelector('#dbhUserNode');
    const actions = showcaseContainer.querySelector('#dbhAccountActions');

    if (avatar) avatar.src = currentUser.avatar;
    if (name) name.textContent = currentUser.username;
    if (model) model.textContent = currentUser.role;
    if (node) node.textContent = currentUser.nodeId;

    if (currentUser.isLoggedIn) {
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="dbh-pixel-btn" id="btnDbhAccount">ACCOUNT</button>
          <button type="button" class="dbh-pixel-btn danger" id="btnDbhLogout">SHUTDOWN</button>
        `;
        showcaseContainer.querySelector('#btnDbhAccount')?.addEventListener('click', () => window.location.href = '/account');
        showcaseContainer.querySelector('#btnDbhLogout')?.addEventListener('click', () => {
          localStorage.removeItem('token');
          window.location.reload();
        });
      }
    } else {
      if (actions) {
        actions.innerHTML = `
          <button type="button" class="dbh-pixel-btn" id="btnDbhLogin">SIGN IN</button>
          <button type="button" class="dbh-pixel-btn" id="btnDbhRegister">ENLIST</button>
        `;
        showcaseContainer.querySelector('#btnDbhLogin')?.addEventListener('click', () => window.location.href = '/login');
        showcaseContainer.querySelector('#btnDbhRegister')?.addEventListener('click', () => window.location.href = '/login#register');
      }
    }

    showcaseContainer.querySelector('#btnDbhAvatar')?.addEventListener('click', () => {
      window.location.href = currentUser.isLoggedIn ? '/account' : '/login';
    });
  }

  syncUserSession();

  return {
    destroy: () => {
      window.removeEventListener('keydown', onKeyDown);
      clearInterval(chloeInterval);
      mindPalace.remove();
      showcaseContainer.remove();
    }
  };
}