// public/themes/modules/friends-theme.js
import { loadServices, handleServiceClick } from '../../services-client.js';

export function init() {
  let ytPlayer = null;
  let isPlaying = false;

  // 1. Obsession ile birebir aynı çalışan IFrame Container yapısı
  const hiddenYtContainer = document.createElement('div');
  hiddenYtContainer.id = 'friendsYoutubePlayer';
  hiddenYtContainer.style.position = 'fixed';
  hiddenYtContainer.style.top = '-9999px';
  hiddenYtContainer.style.left = '-9999px';
  hiddenYtContainer.style.width = '1px';
  hiddenYtContainer.style.height = '1px';
  hiddenYtContainer.style.opacity = '0';
  hiddenYtContainer.style.pointerEvents = 'none';
  document.body.appendChild(hiddenYtContainer);

  // YouTube IFrame API'sini yükle
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
      ytPlayer = new window.YT.Player('friendsYoutubePlayer', {
        height: '1',
        width: '1',
        // Embed izni açık olan doğrulanmış Friends Theme Song video ID'si
        videoId: 'nwBfXsAOfFc',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          start: 0
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(80);
          },
          onStateChange: (event) => {
            const btn = document.getElementById('btnToggleFriendsMusic');
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

  // İlk kullanıcı etkileşiminde başlat (Autoplay engeline karşı)
  const tryAutoPlayOnFirstClick = () => {
    if (ytPlayer && typeof ytPlayer.playVideo === 'function' && !isPlaying) {
      ytPlayer.playVideo();
    }
    document.removeEventListener('click', tryAutoPlayOnFirstClick);
  };
  document.addEventListener('click', tryAutoPlayOnFirstClick, { once: true });

  // 2. Sol Üst Kompakt Ses Kontrol HUD
  const audioHud = document.createElement('div');
  audioHud.className = 'friends-audio-hud';
  audioHud.innerHTML = `
    <div class="friends-audio-meta">
      <span class="friends-audio-label">CENTRAL PERK JUKEBOX</span>
      <span class="friends-audio-title">I'll Be There For You</span>
    </div>
    <div class="friends-audio-controls">
      <button type="button" class="friends-audio-btn" id="btnToggleFriendsMusic">▶ PLAY</button>
      <button type="button" class="friends-audio-btn" id="btnTriggerRoss" title="Make Ross Walk & Shout">🗣️ ROSS</button>
      <input type="range" class="friends-vol-slider" id="friendsVolSlider" min="0" max="100" value="80" />
    </div>
  `;
  document.body.appendChild(audioHud);

  // 3. Yürüyen Ross & "WE WERE ON A BREAK!" Animasyonu
  const rossWalker = document.createElement('div');
  rossWalker.className = 'friends-ross-walker';
  rossWalker.id = 'friendsRossWalker';
  rossWalker.innerHTML = `
    <div class="friends-ross-bubble" id="rossSpeechBubble">WE WERE ON A BREAK! 🦖</div>
    <div class="friends-ross-sprite">
      <div class="friends-ross-head">
        <div class="friends-ross-hair"></div>
      </div>
      <div class="friends-ross-body"></div>
      <div class="friends-ross-legs">
        <div class="friends-ross-leg l1"></div>
        <div class="friends-ross-leg l2"></div>
      </div>
    </div>
  `;
  document.body.appendChild(rossWalker);

  const startRossWalk = () => {
    rossWalker.classList.remove('walking');
    void rossWalker.offsetWidth;
    rossWalker.classList.add('walking');

    const bubble = document.getElementById('rossSpeechBubble');
    setTimeout(() => {
      if (bubble) bubble.classList.add('shout');
    }, 2400);

    setTimeout(() => {
      if (bubble) bubble.classList.remove('shout');
    }, 4800);
  };

  setTimeout(startRossWalk, 1200);

  // 4. Central Perk Kahve Kupası
  const coffeeWidget = document.createElement('div');
  coffeeWidget.className = 'friends-coffee-widget';
  coffeeWidget.innerHTML = `
    <div class="steam-container">
      <div class="steam s1">~</div>
      <div class="steam s2">~</div>
      <div class="steam s3">~</div>
    </div>
    <div class="coffee-mug">
      <div class="coffee-fill" id="coffeeFill" style="height: 65%;"></div>
    </div>
    <span class="coffee-badge" id="coffeeCount">GUNTHER'S COFFEE</span>
  `;
  document.body.appendChild(coffeeWidget);

  let coffeeLevel = 65;
  coffeeWidget.addEventListener('click', () => {
    coffeeLevel = coffeeLevel >= 95 ? 20 : coffeeLevel + 25;
    const fill = document.getElementById('coffeeFill');
    if (fill) fill.style.height = `${coffeeLevel}%`;
  });

  // Buton Event Listeners
  audioHud.querySelector('#btnToggleFriendsMusic')?.addEventListener('click', () => {
    if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
      if (isPlaying) {
        ytPlayer.pauseVideo();
      } else {
        ytPlayer.playVideo();
      }
    }
  });

  audioHud.querySelector('#btnTriggerRoss')?.addEventListener('click', startRossWalk);

  audioHud.querySelector('#friendsVolSlider')?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
      ytPlayer.setVolume(val);
    }
  });

  return {
    destroy: () => {
      document.removeEventListener('click', tryAutoPlayOnFirstClick);
      if (ytPlayer && typeof ytPlayer.destroy === 'function') {
        ytPlayer.destroy();
      }
      hiddenYtContainer.remove();
      audioHud.remove();
      rossWalker.remove();
      coffeeWidget.remove();
    }
  };
}