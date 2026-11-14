(() => {
  const $ = s => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const gameKey = params.get('game');
  const icons = {singleplayer:'◉', multiplayer:'◎', duel:'⚔', group:'♟'};
  const modeInfo = {
    singleplayer: {title:'Singleplayer', description:'Play on your own and focus on your best score.'},
    multiplayer: {title:'Multiplayer', description:'Create a room or join a friend to play online.'},
    duel: {title:'1 vs 1 Duel', description:'Challenge another player in a head-to-head match.'},
    group: {title:'Group game', description:'Play together with a larger group of friends.'}
  };
  const normalizeModes = raw => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') { try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch {} }
    return [];
  };
  async function init() {
    if (!gameKey) throw new Error('Missing game key in URL.');
    const response = await fetch(`/api/games/${encodeURIComponent(gameKey)}`, {credentials:'same-origin', headers:{Accept:'application/json'}});
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.status === 'error') throw new Error(body.message || `Game request failed (${response.status})`);
    const game = body.data?.game || body.game;
    // Air Hockey has its own focused mode + room browser; skip the redundant generic picker.
    if (gameKey === 'hockey') { location.replace('/games/hockey/'); return; }
    if (!game) throw new Error('Game configuration was empty.');
    const modes = normalizeModes(game.player_modes);
    if (!modes.length) throw new Error('This game has no configured player modes.');
    if (game.status !== 'active' || game.is_active !== true) throw new Error('This game is not published yet.');

    $('#gameName').innerHTML = `${escapeHTML(game.name)}<span>.</span>`;
    $('#gameTagline').textContent = game.tagline || game.description || '';
    $('#gameCategory').textContent = `${String(game.category || 'GAME').toUpperCase()} / ${String(game.difficulty || 'EASY').toUpperCase()}`;
    $('#gameIcon').textContent = game.icon || '✦';
    $('#playerRange').textContent = `${game.min_players}–${game.max_players} PLAYERS`;
    const grid = $('#modeGrid');
    const uniqueModes = [...new Set(modes)].filter(mode => modeInfo[mode]);
    if (!uniqueModes.length) throw new Error('Configured player modes are not supported by the launcher yet.');

    // A pure single-player title can launch immediately. All other combinations use the shared mode picker.
    if (uniqueModes.length === 1 && uniqueModes[0] === 'singleplayer') {
      launch(game, 'singleplayer');
      return;
    }
    grid.innerHTML = uniqueModes.map(mode => {
      const info = modeInfo[mode];
      return `<button class="mode-card" type="button" data-mode="${mode}"><span class="arrow">↗</span><span class="mode-icon">${icons[mode]}</span><strong>${info.title}</strong><p>${info.description}</p></button>`;
    }).join('');
    grid.addEventListener('click', event => {
      const button = event.target.closest('[data-mode]');
      if (button) launch(game, button.dataset.mode);
    });
    $('#loading').hidden = true;
    $('#launcher').hidden = false;
  }
  function launch(game, mode) {
    const base = game.route || `/games/${game.game_key}`;
    const target = `${base.replace(/\/$/, '')}/?mode=${encodeURIComponent(mode)}`;
    location.assign(target);
  }
  function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  init().catch(error => {
    console.error('[GAME LAUNCHER]', error);
    $('#loading').hidden = true;
    $('#errorMessage').textContent = error.message;
    $('#error').hidden = false;
  });
})();
