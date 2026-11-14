(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const state = { games: [], category: 'all', query: '' };
  const grid = $('#gamesGrid');
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pretty = value => String(value || '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  async function getJSON(url) {
    const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`);
    if (body.status === 'error') throw new Error(body.message || 'Request failed');
    return body.data ?? body;
  }

  function gameRow(game, index) {
    const accent = /^#[0-9a-f]{3,8}$/i.test(game.accent_color || '') ? game.accent_color : '#42d6a0';
    const image = game.cover_image_url || game.preview_image_url || game.logo_url || '';
    const icon = game.icon || '🎮';
    const minutes = game.estimated_duration ?? '—';
    const canPlay = game.can_play === true || (game.status === 'active' && game.is_active === true);
    const route = game.route || (game.game_key === 'weinguesser' ? '/games/weinguesser/' : `/games/launcher/?game=${encodeURIComponent(game.game_key || '')}`);
    const status = canPlay ? 'PLAY NOW' : game.status === 'maintenance' ? 'MAINTENANCE' : 'COMING SOON';
    const category = pretty(game.category || 'Game');
    const description = game.tagline || game.description || 'Ready when you are.';
    const action = canPlay
      ? `<a class="tile-play" href="${escapeHTML(route)}" aria-label="Play ${escapeHTML(game.name)}">PLAY <span>↗</span></a>`
      : `<span class="tile-status">${status}</span>`;

    return `<article class="game-tile ${canPlay ? 'is-playable' : 'is-planned'}" style="--accent:${escapeHTML(accent)};--delay:${Math.min(index * 35, 280)}ms">
      <div class="tile-art">
        ${image
          ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(game.name || 'Game cover')}" loading="lazy" onerror="this.remove()">`
          : `<span class="tile-fallback">${escapeHTML(icon)}</span>`}
        <span class="tile-number">${String(index + 1).padStart(2, '0')}</span>
        ${game.is_featured ? '<span class="featured-mark">FEATURED</span>' : ''}
        <span class="tile-category">${escapeHTML(category)}</span>
      </div>
      <div class="tile-content">
        <h3 class="game-title">${escapeHTML(game.name || 'Untitled game')}</h3>
        <p class="game-description">${escapeHTML(description)}</p>
        <div class="tile-bottom">
          <div class="tile-meta"><span>${Number(game.min_players) || 1}–${Number(game.max_players) || 2} players</span><span>${escapeHTML(minutes)} min</span></div>
          ${action}
        </div>
      </div>
    </article>`;
  }

  function renderFilters() {
    const categories = [...new Set(state.games.map(game => game.category).filter(Boolean))].sort();
    const filters = $('#categoryFilters');
    filters.innerHTML = `<button class="filter-chip ${state.category === 'all' ? 'active' : ''}" data-category="all">ALL</button>` +
      categories.map(category => `<button class="filter-chip ${state.category === category ? 'active' : ''}" data-category="${escapeHTML(category)}">${escapeHTML(pretty(category).toUpperCase())}</button>`).join('');
  }

  function renderGames() {
    const query = state.query.toLowerCase();
    const games = state.games.filter(game => {
      const categoryOK = state.category === 'all' || game.category === state.category;
      const text = [game.name, game.tagline, game.description, game.category, game.game_key].join(' ').toLowerCase();
      return categoryOK && (!query || text.includes(query));
    });
    $('#allCount').textContent = String(games.length).padStart(2, '0');
    grid.innerHTML = games.map(gameRow).join('');
    grid.hidden = games.length === 0;
    $('#emptyState').hidden = games.length !== 0;
  }


  const pageLabels = {
    home: 'On the home page',
    account: 'Editing account',
    songshare: 'Using SongShare',
    games: 'Browsing games',
    hockey: 'In Hockey',
    login: 'On the login page'
  };

  const activityLabels = {
    browsing: 'Browsing',
    editing_profile: 'Editing account',
    listening_music: 'Listening to music',
    browsing_games: 'Browsing games',
    playing_game: 'Playing',
    in_lobby: 'In lobby',
    transferring_file: 'Sending a file'
  };

  let renderAvatar = null;

  async function loadAvatarRenderer() {
    try {
      const avatarModule = await import('/avatarRenderer.js');
      renderAvatar = avatarModule.renderAvatar;
      renderFriends(window.onlineUsers || []);
    } catch (error) {
      console.warn('[Games] Avatar renderer unavailable:', error);
    }
  }

  function getFriendDescription(user) {
    const game = user.activity?.game;

    if (game?.name) {
      if (game.state === 'playing') return `PLAYING ${game.name.toUpperCase()}`;
      if (game.state === 'lobby') return `IN ${game.name.toUpperCase()} LOBBY`;
      return `VIEWING ${game.name.toUpperCase()}`;
    }

    return activityLabels[user.activity?.activity]
      || pageLabels[user.activity?.page]
      || 'Online';
  }

  function renderFriends(users = []) {
    const rail = $('#friendsRail');
    if (!rail) return;

    const sortedUsers = [...users].sort((a, b) => {
      const rank = user => {
        if (user.activity?.game?.state === 'playing') return 0;
        if (user.activity?.game?.state === 'lobby') return 1;
        if (user.status === 'online') return 2;
        return 3;
      };
      return rank(a) - rank(b) || String(a.user_name).localeCompare(String(b.user_name));
    });

    const onlineCount = sortedUsers.filter(user => user.status === 'online').length;
    const awayCount = sortedUsers.length - onlineCount;

    const heading = $('.friends-section .section-heading h2');
    if (heading) {
      heading.innerHTML = `Friends online<span class="heading-dot">.</span><span class="live-count">${onlineCount} ONLINE${awayCount ? ` · ${awayCount} AWAY` : ''}</span>`;
    }

    if (!sortedUsers.length) {
      rail.innerHTML = '<div class="friends-empty"><span>—</span><span>No one is online right now.</span></div>';
      return;
    }

    rail.innerHTML = '';

    sortedUsers.forEach(user => {
      const card = document.createElement('article');
      card.className = `friend-card presence-friend-card ${user.status === 'away' ? 'is-away' : ''}`;

      const avatar = document.createElement('div');
      avatar.className = 'friend-avatar';

      const info = document.createElement('div');
      info.className = 'friend-info';

      const name = document.createElement('strong');
      name.textContent = user.user_name || 'Unknown user';

      const detail = document.createElement('span');
      detail.textContent = getFriendDescription(user);

      const status = document.createElement('span');
      status.className = `friend-presence-status ${user.status === 'away' ? 'away' : 'online'}`;
      status.textContent = user.status === 'away' ? 'AWAY' : 'ONLINE';

      info.append(name, detail);
      card.append(avatar, info, status);
      rail.appendChild(card);

      if (renderAvatar) {
        try {
          renderAvatar(avatar, user, { size: 38 });
        } catch (error) {
          avatar.textContent = (user.user_name || '?').slice(0, 1).toUpperCase();
        }
      } else {
        avatar.textContent = (user.user_name || '?').slice(0, 1).toUpperCase();
      }
    });
  }

  function renderActiveRooms(rooms = []) {
    const grid = $('#activeRoomsGrid');
    const count = $('#activeRoomsCount');
    if (!grid) return;
    const active = rooms.filter(room => ['hockey', 'roadtrip'].includes(room.gameKey) && ['waiting', 'playing'].includes(room.status));
    if (count) count.textContent = `${active.length} ${active.length === 1 ? 'ROOM' : 'ROOMS'}`;
    if (!active.length) {
      grid.innerHTML = '<div class="rooms-empty">No active rooms right now.</div>';
      return;
    }
    grid.innerHTML = active.map(room => {
      const names = (room.players || []).map(player => escapeHTML(player.name)).join(' · ');
      const status = room.status === 'playing' ? 'IN GAME' : 'WAITING';
      const isRoadtrip = room.gameKey === 'roadtrip';
      const gameName = isRoadtrip ? 'Co-Driver' : 'Air Hockey';
      const meta = isRoadtrip ? (room.trackName || 'Track') : `FIRST TO ${room.target}`;
      const href = isRoadtrip ? `/games/roadtrip/?room=${encodeURIComponent(room.code)}` : `/games/hockey/?room=${encodeURIComponent(room.code)}`;
      return `<article class="active-room-card">
        <div class="active-room-top"><strong>${gameName}</strong><span class="room-live ${room.status}">${status}</span></div>
        <div class="active-room-players">${escapeHTML(names || 'Room open')}</div>
        <div class="active-room-bottom"><span>${room.playerCount}/${room.maxPlayers} PLAYERS</span><span>${escapeHTML(meta)}</span></div>
        <a href="${href}" class="room-join-link">VIEW ROOM ↗</a>
      </article>`;
    }).join('');
  }

  // Global presence events update the Games live-activity rail.
  let hockeyRooms = []; let roadtripRooms = [];
  const updateRoomCards = () => renderActiveRooms([...hockeyRooms, ...roadtripRooms]);
  window.addEventListener('hockey:rooms:list', event => { hockeyRooms = event.detail || []; updateRoomCards(); });
  window.addEventListener('roadtrip:rooms:list', event => { roadtripRooms = event.detail || []; updateRoomCards(); });
  window.addEventListener('presence:list', event => renderFriends(event.detail || []));
  window.addEventListener('presence:user-online', () => renderFriends(window.onlineUsers || []));
  window.addEventListener('presence:user-offline', () => renderFriends(window.onlineUsers || []));
  window.addEventListener('presence:user-activity', () => renderFriends(window.onlineUsers || []));
  window.addEventListener('presence:user-status', () => renderFriends(window.onlineUsers || []));
  window.addEventListener('presence:list-updated', () => renderFriends(window.onlineUsers || []));

  async function loadGames() {
    grid.hidden = false;
    grid.innerHTML = '<div class="skeleton-row"></div><div class="skeleton-row"></div><div class="skeleton-row"></div>';
    $('#loadError').hidden = true;
    try {
      const data = await getJSON('/api/games');
      state.games = Array.isArray(data) ? data : (data.games || []);
      renderFilters();
      renderGames();
    } catch (error) {
      grid.innerHTML = '';
      grid.hidden = true;
      $('#loadError').hidden = false;
      console.error('Game catalogue request failed:', error);
    }
  }


  $('#categoryFilters').addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.category = button.dataset.category;
    renderFilters();
    renderGames();
  });
  $('#gameSearch').addEventListener('input', event => { state.query = event.target.value.trim(); renderGames(); });
  $('#resetFilters').addEventListener('click', () => {
    state.category = 'all'; state.query = ''; $('#gameSearch').value = '';
    renderFilters(); renderGames();
  });
  $('#retryLoad').addEventListener('click', loadGames);
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); $('#gameSearch').focus(); }
    if (event.key === 'Escape' && document.activeElement === $('#gameSearch')) { $('#gameSearch').value = ''; state.query = ''; renderGames(); }
  });
  loadGames();
  renderFriends(window.onlineUsers || []);
  loadAvatarRenderer();
})();
