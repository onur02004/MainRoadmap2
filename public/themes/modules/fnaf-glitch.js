// public/themes/modules/fnaf-glitch.js
export function init() {
  const FNAF_TRACKS = [
    { name: "Freddy's Music Box (Toreador)", videoId: 'a2Ig_DU8R9A' },
    { name: "Puppet Music Box (Grandfather's Clock)", videoId: 'Ude5O49F4L4' },
    { name: "TLT - FNAF 1 Song", videoId: 'l18A5BOTlzE' },
    { name: "TLT - It's Been So Long (FNAF 2)", videoId: 'gk-aCL6eyGc' },
    { name: "TLT - Die In A Fire (FNAF 3)", videoId: 'AibtyCAhyQE' }
  ];

  let currentTrack = FNAF_TRACKS[Math.floor(Math.random() * FNAF_TRACKS.length)];
  let ytPlayer = null;
  let isPlaying = false;

  // postMessage Origin hatasını önleyen geçerli iframe konteyneri
  const playerWrapper = document.createElement('div');
  playerWrapper.id = 'fnafPlayerWrapper';
  playerWrapper.style.position = 'fixed';
  playerWrapper.style.bottom = '0';
  playerWrapper.style.right = '0';
  playerWrapper.style.width = '200px';
  playerWrapper.style.height = '120px';
  playerWrapper.style.opacity = '0.01';
  playerWrapper.style.pointerEvents = 'none';
  playerWrapper.style.zIndex = '-1';
  document.body.appendChild(playerWrapper);

  const hiddenYt = document.createElement('div');
  hiddenYt.id = 'fnafYoutubePlayer';
  playerWrapper.appendChild(hiddenYt);

  function loadYouTubeApi() {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }

  function initYtPlayer() {
    if (window.YT && window.YT.Player) {
      ytPlayer = new window.YT.Player('fnafYoutubePlayer', {
        height: '100%',
        width: '100%',
        videoId: currentTrack.videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          enablejsapi: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(80);
          },
          onStateChange: (event) => {
            const btnPlay = document.getElementById('btnFnafPlayToggle');
            if (event.data === window.YT.PlayerState.PLAYING) {
              isPlaying = true;
              if (btnPlay) {
                btnPlay.textContent = '⏸ PAUSE';
                btnPlay.classList.add('active');
              }
            } else {
              isPlaying = false;
              if (btnPlay) {
                btnPlay.textContent = '▶ PLAY';
                btnPlay.classList.remove('active');
              }
            }
          }
        }
      });
    } else {
      setTimeout(initYtPlayer, 250);
    }
  }

  loadYouTubeApi();
  initYtPlayer();

  // Tarayıcı kuralı: İlk tıklamayla otomatik oynatma
  const tryAutoPlay = () => {
    if (ytPlayer && typeof ytPlayer.playVideo === 'function' && !isPlaying) {
      ytPlayer.playVideo();
    }
    document.removeEventListener('click', tryAutoPlay);
  };
  document.addEventListener('click', tryAutoPlay, { once: true });

  // 1. FNAF Glitch & Katmanlarını Oluştur
  const fnafOverlay = document.createElement('div');
  fnafOverlay.id = 'fnafGlitchLayer';
  fnafOverlay.className = 'fnaf-overlay-system';
  fnafOverlay.innerHTML = `
    <!-- VHS Static Noise Canvas Overlay -->
    <canvas id="fnafNoiseCanvas" class="fnaf-noise-canvas"></canvas>

    <!-- Ani Glitch / Jumpscare Twitch Katmanı -->
    <div class="fnaf-twitch-frame" id="fnafTwitchFrame"></div>

    <!-- SOL ÜST KOMPAKT AUDIO KASET HUD -->
    <div class="fnaf-audio-hud">
      <div class="fnaf-audio-meta">
        <span class="fnaf-audio-label">📼 FAZBEAR TAPE</span>
        <span class="fnaf-audio-title" id="fnafTrackTitle">${currentTrack.name}</span>
      </div>

      <div class="fnaf-audio-controls-row">
        <button type="button" class="fnaf-audio-btn" id="btnFnafPlayToggle">▶ PLAY</button>
        <button type="button" class="fnaf-audio-btn" id="btnFnafNextTrack" title="Random Next Track">⏭</button>
        <input type="range" class="fnaf-vol-slider" id="fnafVolSlider" min="0" max="100" value="80" />
      </div>
    </div>

    <!-- SOL ALT POWER HUD -->
    <div class="fnaf-power-hud">
      <div class="fnaf-time-display">12:00 AM</div>
      <div class="fnaf-night-tag">Night 1</div>
      <div class="fnaf-battery-box">
        <span>POWER: <strong id="fnafPowerVal">99%</strong></span>
        <div class="fnaf-usage-meter">
          <span>USAGE:</span>
          <span class="fnaf-usage-bar"></span>
          <span class="fnaf-usage-bar"></span>
        </div>
      </div>
    </div>

    <!-- Alt Güvenlik Monitörü Çubuğu -->
    <div class="fnaf-monitor-flip-bar" id="fnafMonitorBar" title="Click to Toggle Security Cam">
      <span class="fnaf-flip-text">▲ SECURITY CAMERAS ▲</span>
    </div>

    <!-- Güvenlik Kamerası UI Modalı -->
    <div class="fnaf-cam-view" id="fnafCamView" style="display: none;">
      <div class="fnaf-cam-header">
        <div>
          <span class="fnaf-rec-dot">● REC</span>
          <span id="fnafCamName" style="margin-left: 8px;">CAM 1A - SHOWSTAGE</span>
        </div>
        <!-- Kolay Kapatma Butonu -->
        <button type="button" class="fnaf-cam-close-btn" id="btnExitCam">[ESC] CLOSE CAM ✕</button>
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

  // Müzik Çalar Buton Olayları
  const btnPlayToggle = fnafOverlay.querySelector('#btnFnafPlayToggle');
  const btnNext = fnafOverlay.querySelector('#btnFnafNextTrack');
  const volSlider = fnafOverlay.querySelector('#fnafVolSlider');
  const trackTitle = fnafOverlay.querySelector('#fnafTrackTitle');

  btnPlayToggle?.addEventListener('click', () => {
    if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
      if (isPlaying) {
        ytPlayer.pauseVideo();
      } else {
        ytPlayer.playVideo();
      }
    }
  });

  btnNext?.addEventListener('click', () => {
    const next = FNAF_TRACKS[Math.floor(Math.random() * FNAF_TRACKS.length)];
    currentTrack = next;
    if (trackTitle) trackTitle.textContent = next.name;

    if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
      ytPlayer.loadVideoById(next.videoId);
    }
  });

  volSlider?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
      ytPlayer.setVolume(val);
    }
  });

  // Dinamik Parazit
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

  // Glitch Tetikleyici
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

  // Güç Düşüş Simülasyonu
  let power = 99;
  const powerEl = fnafOverlay.querySelector('#fnafPowerVal');
  const powerInterval = setInterval(() => {
    if (power > 1) {
      power--;
      powerEl.textContent = `${power}%`;
    }
  }, 12000);

  // Kamera Monitörü Açma / Kapatma
  const monitorBar = fnafOverlay.querySelector('#fnafMonitorBar');
  const camView = fnafOverlay.querySelector('#fnafCamView');
  const btnExitCam = fnafOverlay.querySelector('#btnExitCam');
  const camName = fnafOverlay.querySelector('#fnafCamName');
  const camBtns = fnafOverlay.querySelectorAll('.fnaf-cam-btn');

  let camOpen = false;
  const toggleCam = (forceState) => {
    camOpen = typeof forceState === 'boolean' ? forceState : !camOpen;
    camView.style.display = camOpen ? 'flex' : 'none';
    monitorBar.classList.toggle('flipped', camOpen);
  };

  monitorBar?.addEventListener('click', () => toggleCam());
  btnExitCam?.addEventListener('click', () => toggleCam(false));

  // ESC veya Boşluk Tuşuyla Kameradan Çıkış
  const onKeyDown = (e) => {
    if (e.code === 'Escape' && camOpen) {
      toggleCam(false);
    }
  };
  window.addEventListener('keydown', onKeyDown);

  camBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      camBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      camName.textContent = btn.dataset.cam;
    });
  });

  return {
    destroy: () => {
      document.removeEventListener('click', tryAutoPlay);
      window.removeEventListener('keydown', onKeyDown);
      cancelAnimationFrame(animId);
      clearTimeout(twitchTimeout);
      clearInterval(powerInterval);
      window.removeEventListener('resize', resizeCanvas);
      document.body.classList.remove('fnaf-screen-glitch');
      if (ytPlayer && typeof ytPlayer.destroy === 'function') {
        ytPlayer.destroy();
      }
      playerWrapper.remove();
      fnafOverlay.remove();
    }
  };
}