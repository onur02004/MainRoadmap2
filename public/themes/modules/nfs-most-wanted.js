export function init() {
  let rpm = 1000;
  let speed = 0;
  let gear = 'N';
  let nosGauge = 100;
  let heatLevel = 5;
  let isNosActive = false;
  let isSpeedbreaker = false;
  let engineLoopId = null;

  const nfsLayer = document.createElement('div');
  nfsLayer.id = 'nfsMostWantedLayer';
  nfsLayer.className = 'nfs-hud-layer';
  nfsLayer.innerHTML = `
    <!-- NFS Sepia / Autumn Color Grading & Speed Lines -->
    <div class="nfs-sepia-filter"></div>
    <div class="nfs-speedbreaker-fx" id="nfsSpeedbreakerFx"></div>
    <div class="nfs-nos-tunnel" id="nfsNosTunnel"></div>

    <!-- Sol Üst: Rockport PD Kovalamaca (Heat Level & Bounty) -->
    <div class="nfs-pursuit-hud">
      <div class="heat-flame-wrap">
        <span class="heat-lbl">HEAT</span>
        <strong class="heat-level" id="lblHeatLevel">X5</strong>
      </div>
      <div class="pursuit-meta">
        <div class="pursuit-title">SERGEANT CROSS IN PURSUIT</div>
        <div class="bounty-val">BOUNTY: <strong id="lblBounty">14,890,200</strong></div>
        <div class="pursuit-bar-wrap">
          <div class="pursuit-fill" id="pursuitFill" style="width: 78%;"></div>
        </div>
      </div>
    </div>

    <!-- Sol Alt: Polis Telsiz Konsolu (Police Radio Chatter) -->
    <div class="nfs-police-scanner" id="nfsScanner">
      <div class="scanner-header">
        <span class="blinking-dot"></span>
        <span>ROCKPORT PD // DISPATCH CHATTER</span>
      </div>
      <div class="scanner-log" id="scannerLog">
        "Dispatch, we got a customized BMW M3 GTR hitting 180+ on the highway. Authorize Rhino units!"
      </div>
    </div>

    <!-- Sağ Alt: Analog & Dijital Takometre (RPM Gauge & NOS) -->
    <div class="nfs-gauge-cluster">
      <div class="gauge-ring">
        <!-- SVG Hız İbresi -->
        <svg class="gauge-svg" viewBox="0 0 200 200">
          <circle class="gauge-bg-track" cx="100" cy="100" r="80" />
          <circle class="gauge-redline" cx="100" cy="100" r="80" />
          <line id="gaugeNeedle" class="gauge-needle" x1="100" y1="100" x2="100" y2="30" />
        </svg>

        <div class="gauge-center-hud">
          <span class="gear-val" id="lblGear">N</span>
          <span class="speed-val" id="lblSpeed">0</span>
          <span class="speed-unit">MPH</span>
        </div>
      </div>

      <!-- NOS ve Speedbreaker Barları -->
      <div class="gauge-bars-stack">
        <div class="nfs-bar-row">
          <span class="bar-lbl nos">N2O</span>
          <div class="nfs-meter-track">
            <div class="nfs-meter-fill nos" id="nosFill" style="width: 100%;"></div>
          </div>
        </div>
        <div class="nfs-bar-row">
          <span class="bar-lbl sb">SPEEDBREAKER</span>
          <div class="nfs-meter-track">
            <div class="nfs-meter-fill sb" id="sbFill" style="width: 100%;"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Alt Orta: Gaz & NOS Kontrol Tuşları -->
    <div class="nfs-controls-hint">
      <span>HOLD <strong>[W] / [UP]</strong>: THROTTLE</span>
      <span>HOLD <strong>[SPACE]</strong>: NITROUS (N2O)</span>
      <span>PRESS <strong>[CTRL]</strong>: SPEEDBREAKER</span>
    </div>
  `;

  document.body.appendChild(nfsLayer);

  // --- 1. WEB AUDIO API MOTOR SESİ VE TURBO ÇUFLAMA SENTEZİ ---
  let audioCtx = null;
  const initAudio = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  };

  const playEngineSound = (freq, gainVal = 0.1) => {
    try {
      initAudio();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } catch (e) {}
  };

  const playBlowOffValve = () => {
    try {
      initAudio();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'white-noise' || 'square';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.25);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {}
  };

  // --- 2. HIZ & TAKOMETRE FİZİK DÖNGÜSÜ ---
  const needle = nfsLayer.querySelector('#gaugeNeedle');
  const lblSpeed = nfsLayer.querySelector('#lblSpeed');
  const lblGear = nfsLayer.querySelector('#lblGear');
  const nosFill = nfsLayer.querySelector('#nosFill');
  const nosTunnel = nfsLayer.querySelector('#nfsNosTunnel');
  const speedbreakerFx = nfsLayer.querySelector('#nfsSpeedbreakerFx');
  const scannerLog = nfsLayer.querySelector('#scannerLog');
  const keys = {};

  const radioChatters = [
    "Suspect is blowing through the toll booth! Requesting spike strips!",
    "Heavy SUV Rhinos inbound! Head on collision course!",
    "This is Cross, I have visual on the M3 GTR! Do not let him reach the bridge!",
    "Target used speedbreaker! Units lost control in the intersection!",
    "Code 3! Suspect is pulling away at 200+ mph!"
  ];

  let radioTimer = setInterval(() => {
    if (speed > 80) {
      scannerLog.textContent = `"${radioChatters[Math.floor(Math.random() * radioChatters.length)]}"`;
    }
  }, 4500);

  const physicsLoop = () => {
    const isAccelerating = keys['KeyW'] || keys['ArrowUp'];
    const isBraking = keys['KeyS'] || keys['ArrowDown'];
    const isNosHeld = keys['Space'] && nosGauge > 0;

    // Nitro (N2O)
    if (isNosHeld) {
      isNosActive = true;
      nosGauge = Math.max(0, nosGauge - 0.8);
      nosTunnel.classList.add('active');
    } else {
      isNosActive = false;
      nosGauge = Math.min(100, nosGauge + 0.2);
      nosTunnel.classList.remove('active');
    }
    nosFill.style.width = `${nosGauge}%`;

    // İvmelenme & Hız Hesabı
    const power = isNosActive ? 3.5 : 1.8;

    if (isAccelerating) {
      rpm += (isNosActive ? 120 : 75);
      speed += (isNosActive ? 1.6 : 0.85);
      playEngineSound(100 + (rpm / 8000) * 450, 0.12);
    } else if (isBraking) {
      rpm = Math.max(1000, rpm - 140);
      speed = Math.max(0, speed - 2.2);
    } else {
      rpm = Math.max(1000, rpm - 45);
      speed = Math.max(0, speed - 0.45);
    }

    // Vites Değişimi (Gearbox logic)
    if (speed === 0) gear = 'N';
    else if (speed < 40) gear = '1';
    else if (speed < 75) gear = '2';
    else if (speed < 115) gear = '3';
    else if (speed < 155) gear = '4';
    else if (speed < 195) gear = '5';
    else gear = '6';

    // Otomatik Vites Devir Düşüşü & Turbo Blow-Off
    if (rpm > 7600 && speed < 220) {
      rpm = 4800;
      playBlowOffValve();
    }

    // Takometre İbresi Döndürme (-130deg ile +130deg arası)
    const angle = -130 + (Math.min(8000, rpm) / 8000) * 260;
    needle.style.transform = `rotate(${angle}deg)`;
    lblSpeed.textContent = Math.floor(speed);
    lblGear.textContent = gear;

    engineLoopId = requestAnimationFrame(physicsLoop);
  };

  physicsLoop();

  // --- 3. SPEEDBREAKER AĞIR ÇEKİM ETKİLEŞİMİ ---
  const toggleSpeedbreaker = () => {
    isSpeedbreaker = !isSpeedbreaker;
    speedbreakerFx.classList.toggle('active', isSpeedbreaker);
    if (isSpeedbreaker) {
      playTone(180, 0.4, 'sawtooth', 0.4);
      setTimeout(() => {
        isSpeedbreaker = false;
        speedbreakerFx.classList.remove('active');
      }, 3500);
    }
  };

  const onKeyDown = (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    keys[e.code] = true;
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
      e.preventDefault();
      toggleSpeedbreaker();
    }
  };

  const onKeyUp = (e) => { keys[e.code] = false; };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    destroy: () => {
      cancelAnimationFrame(engineLoopId);
      clearInterval(radioTimer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      nfsLayer.remove();
    }
  };
}