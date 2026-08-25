export function init() {
  // 1. Friends Karakterleri & Replik Veritabanı
  const FRIENDS_CHARACTERS = [
    { name: 'Joey Tribbiani', quote: 'How you doin\'?', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80' },
    { name: 'Chandler Bing', quote: 'Could I BE any more of a software engineer?', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80' },
    { name: 'Monica Geller', quote: 'I know! Everything has to be spotless!', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80' },
    { name: 'Ross Geller', quote: 'WE WERE ON A BREAK!!', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80' },
    { name: 'Rachel Green', quote: 'No uterus, no opinion!', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80' },
    { name: 'Phoebe Buffay', quote: 'Smelly Cat, Smelly Cat, what are they feeding you?', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&auto=format&fit=crop&q=80' }
  ];

  let charIndex = 0;

  // 2. Sol Alttaki Profil Çerçevesini Monica'nın Sarı Çerçevesine Dönüştür
  const guiAvatarWrapper = document.querySelector('.gui-avatar-wrapper');
  const guiUsername = document.querySelector('#guiLblUsername');
  const guiSession = document.querySelector('#guiLblSession');
  const guiAvatar = document.querySelector('#guiUserAvatar');

  if (guiAvatarWrapper) {
    guiAvatarWrapper.classList.add('friends-monica-frame');
    guiAvatarWrapper.title = 'Click to switch Friends character!';
  }

  const cycleCharacter = () => {
    charIndex = (charIndex + 1) % FRIENDS_CHARACTERS.length;
    const char = FRIENDS_CHARACTERS[charIndex];

    if (guiAvatar) guiAvatar.src = char.avatar;
    if (guiUsername) guiUsername.textContent = char.name;
    if (guiSession) guiSession.textContent = `"${char.quote}"`;

    showFloatingFriendsNote(window.innerWidth * 0.15, window.innerHeight * 0.7, char.quote);
  };

  if (guiAvatarWrapper) {
    guiAvatarWrapper.addEventListener('click', cycleCharacter);
  }

  // 3. Sağ Taraf UI Katmanını Oluştur (Central Perk Cup + PIVOT Mini Game)
  const friendsUI = document.createElement('div');
  friendsUI.id = 'friendsGameLayer';
  friendsUI.className = 'friends-ui-layer';
  friendsUI.innerHTML = `
    <!-- PIVOT Mini-Oyun Butonu -->
    <button type="button" class="friends-pivot-toggle-btn" id="btnTogglePivot">
      <span class="couch-emoji">🛋️</span>
      <span>PIVOT! GAME</span>
    </button>

    <!-- Central Perk Kahve Kupası Widget'ı (Sağ Alt) -->
    <div class="friends-coffee-widget" id="coffeeWidget" title="Click to brew Central Perk Coffee!">
      <div class="steam-container">
        <span class="steam s1">~</span>
        <span class="steam s2">~</span>
        <span class="steam s3">~</span>
      </div>
      <div class="coffee-mug">
        <div class="coffee-fill" id="coffeeFillLevel" style="height: 30%;"></div>
      </div>
      <span class="coffee-badge">CENTRAL PERK ☕</span>
    </div>

    <!-- PIVOT Merdiven Mini-Oyun Modalı -->
    <div class="friends-pivot-modal" id="pivotModal" style="display: none;">
      <div class="pivot-game-window">
        <div class="pivot-header">
          <span>STAIRCASE // HELP ROSS MOVE THE COUCH</span>
          <button class="pivot-close" id="btnClosePivot">&times;</button>
        </div>

        <div class="pivot-stage" id="pivotStage">
          <div class="staircase-wall left"></div>
          <div class="staircase-wall right"></div>
          <div class="staircase-corner-target">STAIRS TOP ⬆</div>
          
          <!-- Turuncu Koltuk -->
          <div class="ross-couch" id="rossCouch">
            <span>🛋️</span>
          </div>

          <div class="pivot-shout" id="pivotShout">PIVOT!!</div>
        </div>

        <div class="pivot-controls">
          <button type="button" class="pivot-action-btn" id="btnMoveUp">MOVE UP [W]</button>
          <button type="button" class="pivot-action-btn rotate" id="btnPivot">PIVOT! [SPACE]</button>
        </div>
        <div class="pivot-status-bar" id="pivotStatus">Couch is stuck! Rotate it to fit the corner!</div>
      </div>
    </div>
  `;

  document.body.appendChild(friendsUI);

  // 4. Central Perk Kahve Kupası Mekaniği
  const coffeeWidget = friendsUI.querySelector('#coffeeWidget');
  const coffeeFill = friendsUI.querySelector('#coffeeFillLevel');
  let coffeeLevel = 30;

  coffeeWidget.addEventListener('click', (e) => {
    coffeeLevel += 25;
    if (coffeeLevel >= 100) {
      coffeeLevel = 100;
      coffeeFill.style.height = '100%';
      showFloatingFriendsNote(e.clientX, e.clientY - 30, '+1 Central Perk Blend! Gunther approves ☕');
      setTimeout(() => {
        coffeeLevel = 20;
        coffeeFill.style.height = '20%';
      }, 2500);
    } else {
      coffeeFill.style.height = `${coffeeLevel}%`;
      showFloatingFriendsNote(e.clientX, e.clientY - 20, 'Brewing... ☕');
    }
  });

  // 5. PIVOT Mini-Oyun Motoru
  const pivotModal = friendsUI.querySelector('#pivotModal');
  const btnTogglePivot = friendsUI.querySelector('#btnTogglePivot');
  const btnClosePivot = friendsUI.querySelector('#btnClosePivot');
  const couch = friendsUI.querySelector('#rossCouch');
  const shout = friendsUI.querySelector('#pivotShout');
  const statusMsg = friendsUI.querySelector('#pivotStatus');
  const btnMoveUp = friendsUI.querySelector('#btnMoveUp');
  const btnPivot = friendsUI.querySelector('#btnPivot');

  let couchY = 0; // 0 (alt) -> 140 (üst / bitiş)
  let couchAngle = 0; // 0deg, 45deg, 90deg

  btnTogglePivot.addEventListener('click', () => {
    pivotModal.style.display = pivotModal.style.display === 'none' ? 'flex' : 'none';
  });

  btnClosePivot.addEventListener('click', () => {
    pivotModal.style.display = 'none';
  });

  const triggerPivotShout = () => {
    couchAngle = (couchAngle + 45) % 180;
    couch.style.transform = `translate(-50%, -${couchY}px) rotate(${couchAngle}deg)`;

    shout.classList.remove('shouting');
    void shout.offsetWidth; // Reflow
    shout.classList.add('shouting');

    if (couchY > 50 && couchAngle === 90) {
      statusMsg.textContent = 'PERFECT ANGLE! Now move it up!';
      statusMsg.style.color = '#50ef39';
    } else {
      statusMsg.textContent = 'PIVOT! PIVOT! PIVOOOT!';
      statusMsg.style.color = '#f7d02c';
    }
  };

  const moveCouchUp = () => {
    // Eğer merdiven dar boğazındaysa ve açı 90 derece değilse sıkışır
    if (couchY >= 50 && couchY < 120 && couchAngle !== 90) {
      statusMsg.textContent = 'STUCK! It won\'t fit! PIVOT!';
      statusMsg.style.color = '#ff4444';
      couch.classList.add('shake');
      setTimeout(() => couch.classList.remove('shake'), 300);
      return;
    }

    couchY += 25;
    if (couchY >= 140) {
      couchY = 140;
      statusMsg.textContent = '🎉 YOU MADE IT TO CHANDLER\'S APARTMENT!';
      statusMsg.style.color = '#50ef39';
      setTimeout(() => {
        couchY = 0;
        couchAngle = 0;
        couch.style.transform = 'translate(-50%, 0) rotate(0deg)';
        statusMsg.textContent = 'Great job! Play again?';
      }, 3000);
    }

    couch.style.transform = `translate(-50%, -${couchY}px) rotate(${couchAngle}deg)`;
  };

  btnPivot.addEventListener('click', triggerPivotShout);
  btnMoveUp.addEventListener('click', moveCouchUp);

  const handleKeydown = (e) => {
    if (pivotModal.style.display !== 'flex') return;
    if (e.code === 'Space') {
      e.preventDefault();
      triggerPivotShout();
    } else if (e.code === 'KeyW' || e.code === 'ArrowUp') {
      e.preventDefault();
      moveCouchUp();
    }
  };

  window.addEventListener('keydown', handleKeydown);

  function showFloatingFriendsNote(x, y, text) {
    const floatEl = document.createElement('div');
    floatEl.className = 'friends-floating-note';
    floatEl.style.left = `${x}px`;
    floatEl.style.top = `${y}px`;
    floatEl.textContent = text;
    document.body.appendChild(floatEl);
    setTimeout(() => floatEl.remove(), 1800);
  }

  return {
    destroy: () => {
      if (guiAvatarWrapper) {
        guiAvatarWrapper.classList.remove('friends-monica-frame');
        guiAvatarWrapper.removeEventListener('click', cycleCharacter);
      }
      window.removeEventListener('keydown', handleKeydown);
      friendsUI.remove();
    }
  };
}