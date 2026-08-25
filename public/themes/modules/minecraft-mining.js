export function init() {
  const inventory = {
    wood: 2,
    stone: 0,
    iron: 0,
    coal: 0,
    diamond: 0,
    stick: 0,
    pickaxe: 0
  };

  // Maden blokları ve kırılma süreleri (ms)
  const BLOCK_TYPES = [
    { type: 'oak', name: 'Oak Wood', drop: 'wood', mineTime: 800 },
    { type: 'stone', name: 'Stone', drop: 'stone', mineTime: 1200 },
    { type: 'coal', name: 'Coal Ore', drop: 'coal', mineTime: 1400 },
    { type: 'iron', name: 'Iron Ore', drop: 'iron', mineTime: 1800 },
    { type: 'diamond', name: 'Diamond Ore', drop: 'diamond', mineTime: 2400 }
  ];

  const gridCells = document.querySelectorAll('.corner-unit.solid-box, .corner-unit.wireframe');
  const cleanups = [];

  gridCells.forEach((cell) => {
    const rand = Math.random();
    let blockInfo;
    if (rand < 0.28) blockInfo = BLOCK_TYPES[0];      // Oak
    else if (rand < 0.62) blockInfo = BLOCK_TYPES[1]; // Stone
    else if (rand < 0.80) blockInfo = BLOCK_TYPES[2]; // Coal
    else if (rand < 0.93) blockInfo = BLOCK_TYPES[3]; // Iron
    else blockInfo = BLOCK_TYPES[4];                  // Diamond

    cell.classList.add('mc-voxel-block', `mc-${blockInfo.type}`);
    cell.innerHTML = `
      <div class="mc-crack-layer"></div>
      <span class="mc-block-label">${blockInfo.name.split(' ')[0]}</span>
    `;

    let isMining = false;
    let mineStartTime = 0;
    let mineInterval = null;
    let isBroken = false;

    const crackLayer = cell.querySelector('.mc-crack-layer');

    // Fareye Basılı Tutulduğunda (Start Mining)
    const startMining = (e) => {
      if (e.button !== 0 || isBroken) return; // Sadece sol tık
      e.preventDefault();
      e.stopPropagation();

      isMining = true;
      mineStartTime = Date.now();

      // Madencilik vuruş animasyonu
      cell.classList.add('mc-mining-active');

      mineInterval = setInterval(() => {
        if (!isMining) return;
        const elapsed = Date.now() - mineStartTime;
        const progress = Math.min(1, elapsed / blockInfo.mineTime);

        if (crackLayer) {
          crackLayer.style.opacity = `${progress * 0.95}`;
          // Klasik 10 kademeli minecraft çatlak hissi
          const crackStage = Math.floor(progress * 10);
          crackLayer.setAttribute('data-stage', crackStage);
        }

        // Blok Başarıyla Kırıldı
        if (progress >= 1) {
          stopMining();
          isBroken = true;
          inventory[blockInfo.drop] += 1;
          showFloatingDrop(e.clientX || window.innerWidth * 0.7, e.clientY || 150, `+1 ${blockInfo.name.split(' ')[0]}`);
          updateHotbar();

          cell.classList.add('mc-broken-state');

          // 5 saniye sonra madende blok yeniden belirir (Respawn)
          setTimeout(() => {
            isBroken = false;
            if (crackLayer) {
              crackLayer.style.opacity = '0';
              crackLayer.removeAttribute('data-stage');
            }
            cell.classList.remove('mc-broken-state');
          }, 5000);
        }
      }, 30);
    };

    // Fare Bırakıldığında veya Kutunun Dışına Çıkıldığında (Cancel Mining)
    const stopMining = () => {
      if (!isMining) return;
      isMining = false;
      clearInterval(mineInterval);
      cell.classList.remove('mc-mining-active');

      if (!isBroken && crackLayer) {
        crackLayer.style.opacity = '0';
        crackLayer.removeAttribute('data-stage');
      }
    };

    cell.addEventListener('mousedown', startMining);
    cell.addEventListener('mouseup', stopMining);
    cell.addEventListener('mouseleave', stopMining);

    cleanups.push(() => {
      stopMining();
      cell.removeEventListener('mousedown', startMining);
      cell.removeEventListener('mouseup', stopMining);
      cell.removeEventListener('mouseleave', stopMining);
      cell.classList.remove('mc-voxel-block', `mc-${blockInfo.type}`, 'mc-broken-state', 'mc-mining-active');
      cell.innerHTML = '';
    });
  });

  // Hotbar ve Crafting Modal Arayüzü
  const mcRootUI = document.createElement('div');
  mcRootUI.id = 'mcGamingOverlay';
  mcRootUI.className = 'mc-overlay-layer';
  mcRootUI.innerHTML = `
    <button type="button" class="mc-crafting-btn" id="btnOpenCrafting">
      <span class="mc-craft-icon">⚒</span>
      <span>CRAFTING</span>
    </button>

    <div class="mc-inventory-hotbar">
      <div class="mc-hotbar-slot" title="Wood"><span class="mc-item-emoji">🪵</span><span class="mc-slot-badge" id="hudWood">0</span></div>
      <div class="mc-hotbar-slot" title="Stone"><span class="mc-item-emoji">🪨</span><span class="mc-slot-badge" id="hudStone">0</span></div>
      <div class="mc-hotbar-slot" title="Coal"><span class="mc-item-emoji">⬛</span><span class="mc-slot-badge" id="hudCoal">0</span></div>
      <div class="mc-hotbar-slot" title="Iron"><span class="mc-item-emoji">🪙</span><span class="mc-slot-badge" id="hudIron">0</span></div>
      <div class="mc-hotbar-slot" title="Diamond"><span class="mc-item-emoji">💎</span><span class="mc-slot-badge" id="hudDiamond">0</span></div>
      <div class="mc-hotbar-slot" title="Sticks"><span class="mc-item-emoji">🥢</span><span class="mc-slot-badge" id="hudStick">0</span></div>
      <div class="mc-hotbar-slot" title="Pickaxe"><span class="mc-item-emoji">⛏</span><span class="mc-slot-badge" id="hudPick">0</span></div>
    </div>

    <div class="mc-craft-popup" id="mcCraftModal" style="display: none;">
      <div class="mc-craft-window">
        <div class="mc-craft-header">
          <span>CRAFTING TABLE (3x3)</span>
          <button class="mc-modal-x" id="btnCloseCraft">&times;</button>
        </div>

        <div class="mc-craft-body">
          <div class="mc-grid-3x3">
            ${Array.from({ length: 9 }).map((_, i) => `<div class="mc-cell-slot" data-slot="${i}"></div>`).join('')}
          </div>
          <div class="mc-craft-arrow">&rarr;</div>
          <div class="mc-result-slot">
            <span id="craftResultPreview">⛏</span>
          </div>
        </div>

        <div class="mc-recipe-list">
          <button type="button" class="mc-recipe-action" id="craftPlanks">🪵 1x Wood &rarr; 4x Sticks</button>
          <button type="button" class="mc-recipe-action" id="craftStonePick">🪨 3x Stone + 2x Sticks &rarr; Stone Pickaxe</button>
          <button type="button" class="mc-recipe-action" id="craftDiaPick">💎 3x Diamond + 2x Sticks &rarr; Diamond Pickaxe</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(mcRootUI);

  const craftModal = mcRootUI.querySelector('#mcCraftModal');
  const btnOpenCraft = mcRootUI.querySelector('#btnOpenCrafting');
  const btnCloseCraft = mcRootUI.querySelector('#btnCloseCraft');

  btnOpenCraft.addEventListener('click', () => {
    craftModal.style.display = craftModal.style.display === 'none' ? 'flex' : 'none';
  });

  btnCloseCraft.addEventListener('click', () => {
    craftModal.style.display = 'none';
  });

  mcRootUI.querySelector('#craftPlanks').addEventListener('click', () => {
    if (inventory.wood >= 1) {
      inventory.wood -= 1;
      inventory.stick += 4;
      showFloatingDrop(window.innerWidth / 2, window.innerHeight / 2, '+4x Sticks!');
      updateHotbar();
    }
  });

  mcRootUI.querySelector('#craftStonePick').addEventListener('click', () => {
    if (inventory.stone >= 3 && inventory.stick >= 2) {
      inventory.stone -= 3;
      inventory.stick -= 2;
      inventory.pickaxe += 1;
      showFloatingDrop(window.innerWidth / 2, window.innerHeight / 2, '+1 Stone Pickaxe!');
      updateHotbar();
    }
  });

  mcRootUI.querySelector('#craftDiaPick').addEventListener('click', () => {
    if (inventory.diamond >= 3 && inventory.stick >= 2) {
      inventory.diamond -= 3;
      inventory.stick -= 2;
      inventory.pickaxe += 1;
      showFloatingDrop(window.innerWidth / 2, window.innerHeight / 2, '🏆 DIAMOND PICKAXE CRAFTED!');
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
    mcRootUI.querySelector('#hudPick').textContent = inventory.pickaxe;
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
      cleanups.forEach(fn => fn());
      mcRootUI.remove();
    }
  };
}