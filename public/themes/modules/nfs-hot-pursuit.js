export function init() {
  let speed = 0;
  let boostGauge = 100;
  let empCharge = 100;
  let spikesLeft = 3;
  let targetLocked = false;
  let engineLoopId = null;

  const hpLayer = document.createElement('div');
  hpLayer.id = 'nfsHotPursuitLayer';
  hpLayer.className = 'nfs-hp-layer';
  hpLayer.innerHTML = `
    <!-- Seacrest County Siren Efekti & EMP Shockwave -->
    <div class="hp-siren-strobe" id="hpSirenStrobe"></div>
    <div class="hp-emp-shockwave" id="hpEmpShockwave"></div>
    <div class="hp-turbo-streak" id="hpTurboStreak"></div>

    <!-- Sol Üst: SCPD / RACER Autolog HUD -->
    <div class="hp-autolog-hud">
      <div class="autolog-header">
        <span class="autolog-dot"></span>
        <span>AUTOLOG // SEACREST COUNTY HIGHWAY PATROL</span>
      </div>
      <div class="autolog-body">
        <div class="bounty-stat">
          <small>CURRENT BOUNTY</small>
          <strong id="lblHpBounty">1,450,000 PTS</strong>
        </div>
        <div class="target-status" id="lblTargetStatus">
          <span class="crosshair-icon">🎯</span>
          <span>TARGET LOCK: <strong id="lblLockState">ACQUIRING (85m)...</strong></span>
        </div>
      </div>
    </div>

    <!-- Sağ Taraf: Weapons / Ekipman Dağıtım Doku (D-PAD) -->
    <div class="hp-weapon-dpad">
      <!-- EMP (Üst) -->
      <button type="button" class="weapon-btn emp" id="btnEmpWeapon" title="Press [E] or Click to Fire EMP">
        <span class="w-icon">⚡</span>
        <div class="w-meta">
          <strong>EMP LOCK</strong>
          <small id="lblEmpStatus">READY [E]</small>
        </div>
      </button>

      <!-- Spike Strip (Sağ) -->
      <button type="button" class="weapon-btn spike" id="btnSpikeWeapon" title="Press [Q] or Click to Drop Spike Strip">
        <span class="w-icon">▲</span>
        <div class="w-meta">
          <strong>SPIKE STRIP</strong>
          <small id="lblSpikeCount">3 LEFT [Q]</small>
        </div>
      </button>

      <!-- Turbo / Jammer (Sol) -->
      <button type="button" class="weapon-btn turbo" id="btnTurboWeapon" title="Hold [SPACE] to Burn Nitrous">
        <span class="w-icon">🔥</span>
        <div class="w-meta">
          <strong>NITROUS BOOST</strong>
          <small>HOLD [SPACE]</small>
        </div>
      </button>
    </div>

    <!-- Sağ Alt: Modern Dijital Neon Takometre & Nitro Barı -->
    <div class="hp-gauge-cluster">
      <div class="hp-speed-readout">
        <span class="speed-num" id="lblHpSpeed">0</span>
        <span class="speed-unit">KM/H</span>
      </div>

      <div class="hp-bars-column">
        <div class="hp-bar-wrap">
          <span class="hp-bar-lbl">BOOST</span>
          <div class="hp-meter"><div class="hp-meter-fill nitro" id="hpNitroFill" style="width: 100%;"></div></div>
        </div>
        <div class="hp-bar-wrap">
          <span class="hp-bar-lbl">EMP CAPACITOR</span>
          <div class="hp-meter"><div class="hp-meter-fill emp" id="hpEmpFill" style="width: 100%;"></div></div>
        </div>
      </div>
    </div>

    <!-- Alt Kontrol İpucu -->
    <div class="hp-controls-hint">
      <span>HOLD <strong>[W] / [UP]</strong>: ACCELERATE</span>
      <span>HOLD <strong>[SPACE]</strong>: NITROUS</span>
      <span>PRESS <strong>[E]</strong>: EMP LOCK</span>
      <span>PRESS <strong>[Q]</strong>: SPIKE STRIP</span>
    </div>
  `;

  document.body.appendChild(hpLayer);

  // --- 1. WEB AUDIO API SES MOTORU (EMP, SİREN & HIZLI MOTOR) ---
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

  const playEmpShock = () => {
    try {
      initAudio();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1600, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.45);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {}
  };

  // --- 2. HIZ & ARAÇ FİZİK DÖNGÜSÜ ---
  const lblSpeed = hpLayer.querySelector('#lblHpSpeed');
  const nitroFill = hpLayer.querySelector('#hpNitroFill');
  const empFill = hpLayer.querySelector('#hpEmpFill');
  const turboStreak = hpLayer.querySelector('#hpTurboStreak');
  const sirenStrobe = hpLayer.querySelector('#hpSirenStrobe');
  const keys = {};

  const physicsLoop = () => {
    const isGas = keys['KeyW'] || keys['ArrowUp'];
    const isBrake = keys['KeyS'] || keys['ArrowDown'];
    const isBoosting = keys['Space'] && boostGauge > 0;

    if (isBoosting) {
      boostGauge = Math.max(0, boostGauge - 0.75);
      speed += 2.2;
      turboStreak.classList.add('active');
      playSynth(220 + (speed / 350) * 600, 0.08, 'sawtooth', 0.14);
    } else {
      boostGauge = Math.min(100, boostGauge + 0.18);
      turboStreak.classList.remove('active');
    }
    nitroFill.style.width = `${boostGauge}%`;

    if (isGas) {
      speed = Math.min(360, speed + (isBoosting ? 2.4 : 1.2));
      playSynth(140 + (speed / 360) * 380, 0.08, 'triangle', 0.1);
    } else if (isBrake) {
      speed = Math.max(0, speed - 3.2);
    } else {
      speed = Math.max(0, speed - 0.65);
    }

    // Yüksek hızda siren çakarı başlar
    if (speed > 160) {
      sirenStrobe.classList.add('active');
    } else {
      sirenStrobe.classList.remove('active');
    }

    lblSpeed.textContent = Math.floor(speed);
    engineLoopId = requestAnimationFrame(physicsLoop);
  };
  physicsLoop();

  // --- 3. EMP (ELEKTROMANYETİK DARBE) MEKANİĞİ ---
  const btnEmp = hpLayer.querySelector('#btnEmpWeapon');
  const lblEmpStatus = hpLayer.querySelector('#lblEmpStatus');
  const empShockwave = hpLayer.querySelector('#hpEmpShockwave');
  const lblLockState = hpLayer.querySelector('#lblLockState');
  let empCooldown = false;

  const fireEmp = () => {
    if (empCooldown) return;
    empCooldown = true;
    lblEmpStatus.textContent = 'LOCKING...';
    lblLockState.textContent = 'EMP LOCKED! TARGET HIT!';
    lblLockState.style.color = '#00e5ff';
    playSynth(800, 0.3, 'sine', 0.3);

    setTimeout(() => {
      // Şok dalgası patlat
      empShockwave.classList.add('active');
      playEmpShock();

      setTimeout(() => empShockwave.classList.remove('active'), 600);

      empCharge = 0;
      empFill.style.width = '0%';
      lblEmpStatus.textContent = 'COOLDOWN (6s)';

      setTimeout(() => {
        empCooldown = false;
        empCharge = 100;
        empFill.style.width = '100%';
        lblEmpStatus.textContent = 'READY [E]';
        lblLockState.textContent = 'ACQUIRING (85m)...';
        lblLockState.style.color = '#ff9900';
      }, 6000);
    }, 1200);
  };

  btnEmp.addEventListener('click', fireEmp);

  // --- 4. SPIKE STRIP (KAPAN) MEKANİĞİ ---
  const btnSpike = hpLayer.querySelector('#btnSpikeWeapon');
  const lblSpikeCount = hpLayer.querySelector('#lblSpikeCount');

  const dropSpike = () => {
    if (spikesLeft <= 0) return;
    spikesLeft--;
    lblSpikeCount.textContent = `${spikesLeft} LEFT [Q]`;
    playSynth(300, 0.25, 'square', 0.25);
    showFloatingHpBanner('⚠️ SPIKE STRIP DEPLOYED BEHIND PATROL UNIT!');
    if (spikesLeft === 0) {
      btnSpike.classList.add('empty');
      lblSpikeCount.textContent = 'DEPLETED';
    }
  };

  btnSpike.addEventListener('click', dropSpike);

  const onKeyDown = (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    keys[e.code] = true;
    if (e.code === 'KeyE') fireEmp();
    if (e.code === 'KeyQ') dropSpike();
  };

  const onKeyUp = (e) => { keys[e.code] = false; };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  function showFloatingHpBanner(text) {
    const el = document.createElement('div');
    el.className = 'hp-floating-banner';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  return {
    destroy: () => {
      cancelAnimationFrame(engineLoopId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      hpLayer.remove();
    }
  };
}