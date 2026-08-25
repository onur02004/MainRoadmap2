export function init() {
  const ddStage = document.createElement('div');
  ddStage.id = 'darkDeceptionStage';
  ddStage.className = 'dd-maze-viewport';
  ddStage.innerHTML = `
    <div class="dd-tablet-frame" id="ddTabletFrame">
      <!-- Bierce Tablet Üst Bar -->
      <div class="dd-tablet-topbar">
        <div class="tablet-branding">
          <span class="tablet-cam-lens"></span>
          <span class="tablet-title">BIERCE'S BALLROOM // SURVIVAL OS</span>
        </div>
        <div class="tablet-stats">
          <span>SHARDS: <strong id="lblShards">0 / 62</strong></span>
          <span>LIVES: <strong id="lblLives">♥♥♥</strong></span>
          <button type="button" class="dd-btn-toggle-view" id="btnToggleSize" title="Expand / Minimize">⛶</button>
        </div>
      </div>

      <!-- 2D Canvas & Fog of War -->
      <div class="dd-canvas-container">
        <canvas id="ddMazeCanvas" width="520" height="380"></canvas>
        
        <!-- Ani Jumpscare Katmanı -->
        <div class="dd-jumpscare-flash" id="ddJumpscareFlash">
          <div class="dd-monkey-screamer">🐵</div>
          <div class="dd-jumpscare-quote">"TIME TO DIE, MORTAL!"</div>
        </div>

        <!-- Game Over / Win Modalı -->
        <div class="dd-game-overlay" id="ddGameOverlay" style="display: none;">
          <div class="overlay-modal">
            <h2 id="overlayTitle">SOUL SHREDDED</h2>
            <p id="overlayDesc">The Murder Monkeys collected your soul!</p>
            <button type="button" class="dd-restart-btn" id="btnRestartGame">RETRY NIGHTMARE</button>
          </div>
        </div>
      </div>

      <!-- Alt Bar & Yetenek Butonları -->
      <div class="dd-tablet-bottombar">
        <div class="ability-slot" id="btnStunAbility" title="Press [SPACE] or Click to Stun Monsters!">
          <span class="ability-icon">⚡</span>
          <div class="ability-txt">
            <strong>PRIMAL STUN [SPACE]</strong>
            <small id="stunCooldownText">READY</small>
          </div>
        </div>
        <div class="dash-hint">DASH: <strong>[SHIFT]</strong></div>
      </div>
    </div>
  `;

  document.body.appendChild(ddStage);

  const canvas = ddStage.querySelector('#ddMazeCanvas');
  const ctx = canvas.getContext('2d');
  const lblShards = ddStage.querySelector('#lblShards');
  const lblLives = ddStage.querySelector('#lblLives');
  const overlay = ddStage.querySelector('#ddGameOverlay');
  const overlayTitle = ddStage.querySelector('#overlayTitle');
  const overlayDesc = ddStage.querySelector('#overlayDesc');
  const btnRestart = ddStage.querySelector('#btnRestartGame');
  const btnToggleSize = ddStage.querySelector('#btnToggleSize');
  const tabletFrame = ddStage.querySelector('#ddTabletFrame');
  const jumpscareFlash = ddStage.querySelector('#ddJumpscareFlash');
  const stunCooldownText = ddStage.querySelector('#stunCooldownText');

  // --- HARİTA MATRİSİ (1: Otel Duvarı, 0: Soul Shard Koridoru, 2: Boş/Spawn, 3: Powerup) ---
  const mapGrid = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,0,0,0,1,0,0,0,3,1],
    [1,0,1,0,1,0,1,1,1,1,0,1,0,1,1,0,1],
    [1,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,2,2,2,1,0,0,0,0,0,1],
    [1,1,1,0,1,0,1,2,2,2,1,0,1,0,1,1,1],
    [1,0,0,0,1,0,1,1,1,1,1,0,1,0,0,0,1],
    [1,0,1,1,1,0,0,0,0,0,0,0,1,1,1,0,1],
    [1,0,1,0,0,0,1,1,1,1,0,0,0,0,1,0,1],
    [1,3,0,0,1,0,0,0,1,0,0,1,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ];

  const TILE_SIZE = 30.5;
  let shards = [];
  let powerUps = [];

  const initPickups = () => {
    shards = [];
    powerUps = [];
    for (let r = 0; r < mapGrid.length; r++) {
      for (let c = 0; c < mapGrid[r].length; c++) {
        if (mapGrid[r][c] === 0) {
          shards.push({ x: c * TILE_SIZE + 15, y: r * TILE_SIZE + 15, collected: false });
        } else if (mapGrid[r][c] === 3) {
          powerUps.push({ x: c * TILE_SIZE + 15, y: r * TILE_SIZE + 15, collected: false });
        }
      }
    }
  };

  // --- OYUNCU & CANAVAR DURUMLARI ---
  let player = {
    x: 1 * TILE_SIZE + 15,
    y: 1 * TILE_SIZE + 15,
    radius: 8,
    speed: 2.7,
    baseSpeed: 2.7
  };

  let monsters = [
    { x: 8 * TILE_SIZE + 15, y: 5 * TILE_SIZE + 15, radius: 9, speed: 1.75, name: 'Monkey #1', angle: 0, cymbalState: 0 },
    { x: 7 * TILE_SIZE + 15, y: 6 * TILE_SIZE + 15, radius: 9, speed: 1.55, name: 'Monkey #2', angle: 0, cymbalState: 0 }
  ];

  let lives = 3;
  let collectedCount = 0;
  let isGameOver = false;
  let isStunned = false;
  let stunAvailable = true;
  let animLoopId = null;
  const keys = {};

  // Audio Engine
  let audioCtx = null;
  const playSfx = (freq, duration, type = 'sawtooth', gainVal = 0.2) => {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  };

  const isWall = (x, y, radius = 7) => {
    const minCol = Math.floor((x - radius) / TILE_SIZE);
    const maxCol = Math.floor((x + radius) / TILE_SIZE);
    const minRow = Math.floor((y - radius) / TILE_SIZE);
    const maxRow = Math.floor((y + radius) / TILE_SIZE);

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (r < 0 || r >= mapGrid.length || c < 0 || c >= mapGrid[0].length) return true;
        if (mapGrid[r][c] === 1) return true;
      }
    }
    return false;
  };

  // Canavar AI & Zil Efektleri
  const updateMonsters = () => {
    if (isStunned) return;

    monsters.forEach(m => {
      m.cymbalState = (m.cymbalState + 0.2) % (Math.PI * 2);
      const dx = player.x - m.x;
      const dy = player.y - m.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 0) {
        // Görüş mesafesine girdikçe hızlanırlar (Frenzy mode)
        const currentSpeed = dist < 120 ? m.speed * 1.25 : m.speed;
        let stepX = (dx / dist) * currentSpeed;
        let stepY = (dy / dist) * currentSpeed;

        if (!isWall(m.x + stepX, m.y, m.radius)) m.x += stepX;
        if (!isWall(m.x, m.y + stepY, m.radius)) m.y += stepY;

        m.angle = Math.atan2(dy, dx);
      }

      if (dist < player.radius + m.radius) {
        handleHit();
      }
    });
  };

  const handleHit = () => {
    lives--;
    playSfx(90, 0.5, 'sawtooth', 0.5);
    updateLivesUI();

    // Jumpscare Flash
    jumpscareFlash.classList.add('active');
    setTimeout(() => jumpscareFlash.classList.remove('active'), 800);

    if (lives <= 0) {
      isGameOver = true;
      overlay.style.display = 'flex';
      overlayTitle.textContent = 'SOUL SHREDDED';
      overlayDesc.textContent = 'Bierce sighs: "Disappointing... try not to die this time!"';
    } else {
      player.x = 1 * TILE_SIZE + 15;
      player.y = 1 * TILE_SIZE + 15;
      monsters[0].x = 8 * TILE_SIZE + 15;
      monsters[0].y = 5 * TILE_SIZE + 15;
    }
  };

  const triggerStun = () => {
    if (!stunAvailable || isGameOver) return;
    stunAvailable = false;
    isStunned = true;
    stunCooldownText.textContent = 'ACTIVE (3s)';
    playSfx(850, 0.4, 'triangle', 0.4);

    setTimeout(() => {
      isStunned = false;
      stunCooldownText.textContent = 'COOLDOWN (8s)';
      setTimeout(() => {
        stunAvailable = true;
        stunCooldownText.textContent = 'READY';
      }, 8000);
    }, 3000);
  };

  const updateLivesUI = () => {
    let s = '';
    for (let i = 0; i < lives; i++) s += '♥ ';
    lblLives.textContent = s.trim() || 'DEAD';
  };

  // --- OYUN DÖNGÜSÜ ---
  const gameLoop = () => {
    if (!isGameOver) {
      let moveX = 0;
      let moveY = 0;
      const curSpeed = keys['ShiftLeft'] || keys['ShiftRight'] ? player.baseSpeed * 1.55 : player.baseSpeed;

      if (keys['KeyW'] || keys['ArrowUp']) moveY -= curSpeed;
      if (keys['KeyS'] || keys['ArrowDown']) moveY += curSpeed;
      if (keys['KeyA'] || keys['ArrowLeft']) moveX -= curSpeed;
      if (keys['KeyD'] || keys['ArrowRight']) moveX += curSpeed;

      if (!isWall(player.x + moveX, player.y, player.radius)) player.x += moveX;
      if (!isWall(player.x, player.y + moveY, player.radius)) player.y += moveY;

      // Shard Toplama
      shards.forEach(s => {
        if (!s.collected && Math.hypot(player.x - s.x, player.y - s.y) < player.radius + 7) {
          s.collected = true;
          collectedCount++;
          lblShards.textContent = `${collectedCount} / ${shards.length}`;
          playSfx(750 + (collectedCount % 12) * 40, 0.08, 'triangle', 0.2);

          if (collectedCount >= shards.length) {
            isGameOver = true;
            overlay.style.display = 'flex';
            overlayTitle.textContent = 'PORTAL OPENED!';
            overlayDesc.textContent = 'Ring Piece Acquired! You survived the Murder Monkeys!';
            playSfx(980, 0.8, 'square', 0.4);
          }
        }
      });

      // Power-up
      powerUps.forEach(p => {
        if (!p.collected && Math.hypot(player.x - p.x, player.y - p.y) < player.radius + 8) {
          p.collected = true;
          player.baseSpeed = 4.3;
          playSfx(1100, 0.3, 'sine', 0.3);
          setTimeout(() => { player.baseSpeed = 2.7; }, 4000);
        }
      });

      updateMonsters();
    }

    // --- RENDER (CANVAS & GÖRÜŞ ALANI / FOG OF WAR) ---
    ctx.fillStyle = '#040207';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1. Duvarlar (Otel Koridorları)
    for (let r = 0; r < mapGrid.length; r++) {
      for (let c = 0; c < mapGrid[r].length; c++) {
        if (mapGrid[r][c] === 1) {
          ctx.fillStyle = '#1b0d26';
          ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = '#8000aa';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(c * TILE_SIZE + 1, r * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        }
      }
    }

    // 2. Soul Shard kristalleri (Çift Renk Kristal Parlaması)
    shards.forEach(s => {
      if (!s.collected) {
        ctx.fillStyle = '#df00ff';
        ctx.shadowColor = '#bf00ff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        // Elmas formunda kristal
        ctx.moveTo(s.x, s.y - 4);
        ctx.lineTo(s.x + 3.5, s.y);
        ctx.lineTo(s.x, s.y + 4);
        ctx.lineTo(s.x - 3.5, s.y);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // 3. Speed Orb Power-Up
    powerUps.forEach(p => {
      if (!p.collected) {
        ctx.fillStyle = '#00ffee';
        ctx.shadowColor = '#00ffee';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // 4. Murder Monkeys (Zil Animasyonlu & Kırmızı Gözlü)
    monsters.forEach(m => {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.angle);

      // Gövde
      ctx.fillStyle = isStunned ? '#00e5ff' : '#703816';
      ctx.beginPath();
      ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
      ctx.fill();

      // Ziller (Cymbals)
      const cymbalOffset = Math.sin(m.cymbalState) * 4;
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(6, -6 + cymbalOffset, 3, 12);

      // Parlayan Kırmızı Gözler
      ctx.fillStyle = isStunned ? '#ffffff' : '#ff0033';
      ctx.shadowColor = '#ff0033';
      ctx.shadowBlur = isStunned ? 0 : 8;
      ctx.fillRect(2, -3, 2.5, 2.5);
      ctx.fillRect(2, 1, 2.5, 2.5);
      ctx.shadowBlur = 0;

      ctx.restore();
    });

    // 5. Oyuncu (Fenerli Karakter)
    ctx.fillStyle = '#00ffaa';
    ctx.shadowColor = '#00ffaa';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 6. FOG OF WAR (Karanlık & Fener Işığı Katmanı)
    const radGrd = ctx.createRadialGradient(player.x, player.y, 25, player.x, player.y, 140);
    radGrd.addColorStop(0, 'rgba(0,0,0,0)');
    radGrd.addColorStop(0.65, 'rgba(4, 2, 7, 0.45)');
    radGrd.addColorStop(1, 'rgba(4, 2, 7, 0.96)');

    ctx.fillStyle = radGrd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    animLoopId = requestAnimationFrame(gameLoop);
  };

  const restartGame = () => {
    isGameOver = false;
    lives = 3;
    collectedCount = 0;
    player.x = 1 * TILE_SIZE + 15;
    player.y = 1 * TILE_SIZE + 15;
    monsters[0].x = 8 * TILE_SIZE + 15;
    monsters[0].y = 5 * TILE_SIZE + 15;
    monsters[1].x = 7 * TILE_SIZE + 15;
    monsters[1].y = 6 * TILE_SIZE + 15;
    overlay.style.display = 'none';
    initPickups();
    updateLivesUI();
    lblShards.textContent = `0 / ${shards.length}`;
  };

  btnRestart.addEventListener('click', restartGame);
  ddStage.querySelector('#btnStunAbility').addEventListener('click', triggerStun);
  btnToggleSize.addEventListener('click', () => {
    tabletFrame.classList.toggle('expanded');
  });

  const onKeyDown = (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    keys[e.code] = true;
    if (e.code === 'Space') {
      e.preventDefault();
      triggerStun();
    }
  };
  const onKeyUp = (e) => { keys[e.code] = false; };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  initPickups();
  updateLivesUI();
  lblShards.textContent = `0 / ${shards.length}`;
  animLoopId = requestAnimationFrame(gameLoop);

  return {
    destroy: () => {
      cancelAnimationFrame(animLoopId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      ddStage.remove();
    }
  };
}