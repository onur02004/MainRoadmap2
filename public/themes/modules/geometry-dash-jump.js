export function init() {
  const heroViewport = document.querySelector('.viewport-hero');
  if (!heroViewport) return;

  // 1. Oyun Sahnesini (Track & Stage) Oluştur
  const stage = document.createElement('div');
  stage.id = 'gdRunnerStage';
  stage.className = 'gd-stage';
  stage.innerHTML = `
    <div class="gd-ground-line"></div>
    <div class="gd-player" id="gdPlayer">
      <div class="gd-face">
        <span class="gd-eye left"></span>
        <span class="gd-eye right"></span>
        <span class="gd-mouth"></span>
      </div>
    </div>
    <div class="gd-hud">
      <span id="gdScore">ATTEMPT 1 // DIST: 0m</span>
      <span class="gd-hint">[SPACE / CLICK] JUMP</span>
    </div>
    <div class="gd-game-over" id="gdGameOver">
      <span>CRASHED!</span>
      <small>[CLICK OR PRESS SPACE TO RETRY]</small>
    </div>
  `;

  heroViewport.appendChild(stage);

  const player = stage.querySelector('#gdPlayer');
  const scoreDisplay = stage.querySelector('#gdScore');
  const gameOverScreen = stage.querySelector('#gdGameOver');

  // Oyun Durum Değişkenleri
  let isJumping = false;
  let isGameOver = false;
  let attemptCount = 1;
  let distance = 0;
  let animationFrameId = null;
  let obstacles = [];
  let nextObstacleTime = 0;

  // Zıplama Mantığı
  const jump = (e) => {
    if (e && e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      return;
    }
    if (e && (e.code === 'Space' || e.code === 'ArrowUp')) {
      e.preventDefault();
    }

    if (isGameOver) {
      restartGame();
      return;
    }

    if (isJumping) return;
    isJumping = true;
    player.classList.add('jumping');

    setTimeout(() => {
      player.classList.remove('jumping');
      isJumping = false;
    }, 500);
  };

  const spawnObstacle = () => {
    const obstacle = document.createElement('div');
    obstacle.className = 'gd-spike';
    stage.appendChild(obstacle);

    obstacles.push({
      el: obstacle,
      x: stage.clientWidth + 20,
      width: 24,
      height: 28
    });
  };

  const restartGame = () => {
    isGameOver = false;
    isJumping = false;
    distance = 0;
    attemptCount++;
    gameOverScreen.style.display = 'none';
    player.classList.remove('dead', 'jumping');

    // Var olan tüm engelleri temizle
    obstacles.forEach(obs => obs.el.remove());
    obstacles = [];
    nextObstacleTime = Date.now() + 1200;
  };

  // Ana Oyun Döngüsü
  const gameLoop = () => {
    if (!isGameOver) {
      distance += 1;
      scoreDisplay.textContent = `ATTEMPT ${attemptCount} // DIST: ${Math.floor(distance / 5)}m`;

      const now = Date.now();
      if (now > nextObstacleTime) {
        spawnObstacle();
        nextObstacleTime = now + Math.floor(1300 + Math.random() * 1200);
      }

      // Oyuncunun çarpışma kutusu (Hitbox)
      const playerRect = player.getBoundingClientRect();
      const pBox = {
        left: playerRect.left + 6,
        right: playerRect.right - 6,
        top: playerRect.top + 6,
        bottom: playerRect.bottom - 4
      };

      // Engelleri sola doğru kaydır ve çarpışma kontrolü yap
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.x -= 6.5; // Engel kayma hızı
        obs.el.style.transform = `translateX(${obs.x}px)`;

        const obsRect = obs.el.getBoundingClientRect();
        const oBox = {
          left: obsRect.left + 4,
          right: obsRect.right - 4,
          top: obsRect.top + 4,
          bottom: obsRect.bottom
        };

        // AABB Çarpışma Kontrolü
        const isColliding = !(
          pBox.right < oBox.left ||
          pBox.left > oBox.right ||
          pBox.bottom < oBox.top ||
          pBox.top > oBox.bottom
        );

        if (isColliding) {
          isGameOver = true;
          player.classList.add('dead');
          gameOverScreen.style.display = 'flex';
          break;
        }

        // Ekrandan çıkan engelleri sil
        if (obs.x < -60) {
          obs.el.remove();
          obstacles.splice(i, 1);
        }
      }
    }

    animationFrameId = requestAnimationFrame(gameLoop);
  };

  const keyHandler = (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      jump(e);
    }
  };

  window.addEventListener('keydown', keyHandler);
  stage.addEventListener('click', jump);

  nextObstacleTime = Date.now() + 1000;
  animationFrameId = requestAnimationFrame(gameLoop);

  return {
    destroy: () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', keyHandler);
      stage.removeEventListener('click', jump);
      stage.remove();
    }
  };
}