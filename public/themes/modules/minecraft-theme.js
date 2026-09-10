export function init() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playSound(type) {
    initAudio();
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'hit') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(130, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(35, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
      } else if (type === 'break') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(25, audioCtx.currentTime + 0.22);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.22);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.22);
      } else if (type === 'levelup') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      } else if (type === 'pop') {
        // İtem toplama 'pop' sesi
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(950, audioCtx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.06);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.06);
      } else if (type === 'place') {
        // Blok yerleştirme tok sesi
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(90, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      } else if (type === 'toolbreak') {
        // Kazma kırılma sesi
        osc.type = 'square';
        osc.frequency.setValueAtTime(320, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      }
    } catch (e) {}
  }

  // Alet Tanımları ve Maksimum Dayanıklılık (Durability)
  const TOOLS = [
    { name: 'Wooden Axe', multiplier: 1.0, icon: '🪓', maxDurability: 60 },
    { name: 'Wooden Pickaxe', multiplier: 1.8, icon: '⛏', maxDurability: 60 },
    { name: 'Stone Pickaxe', multiplier: 2.8, icon: '⛏', maxDurability: 132 },
    { name: 'Iron Pickaxe', multiplier: 4.5, icon: '⛏', maxDurability: 250 },
    { name: 'Diamond Pickaxe', multiplier: 8.0, icon: '💎⛏', maxDurability: 1561 }
  ];

  const BLOCK_TYPES = [
    { type: 'oak', name: 'Oak Wood', drop: 'wood', baseMineTime: 850, exp: 6, img: 'themes/modules/oak.png' },
    { type: 'stone', name: 'Stone', drop: 'stone', baseMineTime: 1200, exp: 12, img: 'themes/modules/stone.png' },
    { type: 'coal', name: 'Coal Ore', drop: 'coal', baseMineTime: 1500, exp: 18, img: 'themes/modules/coal.png' },
    { type: 'iron', name: 'Iron Ore', drop: 'iron', baseMineTime: 2200, exp: 30, img: 'themes/modules/iron.png' },
    { type: 'diamond', name: 'Diamond Ore', drop: 'diamond', baseMineTime: 3200, exp: 80, img: 'themes/modules/diamond.png' }
  ];

  const inventory = {
    wood: 4,
    stone: 0,
    coal: 0,
    iron: 0,
    diamond: 0,
    stick: 4,
    pickaxeLevel: 0,
    currentDurability: TOOLS[0].maxDurability,
    exp: 0,
    level: 1,
    selectedSlot: 0
  };

  // 1. 3D Steve Voxel Modeli
  let steveEl = document.getElementById('mc3DSteve');
  if (!steveEl) {
    steveEl = document.createElement('div');
    steveEl.id = 'mc3DSteve';
    steveEl.className = 'mc-steve-3d-scene idle-camp';
    steveEl.innerHTML = `
      <div class="steve-rig-3d">
        <div class="cube steve-head-cube">
          <div class="face front face-skin">
            <div class="steve-hair-fringe"></div>
            <div class="steve-eyes-row">
              <span class="steve-eye left"></span>
              <span class="steve-eye right"></span>
            </div>
            <div class="steve-nose"></div>
            <div class="steve-beard-mouth"></div>
          </div>
          <div class="face back face-hair"></div>
          <div class="face top face-hair"></div>
          <div class="face bottom face-skin"></div>
          <div class="face left face-hair-side"></div>
          <div class="face right face-hair-side"></div>
        </div>

        <div class="cube steve-torso-cube">
          <div class="face front face-shirt">
            <div class="steve-neck-v"></div>
          </div>
          <div class="face back face-shirt"></div>
          <div class="face top face-shirt"></div>
          <div class="face bottom face-pants"></div>
          <div class="face left face-shirt"></div>
          <div class="face right face-shirt"></div>
        </div>

        <div class="steve-arm-anchor arm-l">
          <div class="cube steve-arm-cube">
            <div class="face front face-arm"></div>
            <div class="face back face-arm"></div>
            <div class="face top face-shirt"></div>
            <div class="face bottom face-skin"></div>
            <div class="face left face-arm"></div>
            <div class="face right face-arm"></div>
          </div>
        </div>

        <div class="steve-arm-anchor arm-r">
          <div class="cube steve-arm-cube">
            <div class="face front face-arm"></div>
            <div class="face back face-arm"></div>
            <div class="face top face-shirt"></div>
            <div class="face bottom face-skin"></div>
            <div class="face left face-arm"></div>
            <div class="face right face-arm"></div>
          </div>
          <div class="steve-held-pickaxe" id="steveHeldPick">🪓</div>
        </div>

        <div class="steve-leg-anchor leg-l">
          <div class="cube steve-leg-cube">
            <div class="face front face-pants"><div class="steve-boot-cuff"></div></div>
            <div class="face back face-pants"><div class="steve-boot-cuff"></div></div>
            <div class="face top face-pants"></div>
            <div class="face bottom face-shoes"></div>
            <div class="face left face-pants"><div class="steve-boot-cuff"></div></div>
            <div class="face right face-pants"><div class="steve-boot-cuff"></div></div>
          </div>
        </div>

        <div class="steve-leg-anchor leg-r">
          <div class="cube steve-leg-cube">
            <div class="face front face-pants"><div class="steve-boot-cuff"></div></div>
            <div class="face back face-pants"><div class="steve-boot-cuff"></div></div>
            <div class="face top face-pants"></div>
            <div class="face bottom face-shoes"></div>
            <div class="face left face-pants"><div class="steve-boot-cuff"></div></div>
            <div class="face right face-pants"><div class="steve-boot-cuff"></div></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(steveEl);
  }

  let activeMining = null;
  let steveWalkTimeout = null;

  // 2. Blok Etkileşimleri (Sol Tık: Kaz / Sağ Tık: Blok Yerleştir)
  function attachMinecraftToGrid() {
    const gridLayer = document.getElementById('bgGridLayer');
    const cornerGrid = document.getElementById('cornerGrid');

    if (gridLayer) gridLayer.style.pointerEvents = 'auto';
    if (cornerGrid) cornerGrid.style.pointerEvents = 'auto';

    const cells = document.querySelectorAll('.corner-unit.solid-box, .corner-unit.wireframe');
    cells.forEach((cell) => {
      if (cell.dataset.mcBound === 'true') return;
      cell.dataset.mcBound = 'true';

      const rand = Math.random();
      let blockInfo;
      if (rand < 0.28) blockInfo = BLOCK_TYPES[0];
      else if (rand < 0.58) blockInfo = BLOCK_TYPES[1];
      else if (rand < 0.76) blockInfo = BLOCK_TYPES[2];
      else if (rand < 0.90) blockInfo = BLOCK_TYPES[3];
      else blockInfo = BLOCK_TYPES[4];

      setupCellAsBlock(cell, blockInfo);

      // Sol Tık: Kazma (Hold-to-mine)
      cell.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || cell.classList.contains('mc-broken-state')) return;
        e.preventDefault();
        e.stopPropagation();

        if (activeMining) stopMining();

        const currentBlockType = cell.dataset.blockType;
        const info = BLOCK_TYPES.find(b => b.type === currentBlockType) || BLOCK_TYPES[0];

        const rect = cell.getBoundingClientRect();
        walkSteveToBlock(rect.left - 80, rect.top + 10);

        cell.classList.add('mc-mining-active');
        playSound('hit');

        const activeSpeed = TOOLS[inventory.pickaxeLevel].multiplier;
        const totalDuration = info.baseMineTime / activeSpeed;
        const startTime = Date.now();
        let lastSound = Date.now();
        const crackLayer = cell.querySelector('.mc-crack-layer');

        const interval = setInterval(() => {
          const now = Date.now();
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / totalDuration);

          if (now - lastSound > 150) {
            playSound('hit');
            lastSound = now;
            document.body.classList.add('mc-screen-shake');
            setTimeout(() => document.body.classList.remove('mc-screen-shake'), 50);
          }

          if (crackLayer) {
            crackLayer.style.opacity = `${progress * 0.95}`;
            const stage = Math.min(9, Math.floor(progress * 10));
            crackLayer.setAttribute('data-stage', stage);
          }

          if (progress >= 1) {
            stopMining();
            playSound('break');

            // Dayanıklılık (Durability) Azaltma
            reduceToolDurability();

            gainExp(info.exp);
            spawnBreakParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, info.type);
            
            // 3D Dönen İtem Entity'si Yere Düşer ve Steve Tarafından Toplanır
            spawnDropItemEntity(rect.left + rect.width / 2, rect.top + rect.height / 2, info);

            cell.classList.add('mc-broken-state');
            cell.dataset.isBroken = 'true';

            // Blok yeniden belirme (respawn)
            setTimeout(() => {
              if (cell.dataset.isBroken === 'true') {
                if (crackLayer) {
                  crackLayer.style.opacity = '0';
                  crackLayer.removeAttribute('data-stage');
                }
                cell.classList.remove('mc-broken-state');
                delete cell.dataset.isBroken;
              }
            }, 8000);
          }
        }, 25);

        activeMining = { cell, crackLayer, interval };
      });

      // Sağ Tık: Envanterden Seçili Bloğu Yerleştirme
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!cell.classList.contains('mc-broken-state')) return;

        // Slot 1: Wood (Slot index 1), Slot 2: Stone (Slot index 2)
        let placeType = null;
        if (inventory.selectedSlot === 1 && inventory.wood > 0) {
          inventory.wood -= 1;
          placeType = BLOCK_TYPES[0]; // Oak
        } else if (inventory.selectedSlot === 2 && inventory.stone > 0) {
          inventory.stone -= 1;
          placeType = BLOCK_TYPES[1]; // Stone
        } else if (inventory.wood > 0) {
          // Varsayılan olarak eldeki tahtayı yerleştirir
          inventory.wood -= 1;
          placeType = BLOCK_TYPES[0];
        } else if (inventory.stone > 0) {
          inventory.stone -= 1;
          placeType = BLOCK_TYPES[1];
        }

        if (placeType) {
          playSound('place');
          setupCellAsBlock(cell, placeType);
          cell.classList.remove('mc-broken-state');
          delete cell.dataset.isBroken;
          delete cell.dataset.respawnTimer;

          const rect = cell.getBoundingClientRect();
          showFloatingDrop(rect.left + rect.width / 2, rect.top, `Placed ${placeType.name.split(' ')[0]}`);
          updateHotbar();
        }
      });
    });
  }

  function setupCellAsBlock(cell, blockInfo) {
    cell.dataset.blockType = blockInfo.type;
    cell.className = `corner-unit solid-box mc-voxel-block mc-${blockInfo.type}`;
    cell.style.pointerEvents = 'auto';
    cell.style.cursor = 'grab';

    cell.innerHTML = `
      <div class="mc-item-icon-wrapper">
        <img src="${blockInfo.img}" alt="${blockInfo.name}" class="mc-block-item-icon" />
      </div>
      <div class="mc-crack-layer"></div>
      <span class="mc-block-label">${blockInfo.name.split(' ')[0]}</span>
    `;
  }

  function reduceToolDurability() {
    inventory.currentDurability -= 1;
    if (inventory.currentDurability <= 0) {
      playSound('toolbreak');
      showFloatingDrop(window.innerWidth / 2, window.innerHeight / 2, '💥 TOOL BROKE!');
      inventory.pickaxeLevel = 0; // Başa dön
      inventory.currentDurability = TOOLS[0].maxDurability;
    }
    updateHotbar();
  }

  function stopMining() {
    if (!activeMining) return;
    clearInterval(activeMining.interval);
    activeMining.cell.classList.remove('mc-mining-active');

    if (!activeMining.cell.classList.contains('mc-broken-state') && activeMining.crackLayer) {
      activeMining.crackLayer.style.opacity = '0';
      activeMining.crackLayer.removeAttribute('data-stage');
    }

    activeMining = null;
    returnSteveToCamp();
  }

  window.addEventListener('mouseup', stopMining);

  // Observer
  const cornerGrid = document.getElementById('cornerGrid');
  let observer = null;
  if (cornerGrid) {
    observer = new MutationObserver(() => attachMinecraftToGrid());
    observer.observe(cornerGrid, { childList: true });
  }
  attachMinecraftToGrid();

  // Steve Yürüme & Zıplama Kontrolü
  function walkSteveToBlock(x, y) {
    clearTimeout(steveWalkTimeout);
    steveEl.classList.remove('idle-camp', 'mining-mode');
    steveEl.classList.add('walking-mode');

    steveEl.style.left = `${Math.max(20, x)}px`;
    steveEl.style.top = `${Math.max(20, y)}px`;

    steveWalkTimeout = setTimeout(() => {
      if (activeMining) {
        steveEl.classList.remove('walking-mode');
        steveEl.classList.add('mining-mode');
      }
    }, 450);
  }

  function returnSteveToCamp() {
    clearTimeout(steveWalkTimeout);
    steveEl.classList.remove('mining-mode');
    steveEl.classList.add('walking-mode');

    steveEl.style.left = '';
    steveEl.style.top = '';

    steveWalkTimeout = setTimeout(() => {
      steveEl.classList.remove('walking-mode');
      steveEl.classList.add('idle-camp');
    }, 600);
  }

  // Yere Düşen Dönen 3D İtem Entity'si (Spinning 3D Drop + Pop Sesi)
  function spawnDropItemEntity(x, y, blockInfo) {
    const itemEntity = document.createElement('div');
    itemEntity.className = 'mc-3d-dropped-item';
    itemEntity.style.left = `${x}px`;
    itemEntity.style.top = `${y}px`;
    itemEntity.innerHTML = `
      <img src="${blockInfo.img}" alt="${blockInfo.name}" class="mc-spin-img" />
    `;
    document.body.appendChild(itemEntity);

    // 400ms havada süzülüp Steve'e doğru uçar ve toplanır
    setTimeout(() => {
      itemEntity.classList.add('collecting');
      const steveRect = steveEl.getBoundingClientRect();
      itemEntity.style.left = `${steveRect.left + 30}px`;
      itemEntity.style.top = `${steveRect.top + 40}px`;
      itemEntity.style.transform = 'scale(0.2) rotate(360deg)';
      itemEntity.style.opacity = '0';

      setTimeout(() => {
        playSound('pop');
        inventory[blockInfo.drop] += 1;
        showFloatingDrop(steveRect.left + 30, steveRect.top, `+1 ${blockInfo.name.split(' ')[0]}`);
        updateHotbar();
        itemEntity.remove();
      }, 350);
    }, 500);
  }

  function spawnBreakParticles(x, y, blockType) {
    const colors = {
      oak: ['#85542b', '#5c3a1e', '#a36835'],
      stone: ['#686868', '#8a8a8a', '#4a4a4a'],
      coal: ['#222222', '#111111', '#444444'],
      iron: ['#d8af93', '#8e8e8e', '#e5cbb8'],
      diamond: ['#4dedf4', '#2dbbc2', '#a8f9fc']
    }[blockType] || ['#777', '#999', '#555'];

    for (let i = 0; i < 16; i++) {
      const p = document.createElement('div');
      p.className = 'mc-pixel-particle';
      p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;

      const destX = (Math.random() - 0.5) * 160;
      const destY = (Math.random() - 0.8) * 160;
      p.style.setProperty('--dx', `${destX}px`);
      p.style.setProperty('--dy', `${destY}px`);

      document.body.appendChild(p);
      setTimeout(() => p.remove(), 550);
    }
  }

  function gainExp(amount) {
    inventory.exp += amount;
    const reqExp = inventory.level * 40;
    if (inventory.exp >= reqExp) {
      inventory.exp -= reqExp;
      inventory.level += 1;
      playSound('levelup');
      showFloatingDrop(window.innerWidth / 2, 90, `⭐ LEVEL UP! (LVL ${inventory.level})`);
    }
    updateHotbar();
  }

  // 3. UI Katmanı & Hotbar
  let mcRootUI = document.getElementById('mcGamingOverlay');
  if (mcRootUI) mcRootUI.remove();

  mcRootUI = document.createElement('div');
  mcRootUI.id = 'mcGamingOverlay';
  mcRootUI.className = 'mc-overlay-layer';
  mcRootUI.innerHTML = `
    <button type="button" class="mc-crafting-btn" id="btnOpenCrafting">
      <span class="mc-craft-icon">⚒</span>
      <span>CRAFTING (E)</span>
    </button>

    <div class="mc-bottom-hud">
      <div class="mc-status-bars-row">
        <div class="mc-hearts-row">${'<span>❤️</span>'.repeat(10)}</div>
        <div class="mc-hunger-row">${'<span>🍗</span>'.repeat(10)}</div>
      </div>

      <div class="mc-exp-bar-container">
        <div class="mc-exp-bar-fill" id="hudExpFill" style="width: 0%;"></div>
        <span class="mc-exp-level-text" id="hudLvl">1</span>
      </div>

      <div class="mc-inventory-hotbar" id="mcHotbarContainer">
        <div class="mc-hotbar-slot active" data-slot="0" title="Slot 1 (Tool)">
          <span class="mc-item-emoji" id="hudToolEmoji">🪓</span>
          <span class="mc-slot-badge" id="hudToolName">Axe</span>
          <!-- Alet Dayanıklılık Barı (Durability Bar) -->
          <div class="mc-durability-bar"><div class="mc-durability-fill" id="hudDurabilityFill"></div></div>
        </div>
        <div class="mc-hotbar-slot" data-slot="1" title="Slot 2: Wood (Right click to place)">
          <img src="themes/modules/oak.png" class="mc-hotbar-img" alt="Wood" />
          <span class="mc-slot-badge" id="hudWood">0</span>
        </div>
        <div class="mc-hotbar-slot" data-slot="2" title="Slot 3: Stone (Right click to place)">
          <img src="themes/modules/stone.png" class="mc-hotbar-img" alt="Stone" />
          <span class="mc-slot-badge" id="hudStone">0</span>
        </div>
        <div class="mc-hotbar-slot" data-slot="3" title="Slot 4: Coal">
          <img src="themes/modules/coal.png" class="mc-hotbar-img" alt="Coal" />
          <span class="mc-slot-badge" id="hudCoal">0</span>
        </div>
        <div class="mc-hotbar-slot" data-slot="4" title="Slot 5: Iron">
          <img src="themes/modules/iron.png" class="mc-hotbar-img" alt="Iron" />
          <span class="mc-slot-badge" id="hudIron">0</span>
        </div>
        <div class="mc-hotbar-slot" data-slot="5" title="Slot 6: Diamond">
          <img src="themes/modules/diamond.png" class="mc-hotbar-img" alt="Diamond" />
          <span class="mc-slot-badge" id="hudDiamond">0</span>
        </div>
        <div class="mc-hotbar-slot" data-slot="6" title="Slot 7: Sticks">
          <span class="mc-item-emoji">🥢</span>
          <span class="mc-slot-badge" id="hudStick">0</span>
        </div>
        <div class="mc-hotbar-slot" data-slot="7" title="Slot 8"></div>
        <div class="mc-hotbar-slot" data-slot="8" title="Slot 9"></div>
      </div>
    </div>

    <div class="mc-craft-popup" id="mcCraftModal" style="display: none;">
      <div class="mc-craft-window">
        <div class="mc-craft-header">
          <span>CRAFTING TABLE</span>
          <button class="mc-modal-x" id="btnCloseCraft">&times;</button>
        </div>

        <div class="mc-recipe-list">
          <button type="button" class="mc-recipe-action" id="craftPlanks">🪵 1x Wood ➔ 4x Sticks</button>
          <button type="button" class="mc-recipe-action" id="craftWoodPick">🪵 3x Wood + 2x Sticks ➔ Wooden Pickaxe (1.8x Hız)</button>
          <button type="button" class="mc-recipe-action" id="craftStonePick">🪨 3x Stone + 2x Sticks ➔ Stone Pickaxe (2.8x Hız)</button>
          <button type="button" class="mc-recipe-action" id="craftIronPick">🪙 3x Iron + 2x Sticks ➔ Iron Pickaxe (4.5x Hız)</button>
          <button type="button" class="mc-recipe-action" id="craftDiaPick">💎 3x Diamond + 2x Sticks ➔ Diamond Pickaxe (8.0x Hız)</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(mcRootUI);

  const keyHandler = (e) => {
    if (e.key.toLowerCase() === 'e' && document.activeElement.tagName !== 'INPUT') {
      const modal = document.getElementById('mcCraftModal');
      if (modal) modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
    }
    const num = parseInt(e.key, 10);
    if (!isNaN(num) && num >= 1 && num <= 9) {
      inventory.selectedSlot = num - 1;
      const slots = document.querySelectorAll('.mc-hotbar-slot');
      slots.forEach((s, idx) => s.classList.toggle('active', idx === inventory.selectedSlot));
    }
  };
  window.addEventListener('keydown', keyHandler);

  // Crafting Butonları
  const craftModal = mcRootUI.querySelector('#mcCraftModal');
  mcRootUI.querySelector('#btnOpenCrafting').addEventListener('click', () => {
    craftModal.style.display = craftModal.style.display === 'none' ? 'flex' : 'none';
  });
  mcRootUI.querySelector('#btnCloseCraft').addEventListener('click', () => {
    craftModal.style.display = 'none';
  });

  mcRootUI.querySelector('#craftPlanks').addEventListener('click', () => {
    if (inventory.wood >= 1) {
      inventory.wood -= 1;
      inventory.stick += 4;
      playSound('break');
      showFloatingDrop(window.innerWidth / 2, window.innerHeight / 2, '+4x Sticks!');
      updateHotbar();
    }
  });

  mcRootUI.querySelector('#craftWoodPick').addEventListener('click', () => {
    if (inventory.wood >= 3 && inventory.stick >= 2) {
      inventory.wood -= 3;
      inventory.stick -= 2;
      inventory.pickaxeLevel = Math.max(inventory.pickaxeLevel, 1);
      inventory.currentDurability = TOOLS[1].maxDurability;
      playSound('levelup');
      showFloatingDrop(window.innerWidth / 2, window.innerHeight / 2, '🪵 WOODEN PICKAXE CRAFTED!');
      updateHotbar();
    }
  });

  mcRootUI.querySelector('#craftStonePick').addEventListener('click', () => {
    if (inventory.stone >= 3 && inventory.stick >= 2) {
      inventory.stone -= 3;
      inventory.stick -= 2;
      inventory.pickaxeLevel = Math.max(inventory.pickaxeLevel, 2);
      inventory.currentDurability = TOOLS[2].maxDurability;
      playSound('levelup');
      showFloatingDrop(window.innerWidth / 2, window.innerHeight / 2, '🪨 STONE PICKAXE CRAFTED!');
      updateHotbar();
    }
  });

  mcRootUI.querySelector('#craftIronPick').addEventListener('click', () => {
    if (inventory.iron >= 3 && inventory.stick >= 2) {
      inventory.iron -= 3;
      inventory.stick -= 2;
      inventory.pickaxeLevel = Math.max(inventory.pickaxeLevel, 3);
      inventory.currentDurability = TOOLS[3].maxDurability;
      playSound('levelup');
      showFloatingDrop(window.innerWidth / 2, window.innerHeight / 2, '🪙 IRON PICKAXE CRAFTED!');
      updateHotbar();
    }
  });

  mcRootUI.querySelector('#craftDiaPick').addEventListener('click', () => {
    if (inventory.diamond >= 3 && inventory.stick >= 2) {
      inventory.diamond -= 3;
      inventory.stick -= 2;
      inventory.pickaxeLevel = 4;
      inventory.currentDurability = TOOLS[4].maxDurability;
      playSound('levelup');
      showFloatingDrop(window.innerWidth / 2, window.innerHeight / 2, '💎 DIAMOND PICKAXE CRAFTED!');
      updateHotbar();
    }
  });

  function updateHotbar() {
    mcRootUI.querySelector('#hudWood').textContent = inventory.wood;
    mcRootUI.querySelector('#hudStone').textContent = inventory.stone;
    mcRootUI.querySelector('#hudCoal').textContent = inventory.coal;
    mcRootUI.querySelector('#hudIron').textContent = inventory.iron;
    mcRootUI.querySelector('#hudDiamond').textContent = inventory.diamond;
    mcRootUI.querySelector('#hudStick').textContent = inventory.stick;

    const currentTool = TOOLS[inventory.pickaxeLevel];
    mcRootUI.querySelector('#hudToolEmoji').textContent = currentTool.icon;
    mcRootUI.querySelector('#hudToolName').textContent = currentTool.name.split(' ')[0];

    // Dayanıklılık Çubuğunun Renk ve Genişlik Hesabı (Yeşil -> Sarı -> Kırmızı)
    const durRatio = Math.max(0, Math.min(1, inventory.currentDurability / currentTool.maxDurability));
    const durBarFill = document.getElementById('hudDurabilityFill');
    if (durBarFill) {
      durBarFill.style.width = `${durRatio * 100}%`;
      if (durRatio > 0.5) durBarFill.style.backgroundColor = '#55ff55';
      else if (durRatio > 0.2) durBarFill.style.backgroundColor = '#ffff55';
      else durBarFill.style.backgroundColor = '#ff5555';
    }

    const held = document.getElementById('steveHeldPick');
    if (held) held.textContent = currentTool.icon;

    const reqExp = inventory.level * 40;
    const pct = Math.min(100, Math.floor((inventory.exp / reqExp) * 100));
    mcRootUI.querySelector('#hudLvl').textContent = inventory.level;
    mcRootUI.querySelector('#hudExpFill').style.width = `${pct}%`;
  }

  function showFloatingDrop(x, y, text) {
    const floatEl = document.createElement('div');
    floatEl.className = 'mc-float-text';
    floatEl.style.left = `${x}px`;
    floatEl.style.top = `${y}px`;
    floatEl.textContent = text;
    document.body.appendChild(floatEl);
    setTimeout(() => floatEl.remove(), 1000);
  }

  updateHotbar();

  return {
    destroy: () => {
      window.removeEventListener('keydown', keyHandler);
      window.removeEventListener('mouseup', stopMining);
      if (observer) observer.disconnect();
      if (steveEl) steveEl.remove();
      if (mcRootUI) mcRootUI.remove();
    }
  };
} 