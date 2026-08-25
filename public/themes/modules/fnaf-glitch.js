export function init() {
  // 1. FNAF Glitch & Kamera Katmanını Oluştur
  const fnafOverlay = document.createElement('div');
  fnafOverlay.id = 'fnafGlitchLayer';
  fnafOverlay.className = 'fnaf-overlay-system';
  fnafOverlay.innerHTML = `
    <!-- VHS Static Noise Canvas Overlay -->
    <canvas id="fnafNoiseCanvas" class="fnaf-noise-canvas"></canvas>

    <!-- Ani Glitch / Jumpscare Twitch Katmanı -->
    <div class="fnaf-twitch-frame" id="fnafTwitchFrame"></div>

    <!-- 12 AM / Gece & Güç Göstergesi -->
    <div class="fnaf-power-hud">
      <div class="fnaf-time-display">12:00 AM</div>
      <div class="fnaf-night-tag">Night 1</div>
      <div class="fnaf-battery-box">
        <span>POWER: <strong id="fnafPowerVal">99%</strong></span>
        <div class="fnaf-usage-meter">
          <span>USAGE:</span>
          <span class="fnaf-usage-bar green"></span>
          <span class="fnaf-usage-bar green"></span>
        </div>
      </div>
    </div>

    <!-- Alt Güvenlik Monitörü Çubuğu (Monitor Flip Bar) -->
    <div class="fnaf-monitor-flip-bar" id="fnafMonitorBar" title="Click to Toggle Security Cam">
      <div class="fnaf-flip-line"></div>
      <span class="fnaf-flip-text">▲ SECURITY CAMERAS ▲</span>
    </div>

    <!-- Güvenlik Kamerası UI Modalı -->
    <div class="fnaf-cam-view" id="fnafCamView" style="display: none;">
      <div class="fnaf-cam-header">
        <span class="fnaf-rec-dot">● REC</span>
        <span id="fnafCamName">CAM 1A - SHOWSTAGE</span>
      </div>
      <div class="fnaf-cam-map">
        <button type="button" class="fnaf-cam-btn active" data-cam="CAM 1A - SHOWSTAGE">CAM 1A</button>
        <button type="button" class="fnaf-cam-btn" data-cam="CAM 1B - DINING AREA">CAM 1B</button>
        <button type="button" class="fnaf-cam-btn" data-cam="CAM 5 - BACKSTAGE">CAM 5</button>
        <button type="button" class="fnaf-cam-btn" data-cam="CAM 2A - WEST HALL">CAM 2A</button>
      </div>
    </div>
  `;

  document.body.appendChild(fnafOverlay);

  // 2. Dinamik Parazit (Static Noise Generator)
  const canvas = fnafOverlay.querySelector('#fnafNoiseCanvas');
  const ctx = canvas.getContext('2d');
  let animId = null;

  const resizeCanvas = () => {
    canvas.width = window.innerWidth / 3;
    canvas.height = window.innerHeight / 3;
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const drawNoise = () => {
    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.createImageData(w, h);
    const buffer32 = new Uint32Array(imgData.data.buffer);
    const len = buffer32.length;

    for (let i = 0; i < len; i++) {
      if (Math.random() < 0.12) {
        buffer32[i] = 0xffffffff;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    animId = requestAnimationFrame(drawNoise);
  };
  drawNoise();

  // 3. Rastgele Freddy Twitch / Glitch Tetikleyici
  const twitchFrame = fnafOverlay.querySelector('#fnafTwitchFrame');
  let twitchTimeout = null;

  const triggerRandomGlitch = () => {
    const duration = Math.floor(60 + Math.random() * 140);
    twitchFrame.classList.add('active');
    document.body.classList.add('fnaf-screen-glitch');

    setTimeout(() => {
      twitchFrame.classList.remove('active');
      document.body.classList.remove('fnaf-screen-glitch');

      const nextDelay = Math.floor(1800 + Math.random() * 4500);
      twitchTimeout = setTimeout(triggerRandomGlitch, nextDelay);
    }, duration);
  };
  twitchTimeout = setTimeout(triggerRandomGlitch, 2000);

  // 4. Batarya / Güç Düşüş Simülasyonu
  let power = 99;
  const powerEl = fnafOverlay.querySelector('#fnafPowerVal');
  const powerInterval = setInterval(() => {
    if (power > 1) {
      power--;
      powerEl.textContent = `${power}%`;
    }
  }, 12000);

  // 5. Kamera Monitörü Flip Mantığı
  const monitorBar = fnafOverlay.querySelector('#fnafMonitorBar');
  const camView = fnafOverlay.querySelector('#fnafCamView');
  const camName = fnafOverlay.querySelector('#fnafCamName');
  const camBtns = fnafOverlay.querySelectorAll('.fnaf-cam-btn');

  let camOpen = false;
  monitorBar.addEventListener('click', () => {
    camOpen = !camOpen;
    camView.style.display = camOpen ? 'flex' : 'none';
    monitorBar.classList.toggle('flipped', camOpen);
  });

  camBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      camBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      camName.textContent = btn.dataset.cam;
    });
  });

  return {
    destroy: () => {
      cancelAnimationFrame(animId);
      clearTimeout(twitchTimeout);
      clearInterval(powerInterval);
      window.removeEventListener('resize', resizeCanvas);
      document.body.classList.remove('fnaf-screen-glitch');
      fnafOverlay.remove();
    }
  };
}