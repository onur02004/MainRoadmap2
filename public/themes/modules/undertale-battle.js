export function init() {
  let hp = 20;
  const maxHp = 20;
  let isBlueSoul = false;
  let inBattle = false;
  let battleLoopId = null;

  // 1. Undertale Sahnesi ve Savaş Alanını Oluştur
  const utStage = document.createElement('div');
  utStage.id = 'undertaleGameLayer';
  utStage.className = 'ut-layer';
  utStage.innerHTML = `
    <!-- Save Point Yıldızı (Sol Üst) -->
    <div class="ut-save-star" id="utSaveStar" title="Click to Save!">
      <span class="star-icon">✦</span>
      <span class="star-label">SAVE POINT</span>
    </div>

    <!-- Diyalog / Typewriter Kutusu -->
    <div class="ut-dialog-box" id="utDialogBox">
      <span class="ut-dialog-char">*</span>
      <p class="ut-dialog-text" id="utDialogText">(Seeing the terminal online fills you with DETERMINATION.)</p>
    </div>

    <!-- Undertale Savaş Kutusu HUD -->
    <div class="ut-battle-container" id="utBattleContainer">
      <div class="ut-status-bar">
        <span class="ut-name-tag">ONUR  LV 19</span>
        <div class="ut-hp-wrap">
          <span class="ut-hp-lbl">HP</span>
          <div class="ut-hp-bar">
            <div class="ut-hp-fill" id="utHpFill" style="width: 100%;"></div>
          </div>
          <span class="ut-hp-num" id="utHpNum">20 / 20</span>
        </div>
      </div>

      <!-- Bullet Hell Savaş Çerçevesi -->
      <div class="ut-bullet-box" id="utBulletBox">
        <div class="ut-soul" id="utSoul"></div>
        <div class="ut-bones-container" id="utBonesContainer"></div>
        <div class="ut-box-hint" id="utBoxHint">PRESS [FIGHT] OR [SPACE] TO START SANS BATTLE</div>
      </div>

      <!-- 4'lü Savaş Menüsü -->
      <div class="ut-menu-row">
        <button type="button" class="ut-btn" id="btnUtFight">⚔ FIGHT</button>
        <button type="button" class="ut-btn" id="btnUtAct">🗣 ACT</button>
        <button type="button" class="ut-btn" id="btnUtItem">🥧 ITEM</button>
        <button type="button" class="ut-btn" id="btnUtMercy">💛 MERCY</button>
      </div>
    </div>
  `;

  document.body.appendChild(utStage);

  // --- WEB AUDIO API (MEGALOVANIA VE EFFECT SENTEZİ) ---
  let audioCtx = null;
  const initAudio = () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  };

  const playBuzzerTone = (freq, duration, type = 'square') => {
    try {
      initAudio();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  };

  const playMegalovaniaIntro = () => {
    initAudio();
    const notes = [293.66, 293.66, 587.33, 440.0, 415.3, 392.0, 349.23, 293.66, 349.23, 392.0];
    const delays = [0, 120, 240, 360, 480, 600, 720, 840, 960, 1080];
    notes.forEach((freq, i) => {
      setTimeout(() => playBuzzerTone(freq, 0.1, 'sawtooth'), delays[i]);
    });
  };

  // --- TYPEWRITER DİYALOG YAZICI ---
  const dialogTextEl = utStage.querySelector('#utDialogText');
  let typeTimer = null;
  const typeDialog = (text) => {
    clearTimeout(typeTimer);
    dialogTextEl.textContent = '';
    let idx = 0;
    const typeChar = () => {
      if (idx < text.length) {
        dialogTextEl.textContent += text[idx];
        if (text[idx] !== ' ') playBuzzerTone(140, 0.04, 'square');
        idx++;
        typeTimer = setTimeout(typeChar, 30);
      }
    };
    typeChar();
  };

  // --- SAVE POINT ETKİLEŞİMİ ---
  const saveStar = utStage.querySelector('#utSaveStar');
  saveStar.addEventListener('click', () => {
    playBuzzerTone(523.25, 0.15, 'triangle');
    setTimeout(() => playBuzzerTone(659.25, 0.35, 'triangle'), 120);
    typeDialog('(Knowing the code is cleanly compiled fills you with DETERMINATION. File Saved.)');
  });

  // --- BULLET HELL & SOUL KONTROLÜ ---
  const bulletBox = utStage.querySelector('#utBulletBox');
  const soul = utStage.querySelector('#utSoul');
  const bonesContainer = utStage.querySelector('#utBonesContainer');
  const hpFill = utStage.querySelector('#utHpFill');
  const hpNum = utStage.querySelector('#utHpNum');
  const boxHint = utStage.querySelector('#utBoxHint');

  let soulX = 140;
  let soulY = 60;
  let vy = 0;
  const gravity = 0.45;
  const jumpForce = -7.5;
  const speed = 4.2;
  const keys = {};
  let bones = [];

  const updateSoulDisplay = () => {
    soul.style.left = `${soulX}px`;
    soul.style.top = `${soulY}px`;
    soul.className = isBlueSoul ? 'ut-soul blue' : 'ut-soul';
  };

  const startBattle = () => {
    if (inBattle) return;
    inBattle = true;
    boxHint.style.display = 'none';
    playMegalovaniaIntro();
    typeDialog('* Sans: "it\'s a beautiful day outside. birds are singing, flowers are blooming..."');

    soulX = bulletBox.clientWidth / 2 - 8;
    soulY = bulletBox.clientHeight / 2 - 8;
    bones = [];
    bonesContainer.innerHTML = '';

    // 5 saniye sonra Papyrus / Sans Blue Soul moduna geç
    setTimeout(() => {
      if (inBattle) {
        isBlueSoul = true;
        playBuzzerTone(220, 0.2, 'square');
        typeDialog('* You\'re blue now. That\'s my attack!');
      }
    }, 4500);

    battleLoop();
  };

  const stopBattle = (win = false) => {
    inBattle = false;
    isBlueSoul = false;
    cancelAnimationFrame(battleLoopId);
    bonesContainer.innerHTML = '';
    boxHint.style.display = 'block';
    boxHint.textContent = win ? 'YOU SPARED THE SKELETON! 🏆' : 'PRESS [FIGHT] OR [SPACE] TO RETRY';
    updateSoulDisplay();
  };

  const takeDamage = () => {
    if (hp > 0) {
      hp = Math.max(0, hp - 2);
      playBuzzerTone(90, 0.12, 'sawtooth');
      soul.classList.add('hurt');
      setTimeout(() => soul.classList.remove('hurt'), 180);

      const percent = (hp / maxHp) * 100;
      hpFill.style.width = `${percent}%`;
      hpNum.textContent = `${hp} / ${maxHp}`;

      if (hp <= 0) {
        stopBattle(false);
        typeDialog('* GAME OVER. Stay determined...');
        setTimeout(() => {
          hp = 20;
          hpFill.style.width = '100%';
          hpNum.textContent = '20 / 20';
        }, 3000);
      }
    }
  };

  let spawnTimer = 0;
  const battleLoop = () => {
    if (!inBattle) return;

    // Hareket Mekaniği
    const boxW = bulletBox.clientWidth;
    const boxH = bulletBox.clientHeight;

    if (keys['ArrowLeft'] || keys['KeyA']) soulX -= speed;
    if (keys['ArrowRight'] || keys['KeyD']) soulX += speed;

    if (isBlueSoul) {
      // Yerçekimi & Zıplama Modu
      vy += gravity;
      soulY += vy;

      if (soulY >= boxH - 20) {
        soulY = boxH - 20;
        vy = 0;
        if (keys['ArrowUp'] || keys['KeyW'] || keys['Space']) {
          vy = jumpForce;
          playBuzzerTone(350, 0.08, 'triangle');
        }
      }
    } else {
      // Serbest Kırmızı Kalp Modu
      if (keys['ArrowUp'] || keys['KeyW']) soulY -= speed;
      if (keys['ArrowDown'] || keys['KeyS']) soulY += speed;
    }

    soulX = Math.max(4, Math.min(boxW - 20, soulX));
    soulY = Math.max(4, Math.min(boxH - 20, soulY));
    updateSoulDisplay();

    // Kemik / Saldırı Üretimi (Spawner)
    spawnTimer++;
    if (spawnTimer % 45 === 0) {
      const boneEl = document.createElement('div');
      const fromLeft = Math.random() < 0.5;
      const isGroundBone = isBlueSoul && Math.random() < 0.6;

      const bone = {
        el: boneEl,
        x: fromLeft ? -12 : boxW + 10,
        y: isGroundBone ? boxH - 32 : Math.random() * (boxH - 40),
        w: 10,
        h: isGroundBone ? 30 : Math.random() * 35 + 25,
        vx: fromLeft ? 3.2 : -3.2
      };

      boneEl.className = 'ut-bone';
      boneEl.style.width = `${bone.w}px`;
      boneEl.style.height = `${bone.h}px`;
      bonesContainer.appendChild(boneEl);
      bones.push(bone);
    }

    // Kemik Hareketi ve Çarpışma Testi (AABB Collision)
    for (let i = bones.length - 1; i >= 0; i--) {
      const b = bones[i];
      b.x += b.vx;
      b.el.style.left = `${b.x}px`;
      b.el.style.top = `${b.y}px`;

      // Çarpışma
      if (
        soulX < b.x + b.w &&
        soulX + 16 > b.x &&
        soulY < b.y + b.h &&
        soulY + 16 > b.y
      ) {
        takeDamage();
      }

      // Ekran dışına çıkma
      if (b.x < -30 || b.x > boxW + 30) {
        b.el.remove();
        bones.splice(i, 1);
      }
    }

    battleLoopId = requestAnimationFrame(battleLoop);
  };

  // --- KLAVYE DİNLEYİCİLERİ ---
  const onKeyDown = (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    keys[e.code] = true;
    if (e.code === 'Space' && !inBattle) {
      e.preventDefault();
      startBattle();
    }
  };

  const onKeyUp = (e) => {
    keys[e.code] = false;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // --- 4'LÜ MENÜ BUTONLARI ---
  utStage.querySelector('#btnUtFight').addEventListener('click', () => {
    playBuzzerTone(440, 0.1, 'sawtooth');
    startBattle();
  });

  utStage.querySelector('#btnUtAct').addEventListener('click', () => {
    playBuzzerTone(300, 0.08, 'triangle');
    typeDialog('* You told Sans a skeleton pun. He chuckles: "heheheh."');
  });

  utStage.querySelector('#btnUtItem').addEventListener('click', () => {
    hp = 20;
    hpFill.style.width = '100%';
    hpNum.textContent = '20 / 20';
    playBuzzerTone(600, 0.2, 'triangle');
    typeDialog('* You ate the Butterscotch Pie. HP was fully restored!');
  });

  utStage.querySelector('#btnUtMercy').addEventListener('click', () => {
    playBuzzerTone(500, 0.2, 'triangle');
    stopBattle(true);
    typeDialog('* You spared the enemy. YOU WON! +0 EXP and +0 GOLD.');
  });

  updateSoulDisplay();

  return {
    destroy: () => {
      cancelAnimationFrame(battleLoopId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      utStage.remove();
    }
  };
}