export function init() {
  const DEBATE_STATEMENTS = [
    { text: "The server went down at midnight!", isContradiction: false },
    { text: "Nobody had access to the master key!", isContradiction: false },
    { text: "The CLI terminal was completely locked!", isContradiction: true },
    { text: "The log files were wiped permanently!", isContradiction: false }
  ];

  let ammoCount = 6;
  let hangmanProgress = "";
  const TARGET_WORD = "DESPAIR";

  const drStage = document.createElement('div');
  drStage.id = 'danganronpaStage';
  drStage.className = 'dr-stage';
  drStage.innerHTML = `
    <div class="dr-crosshair" id="drCrosshair"></div>

    <!-- Üst Kontrol & Araçlar Barı -->
    <div class="dr-top-bar">
      <button type="button" class="dr-tool-btn exec" id="btnExecution" title="It's Punishment Time!">
        <span class="dr-monokuma-eye"></span>
        <span>PUNISHMENT TIME 🔨</span>
      </button>

      <button type="button" class="dr-tool-btn pta" id="btnStartPTA" title="Start Panic Talk Action!">
        <span>⚡</span>
        <span>PANIC TALK (PTA)</span>
      </button>

      <button type="button" class="dr-tool-btn hangman" id="btnStartHangman" title="Play Hangman's Gambit!">
        <span>🔤</span>
        <span>HANGMAN'S GAMBIT</span>
      </button>
    </div>

    <!-- Nonstop Debate Sahnesi (Dönen İfadeler) -->
    <div class="dr-debate-orbit" id="drDebateOrbit">
      <div class="dr-debate-badge">NONSTOP DEBATE // LOAD TRUTH BULLET</div>
      <div class="dr-statements-container" id="drStatements"></div>
    </div>

    <!-- "NO, THAT'S WRONG!" / BREAK SCREEN EFEKTİ -->
    <div class="dr-break-screen" id="drBreakScreen">
      <div class="dr-shatter-glass"></div>
      <div class="dr-break-text">
        <span>NO, THAT'S</span>
        <strong>WRONG!</strong>
        <small>それ は 違う よ !</small>
      </div>
    </div>

    <!-- Hangman's Gambit Yüzen Harf Sahnesi -->
    <div class="dr-hangman-stage" id="drHangmanStage" style="display: none;">
      <div class="dr-hangman-header">
        <span>HANGMAN'S GAMBIT: SPELL THE CLUE</span>
        <div class="dr-word-slots" id="drWordSlots">_ _ _ _ _ _ _</div>
        <button type="button" class="dr-mini-close" id="btnCloseHangman">&times;</button>
      </div>
      <div class="dr-letter-orbit" id="drLetterOrbit"></div>
    </div>

    <!-- Panic Talk Action (Ritim Çemberi) -->
    <div class="dr-pta-stage" id="drPtaStage" style="display: none;">
      <div class="dr-pta-box">
        <div class="dr-pta-title">PANIC TALK ACTION // HIT THE BEAT [SPACE]</div>
        <div class="dr-shield-meter">
          <div class="dr-shield-fill" id="drShieldFill" style="width: 100%;"></div>
        </div>
        <div class="dr-rhythm-target" id="drRhythmTarget">
          <div class="dr-pulse-ring"></div>
          <span class="dr-beat-icon">⚡</span>
        </div>
        <button type="button" class="dr-mini-close pta-close" id="btnClosePta">&times;</button>
      </div>
    </div>

    <!-- Sağ Alt: 6'lı Truth Bullet Revolver Silindiri -->
    <div class="dr-cylinder-widget" id="drCylinder" title="Truth Bullet Cylinder">
      <div class="dr-cylinder-drum" id="drDrum">
        <span class="bullet b1 loaded"></span>
        <span class="bullet b2 loaded"></span>
        <span class="bullet b3 loaded"></span>
        <span class="bullet b4 loaded"></span>
        <span class="bullet b5 loaded"></span>
        <span class="bullet b6 loaded"></span>
      </div>
      <span class="dr-bullet-label">TRUTH BULLET</span>
    </div>

    <!-- Monokuma İnfaz (Execution) Pop-up Modalı -->
    <div class="dr-execution-modal" id="drExecModal" style="display: none;">
      <div class="dr-exec-box">
        <div class="dr-exec-header">
          <span>// CLASS TRIAL EXECUTION</span>
          <button type="button" class="dr-modal-close" id="btnCloseExec">&times;</button>
        </div>
        <div class="dr-exec-content">
          <div class="dr-monokuma-art">
            <div class="monokuma-half left"></div>
            <div class="monokuma-half right"></div>
          </div>
          <h3>UPUPUPU~ GUILTY VERDICT!</h3>
          <p>The blackened has been identified. Commencing final routine...</p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(drStage);

  // --- 1. WEB AUDIO API SES MOTORU ---
  let audioCtx = null;
  const initAudio = () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  };

  const playSfx = (freq, duration, type = 'sawtooth') => {
    try {
      initAudio();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + duration);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  };

  // --- 2. CROSSHAIR & PEMBE KAN MOTORU ---
  const crosshair = drStage.querySelector('#drCrosshair');
  const onMouseMove = (e) => {
    crosshair.style.left = `${e.clientX}px`;
    crosshair.style.top = `${e.clientY}px`;
  };
  window.addEventListener('mousemove', onMouseMove);

  const spawnPinkSplatter = (x, y) => {
    const splat = document.createElement('div');
    splat.className = 'dr-pink-splatter';
    splat.style.left = `${x}px`;
    splat.style.top = `${y}px`;
    document.body.appendChild(splat);
    setTimeout(() => splat.remove(), 2200);
  };

  // --- 3. NONSTOP DEBATE MOTORU ---
  const statementsBox = drStage.querySelector('#drStatements');
  const drum = drStage.querySelector('#drDrum');
  const breakScreen = drStage.querySelector('#drBreakScreen');

  const startDebate = () => {
    statementsBox.innerHTML = '';
    DEBATE_STATEMENTS.forEach((stmt, idx) => {
      const el = document.createElement('div');
      el.className = `dr-statement ${stmt.isContradiction ? 'contradiction' : ''}`;
      el.textContent = `"${stmt.text}"`;
      el.style.animationDelay = `${idx * 1.8}s`;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        shootStatement(stmt.isContradiction, e.clientX, e.clientY);
      });

      statementsBox.appendChild(el);
    });
  };
  startDebate();

  const shootStatement = (isCorrect, x, y) => {
    if (ammoCount <= 0) return;
    ammoCount--;
    playSfx(380, 0.2, 'sawtooth');

    drum.style.transform = `rotate(${(6 - ammoCount) * 60}deg)`;
    const bullets = drum.querySelectorAll('.bullet');
    if (bullets[ammoCount]) bullets[ammoCount].classList.remove('loaded');

    if (isCorrect) {
      playSfx(880, 0.4, 'square');
      breakScreen.classList.add('shattering');
      spawnPinkSplatter(x, y);

      setTimeout(() => {
        breakScreen.classList.remove('shattering');
        ammoCount = 6;
        bullets.forEach(b => b.classList.add('loaded'));
        drum.style.transform = 'rotate(0deg)';
        startDebate();
      }, 2000);
    } else {
      spawnPinkSplatter(x, y);
    }
  };

  // --- 4. HANGMAN'S GAMBIT MOTORU ---
  const btnHangman = drStage.querySelector('#btnStartHangman');
  const hangmanStage = drStage.querySelector('#drHangmanStage');
  const letterOrbit = drStage.querySelector('#drLetterOrbit');
  const wordSlots = drStage.querySelector('#drWordSlots');
  const btnCloseHangman = drStage.querySelector('#btnCloseHangman');

  const startHangman = () => {
    hangmanStage.style.display = 'flex';
    hangmanProgress = "";
    updateWordSlots();
    letterOrbit.innerHTML = '';

    const letters = ['D', 'E', 'S', 'P', 'A', 'I', 'R', 'X', 'O', 'M'];
    letters.sort(() => Math.random() - 0.5);

    letters.forEach((char, i) => {
      const orb = document.createElement('div');
      orb.className = 'dr-letter-orb';
      orb.textContent = char;
      orb.style.left = `${15 + (i % 5) * 18}%`;
      orb.style.top = `${25 + Math.floor(i / 5) * 35}%`;

      orb.addEventListener('click', (e) => {
        e.stopPropagation();
        playSfx(420, 0.15, 'triangle');
        if (TARGET_WORD[hangmanProgress.length] === char) {
          hangmanProgress += char;
          orb.classList.add('hit-correct');
          updateWordSlots();
          if (hangmanProgress === TARGET_WORD) {
            playSfx(900, 0.5, 'square');
            setTimeout(() => {
              hangmanStage.style.display = 'none';
              spawnPinkSplatter(window.innerWidth / 2, window.innerHeight / 2);
            }, 800);
          }
        } else {
          spawnPinkSplatter(e.clientX, e.clientY);
        }
      });

      letterOrbit.appendChild(orb);
    });
  };

  const updateWordSlots = () => {
    let display = "";
    for (let i = 0; i < TARGET_WORD.length; i++) {
      display += (hangmanProgress[i] ? `${hangmanProgress[i]} ` : "_ ");
    }
    wordSlots.textContent = display.trim();
  };

  btnHangman.addEventListener('click', startHangman);
  btnCloseHangman.addEventListener('click', () => hangmanStage.style.display = 'none');

  // --- 5. PANIC TALK ACTION (PTA RİTİM OYUNU) ---
  const btnPta = drStage.querySelector('#btnStartPTA');
  const ptaStage = drStage.querySelector('#drPtaStage');
  const shieldFill = drStage.querySelector('#drShieldFill');
  const btnClosePta = drStage.querySelector('#btnClosePta');
  let shieldHp = 100;

  const startPTA = () => {
    ptaStage.style.display = 'flex';
    shieldHp = 100;
    shieldFill.style.width = '100%';
  };

  const hitPTABeat = () => {
    if (ptaStage.style.display !== 'flex') return;
    shieldHp = Math.max(0, shieldHp - 25);
    shieldFill.style.width = `${shieldHp}%`;
    playSfx(500, 0.12, 'sawtooth');

    if (shieldHp <= 0) {
      playSfx(1000, 0.4, 'square');
      setTimeout(() => {
        ptaStage.style.display = 'none';
        breakScreen.classList.add('shattering');
        setTimeout(() => breakScreen.classList.remove('shattering'), 1800);
      }, 300);
    }
  };

  btnPta.addEventListener('click', startPTA);
  btnClosePta.addEventListener('click', () => ptaStage.style.display = 'none');
  ptaStage.querySelector('#drRhythmTarget').addEventListener('click', hitPTABeat);

  const onKeyDown = (e) => {
    if (e.code === 'Space' && ptaStage.style.display === 'flex') {
      e.preventDefault();
      hitPTABeat();
    }
  };
  window.addEventListener('keydown', onKeyDown);

  // --- 6. MONOKUMA EXECUTION MODAL ---
  const btnExec = drStage.querySelector('#btnExecution');
  const execModal = drStage.querySelector('#drExecModal');
  const btnCloseExec = drStage.querySelector('#btnCloseExec');

  btnExec.addEventListener('click', () => {
    execModal.style.display = 'flex';
    playSfx(200, 0.3, 'sawtooth');
    spawnPinkSplatter(window.innerWidth / 2, window.innerHeight / 2);
  });

  btnCloseExec.addEventListener('click', () => {
    execModal.style.display = 'none';
  });

  return {
    destroy: () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      drStage.remove();
    }
  };
}