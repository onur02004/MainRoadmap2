export function init() {
  const PLAYBOOK_PLAYS = [
    { title: "The Lorenzo Von Matterhorn", desc: "Create fake Wikipedia articles, a website, and a mysterious persona." },
    { title: "The Scuba Diver", desc: "Wear full scuba gear into the bar. Claim you're going to dive into the Hudson." },
    { title: "The Ted Mosby", desc: "Tell a girl on the first night: 'I think I'm in love with you' with puppy eyes." },
    { title: "The SNASA", desc: "Claim you work for Secret NASA and you've been to the Smooth Moon." },
    { title: "The Mrs. Stinsfire", desc: "Disguise yourself as a strict English nanny." },
    { title: "The 'Don't Drink That!'", desc: "Run across the bar in slow motion to save her from a nonexistent fly in her drink." }
  ];

  let playIndex = 0;
  let slapCount = 1;

  const himymLayer = document.createElement('div');
  himymLayer.id = 'himymGameLayer';
  himymLayer.className = 'himym-interactive-layer';
  himymLayer.innerHTML = `
    <!-- Yağmur Efekti Canvas -->
    <canvas id="himymRainCanvas" class="himym-rain-canvas"></canvas>

    <!-- Sol Üst: Sarı Şemsiye Butonu -->
    <div class="himym-umbrella-badge" id="btnToggleRain" title="Click to Open the Giant Yellow Umbrella!">
      <span class="umbrella-icon">☂️</span>
      <span class="umbrella-label">YELLOW UMBRELLA</span>
    </div>

    <!-- EKRANIN ÜSTÜNDE AÇILAN DEV SARI ŞEMSİYE -->
    <div class="himym-big-umbrella-stage" id="bigUmbrellaStage">
      <div class="umbrella-canopy-wrap">
        <svg class="giant-yellow-umbrella-svg" viewBox="0 0 400 220" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Şemsiye Kubbesi -->
          <path d="M 10 140 C 15 30, 385 30, 390 140 C 340 120, 300 140, 260 125 C 220 140, 180 125, 140 140 C 100 125, 60 140, 10 140 Z" fill="#F7D02C" stroke="#D4A017" stroke-width="4"/>
          <!-- Dilim Çizgileri -->
          <path d="M 200 35 Q 160 85 140 140" stroke="#E5B810" stroke-width="3" fill="none"/>
          <path d="M 200 35 Q 240 85 260 125" stroke="#E5B810" stroke-width="3" fill="none"/>
          <!-- Şemsiyenin Ucu & Sapı -->
          <path d="M 200 20 L 200 35" stroke="#4A3B18" stroke-width="6" stroke-linecap="round"/>
          <path d="M 200 120 L 200 200 C 200 215, 175 215, 175 200" stroke="#4A3B18" stroke-width="6" stroke-linecap="round" fill="none"/>
        </svg>
        <div class="umbrella-quote-bubble">"Right place, right time." — Ted Mosby ☂️</div>
      </div>
    </div>

    <!-- Sağ Taraf Kontrol & Widget Barı -->
    <div class="himym-sidebar-tools">
      <!-- Mavi Fransız Kornosu (PNG Buton) -->
      <button type="button" class="himym-tool-btn horn" id="btnFrenchHorn" title="For Robin: Play the Blue French Horn!">
        <img src="https://cdn-icons-png.flaticon.com/512/848/848123.png" alt="Horn" class="horn-mini-thumb" />
        <small>BLUE HORN</small>
      </button>

      <!-- The Playbook Butonu -->
      <button type="button" class="himym-tool-btn playbook" id="btnOpenPlaybook" title="Barney's Playbook: Challenge Accepted!">
        <span>📖</span>
        <small>PLAYBOOK</small>
      </button>

      <!-- Slap Bet Tokat Butonu -->
      <button type="button" class="himym-tool-btn slap" id="btnSlapCountdown" title="Slap Bet Countdown!">
        <span>🖐️</span>
        <small>SLAP BET</small>
      </button>
    </div>

    <!-- MacLaren's Pub Bira Bardağı (Sağ Alt) -->
    <div class="himym-beer-widget" id="beerWidget" title="Click to drink at MacLaren's Pub!">
      <div class="beer-mug">
        <div class="beer-foam"></div>
        <div class="beer-fill" id="beerFillLevel" style="height: 40%;"></div>
      </div>
      <span class="beer-badge">MACLAREN'S PUB 🍺</span>
    </div>

    <!-- The Playbook Pop-up Penceresi -->
    <div class="himym-modal" id="playbookModal" style="display: none;">
      <div class="playbook-book">
        <div class="playbook-cover">
          <div class="book-title">THE PLAYBOOK</div>
          <div class="book-author">By Barney Stinson</div>
          <button class="book-close" id="btnClosePlaybook">&times;</button>
        </div>
        <div class="playbook-page">
          <h4 id="playTitle">The Lorenzo Von Matterhorn</h4>
          <p id="playDesc">Create fake Wikipedia articles, a website, and a mysterious persona.</p>
          <div class="playbook-actions">
            <button type="button" class="book-btn" id="btnNextPlay">NEXT PLAY &rarr;</button>
            <button type="button" class="book-btn suit" id="btnSuitUp">SUIT UP! 👔</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tokat Efekti Katmanı -->
    <div class="himym-slap-fx" id="slapFx">
      <div class="slap-hand">🖐️</div>
      <div class="slap-text" id="slapText">THAT'S ONE!!</div>
    </div>

    <!-- Ekranda Canlanan Dev Mavi Fransız Kornosu Sahnesi -->
    <div class="himym-horn-stage" id="hornStage">
      <div class="horn-instrument-wrapper" id="hornInstrument">
        <img src="https://cdn-icons-png.flaticon.com/512/848/848123.png" alt="Playing Blue French Horn" class="horn-active-sprite" />
        <div class="horn-blast-wave w1"></div>
        <div class="horn-blast-wave w2"></div>
        <div class="horn-blast-wave w3"></div>
      </div>
      <div class="horn-romantic-quote" id="hornQuote">"I would have stolen you a whole orchestra." 💙</div>
    </div>
  `;

  document.body.appendChild(himymLayer);

  // --- 1. WEB AUDIO API İLE KORNO SESİ SENTEZİ ---
  let audioCtx = null;
  const playFrenchHornSound = () => {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const now = audioCtx.currentTime;
      const freqs = [174.61, 261.63];

      freqs.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.22);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(650, now);
        filter.frequency.exponentialRampToValueAtTime(1400, now + 0.15);

        gain.gain.setValueAtTime(0, now + idx * 0.22);
        gain.gain.linearRampToValueAtTime(0.28, now + idx * 0.22 + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.22 + 0.65);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now + idx * 0.22);
        osc.stop(now + idx * 0.22 + 0.7);
      });
    } catch (e) {}
  };

  // --- 2. MAVİ KORNO ÇALINMA & HAREKET ANİMASYONU ---
  const btnHorn = himymLayer.querySelector('#btnFrenchHorn');
  const hornStage = himymLayer.querySelector('#hornStage');
  const hornInstrument = himymLayer.querySelector('#hornInstrument');
  let isPlayingHorn = false;

  btnHorn.addEventListener('click', () => {
    if (isPlayingHorn) return;
    isPlayingHorn = true;

    playFrenchHornSound();

    hornStage.classList.add('active');
    hornInstrument.classList.add('playing-animation');

    const notes = ['♪', '♫', '♬', '💙', '♩'];
    for (let i = 0; i < 7; i++) {
      const noteEl = document.createElement('div');
      noteEl.className = 'horn-floating-note';
      noteEl.textContent = notes[Math.floor(Math.random() * notes.length)];
      noteEl.style.left = `${window.innerWidth / 2 + (Math.random() * 160 - 80)}px`;
      noteEl.style.top = `${window.innerHeight / 2 + (Math.random() * 80 - 40)}px`;
      document.body.appendChild(noteEl);
      setTimeout(() => noteEl.remove(), 1400);
    }

    setTimeout(() => {
      hornInstrument.classList.remove('playing-animation');
      hornStage.classList.remove('active');
      isPlayingHorn = false;
    }, 1600);
  });

  // --- 3. SARI YAĞMUR CANVAS DÖNGÜSÜ ---
  const canvas = himymLayer.querySelector('#himymRainCanvas');
  const ctx = canvas.getContext('2d');
  let rainActive = true;
  let rainAnimId = null;

  const resizeRain = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resizeRain();
  window.addEventListener('resize', resizeRain);

  const drops = Array.from({ length: 80 }).map(() => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    length: Math.random() * 20 + 10,
    speed: Math.random() * 8 + 6
  }));

  const drawRain = () => {
    if (!rainActive) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(247, 208, 44, 0.35)';
    ctx.lineWidth = 1.2;

    drops.forEach(d => {
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 1, d.y + d.length);
      ctx.stroke();

      d.y += d.speed;
      if (d.y > canvas.height) {
        d.y = -20;
        d.x = Math.random() * canvas.width;
      }
    });

    rainAnimId = requestAnimationFrame(drawRain);
  };
  drawRain();

  // --- 4. SARI ŞEMSİYE BUTONU (BÜYÜK ŞEMSİYEYİ EKRANDA AÇMA) ---
  const btnToggleRain = himymLayer.querySelector('#btnToggleRain');
  const bigUmbrellaStage = himymLayer.querySelector('#bigUmbrellaStage');
  let isUmbrellaOpen = false;

  btnToggleRain.addEventListener('click', () => {
    isUmbrellaOpen = !isUmbrellaOpen;
    btnToggleRain.classList.toggle('active', isUmbrellaOpen);
    bigUmbrellaStage.classList.toggle('open', isUmbrellaOpen);

    if (isUmbrellaOpen) {
      showFloatingHimymNote(btnToggleRain.offsetLeft + 140, btnToggleRain.offsetTop + 20, 'Yellow Umbrella Opened! Protected from NYC rain ☂️');
    } else {
      showFloatingHimymNote(btnToggleRain.offsetLeft + 140, btnToggleRain.offsetTop + 20, 'Umbrella closed ☂️');
    }
  });

  // --- 5. THE PLAYBOOK MODAL ---
  const playbookModal = himymLayer.querySelector('#playbookModal');
  const btnOpenPlaybook = himymLayer.querySelector('#btnOpenPlaybook');
  const btnClosePlaybook = himymLayer.querySelector('#btnClosePlaybook');
  const btnNextPlay = himymLayer.querySelector('#btnNextPlay');
  const btnSuitUp = himymLayer.querySelector('#btnSuitUp');
  const playTitle = himymLayer.querySelector('#playTitle');
  const playDesc = himymLayer.querySelector('#playDesc');

  btnOpenPlaybook.addEventListener('click', () => {
    playbookModal.style.display = 'flex';
  });

  btnClosePlaybook.addEventListener('click', () => {
    playbookModal.style.display = 'none';
  });

  btnNextPlay.addEventListener('click', () => {
    playIndex = (playIndex + 1) % PLAYBOOK_PLAYS.length;
    playTitle.textContent = PLAYBOOK_PLAYS[playIndex].title;
    playDesc.textContent = PLAYBOOK_PLAYS[playIndex].desc;
  });

  btnSuitUp.addEventListener('click', () => {
    playbookModal.style.display = 'none';
    showFloatingHimymNote(window.innerWidth / 2, window.innerHeight / 2, '👔 SUIT UP! It\'s gonna be LEGEN-DARY!');
  });

  // --- 6. SLAP BET SAYACI ---
  const btnSlap = himymLayer.querySelector('#btnSlapCountdown');
  const slapFx = himymLayer.querySelector('#slapFx');
  const slapText = himymLayer.querySelector('#slapText');

  btnSlap.addEventListener('click', () => {
    slapText.textContent = `THAT'S SLAP #${slapCount}!! 💥`;
    slapCount++;

    slapFx.classList.remove('slapping');
    void slapFx.offsetWidth;
    slapFx.classList.add('slapping');

    setTimeout(() => {
      slapFx.classList.remove('slapping');
    }, 1200);
  });

  // --- 7. MACLAREN'S PUB BİRA DOLDURMA ---
  const beerWidget = himymLayer.querySelector('#beerWidget');
  const beerFill = himymLayer.querySelector('#beerFillLevel');
  let beerLevel = 40;

  beerWidget.addEventListener('click', (e) => {
    beerLevel += 25;
    if (beerLevel >= 100) {
      beerLevel = 100;
      beerFill.style.height = '100%';
      showFloatingHimymNote(e.clientX - 100, e.clientY - 40, '🍻 Carl poured you a fresh cold one at MacLaren\'s!');
      setTimeout(() => {
        beerLevel = 25;
        beerFill.style.height = '25%';
      }, 2500);
    } else {
      beerFill.style.height = `${beerLevel}%`;
      showFloatingHimymNote(e.clientX - 60, e.clientY - 20, 'Pouring beer... 🍺');
    }
  });

  function showFloatingHimymNote(x, y, text) {
    const note = document.createElement('div');
    note.className = 'himym-floating-note';
    note.style.left = `${Math.max(20, Math.min(window.innerWidth - 200, x))}px`;
    note.style.top = `${y}px`;
    note.innerHTML = text;
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 2000);
  }

  return {
    destroy: () => {
      cancelAnimationFrame(rainAnimId);
      window.removeEventListener('resize', resizeRain);
      himymLayer.remove();
    }
  };
}