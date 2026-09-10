// public/themes/modules/weingarten-campus.js
import { loadServices, handleServiceClick } from '../../services-client.js';

export function init() {
  // ==========================================
  // 1. MANIFEST ŞARKI SÖZLERİ & SQUAD BİLGİSİ
  // ==========================================
  const MANIFEST_LYRIC_LINES = [
    "Ben bu anı yaşayıp gördüm, kalbim deliye döndü",
    "Kıvılcım alev alır, doğar küllerinden",
    "Cesur adımlarım herkesin dilinde, korku yok!",
    "Dert değil düşmek, deneme vazgeçirmeye",
    "Titrese bile omuzlarım durmam!",
    "Kaybolduğum anda onlar hep yanımda, aldım rüzgârı ardıma",
    "Bi' hayalle geldik biz bu günlere...",
    "Artık korkmak, kaçmak yok bundan böyle!",
    "Bizimle gel sen de, kır zincirleri, düşünme!",
    "Fark edersin, başrol sensin bu filmde, vazgeçme!",
    "Kamera ve şöhrete aldırmam, hedefim çok daha yolum var",
    "Deniyorum 7/24, peşindeyim!",
    "Gecemi sabah eden gençliğime yemin ederim",
    "Kanma güldüğüme, buz kadar sert durabilirim",
    "Kovalama, benim gibisini göremedin hiç",
    "Zor geldi belki başta, savaştım şeytanlarla",
    "Sizi buldum, çıktık dipten!",
    "Omzuma yüklenmişken hayat, üzmedi ilk defa"
  ];

  const MANIFEST_FULL_BLOCKS = [
    "🎶 Bi' hayalle geldik biz bu günlere / Artık korkmak, kaçmak yok bundan böyle / Bizimle gel sen de, kır zincirleri, düşünme / Fark edersin, başrol sensin bu filmde, vazgeçme! 🎶",
    "🔥 Ben bu anı yaşayıp gördüm, kalbim deliye döndü / Kıvılcım alev alır, doğar küllerinden / Cesur adımlarım herkesin dilinde! 🔥",
    "✨ Dert değil düşmek, deneme vazgeçirmeye / Titrese bile omuzlarım durmam / Kaybolduğum anda onlar hep yanımda! ✨"
  ];

  const SQUAD = [
    { id: 'onur', name: 'Onur', gender: 'm', bodyColor: '#1e3799', skinTone: '#ffd2a5', avatar: 'themes/characters/onur.png', fallback: 'https://api.dicebear.com/7.x/bottts/svg?seed=Onur', speed: 4.0, canSleep: false, quotes: ['Kod yazcam', 'C Parkplatz drift vakti', 'Aral\'dan Red Bull alak', 'Opelle bi tur atıp gelem'] },
    { id: 'can', name: 'Can', gender: 'm', bodyColor: '#eb2f06', skinTone: '#ffd2a5', avatar: 'themes/characters/can.png', fallback: 'https://api.dicebear.com/7.x/bottts/svg?seed=Can', speed: 4.2, canSleep: false, quotes: ['ZINK', 'ZINKKKKK', 'Abi Manifest ya <3', 'Ben buyuyunce zoktay olucam', 'Abi C43 mu reno twingo mu'] },
    { id: 'patrick', name: 'Patrick', gender: 'm', bodyColor: '#20bf6b', skinTone: '#ffe0bd', avatar: 'themes/characters/patrick.png', fallback: 'https://api.dicebear.com/7.x/bottts/svg?seed=Patrick', speed: 3.8, canSleep: false, quotes: ['Was geht ab guys?', 'Bugün Mensa\'da ne var?', 'Almanca sunumu hallederiz'] },
    { id: 'defne', name: 'Defne', gender: 'f', bodyColor: '#8854d0', skinTone: '#fcd0a1', avatar: 'themes/characters/defne.png', fallback: 'https://api.dicebear.com/7.x/bottts/svg?seed=Defne', speed: 3.6, canSleep: false, quotes: ['Kahve içmeye Sima\'ya mı gitsek?', 'Story atmalık manzara var mı?', 'Ders aşırı sıkıcıydı'] },
    { id: 'simay', name: 'Simay', gender: 'f', bodyColor: '#fa8231', skinTone: '#ffe0bd', avatar: 'themes/characters/simay.png', fallback: 'https://api.dicebear.com/7.x/bottts/svg?seed=Simay', speed: 3.6, canSleep: false, quotes: ['SELAMS', 'Annem izin vermedi', 'SELAMSSSSS', 'Bende kahve?'] },
    { id: 'unsal', name: 'Ünsal', gender: 'm', bodyColor: '#2d98da', skinTone: '#ffd2a5', avatar: 'themes/characters/unsal.png', fallback: 'https://api.dicebear.com/7.x/bottts/svg?seed=Unsal', speed: 4.4, canSleep: true, quotes: ['BMW mi ozledim', 'vrum vrum', 'tamponu yere bastirdim', 'Ceza yemisim'] },
    { id: 'ezra', name: 'Ezra', gender: 'f', bodyColor: '#0fb9b1', skinTone: '#ffe0bd', avatar: 'themes/characters/ezra.png', fallback: 'https://api.dicebear.com/7.x/bottts/svg?seed=Ezra', speed: 3.7, canSleep: false, quotes: ['abi nolur GEZELIM BASKA BI ULKE DUNYA FARK ETMEZ', 'Hadi tatile gidelim!', 'CICEKUM'] },
    { id: 'naz', name: 'Naz', gender: 'f', bodyColor: '#fd79a8', skinTone: '#fcd0a1', avatar: 'themes/characters/naz.png', fallback: 'https://api.dicebear.com/7.x/bottts/svg?seed=Naz', speed: 3.6, canSleep: false, quotes: ['Pembe Stanleyim nerde', 'Stanleyimi kim aldi?!', 'Kombinime pembe Stanley şart'] },
    { id: 'mina', name: 'Mina', gender: 'f', bodyColor: '#3c2415', skinTone: '#5c3826', avatar: 'themes/characters/mina.png', fallback: 'https://api.dicebear.com/7.x/avataaars/svg?skinColor=darkBrown&top=curvy&seed=Mina', speed: 3.8, canSleep: false, quotes: ['Abi guldurmeyin korkarsiniz', 'Abi mcies yapak', '101 mi atsak', 'PUAHAHAHAH', 'Arkadaslar o tuttugum yesil sey neydi'] },
    { id: 'batu', name: 'Batu', gender: 'm', bodyColor: '#4b6584', skinTone: '#ffd2a5', avatar: 'themes/characters/batu.png', fallback: 'https://api.dicebear.com/7.x/bottts/svg?seed=Batu', speed: 3.4, canSleep: true, quotes: ['Haci ben odadayim', 'Ulm olmicak knk', 'Yatıyom ben hacı'] }
  ];

  const COMMON_QUOTES = ['ZINKKKKK', 'SELAMSSSSS', 'Abi mcies yapak', '101 mi atsak', 'Mensa\'da bugün ne var?', 'Kaufland\'a kim gidiyo?'];
  const MALE_QUOTES = ['Abi Manifest ya <3', 'Ben buyuyunce zoktay olucam', 'vrum vrum', 'tamponu yere bastirdim', 'C Parkplatz\'da yanlayalım'];

  // ==========================================
  // 2. SES MOTORU (WEB AUDIO API RETRO SYNTH)
  // ==========================================
  let audioCtx = null;
  const getAudio = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  };

  const SoundEngine = {
    playHorn: () => {
      try {
        const ctx = getAudio();
        const now = ctx.currentTime;
        [440, 554].forEach(freq => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.35);
        });
      } catch (e) {}
    },
    playDriftScreech: () => {
      try {
        const ctx = getAudio();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800 + Math.random() * 200, now);
        osc.frequency.linearRampToValueAtTime(300, now + 0.15);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } catch (e) {}
    },
    playItemPickup: () => {
      try {
        const ctx = getAudio();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587, now);
        osc.frequency.setValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } catch (e) {}
    },
    playQuestComplete: () => {
      try {
        const ctx = getAudio();
        const now = ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.1);
          gain.gain.setValueAtTime(0.2, now + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.1);
          osc.stop(now + i * 0.1 + 0.3);
        });
      } catch (e) {}
    }
  };

  // ==========================================
  // 3. ANA MENÜDE YÜRÜYEN NPC'LER (SQUAD LAYER)
  // ==========================================
  const charLayer = document.createElement('div');
  charLayer.id = 'wgtCharactersLayer';
  document.body.appendChild(charLayer);

  let lastSpokenCharId = null;
  const recentGlobalLines = [];
  const charRecentHistory = {};
  SQUAD.forEach(c => { charRecentHistory[c.id] = []; });

  function getNonRepeatingDialogue(char) {
    let candidatePool = [];
    if (char.quotes && char.quotes.length > 0) {
      candidatePool.push(...char.quotes.map(text => ({ text, weight: 3 })));
    }
    if (char.gender === 'm') {
      candidatePool.push(...MANIFEST_LYRIC_LINES.map(text => ({ text: `🎵 ${text}`, weight: 4 })));
      candidatePool.push(...MANIFEST_FULL_BLOCKS.map(text => ({ text, weight: 2 })));
      candidatePool.push(...MALE_QUOTES.map(text => ({ text, weight: 2 })));
    }
    candidatePool.push(...COMMON_QUOTES.map(text => ({ text, weight: 1 })));

    const charHist = charRecentHistory[char.id] || [];
    let validPool = candidatePool.filter(item => 
      !charHist.includes(item.text) && !recentGlobalLines.includes(item.text)
    );

    if (validPool.length === 0) {
      validPool = candidatePool.filter(item => !charHist.slice(-2).includes(item.text));
    }

    const expandedList = [];
    validPool.forEach(item => {
      for (let i = 0; i < item.weight; i++) expandedList.push(item.text);
    });

    const chosenText = expandedList[Math.floor(Math.random() * expandedList.length)] || "Selams!";
    charHist.push(chosenText);
    if (charHist.length > 5) charHist.shift();
    charRecentHistory[char.id] = charHist;

    recentGlobalLines.push(chosenText);
    if (recentGlobalLines.length > 8) recentGlobalLines.shift();

    return chosenText;
  }

  function triggerDialogue(charData, charEl) {
    const bubble = charEl.querySelector('.wgt-speech-bubble');
    const sleepBubble = charEl.querySelector('.wgt-sleep-bubble');
    if (!bubble) return;

    if (sleepBubble) sleepBubble.classList.remove('sleeping');

    const speech = getNonRepeatingDialogue(charData);
    bubble.textContent = speech;
    bubble.classList.add('active');

    const displayDuration = speech.length > 45 ? 5500 : 4000;
    setTimeout(() => {
      bubble.classList.remove('active');
    }, displayDuration);
  }

  const activeCharNodes = SQUAD.map((char) => {
    const el = document.createElement('div');
    el.className = 'wgt-character-node';
    el.id = `char_${char.id}`;

    let posX = Math.random() * (window.innerWidth - 140) + 50;
    let posY = Math.random() * (window.innerHeight - 220) + 80;
    el.style.left = `${posX}px`;
    el.style.top = `${posY}px`;

    el.innerHTML = `
      <div class="wgt-speech-bubble" id="bubble_${char.id}">...</div>
      ${char.canSleep ? `<div class="wgt-sleep-bubble" id="sleep_${char.id}">Zzz...</div>` : ''}
      <div class="wgt-sprite-wrapper">
        <img class="wgt-character-head" src="${char.avatar}" onerror="this.src='${char.fallback}'" alt="${char.name}" style="border-color:${char.bodyColor};" />
        <div class="wgt-char-body" style="background:${char.bodyColor};">
          <div class="wgt-char-arm left" style="background:${char.skinTone};"></div>
          <div class="wgt-char-arm right" style="background:${char.skinTone};"></div>
        </div>
        <div class="wgt-char-legs">
          <div class="wgt-char-leg left"></div>
          <div class="wgt-char-leg right"></div>
        </div>
      </div>
      <div class="wgt-char-shadow"></div>
      <span class="wgt-character-name-tag">${char.name}</span>
    `;

    charLayer.appendChild(el);
    el.addEventListener('click', () => triggerDialogue(char, el));

    return {
      data: char,
      element: el,
      sleepEl: el.querySelector('.wgt-sleep-bubble'),
      x: posX,
      y: posY,
      targetX: posX,
      targetY: posY,
      speed: 1.2 + Math.random() * 0.8,
      isMoving: false
    };
  });

  let menuAnimationFrameId = null;
  function stepMenuCharacters() {
    activeCharNodes.forEach(node => {
      if (!node.isMoving && Math.random() < 0.035) {
        node.isMoving = true;
        if (node.sleepEl) node.sleepEl.classList.remove('sleeping');

        node.targetX = Math.max(40, Math.min(window.innerWidth - 100, node.x + (Math.random() * 360 - 180)));
        node.targetY = Math.max(80, Math.min(window.innerHeight - 140, node.y + (Math.random() * 200 - 100)));

        if (node.targetX < node.x) {
          node.element.classList.add('facing-left');
        } else {
          node.element.classList.remove('facing-left');
        }
        node.element.classList.add('walking');
      }

      if (node.isMoving) {
        const dx = node.targetX - node.x;
        const dy = node.targetY - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 4) {
          node.x += (dx / dist) * node.speed;
          node.y += (dy / dist) * node.speed;
          node.element.style.left = `${node.x}px`;
          node.element.style.top = `${node.y}px`;
        } else {
          node.isMoving = false;
          node.element.classList.remove('walking');
          if (node.data.canSleep && Math.random() < 0.45) {
            if (node.sleepEl) node.sleepEl.classList.add('sleeping');
          }
        }
      }
    });
    menuAnimationFrameId = requestAnimationFrame(stepMenuCharacters);
  }
  menuAnimationFrameId = requestAnimationFrame(stepMenuCharacters);

  const talkInterval = setInterval(() => {
    const availableNodes = activeCharNodes.filter(n => n.data.id !== lastSpokenCharId);
    const chosenNode = availableNodes[Math.floor(Math.random() * availableNodes.length)];
    if (chosenNode) {
      lastSpokenCharId = chosenNode.data.id;
      triggerDialogue(chosenNode.data, chosenNode.element);
    }
  }, 4800);

  // ==========================================
  // 4. 2D SIDE-SCROLLER RPG, ARAÇ SÜRME & GÖREV SİSTEMİ
  // ==========================================
  const SIDE_LOCATIONS = [
    { id: 'basilika', name: 'St. Martin Basilika', x: 250, w: 260, h: 220, color: '#c59b27', icon: '⛪', desc: 'Barok Tarihi Meydan' },
    { id: 'rwu', name: 'RWU H-Gebäude', x: 750, w: 300, h: 240, color: '#0066b2', icon: '🎓', desc: 'Amfiler & Derslikler' },
    { id: 'mensa', name: 'Mensa Weingarten', x: 1300, w: 240, h: 200, color: '#e67e22', icon: '🍽️', desc: 'Maultaschen & Kahve' },
    { id: 'cpark', name: 'C Parkplatz (Drift)', x: 1850, w: 340, h: 180, color: '#34495e', icon: '🏎️', desc: 'Drift & Yanlama Alanı' },
    { id: 'sima', name: 'Sima Cafe', x: 2500, w: 220, h: 190, color: '#8e44ad', icon: '☕', desc: 'Filtre Kahve & Muhabbet' },
    { id: 'kaufland', name: 'Kaufland Weingarten', x: 3000, w: 280, h: 220, color: '#c0392b', icon: '🛒', desc: 'Abur Cubur Stoğu' },
    { id: 'mcdrive', name: 'McDonald\'s & McDrive', x: 3550, w: 260, h: 210, color: '#f1c40f', icon: '🍔', desc: '20\'li Nugget Ziyafeti' },
    { id: 'manzara', name: 'Manzara Tepesi', x: 4100, w: 260, h: 200, color: '#27ae60', icon: '🌄', desc: 'Gece Manzara Noktası' }
  ];

  const STREET_LENGTH = 4600;

  // Görev ve Eşya Listesi (World Items)
  let worldItems = [
    { id: 'stanley', name: 'Naz\'ın Pembe Stanley\'i', icon: '🌸', x: 1580, collected: false, targetNpc: 'naz', desc: 'Naz\'a götür' },
    { id: 'redbull', name: 'Aral Soğuk Red Bull', icon: '🥫', x: 2720, collected: false, targetNpc: null, desc: 'Hız boostu (+60% Speed)' },
    { id: 'bmwkey', name: 'Ünsal\'ın BMW Anahtarı', icon: '🔑', x: 3820, collected: false, targetNpc: 'unsal', desc: 'Ünsal\'a teslim et' }
  ];

  let quests = {
    stanleyDelivered: false,
    bmwKeyDelivered: false,
    carDriftDone: false
  };

  let playerInventory = [];
  let speedBoostTimer = 0;

  // Araç Durumu (Opel / BMW)
  let car = {
    x: 1900,
    speed: 0,
    maxSpeed: 11,
    accel: 0.35,
    friction: 0.94,
    isOccupied: false,
    isDrifting: false,
    smokeParticles: []
  };

  let selectedCharacter = SQUAD[0];
  let weather = 'sunny';
  let timeOfDay = 'noon';
  let isRpgRunning = false;

  // Ana Menü Başlatma Butonu
  const showcaseContainer = document.createElement('div');
  showcaseContainer.id = 'weingartenShowcase';
  showcaseContainer.className = 'wgt-campus-showcase';
  showcaseContainer.innerHTML = `
    <button type="button" class="wgt-btn-launch-rpg" id="btnLaunchRpg">
      <span>🎮</span>
      <span>ENTER WEINGARTEN 2D SIDE-SCROLLER RPG</span>
      <span>🏎️</span>
    </button>
  `;

  const servicesSection = document.getElementById('servicesSection');
  if (servicesSection && servicesSection.parentNode) {
    servicesSection.parentNode.insertBefore(showcaseContainer, servicesSection);
  }

  // RPG Modal Penceresi
  const gameModal = document.createElement('div');
  gameModal.id = 'wgtGameModal';
  gameModal.className = 'wgt-game-modal-backdrop';
  gameModal.style.display = 'none';

  gameModal.innerHTML = `
    <div class="wgt-game-window">
      
      <!-- Top HUD -->
      <div class="wgt-game-top-hud">
        <div class="wgt-game-hud-title">
          <span>⛪ WEINGARTEN SIDE-SCROLLER RPG</span>
          <span style="font-size:0.65rem; color:#7d7260;">2D RETRO OPEN-WORLD</span>
        </div>

        <div class="wgt-weather-controls">
          <span style="font-size:0.65rem; color:var(--wgt-gold);">WEATHER:</span>
          <button type="button" class="wgt-hud-select-btn active" data-weather="sunny">☀️ SUN</button>
          <button type="button" class="wgt-hud-select-btn" data-weather="rainy">🌧️ RAIN</button>
          <button type="button" class="wgt-hud-select-btn" data-weather="snowy">❄️ SNOW</button>

          <span style="font-size:0.65rem; color:var(--wgt-gold); margin-left:8px;">TIME:</span>
          <button type="button" class="wgt-hud-select-btn active" data-time="noon">☀️ NOON</button>
          <button type="button" class="wgt-hud-select-btn" data-time="golden">🌇 GOLDEN</button>
          <button type="button" class="wgt-hud-select-btn" data-time="night">🌙 NIGHT</button>
        </div>

        <button type="button" class="wgt-game-close-btn" id="btnCloseRpg">&times;</button>
      </div>

      <!-- Envanter Çantası HUD -->
      <div class="wgt-inventory-bar">
        <span style="font-size:0.65rem; color:var(--wgt-gold); font-weight:700;">BAG:</span>
        <div class="wgt-inv-slot empty" id="invSlot0">-</div>
        <div class="wgt-inv-slot empty" id="invSlot1">-</div>
        <div class="wgt-inv-slot empty" id="invSlot2">-</div>
      </div>

      <!-- Görev Takipçisi HUD -->
      <div class="wgt-quest-tracker">
        <div class="wgt-quest-header">
          <span>SQUAD QUESTS</span>
          <span id="questCounter">0/3</span>
        </div>
        <div class="wgt-quest-item" id="questStanley">🌸 Naz'ın Stanley Termosunu Bul</div>
        <div class="wgt-quest-item" id="questBmwKey">🔑 Ünsal'ın BMW Anahtarını Teslim Et</div>
        <div class="wgt-quest-item" id="questDrift">🏎️ C Parkplatz'da Arabayla Drift Yap [SPACE]</div>
      </div>

      <!-- Hız Göstergesi (Araçtayken) -->
      <div class="wgt-speedo-hud" id="speedoHud">
        <div class="wgt-speedo-val"><span id="speedVal">0</span> <span>KM/H</span></div>
        <div style="font-size:0.58rem; color:#7d7260;">[H] KORNA • [SPACE] DRIFT • [F] IN</div>
      </div>

      <!-- Karakter Seçim Ekranı -->
      <div class="wgt-char-select-screen" id="wgtCharSelectScreen">
        <h2 class="wgt-char-select-title">SELECT YOUR SQUAD CHARACTER</h2>
        <div class="wgt-char-grid" id="wgtCharGrid"></div>
        <button type="button" class="wgt-btn-start-game" id="btnStartGameEngine">START WALKING WEINGARTEN</button>
      </div>

      <!-- Canvas Viewport -->
      <div class="wgt-canvas-viewport">
        <canvas id="wgtRpgCanvas"></canvas>
      </div>

      <div class="wgt-game-footer-hints">
        <div><strong>A - D / Ok Tuşları:</strong> Koş/Sür • <strong>[F]:</strong> Arabaya Bin/İn • <strong>[SPACE]:</strong> Drift/Koş • <strong>[E]:</strong> Konuş/Topla</div>
        <div id="wgtLocationBadge">LOCATION: WEINGARTEN STREETS</div>
      </div>

    </div>
  `;

  document.body.appendChild(gameModal);

  // Karakter Seçim Kartlarını Doldur
  const charGrid = gameModal.querySelector('#wgtCharGrid');
  SQUAD.forEach(char => {
    const card = document.createElement('div');
    card.className = `wgt-char-card ${char.id === selectedCharacter.id ? 'selected' : ''}`;
    card.innerHTML = `
      <img class="wgt-char-card-img" src="${char.avatar}" onerror="this.src='${char.fallback}'" alt="${char.name}" style="border-color:${char.bodyColor};" />
      <span class="wgt-char-card-name">${char.name}</span>
      <span class="wgt-char-card-role">${char.quotes[0]}</span>
    `;
    card.addEventListener('click', () => {
      gameModal.querySelectorAll('.wgt-char-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedCharacter = char;
    });
    charGrid.appendChild(card);
  });

  gameModal.querySelectorAll('[data-weather]').forEach(btn => {
    btn.addEventListener('click', () => {
      gameModal.querySelectorAll('[data-weather]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      weather = btn.dataset.weather;
    });
  });

  gameModal.querySelectorAll('[data-time]').forEach(btn => {
    btn.addEventListener('click', () => {
      gameModal.querySelectorAll('[data-time]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      timeOfDay = btn.dataset.time;
    });
  });

  // ==========================================
  // 5. SIDE-SCROLLER CANVAS ENGINE & RENDER
  // ==========================================
  const canvas = gameModal.querySelector('#wgtRpgCanvas');
  const ctx = canvas.getContext('2d');
  let rpgAnimationId = null;

  let playerSide = {
    x: 400,
    facing: 'right',
    animFrame: 0,
    isMoving: false
  };

  let sideNpcs = [];
  function spawnSideNpcs() {
    sideNpcs = SQUAD.filter(c => c.id !== selectedCharacter.id).map((c, idx) => {
      const loc = SIDE_LOCATIONS[idx % SIDE_LOCATIONS.length];
      return {
        data: c,
        x: loc.x + loc.w / 2 + (Math.random() * 60 - 30),
        facing: Math.random() < 0.5 ? 'left' : 'right',
        animFrame: Math.random() * 10,
        activeDialogue: null,
        dialogueTimer: 0,
        isPanicking: false
      };
    });
  }

  let weatherParticles = [];
  for (let i = 0; i < 110; i++) {
    weatherParticles.push({
      x: Math.random() * 1400,
      y: Math.random() * 700,
      speed: 3 + Math.random() * 5,
      size: 1.5 + Math.random() * 2
    });
  }

  function updateInventoryHud() {
    [0, 1, 2].forEach(idx => {
      const slot = gameModal.querySelector(`#invSlot${idx}`);
      if (slot) {
        if (playerInventory[idx]) {
          slot.textContent = playerInventory[idx].icon;
          slot.classList.remove('empty');
          slot.title = playerInventory[idx].name;
        } else {
          slot.textContent = '-';
          slot.classList.add('empty');
          slot.title = '';
        }
      }
    });
  }

  function updateQuestHud() {
    const q1 = gameModal.querySelector('#questStanley');
    const q2 = gameModal.querySelector('#questBmwKey');
    const q3 = gameModal.querySelector('#questDrift');
    const counter = gameModal.querySelector('#questCounter');

    let completed = 0;
    if (quests.stanleyDelivered) { q1?.classList.add('done'); completed++; }
    if (quests.bmwKeyDelivered) { q2?.classList.add('done'); completed++; }
    if (quests.carDriftDone) { q3?.classList.add('done'); completed++; }

    if (counter) counter.textContent = `${completed}/3`;
  }

  const sideKeys = {};
  window.addEventListener('keydown', e => {
    sideKeys[e.code] = true;

    if (!isRpgRunning) return;

    // [F] Tuşu: Arabaya Bin / İn
    if (e.code === 'KeyF') {
      const distToCar = Math.abs(car.x - playerSide.x);
      if (!car.isOccupied && distToCar < 120) {
        car.isOccupied = true;
        SoundEngine.playItemPickup();
      } else if (car.isOccupied) {
        car.isOccupied = false;
        playerSide.x = car.x + (playerSide.facing === 'right' ? 50 : -50);
      }
    }

    // [H] Tuşu: Korna Çal
    if (e.code === 'KeyH' && car.isOccupied) {
      SoundEngine.playHorn();
      // Yakındaki NPC'leri korkut ve kaçır
      sideNpcs.forEach(npc => {
        const dist = Math.abs(npc.x - car.x);
        if (dist < 220) {
          npc.activeDialogue = Math.random() < 0.5 ? "ZINKKK! Yavaş sür be!" : "Ayyy tamponu vurcan!";
          npc.dialogueTimer = 180;
          npc.x += (npc.x > car.x ? 60 : -60);
        }
      });
    }

    // [E] Tuşu: NPC ile Konuş veya Yerden Eşya Topla / Teslim Et
    if (e.code === 'KeyE') {
      // 1. Yerden eşya alma kontrolü
      worldItems.forEach(item => {
        if (!item.collected && Math.abs(item.x - playerSide.x) < 70) {
          item.collected = true;
          playerInventory.push(item);
          SoundEngine.playItemPickup();
          updateInventoryHud();

          // Red Bull alındıysa direkt hız boostu
          if (item.id === 'redbull') {
            speedBoostTimer = 600; // 10 saniye
          }
        }
      });

      // 2. NPC'ye teslimat veya diyalog
      sideNpcs.forEach(npc => {
        const dist = Math.abs(npc.x - (car.isOccupied ? car.x : playerSide.x));
        if (dist < 100) {
          // Naz'a Stanley teslimatı
          const stanleyIndex = playerInventory.findIndex(i => i.id === 'stanley');
          if (npc.data.id === 'naz' && stanleyIndex !== -1 && !quests.stanleyDelivered) {
            playerInventory.splice(stanleyIndex, 1);
            quests.stanleyDelivered = true;
            npc.activeDialogue = "Aşkım Stanleyimi bulmuşsun çok teşekkürler! <3";
            npc.dialogueTimer = 240;
            SoundEngine.playQuestComplete();
            updateInventoryHud();
            updateQuestHud();
            return;
          }

          // Ünsal'a BMW anahtarı teslimatı
          const keyIndex = playerInventory.findIndex(i => i.id === 'bmwkey');
          if (npc.data.id === 'unsal' && keyIndex !== -1 && !quests.bmwKeyDelivered) {
            playerInventory.splice(keyIndex, 1);
            quests.bmwKeyDelivered = true;
            npc.activeDialogue = "Hacı anahtarı bulmuşsun adamsın! BMW ile gazlama vakti!";
            npc.dialogueTimer = 240;
            SoundEngine.playQuestComplete();
            updateInventoryHud();
            updateQuestHud();
            return;
          }

          // Standart konuşma
          npc.activeDialogue = getNonRepeatingDialogue(npc.data);
          npc.dialogueTimer = 200;
        }
      });
    }
  });

  window.addEventListener('keyup', e => { sideKeys[e.code] = false; });

  function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  }

  // 2D Karakter Sprite Çizim Fonksiyonu
  function draw2DCharacterSprite(context, x, y, char, facing, isWalking, frame, isPlayer = false) {
    context.save();
    context.translate(x, y);
    if (facing === 'left') context.scale(-1, 1);

    const bob = isWalking ? Math.sin(frame * 0.4) * 3 : 0;
    const legSwing = isWalking ? Math.sin(frame * 0.4) * 8 : 0;
    const armSwing = isWalking ? Math.cos(frame * 0.4) * 10 : 0;

    // Gölge
    context.fillStyle = 'rgba(0, 0, 0, 0.45)';
    context.beginPath();
    context.ellipse(0, 4, 18, 5, 0, 0, Math.PI * 2);
    context.fill();

    // Ayaklar
    context.fillStyle = '#111111';
    context.fillRect(-7, -12 - (isWalking ? -legSwing : 0), 5, 14 + (isWalking ? -legSwing : 0));
    context.fillRect(2, -12 - (isWalking ? legSwing : 0), 5, 14 + (isWalking ? legSwing : 0));

    // Gövde
    context.fillStyle = char.bodyColor || '#2d98da';
    context.fillRect(-12, -34 + bob, 24, 22);

    // Kollar
    context.fillStyle = char.skinTone || '#ffd2a5';
    context.fillRect(-16, -32 + bob + armSwing, 4, 16);
    context.fillRect(12, -32 + bob - armSwing, 4, 16);

    // Kafa
    context.beginPath();
    context.arc(0, -48 + bob, 15, 0, Math.PI * 2);
    context.fillStyle = char.skinTone || '#ffd2a5';
    context.fill();
    context.strokeStyle = char.bodyColor || '#ffffff';
    context.lineWidth = 2;
    context.stroke();

    context.fillStyle = '#000000';
    context.fillRect(2, -50 + bob, 3, 3);
    context.fillRect(7, -50 + bob, 3, 3);

    context.restore();

    context.save();
    context.fillStyle = isPlayer ? '#e5b338' : '#ffffff';
    context.font = isPlayer ? 'bold 11px "Cinzel"' : 'bold 10px "JetBrains Mono"';
    context.textAlign = 'center';
    context.fillText(`${isPlayer ? '★ ' : ''}${char.name}${isPlayer ? ' (YOU)' : ''}`, x, y - 72);
    context.restore();
  }

  // 2D Araba Çizim Fonksiyonu (Opel Astra / BMW Retro Coupe)
  function draw2DCarSprite(context, x, y, carState) {
    context.save();
    context.translate(x, y);

    const facingRight = carState.speed >= 0;

    // Araba Gövdesi (Metalik Koyu Gri / Mavi)
    context.fillStyle = '#2c3e50';
    context.fillRect(-55, -28, 110, 22);

    // Tavan / Kabin
    context.fillStyle = '#1a252f';
    context.fillRect(-30, -48, 60, 22);

    // Camlar
    context.fillStyle = '#74b9ff';
    context.fillRect(-26, -45, 22, 16);
    context.fillRect(4, -45, 22, 16);

    // Farlar
    context.fillStyle = facingRight ? '#f1c40f' : '#e74c3c';
    context.fillRect(48, -22, 7, 10);
    context.fillStyle = facingRight ? '#e74c3c' : '#f1c40f';
    context.fillRect(-55, -22, 7, 10);

    // Tekerlekler (Jantlı)
    [-34, 34].forEach(wheelX => {
      context.fillStyle = '#111111';
      context.beginPath();
      context.arc(wheelX, -6, 12, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#bdc3c7';
      context.beginPath();
      context.arc(wheelX, -6, 6, 0, Math.PI * 2);
      context.fill();
    });

    // Sürücü Kafası (Araç doluyken içeriden gözükür)
    if (carState.isOccupied) {
      context.beginPath();
      context.arc(-4, -36, 9, 0, Math.PI * 2);
      context.fillStyle = selectedCharacter.skinTone || '#ffd2a5';
      context.fill();
    }

    context.restore();
  }

  function sideScrollerLoop() {
    if (!isRpgRunning) return;

    let groundY = canvas.height - 90;

    // Hız Boostu Sayacı
    let currentSpeed = selectedCharacter.speed;
    if (speedBoostTimer > 0) {
      currentSpeed *= 1.6;
      speedBoostTimer--;
    }

    // -----------------------------
    // FİZİK & HAREKET HESAPLAMASI
    // -----------------------------
    if (car.isOccupied) {
      // Araç Sürüş Fiziği
      if (sideKeys['KeyD'] || sideKeys['ArrowRight']) {
        car.speed = Math.min(car.maxSpeed, car.speed + car.accel);
      } else if (sideKeys['KeyA'] || sideKeys['ArrowLeft']) {
        car.speed = Math.max(-car.maxSpeed, car.speed - car.accel);
      } else {
        car.speed *= car.friction;
      }

      // Drift / El Freni
      if (sideKeys['Space'] && Math.abs(car.speed) > 2) {
        car.isDrifting = true;
        car.speed *= 0.96;
        SoundEngine.playDriftScreech();

        // Drift dumanı parçacığı üret
        car.smokeParticles.push({
          x: car.x + (Math.random() * 20 - 10),
          y: groundY - 8,
          size: 6 + Math.random() * 10,
          opacity: 0.8
        });

        // C Parkplatz lokasyonundaysa görevi tamamla
        if (car.x > 1850 && car.x < 2190 && !quests.carDriftDone) {
          quests.carDriftDone = true;
          SoundEngine.playQuestComplete();
          updateQuestHud();
        }
      } else {
        car.isDrifting = false;
      }

      car.x += car.speed;
      car.x = Math.max(60, Math.min(STREET_LENGTH - 60, car.x));
      playerSide.x = car.x;

      // Hız Göstergesi Güncelle
      const speedo = gameModal.querySelector('#speedoHud');
      const speedVal = gameModal.querySelector('#speedVal');
      if (speedo && speedVal) {
        speedo.classList.add('active');
        speedVal.textContent = Math.round(Math.abs(car.speed) * 12);
      }
    } else {
      // Yaya Hareketi
      const speedo = gameModal.querySelector('#speedoHud');
      if (speedo) speedo.classList.remove('active');

      if (sideKeys['Space']) currentSpeed *= 1.5;

      playerSide.isMoving = false;
      if (sideKeys['KeyA'] || sideKeys['ArrowLeft']) {
        playerSide.x -= currentSpeed;
        playerSide.facing = 'left';
        playerSide.isMoving = true;
        playerSide.animFrame += 1;
      }
      if (sideKeys['KeyD'] || sideKeys['ArrowRight']) {
        playerSide.x += currentSpeed;
        playerSide.facing = 'right';
        playerSide.isMoving = true;
        playerSide.animFrame += 1;
      }
      playerSide.x = Math.max(50, Math.min(STREET_LENGTH - 50, playerSide.x));
    }

    // Kamera Takibi
    const focusX = car.isOccupied ? car.x : playerSide.x;
    const camX = focusX - canvas.width / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-camX, 0);

    // 1. Arka Plan Manzara
    ctx.fillStyle = '#0f1411';
    ctx.fillRect(0, 0, STREET_LENGTH, canvas.height);

    ctx.fillStyle = '#162119';
    for (let i = 0; i < 15; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 350, groundY);
      ctx.lineTo(i * 350 + 175, groundY - 220);
      ctx.lineTo(i * 350 + 350, groundY);
      ctx.fill();
    }

    // 2. Weingarten Lokasyon Binaları
    let currentLocName = 'Weingarten Street';
    SIDE_LOCATIONS.forEach(loc => {
      ctx.fillStyle = loc.color + '26';
      ctx.strokeStyle = loc.color;
      ctx.lineWidth = 3;
      ctx.fillRect(loc.x, groundY - loc.h, loc.w, loc.h);
      ctx.strokeRect(loc.x, groundY - loc.h, loc.w, loc.h);

      // Pencereler
      ctx.fillStyle = 'rgba(255, 235, 170, 0.25)';
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          ctx.fillRect(loc.x + 20 + c * (loc.w / 3.8), groundY - loc.h + 40 + r * 50, 24, 30);
        }
      }

      ctx.fillStyle = loc.color;
      ctx.fillRect(loc.x + loc.w / 2 - 18, groundY - 55, 36, 55);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px "Cinzel"';
      ctx.textAlign = 'center';
      ctx.fillText(`${loc.icon} ${loc.name}`, loc.x + loc.w / 2, groundY - loc.h - 15);

      ctx.fillStyle = loc.color;
      ctx.font = '11px "JetBrains Mono"';
      ctx.fillText(loc.desc, loc.x + loc.w / 2, groundY - loc.h + 22);

      if (focusX > loc.x && focusX < loc.x + loc.w) {
        currentLocName = loc.name;
      }
    });

    const locBadge = gameModal.querySelector('#wgtLocationBadge');
    if (locBadge) locBadge.textContent = `LOCATION: ${currentLocName.toUpperCase()}`;

    // 3. Cadde & Yol Çizimi
    ctx.fillStyle = '#222823';
    ctx.fillRect(0, groundY, STREET_LENGTH, 90);

    ctx.fillStyle = '#e5b338';
    ctx.fillRect(0, groundY - 4, STREET_LENGTH, 4);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.setLineDash([30, 20]);
    ctx.beginPath();
    ctx.moveTo(0, groundY + 45);
    ctx.lineTo(STREET_LENGTH, groundY + 45);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Görev Eşyalarını (World Items) Çiz
    worldItems.forEach(item => {
      if (!item.collected) {
        ctx.save();
        ctx.font = '24px serif';
        ctx.textAlign = 'center';
        // Havada hafif süzülme animasyonu
        const floatY = Math.sin(Date.now() * 0.005) * 6;
        ctx.fillText(item.icon, item.x, groundY - 14 + floatY);

        ctx.fillStyle = '#e5b338';
        ctx.font = 'bold 10px "JetBrains Mono"';
        ctx.fillText(item.name, item.x, groundY - 40 + floatY);
        ctx.restore();
      }
    });

    // 5. Drift Duman Parçacıklarını Çiz
    car.smokeParticles.forEach((p, idx) => {
      ctx.fillStyle = `rgba(220, 220, 220, ${p.opacity})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      p.size += 0.4;
      p.opacity -= 0.025;
      if (p.opacity <= 0) car.smokeParticles.splice(idx, 1);
    });

    // 6. Arabayı Çiz
    draw2DCarSprite(ctx, car.x, groundY, car);

    // 7. NPC'leri Çiz
    sideNpcs.forEach(npc => {
      draw2DCharacterSprite(ctx, npc.x, groundY, npc.data, npc.facing, false, npc.animFrame, false);

      if (npc.dialogueTimer > 0 && npc.activeDialogue) {
        ctx.save();
        ctx.fillStyle = '#fffdfa';
        ctx.strokeStyle = '#c59b27';
        ctx.lineWidth = 1.5;
        const txtWidth = ctx.measureText(npc.activeDialogue).width + 20;
        ctx.fillRect(npc.x - txtWidth / 2, groundY - 110, txtWidth, 24);
        ctx.strokeRect(npc.x - txtWidth / 2, groundY - 110, txtWidth, 24);

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 11px "JetBrains Mono"';
        ctx.textAlign = 'center';
        ctx.fillText(npc.activeDialogue, npc.x, groundY - 94);
        npc.dialogueTimer--;
        ctx.restore();
      }
    });

    // 8. Oyuncuyu Çiz (Araba içinde değilken)
    if (!car.isOccupied) {
      draw2DCharacterSprite(
        ctx,
        playerSide.x,
        groundY,
        selectedCharacter,
        playerSide.facing,
        playerSide.isMoving,
        playerSide.animFrame,
        true
      );
    }

    // 9. Hava Durumu Parçacıkları
    if (weather === 'rainy' || weather === 'snowy') {
      ctx.fillStyle = weather === 'rainy' ? '#74b9ff' : '#ffffff';
      weatherParticles.forEach(p => {
        ctx.beginPath();
        ctx.arc(camX + p.x % canvas.width, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        p.y += p.speed;
        if (weather === 'rainy') p.x += 1;
        if (p.y > canvas.height) p.y = 0;
      });
    }

    ctx.restore(); // Kamera sonu

    // 10. Gün/Zaman Filtresi
    if (timeOfDay === 'night') {
      ctx.fillStyle = 'rgba(5, 8, 14, 0.65)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (timeOfDay === 'golden') {
      ctx.fillStyle = 'rgba(255, 150, 40, 0.18)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    rpgAnimationId = requestAnimationFrame(sideScrollerLoop);
  }

  // Modal Başlatma & Kapatma
  showcaseContainer.querySelector('#btnLaunchRpg')?.addEventListener('click', () => {
    gameModal.style.display = 'flex';
    gameModal.querySelector('#wgtCharSelectScreen').style.display = 'flex';
  });

  gameModal.querySelector('#btnCloseRpg')?.addEventListener('click', () => {
    isRpgRunning = false;
    if (rpgAnimationId) cancelAnimationFrame(rpgAnimationId);
    gameModal.style.display = 'none';
  });

  gameModal.querySelector('#btnStartGameEngine')?.addEventListener('click', () => {
    gameModal.querySelector('#wgtCharSelectScreen').style.display = 'none';
    resizeCanvas();
    spawnSideNpcs();
    updateInventoryHud();
    updateQuestHud();
    isRpgRunning = true;
    sideScrollerLoop();
  });

  window.addEventListener('resize', () => {
    if (isRpgRunning) resizeCanvas();
  });

  return {
    destroy: () => {
      clearInterval(talkInterval);
      if (menuAnimationFrameId) cancelAnimationFrame(menuAnimationFrameId);
      if (rpgAnimationId) cancelAnimationFrame(rpgAnimationId);
      charLayer.remove();
      showcaseContainer.remove();
      gameModal.remove();
    }
  };
}