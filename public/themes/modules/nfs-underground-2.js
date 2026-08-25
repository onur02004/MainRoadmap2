export function init() {
  const CAR_DATABASE = [
    {
      id: "nissan-350z",
      name: "NISSAN 350Z (RACHEL SPEC)",
      image: "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=600&auto=format&fit=crop&q=80",
      topSpeed: "318 KM/H",
      accel: "3.2s",
      handling: "9.4",
      stars: "⭐⭐⭐⭐⭐",
      neonColor: "#00ff66"
    },
    {
      id: "skyline-r34",
      name: "NISSAN SKYLINE GT-R (R34)",
      image: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=600&auto=format&fit=crop&q=80",
      topSpeed: "335 KM/H",
      accel: "2.8s",
      handling: "9.8",
      stars: "⭐⭐⭐⭐⭐",
      neonColor: "#00d2ff"
    },
    {
      id: "toyota-supra",
      name: "TOYOTA SUPRA MK IV (2JZ)",
      image: "https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?w=600&auto=format&fit=crop&q=80",
      topSpeed: "342 KM/H",
      accel: "2.9s",
      handling: "9.1",
      stars: "⭐⭐⭐⭐⭐",
      neonColor: "#ff007f"
    },
    {
      id: "mazda-rx7",
      name: "MAZDA RX-7 (ROTARY FD3S)",
      image: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&auto=format&fit=crop&q=80",
      topSpeed: "310 KM/H",
      accel: "3.4s",
      handling: "10.0",
      stars: "⭐⭐⭐⭐☆",
      neonColor: "#ffaa00"
    }
  ];

  let currentCarIdx = 0;
  let activeNeon = "#00ff66";
  let activeRim = "Volk Racing TE37";
  let activeHood = "Carbon Fiber OEM";
  let bankAccount = 48500;
  let nosBottle = 100;
  let currentRpm = 1000;
  let dynoHp = 580;
  let animLoopId = null;

  const ugStage = document.createElement('div');
  ugStage.id = 'nfsUnderground2Layer';
  ugStage.className = 'ug-stage-layer';
  ugStage.innerHTML = `
    <!-- Bayview Yağmurlu Gece Neon Yansıma Katmanı -->
    <div class="ug-asphalt-wet"></div>
    <div class="ug-neon-underglow" id="ugNeonUnderglow"></div>

    <!-- Sol Üst: Bayview Harita & Rachel SMS Telefonu -->
    <div class="ug-top-left-dock">
      <!-- Rachel SMS Flip Phone -->
      <div class="ug-flip-phone" id="ugFlipPhone">
        <div class="phone-screen">
          <div class="phone-header">
            <span>📡 BAYVIEW 3G</span>
            <span>02:44 AM</span>
          </div>
          <div class="phone-sms">
            <strong class="sms-sender">RACHEL TELLER:</strong>
            <p id="smsBody">"Hey! Bring my 350Z to the car lot in City Center. Don't scratch the vinyl!"</p>
          </div>
        </div>
        <div class="phone-badge">SMS INBOX [M]</div>
      </div>

      <!-- Banka / Kasa -->
      <div class="ug-bank-meter">
        <span class="bank-lbl">BANK ACCOUNT:</span>
        <strong id="lblBank">$48,500</strong>
      </div>
    </div>

    <!-- Sol Taraf: İkonik Garaj / Modifiye Ana Menüsü -->
    <div class="ug-main-menu">
      <div class="menu-brand">
        <h2>NEED FOR SPEED</h2>
        <h1>UNDERGROUND <span>2</span></h1>
      </div>

      <div class="menu-list">
        <button type="button" class="ug-menu-btn active" id="btnMenuGarage">CAR SELECT &amp; SHOWCASE</button>
        <button type="button" class="ug-menu-btn" id="btnMenuPerformance">PERFORMANCE DYNO SHOP</button>
        <button type="button" class="ug-menu-btn" id="btnMenuVisual">BODY SHOP &amp; NEON</button>
        <button type="button" class="ug-menu-btn" id="btnMenuMagazine">DVD MAGAZINE COVER</button>
        <button type="button" class="ug-menu-btn" id="btnMenuFreeRoam">ENTER BAYVIEW FREE ROAM</button>
      </div>
    </div>

    <!-- Orta: 3D Garaj / Araba Showcase Alanı -->
    <div class="ug-car-stage" id="ugCarStage">
      <div class="car-halo-platform"></div>
      <img src="${CAR_DATABASE[0].image}" alt="Car" id="ugCarImage" class="ug-car-sprite" />
      <div class="car-neon-glow" id="carNeonGlow"></div>

      <!-- Araç Değiştirme Okları -->
      <div class="car-carousel-controls">
        <button type="button" class="car-nav-arrow" id="btnPrevCar">&lt; PREV</button>
        <div class="car-name-plate">
          <h3 id="lblCarName">${CAR_DATABASE[0].name}</h3>
          <span class="car-stars" id="lblCarStars">${CAR_DATABASE[0].stars}</span>
        </div>
        <button type="button" class="car-nav-arrow" id="btnNextCar">NEXT &gt;</button>
      </div>
    </div>

    <!-- Sağ Taraf: Performans & Modifiye Paneli (Sekmeli) -->
    <div class="ug-inspector-drawer" id="ugInspector">
      
      <!-- 1. GARAJ BİLGİ SEKMESİ -->
      <div class="drawer-tab-content active" id="tabContentSpecs">
        <div class="tab-sec-title">// VEHICLE TELEMETRY</div>
        <div class="stat-spec-row">
          <span>TOP SPEED</span>
          <strong id="specTopSpeed">${CAR_DATABASE[0].topSpeed}</strong>
        </div>
        <div class="stat-spec-row">
          <span>0-100 KM/H</span>
          <strong id="specAccel">${CAR_DATABASE[0].accel}</strong>
        </div>
        <div class="stat-spec-row">
          <span>HANDLING RATING</span>
          <strong id="specHandling">${CAR_DATABASE[0].handling} / 10</strong>
        </div>
      </div>

      <!-- 2. GÖRSEL MODİFİYE (BODY SHOP & NEON) SEKMESİ -->
      <div class="drawer-tab-content" id="tabContentVisual" style="display: none;">
        <div class="tab-sec-title">// UNDERGLOW NEON COLOR</div>
        <div class="neon-color-palette">
          <button type="button" class="neon-chip" data-neon="#00ff66" style="background:#00ff66; box-shadow:0 0 10px #00ff66;"></button>
          <button type="button" class="neon-chip" data-neon="#00d2ff" style="background:#00d2ff; box-shadow:0 0 10px #00d2ff;"></button>
          <button type="button" class="neon-chip" data-neon="#ff007f" style="background:#ff007f; box-shadow:0 0 10px #ff007f;"></button>
          <button type="button" class="neon-chip" data-neon="#ffaa00" style="background:#ffaa00; box-shadow:0 0 10px #ffaa00;"></button>
          <button type="button" class="neon-chip" data-neon="#aa00ff" style="background:#aa00ff; box-shadow:0 0 10px #aa00ff;"></button>
          <button type="button" class="neon-chip" data-neon="#ff2200" style="background:#ff2200; box-shadow:0 0 10px #ff2200;"></button>
        </div>

        <div class="tab-sec-title">// RIMS &amp; SPOILER</div>
        <select class="ug-select" id="selRims">
          <option value="Volk Racing TE37">Volk Racing TE37 (18")</option>
          <option value="BBS LM Deep Dish">BBS LM Deep Dish (19")</option>
          <option value="Enkei RPF1">Enkei RPF1 Lightweight</option>
          <option value="HRE 540 Custom Chrome">HRE 540 Custom Chrome</option>
        </select>

        <div class="tab-sec-title">// HOOD &amp; CARBON FIBER</div>
        <select class="ug-select" id="selHood">
          <option value="Carbon Fiber OEM">Carbon Fiber OEM Vented</option>
          <option value="D-Speed Dual Scoop">D-Speed Dual Air Scoop</option>
          <option value="Speedline Extractor">Speedline Heat Extractor</option>
        </select>
      </div>

      <!-- 3. PERFORMANS & DYNO SHOP -->
      <div class="drawer-tab-content" id="tabContentDyno" style="display: none;">
        <div class="tab-sec-title">// DYNO TUNING &amp; TURBO SPOOL</div>
        <div class="dyno-meter-wrap">
          <div class="dyno-val-line">
            <span>HORSEPOWER:</span>
            <strong id="lblDynoHp">580 WHP</strong>
          </div>
          <div class="dyno-val-line">
            <span>TURBO BOOST:</span>
            <strong id="lblDynoPsi">1.8 BAR (26 PSI)</strong>
          </div>
        </div>
        <button type="button" class="ug-action-btn dyno" id="btnRunDyno">🔥 RUN DYNO TEST [SPACE]</button>
      </div>

    </div>

    <!-- DVD Magazine Pop-Up / Fotoğraf Çekim Modalı -->
    <div class="ug-magazine-modal" id="ugMagazineModal" style="display: none;">
      <div class="magazine-cover">
        <div class="mag-header">
          <span class="mag-issue">SPECIAL STREET ISSUE #42</span>
          <h2 class="mag-title">MAXI TUNING</h2>
        </div>
        <img src="${CAR_DATABASE[0].image}" class="mag-car-img" id="magCarImg" alt="Cover Car" />
        <div class="mag-headlines">
          <h3>BAYVIEW'S NEW UNDERGROUND KING!</h3>
          <p>Over 600WHP, full vinyl wrap and pulse neon lights dominating Jackson Heights.</p>
        </div>
        <button type="button" class="mag-close-btn" id="btnCloseMag">&times; CLOSE COVER</button>
      </div>
    </div>

    <!-- Sağ Alt: Analog Takometre & NOS Purge Barı -->
    <div class="ug-gauge-dock">
      <div class="ug-analog-tach">
        <div class="tach-center">
          <span class="tach-rpm" id="lblTachRpm">1.0</span>
          <small>x1000 RPM</small>
        </div>
      </div>
      <div class="ug-nos-bottle-wrap" id="btnNosPurge" title="Click or Press [N] for NOS Purge!">
        <span class="nos-icon">💨</span>
        <div class="nos-meter">
          <div class="nos-fill" id="ugNosFill" style="height: 100%;"></div>
        </div>
        <small>NOS [N]</small>
      </div>
    </div>
  `;

  document.body.appendChild(ugStage);

  // --- 1. WEB AUDIO API SES MOTORU (TURBO SPOOL, BOV ÇUFLAMA, PURGE) ---
  let audioCtx = null;
  const initAudio = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  };

  const playSynth = (freq, duration, type = 'sawtooth', gainVal = 0.2) => {
    try {
      initAudio();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  };

  // Turbo Blow-Off Valve (Çuflama Sesi)
  const playBlowOffValve = () => {
    try {
      initAudio();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.35);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  };

  // --- 2. ARAÇ DEĞİŞTİRME & SHOWCASE MOTORU ---
  const carImg = ugStage.querySelector('#ugCarImage');
  const lblCarName = ugStage.querySelector('#lblCarName');
  const lblCarStars = ugStage.querySelector('#lblCarStars');
  const specTopSpeed = ugStage.querySelector('#specTopSpeed');
  const specAccel = ugStage.querySelector('#specAccel');
  const specHandling = ugStage.querySelector('#specHandling');
  const carNeon = ugStage.querySelector('#carNeonGlow');
  const underglowLayer = ugStage.querySelector('#ugNeonUnderglow');
  const magCarImg = ugStage.querySelector('#magCarImg');

  const updateCarDisplay = () => {
    const car = CAR_DATABASE[currentCarIdx];
    carImg.style.opacity = '0';
    setTimeout(() => {
      carImg.src = car.image;
      if (magCarImg) magCarImg.src = car.image;
      lblCarName.textContent = car.name;
      lblCarStars.textContent = car.stars;
      specTopSpeed.textContent = car.topSpeed;
      specAccel.textContent = car.accel;
      specHandling.textContent = `${car.handling} / 10`;
      setNeonColor(car.neonColor);
      carImg.style.opacity = '1';
    }, 150);
  };

  ugStage.querySelector('#btnPrevCar').addEventListener('click', () => {
    currentCarIdx = (currentCarIdx - 1 + CAR_DATABASE.length) % CAR_DATABASE.length;
    playSynth(450, 0.08, 'triangle');
    updateCarDisplay();
  });

  ugStage.querySelector('#btnNextCar').addEventListener('click', () => {
    currentCarIdx = (currentCarIdx + 1) % CAR_DATABASE.length;
    playSynth(520, 0.08, 'triangle');
    updateCarDisplay();
  });

  // --- 3. NEON & GÖRSEL MODİFİYE ---
  const setNeonColor = (color) => {
    activeNeon = color;
    carNeon.style.boxShadow = `0 15px 40px ${color}, 0 0 80px ${color}`;
    underglowLayer.style.background = `radial-gradient(ellipse at bottom, ${color}33 0%, transparent 70%)`;
  };

  ugStage.querySelectorAll('.neon-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      setNeonColor(chip.dataset.neon);
      playSynth(800, 0.1, 'sine');
    });
  });

  // --- 4. DYNO TESTİ & TAKOMETRE GAZ VERME ---
  const btnRunDyno = ugStage.querySelector('#btnRunDyno');
  const lblDynoHp = ugStage.querySelector('#lblDynoHp');
  const lblTachRpm = ugStage.querySelector('#lblTachRpm');

  const runDynoTest = () => {
    playSynth(150, 1.2, 'sawtooth', 0.3);
    setTimeout(playBlowOffValve, 1300);

    let rev = 1000;
    const interval = setInterval(() => {
      rev += 400;
      lblTachRpm.textContent = (rev / 1000).toFixed(1);
      if (rev >= 8200) {
        clearInterval(interval);
        dynoHp = Math.floor(560 + Math.random() * 85);
        lblDynoHp.textContent = `${dynoHp} WHP`;
        setTimeout(() => { lblTachRpm.textContent = '1.0'; }, 800);
      }
    }, 60);
  };

  btnRunDyno.addEventListener('click', runDynoTest);

  // NOS Purge Butonu
  const btnNos = ugStage.querySelector('#btnNosPurge');
  const nosFill = ugStage.querySelector('#ugNosFill');

  const purgeNos = () => {
    playBlowOffValve();
    nosBottle = Math.max(0, nosBottle - 25);
    nosFill.style.height = `${nosBottle}%`;
    setTimeout(() => {
      nosBottle = 100;
      nosFill.style.height = '100%';
    }, 3000);
  };

  btnNos.addEventListener('click', purgeNos);

  // --- 5. ANA MENÜ SEKMELERİ ---
  const tabSpecs = ugStage.querySelector('#tabContentSpecs');
  const tabVisual = ugStage.querySelector('#tabContentVisual');
  const tabDyno = ugStage.querySelector('#tabContentDyno');
  const magModal = ugStage.querySelector('#ugMagazineModal');

  const showTab = (tabEl) => {
    [tabSpecs, tabVisual, tabDyno].forEach(t => t.style.display = 'none');
    tabEl.style.display = 'block';
  };

  ugStage.querySelector('#btnMenuGarage').addEventListener('click', (e) => {
    setActiveMenuBtn(e.target);
    showTab(tabSpecs);
  });

  ugStage.querySelector('#btnMenuVisual').addEventListener('click', (e) => {
    setActiveMenuBtn(e.target);
    showTab(tabVisual);
  });

  ugStage.querySelector('#btnMenuPerformance').addEventListener('click', (e) => {
    setActiveMenuBtn(e.target);
    showTab(tabDyno);
  });

  ugStage.querySelector('#btnMenuMagazine').addEventListener('click', () => {
    magModal.style.display = 'flex';
    playSynth(700, 0.2, 'square');
  });

  ugStage.querySelector('#btnCloseMag').addEventListener('click', () => {
    magModal.style.display = 'none';
  });

  ugStage.querySelector('#btnMenuFreeRoam').addEventListener('click', () => {
    const el = document.getElementById('servicesSection');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  });

  function setActiveMenuBtn(btn) {
    ugStage.querySelectorAll('.ug-menu-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    playSynth(380, 0.06, 'triangle');
  }

  // Klavye Kısayolları ([Space] Dyno, [N] NOS, [M] Rachel SMS)
  const onKeyDown = (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      runDynoTest();
    }
    if (e.code === 'KeyN') {
      purgeNos();
    }
  };

  window.addEventListener('keydown', onKeyDown);
  setNeonColor(CAR_DATABASE[0].neonColor);

  return {
    destroy: () => {
      window.removeEventListener('keydown', onKeyDown);
      ugStage.remove();
    }
  };
}