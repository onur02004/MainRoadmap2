// public/themes/modules/himym-theme.js
import { loadServices, handleServiceClick } from '../../services-client.js';

export function init() {
  // 1. Doğrulanmış & Embed İzni Açık HIMYM Müzik Listesi
  const HIMYM_TRACKS = [
    { name: "The Solids - Hey Beautiful (Intro)", videoId: "Xk8fIuh4F4o", start: 0 },
    { name: "Barney - Nothing Suits Me Like a Suit", videoId: "AoyvPz0aK_M", start: 20 },
    { name: "The Proclaimers - 500 Miles", videoId: "XZ4Ib-7YJcU", start: 40 }
  ];

  let currentTrack = HIMYM_TRACKS[Math.floor(Math.random() * HIMYM_TRACKS.length)];
  let ytPlayer = null;
  let isPlaying = false;

  // IFrame Konteyneri
  const hiddenYtContainer = document.createElement('div');
  hiddenYtContainer.id = 'himymYoutubePlayer';
  hiddenYtContainer.style.position = 'fixed';
  hiddenYtContainer.style.top = '-9999px';
  hiddenYtContainer.style.left = '-9999px';
  hiddenYtContainer.style.width = '1px';
  hiddenYtContainer.style.height = '1px';
  hiddenYtContainer.style.opacity = '0';
  hiddenYtContainer.style.pointerEvents = 'none';
  document.body.appendChild(hiddenYtContainer);

  function loadYouTubeIframeApi() {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }

  function initPlayer() {
    if (window.YT && window.YT.Player) {
      ytPlayer = new window.YT.Player('himymYoutubePlayer', {
        height: '1',
        width: '1',
        videoId: currentTrack.videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          start: currentTrack.start
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(80);
          },
          onStateChange: (event) => {
            const btn = document.getElementById('btnToggleHimymMusic');
            if (event.data === window.YT.PlayerState.PLAYING) {
              isPlaying = true;
              if (btn) btn.textContent = '⏸ PAUSE';
            } else {
              isPlaying = false;
              if (btn) btn.textContent = '▶ PLAY';
            }
          }
        }
      });
    } else {
      setTimeout(initPlayer, 200);
    }
  }

  loadYouTubeIframeApi();
  initPlayer();

  const tryAutoPlayOnFirstClick = () => {
    if (ytPlayer && typeof ytPlayer.playVideo === 'function' && !isPlaying) {
      ytPlayer.playVideo();
    }
    document.removeEventListener('click', tryAutoPlayOnFirstClick);
  };
  document.addEventListener('click', tryAutoPlayOnFirstClick, { once: true });

  // 2. İlk Koddaki Web Audio API Korno Sentezleyicisi
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

  // 3. Rastgele HIMYM Sahneleri
  const HIMYM_SKETCHES = [
    { title: "THE TIME TRAVELERS 🕰️", quote: '"Look around you, Ted. You\'re all alone."' },
    { title: "SUIT UP! 👔", quote: '"A lie is just a great story someone ruined with the truth."' },
    { title: "BLUE FRENCH HORN 💙", quote: '"I would have stolen you a whole orchestra."' },
    { title: "SLAP BET 💥", quote: '"THAT\'S SLAP #4!! Happy Slapsgiving, Barney!"' }
  ];

  let selectedSketch = HIMYM_SKETCHES[Math.floor(Math.random() * HIMYM_SKETCHES.length)];

  const PLAYBOOK_PLAYS = [
    { title: "The Lorenzo Von Matterhorn", desc: "Create fake Wikipedia articles, a website, and a mysterious persona." },
    { title: "The Scuba Diver", desc: "Wear full scuba gear into the bar. Claim you're going to dive into the Hudson." },
    { title: "The Ted Mosby", desc: "Tell a girl on the first night: 'I think I'm in love with you' with puppy eyes." },
    { title: "The SNASA", desc: "Claim you work for Secret NASA and you've been to the Smooth Moon." },
    { title: "The Mrs. Stinsfire", desc: "Disguise yourself as a strict English nanny." }
  ];
  let playIndex = 0;

  // 4. HIMYM Katmanları
  const himymLayer = document.createElement('div');
  himymLayer.id = 'himymGameLayer';
  himymLayer.innerHTML = `
    <!-- Yağmur Canvas -->
    <canvas id="himymRainCanvas" class="himym-rain-canvas"></canvas>

    <!-- SOL ÜST BİRLEŞİK BAR: JUKEBOX VE ŞEMSİYE BUTONU (YAN YANA) -->
    <div class="himym-top-left-bar">
      <div class="himym-audio-hud">
        <div class="himym-audio-meta">
          <span class="himym-audio-label">MACLAREN'S JUKEBOX</span>
          <span class="himym-audio-title" id="himymTrackTitle">${currentTrack.name}</span>
        </div>
        <div class="himym-audio-controls">
          <button type="button" class="himym-audio-btn" id="btnToggleHimymMusic">▶ PLAY</button>
          <button type="button" class="himym-audio-btn blue" id="btnNextHimymTrack" title="Random Next Track">⏭</button>
          <input type="range" class="himym-vol-slider" id="himymVolSlider" min="0" max="100" value="80" />
        </div>
      </div>

      <div class="himym-umbrella-badge" id="btnToggleRain" title="Click to Open the Giant Yellow Umbrella!">
        <span>☂️</span>
        <span>YELLOW UMBRELLA</span>
      </div>
    </div>

    <!-- DEV SARI ŞEMSİYE KUBBESİ -->
    <div class="himym-big-umbrella-stage" id="bigUmbrellaStage">
      <div class="umbrella-canopy-wrap">
        <svg class="giant-yellow-umbrella-svg" viewBox="0 0 400 220" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M 10 140 C 15 30, 385 30, 390 140 C 340 120, 300 140, 260 125 C 220 140, 180 125, 140 140 C 100 125, 60 140, 10 140 Z" fill="#F7D02C" stroke="#D4A017" stroke-width="4"/>
          <path d="M 200 35 Q 160 85 140 140" stroke="#E5B810" stroke-width="3" fill="none"/>
          <path d="M 200 35 Q 240 85 260 125" stroke="#E5B810" stroke-width="3" fill="none"/>
          <path d="M 200 20 L 200 35" stroke="#4A3B18" stroke-width="6" stroke-linecap="round"/>
          <path d="M 200 120 L 200 200 C 200 215, 175 215, 175 200" stroke="#4A3B18" stroke-width="6" stroke-linecap="round" fill="none"/>
        </svg>
        <div class="umbrella-quote-bubble">"Right place, right time." — Ted Mosby ☂️</div>
      </div>
    </div>

    <!-- SAĞ ALTTA ÇALIŞAN RASTGELE HIMYM SKETCH KUTUSU -->
    <div class="himym-alone-scene" id="himymAloneScene">
      <div class="alone-header-row">
        <span class="alone-header-title" id="sketchTitle">${selectedSketch.title}</span>
        <button type="button" class="alone-close-btn" id="btnCloseAloneScene">&times;</button>
      </div>
      
      <div class="alone-stage-wrap">
        <div class="alone-bubble" id="barneyQuoteBubble">${selectedSketch.quote}</div>

        <!-- Ted (Soldan Gelir) -->
        <div class="alone-char ted" id="tedChar">
          <div class="char-head ted-hair"></div>
          <div class="char-suit"></div>
        </div>

        <!-- Booth Masası -->
        <div class="alone-booth-table"></div>

        <!-- Barney (Sağdan Gelir) -->
        <div class="alone-char barney" id="barneyChar">
          <div class="char-head barney-hair"></div>
          <div class="char-suit barney-suit"></div>
        </div>
      </div>
    </div>

    <!-- SAĞ KENAR WIDGETLARI -->
    <div class="himym-sidebar-tools">
      <button type="button" class="himym-tool-btn alone" id="btnTriggerSketch" title="Trigger Random HIMYM Scene">
        <span>🎬</span>
        <small>SCENE</small>
      </button>

      <button type="button" class="himym-tool-btn horn" id="btnFrenchHorn" title="Play Blue French Horn">
        <img src="https://cdn-icons-png.flaticon.com/512/848/848123.png" alt="Horn" class="horn-mini-thumb" />
        <small>BLUE HORN</small>
      </button>

      <button type="button" class="himym-tool-btn playbook" id="btnOpenPlaybook" title="The Playbook">
        <span>📖</span>
        <small>PLAYBOOK</small>
      </button>
    </div>

    <!-- PLAYBOOK MODAL -->
    <div class="himym-modal" id="playbookModal" style="display: none;">
      <div class="playbook-book">
        <div class="playbook-cover">
          <div class="book-title">THE PLAYBOOK</div>
          <button class="book-close" id="btnClosePlaybook">&times;</button>
        </div>
        <div class="playbook-page">
          <h4 id="playTitle">${PLAYBOOK_PLAYS[0].title}</h4>
          <p id="playDesc">${PLAYBOOK_PLAYS[0].desc}</p>
          <button type="button" class="book-btn" id="btnNextPlay">NEXT PLAY &rarr;</button>
          <button type="button" class="book-btn suit" id="btnSuitUp">SUIT UP! 👔</button>
        </div>
      </div>
    </div>

    <!-- İLK KODDAKİ ANİMASYONLU MAVİ FRANSIZ KORNOSU SAHNESİ -->
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

  // 5. Mavi Korno Oynatma & Not Patlaması
  const btnHorn = himymLayer.querySelector('#btnFrenchHorn');
  const hornStage = himymLayer.querySelector('#hornStage');
  const hornInstrument = himymLayer.querySelector('#hornInstrument');
  let isPlayingHorn = false;

  btnHorn?.addEventListener('click', () => {
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

  // 6. Rastgele Sahne Oynatıcı Fonksiyonu
  const aloneScene = himymLayer.querySelector('#himymAloneScene');
  const tedChar = himymLayer.querySelector('#tedChar');
  const barneyChar = himymLayer.querySelector('#barneyChar');
  const barneyQuote = himymLayer.querySelector('#barneyQuoteBubble');
  const sketchTitle = himymLayer.querySelector('#sketchTitle');
  const btnCloseAlone = himymLayer.querySelector('#btnCloseAloneScene');

  const playRandomScene = () => {
    selectedSketch = HIMYM_SKETCHES[Math.floor(Math.random() * HIMYM_SKETCHES.length)];
    if (sketchTitle) sketchTitle.textContent = selectedSketch.title;
    if (barneyQuote) barneyQuote.textContent = selectedSketch.quote;

    aloneScene.classList.add('active');
    tedChar.classList.remove('seated');
    barneyChar.classList.remove('appeared');
    barneyQuote.classList.remove('show');

    setTimeout(() => { tedChar.classList.add('seated'); }, 400);
    setTimeout(() => { barneyChar.classList.add('appeared'); }, 1200);
    setTimeout(() => { barneyQuote.classList.add('show'); }, 2000);
  };

  const closeScene = () => { aloneScene.classList.remove('active'); };

  himymLayer.querySelector('#btnTriggerSketch')?.addEventListener('click', playRandomScene);
  btnCloseAlone?.addEventListener('click', closeScene);
  setTimeout(playRandomScene, 1000);

  // 7. Şemsiye Açma / Kapatma
  const btnToggleRain = himymLayer.querySelector('#btnToggleRain');
  const bigUmbrellaStage = himymLayer.querySelector('#bigUmbrellaStage');
  let isUmbrellaOpen = false;

  btnToggleRain?.addEventListener('click', () => {
    isUmbrellaOpen = !isUmbrellaOpen;
    btnToggleRain.classList.toggle('active', isUmbrellaOpen);
    bigUmbrellaStage.classList.toggle('open', isUmbrellaOpen);
  });

  // 8. Yağmur Canvas
  const canvas = himymLayer.querySelector('#himymRainCanvas');
  const ctx = canvas.getContext('2d');
  let rainAnimId = null;

  const resizeRain = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resizeRain();
  window.addEventListener('resize', resizeRain);

  const drops = Array.from({ length: 70 }).map(() => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    length: Math.random() * 18 + 10,
    speed: Math.random() * 7 + 5
  }));

  const drawRain = () => {
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

  // 9. Müzik Kontrolleri
  const btnToggleMusic = himymLayer.querySelector('#btnToggleHimymMusic');
  const btnNext = himymLayer.querySelector('#btnNextHimymTrack');
  const trackTitle = himymLayer.querySelector('#himymTrackTitle');
  const volSlider = himymLayer.querySelector('#himymVolSlider');

  btnToggleMusic?.addEventListener('click', () => {
    if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
      if (isPlaying) {
        ytPlayer.pauseVideo();
      } else {
        ytPlayer.playVideo();
      }
    }
  });

  btnNext?.addEventListener('click', () => {
    const next = HIMYM_TRACKS[Math.floor(Math.random() * HIMYM_TRACKS.length)];
    currentTrack = next;
    if (trackTitle) trackTitle.textContent = next.name;

    if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
      ytPlayer.loadVideoById({
        videoId: next.videoId,
        startSeconds: next.start
      });
    }
  });

  volSlider?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
      ytPlayer.setVolume(val);
    }
  });

  // 10. Playbook
  const playbookModal = himymLayer.querySelector('#playbookModal');
  const btnOpenPlaybook = himymLayer.querySelector('#btnOpenPlaybook');
  const btnClosePlaybook = himymLayer.querySelector('#btnClosePlaybook');
  const btnNextPlay = himymLayer.querySelector('#btnNextPlay');
  const playTitle = himymLayer.querySelector('#playTitle');
  const playDesc = himymLayer.querySelector('#playDesc');

  btnOpenPlaybook?.addEventListener('click', () => { playbookModal.style.display = 'flex'; });
  btnClosePlaybook?.addEventListener('click', () => { playbookModal.style.display = 'none'; });
  btnNextPlay?.addEventListener('click', () => {
    playIndex = (playIndex + 1) % PLAYBOOK_PLAYS.length;
    playTitle.textContent = PLAYBOOK_PLAYS[playIndex].title;
    playDesc.textContent = PLAYBOOK_PLAYS[playIndex].desc;
  });

  return {
    destroy: () => {
      document.removeEventListener('click', tryAutoPlayOnFirstClick);
      window.removeEventListener('resize', resizeRain);
      cancelAnimationFrame(rainAnimId);
      if (ytPlayer && typeof ytPlayer.destroy === 'function') {
        ytPlayer.destroy();
      }
      hiddenYtContainer.remove();
      himymLayer.remove();
    }
  };
}