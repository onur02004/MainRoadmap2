export function init() {
  const heroViewport = document.querySelector('.viewport-hero');
  if (!heroViewport) return;

  // 1. Skeld Oyun Sahnesini ve Task UI Katmanını Oluştur
  const stage = document.createElement('div');
  stage.id = 'amongUsStage';
  stage.className = 'au-stage';
  stage.innerHTML = `
    <!-- Görev ve Durum HUD -->
    <div class="au-hud">
      <div class="au-task-bar-container">
        <span class="au-task-label">TOTAL TASKS COMPLETED</span>
        <div class="au-task-bar">
          <div class="au-task-progress" id="auTaskProgress" style="width: 25%;"></div>
        </div>
      </div>
      <div class="au-sub-hint">USE [W, A, S, D] OR ARROW KEYS TO MOVE // WALK TO PANELS TO INTERACT</div>
    </div>

    <!-- Harita İstasyonları (Task İstasyonları & Vent) -->
    <div class="au-station electrical" id="stElectrical" style="left: 18%; top: 38%;">
      <span class="au-station-icon">⚡</span>
      <span class="au-station-name">ELECTRICAL</span>
      <button class="au-interact-btn" id="btnInteractElec">USE [E]</button>
    </div>

    <div class="au-station reactor" id="stReactor" style="left: 82%; top: 38%;">
      <span class="au-station-icon">☢</span>
      <span class="au-station-name">REACTOR</span>
      <button class="au-interact-btn" id="btnInteractReact">USE [E]</button>
    </div>

    <div class="au-vent" id="auVent" style="left: 50%; top: 70%;">
      <div class="au-vent-grate"></div>
      <span class="au-vent-label">VENT</span>
    </div>

    <!-- Crewmate Karakteri -->
    <div class="au-crewmate" id="auCrewmate" style="left: 50%; top: 40%;">
      <div class="au-shadow"></div>
      <div class="au-body">
        <div class="au-backpack"></div>
        <div class="au-visor"></div>
        <div class="au-legs">
          <span class="au-leg left"></span>
          <span class="au-leg right"></span>
        </div>
      </div>
      <span class="au-name-tag">onur</span>
    </div>

    <!-- Mini Task Modalı (Fix Wiring / Divert Power) -->
    <div class="au-task-modal" id="auTaskModal" style="display: none;">
      <div class="au-modal-box">
        <div class="au-modal-header">
          <span id="auModalTitle">ELECTRICAL: FIX WIRING</span>
          <button type="button" class="au-modal-close" id="btnAuCloseTask">&times;</button>
        </div>
        <div class="au-modal-content" id="auModalContent">
          <!-- Dinamik Task İçeriği -->
        </div>
      </div>
    </div>
  `;

  heroViewport.appendChild(stage);

  // Karakter Fizik ve Hareket Değişkenleri
  const crewmate = stage.querySelector('#auCrewmate');
  const taskProgress = stage.querySelector('#auTaskProgress');
  const modal = stage.querySelector('#auTaskModal');
  const modalTitle = stage.querySelector('#auModalTitle');
  const modalContent = stage.querySelector('#auModalContent');
  const btnCloseTask = stage.querySelector('#btnAuCloseTask');

  let posX = stage.clientWidth * 0.5;
  let posY = stage.clientHeight * 0.45;
  const speed = 4.8;
  const keys = { KeyW: false, KeyA: false, KeyS: false, KeyD: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false };
  let facingLeft = false;
  let isTaskOpen = false;
  let animFrameId = null;

  let electricalDone = false;
  let reactorDone = false;

  // Klavye Dinleyicileri
  const handleKeyDown = (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (keys.hasOwnProperty(e.code)) {
      keys[e.code] = true;
      e.preventDefault();
    }
    if ((e.code === 'KeyE' || e.code === 'Space') && !isTaskOpen) {
      checkProximityInteraction();
    }
    if (e.code === 'Escape' && isTaskOpen) {
      closeTask();
    }
  };

  const handleKeyUp = (e) => {
    if (keys.hasOwnProperty(e.code)) {
      keys[e.code] = false;
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  btnCloseTask.addEventListener('click', closeTask);

  // Hareket ve Harita Döngüsü
  const updateLoop = () => {
    if (!isTaskOpen) {
      let moved = false;
      let dx = 0;
      let dy = 0;

      if (keys.KeyW || keys.ArrowUp) { dy -= speed; moved = true; }
      if (keys.KeyS || keys.ArrowDown) { dy += speed; moved = true; }
      if (keys.KeyA || keys.ArrowLeft) { dx -= speed; facingLeft = true; moved = true; }
      if (keys.KeyD || keys.ArrowRight) { dx += speed; facingLeft = false; moved = true; }

      // Sahne sınırları (Viewport Boundary Clamp)
      const stageW = stage.clientWidth;
      const stageH = stage.clientHeight;
      posX = Math.max(40, Math.min(stageW - 60, posX + dx));
      posY = Math.max(60, Math.min(stageH - 80, posY + dy));

      // Konum ve Yön Çevrimi (Flip)
      crewmate.style.left = `${posX}px`;
      crewmate.style.top = `${posY}px`;
      crewmate.style.transform = `translate(-50%, -50%) scaleX(${facingLeft ? -1 : 1})`;

      // Yürüme Animasyonu
      if (moved) {
        crewmate.classList.add('walking');
      } else {
        crewmate.classList.remove('walking');
      }

      // İstasyon Yakınlık Kontrolü
      updateStationProximity();
    }

    animFrameId = requestAnimationFrame(updateLoop);
  };

  function updateStationProximity() {
    const stElec = stage.querySelector('#stElectrical');
    const stReact = stage.querySelector('#stReactor');

    const distElec = Math.hypot(posX - (stElec.offsetLeft + 30), posY - (stElec.offsetTop + 30));
    const distReact = Math.hypot(posX - (stReact.offsetLeft + 30), posY - (stReact.offsetTop + 30));

    stElec.classList.toggle('near', distElec < 80 && !electricalDone);
    stReact.classList.toggle('near', distReact < 80 && !reactorDone);
  }

  function checkProximityInteraction() {
    const stElec = stage.querySelector('#stElectrical');
    const stReact = stage.querySelector('#stReactor');

    const distElec = Math.hypot(posX - (stElec.offsetLeft + 30), posY - (stElec.offsetTop + 30));
    const distReact = Math.hypot(posX - (stReact.offsetLeft + 30), posY - (stReact.offsetTop + 30));

    if (distElec < 80 && !electricalDone) {
      openWiringTask();
    } else if (distReact < 80 && !reactorDone) {
      openDivertPowerTask();
    }
  }

  // Task 1: Fix Wiring (Kabloları Eşleştir)
  function openWiringTask() {
    isTaskOpen = true;
    modal.style.display = 'flex';
    modalTitle.textContent = 'ELECTRICAL: FIX WIRING';
    
    modalContent.innerHTML = `
      <div class="au-wiring-game">
        <p class="au-task-desc">Click each wire circuit on the left to repair the power feed:</p>
        <div class="au-wire-row"><button class="au-wire-btn red" id="w1">🔴 RED WIRE [OFFLINE]</button></div>
        <div class="au-wire-row"><button class="au-wire-btn blue" id="w2">🔵 BLUE WIRE [OFFLINE]</button></div>
        <div class="au-wire-row"><button class="au-wire-btn yellow" id="w3">🟡 YELLOW WIRE [OFFLINE]</button></div>
      </div>
    `;

    let fixedCount = 0;
    ['w1', 'w2', 'w3'].forEach(id => {
      const btn = modalContent.querySelector(`#${id}`);
      btn.addEventListener('click', () => {
        if (!btn.classList.contains('fixed')) {
          btn.classList.add('fixed');
          btn.textContent = btn.textContent.replace('OFFLINE', 'CONNECTED ✔');
          fixedCount++;
          if (fixedCount === 3) {
            setTimeout(() => {
              electricalDone = true;
              updateTotalProgress();
              closeTask();
            }, 500);
          }
        }
      });
    });
  }

  // Task 2: Divert Power (Gücü Aktar)
  function openDivertPowerTask() {
    isTaskOpen = true;
    modal.style.display = 'flex';
    modalTitle.textContent = 'REACTOR: DIVERT POWER';

    modalContent.innerHTML = `
      <div class="au-divert-game">
        <p class="au-task-desc">Hold the emergency slider up to calibrate reactor core:</p>
        <div class="au-slider-box">
          <button class="au-slider-switch" id="btnSliderSwitch">▲ SLIDE TO ENGAGE ▲</button>
        </div>
      </div>
    `;

    const btnSlider = modalContent.querySelector('#btnSliderSwitch');
    btnSlider.addEventListener('click', () => {
      btnSlider.classList.add('engaged');
      btnSlider.textContent = 'POWER 100% ONLINE ✔';
      setTimeout(() => {
        reactorDone = true;
        updateTotalProgress();
        closeTask();
      }, 600);
    });
  }

  function updateTotalProgress() {
    let completed = 0;
    if (electricalDone) completed++;
    if (reactorDone) completed++;

    const percent = 25 + (completed * 37.5);
    taskProgress.style.width = `${percent}%`;

    if (completed === 2) {
      const hint = stage.querySelector('.au-sub-hint');
      if (hint) hint.textContent = 'ALL TASKS COMPLETED! THE SKELD IS SAFE ✔';
      hint.style.color = '#50ef39';
    }
  }

  function closeTask() {
    isTaskOpen = false;
    modal.style.display = 'none';
    modalContent.innerHTML = '';
  }

  animFrameId = requestAnimationFrame(updateLoop);

  return {
    destroy: () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      stage.remove();
    }
  };
}