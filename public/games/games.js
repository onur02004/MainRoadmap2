(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const state = { games: [], category: 'all', query: '' };
  const grid = $('#gamesGrid');

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const listValue = value => Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',').map(v => v.trim()).filter(Boolean) : []);
  async function getJSON(url) {
    const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    const body = await response.json();
    if (body.status === 'error') throw new Error(body.message || 'Request failed');
    return body.data ?? body;
  }
  function gameRow(game, index) {
    const accent = /^#[0-9a-f]{3,8}$/i.test(game.accent_color || '') ? game.accent_color : '#b8a5ff';
    const image = game.cover_image_url || game.preview_image_url || game.logo_url || '';
    const icon = game.icon || '🎮';
    const minutes = game.estimated_minutes ?? game.estimated_duration ?? '—';
    const route = game.route || `/games/${encodeURIComponent(game.game_key || '')}`;
    const description = game.tagline || game.description || 'Ready when you are.';
    return `<article class="game-row" style="--accent:${escapeHTML(accent)};animation-delay:${Math.min(index * 45, 360)}ms" data-game-row>
      <div class="game-thumb">${image ? `<img src="${escapeHTML(image)}" alt="" loading="lazy" onerror="this.remove();this.nextElementSibling.hidden=false"><span class="fallback-icon" hidden>${escapeHTML(icon)}</span>` : `<span class="fallback-icon">${escapeHTML(icon)}</span>`}</div>
      <div class="game-copy"><div class="game-title-line"><h3 class="game-title">${escapeHTML(game.name || 'Untitled game')}</h3>${game.is_featured ? '<span class="featured-mark">✦ FEATURED</span>' : ''}</div>
        <p class="game-description">${escapeHTML(description)}</p>
        <div class="game-details"><span>♙ ${Number(game.min_players) || 1}–${Number(game.max_players) || 2} players</span><i class="detail-dot"></i><span>◷ ${escapeHTML(minutes)} min</span><i class="detail-dot"></i><span>${escapeHTML(game.difficulty || 'easy')}</span></div>
      </div>
      <div class="game-right"><span class="game-category">${escapeHTML(game.category || 'Game')}</span><a class="play-link" href="${escapeHTML(route)}" aria-label="Play ${escapeHTML(game.name || 'game')}">↗</a></div>
    </article>`;
  }
  function renderGames() {
    const query = state.query.toLowerCase();
    const games = state.games.filter(game => {
      const categoryOK = state.category === 'all' || game.category === state.category;
      const text = [game.name, game.tagline, game.description, game.category, ...listValue(game.tags)].join(' ').toLowerCase();
      return categoryOK && (!query || text.includes(query));
    });
    $('#allCount').textContent = games.length;
    grid.innerHTML = games.map(gameRow).join('');
    grid.hidden = games.length === 0;
    $('#emptyState').hidden = games.length !== 0;
    grid.querySelectorAll('[data-game-row]').forEach(row => {
      row.addEventListener('pointermove', event => {
        if (event.pointerType !== 'mouse') return;
        const rect = row.getBoundingClientRect();
        row.style.setProperty('--mx', `${event.clientX - rect.left}px`);
        row.style.setProperty('--my', `${event.clientY - rect.top}px`);
      });
    });
  }
  function renderFriends(friends) {
    const rail = $('#friendsRail');
    if (!friends.length) {
      rail.innerHTML = '<div class="friends-empty"><span class="empty-face">☕</span><span>No friends playing at the moment.</span></div>';
      return;
    }
    rail.innerHTML = friends.map(friend => {
      const name = friend.display_name || friend.username || friend.name || 'Friend';
      const game = friend.game_name || friend.gameName || 'a game';
      const avatar = friend.avatar_url || friend.avatarUrl || '';
      const join = friend.join_url || friend.joinUrl || friend.room_url || '';
      return `<article class="friend-card"><div class="friend-avatar">${avatar ? `<img src="${escapeHTML(avatar)}" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.remove()">` : escapeHTML(name.charAt(0).toUpperCase())}</div><div class="friend-info"><strong>${escapeHTML(name)}</strong><span>Playing ${escapeHTML(game)}</span></div>${join ? `<a class="friend-join" href="${escapeHTML(join)}">Join ↗</a>` : ''}</article>`;
    }).join('');
  }
  async function loadGames() {
    grid.hidden = false;
    grid.innerHTML = '<div class="skeleton-row"></div><div class="skeleton-row"></div><div class="skeleton-row"></div>';
    $('#loadError').hidden = true;
    try {
      const data = await getJSON('/api/games');
      state.games = Array.isArray(data) ? data : (data.games || []);
      renderGames();
    } catch (error) {
      grid.innerHTML = '';
      $('#loadError').hidden = false;
      console.error('Game catalogue request failed:', error);
    }
  }
  async function loadFriends() {
    try {
      const data = await getJSON('/api/games/active-friends');
      renderFriends(Array.isArray(data) ? data : (data.friends || data.activeFriends || []));
    } catch (error) {
      console.info('Active friends endpoint is not available yet:', error.message);
      renderFriends([]);
    }
  }
  $('#categoryFilters').addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.category = button.dataset.category;
    $('#categoryFilters').querySelectorAll('.filter-chip').forEach(item => item.classList.toggle('active', item === button));
    renderGames();
  });
  $('#gameSearch').addEventListener('input', event => { state.query = event.target.value.trim(); renderGames(); });
  $('#resetFilters').addEventListener('click', () => {
    state.category = 'all'; state.query = ''; $('#gameSearch').value = '';
    $('#categoryFilters').querySelectorAll('.filter-chip').forEach(item => item.classList.toggle('active', item.dataset.category === 'all'));
    renderGames();
  });
  $('#retryLoad').addEventListener('click', loadGames);
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); $('#gameSearch').focus(); }
    if (event.key === 'Escape' && document.activeElement === $('#gameSearch')) { $('#gameSearch').value = ''; state.query = ''; renderGames(); }
  });
  const glow = $('#pointerGlow');
  window.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    glow.style.left = `${event.clientX}px`; glow.style.top = `${event.clientY}px`; glow.classList.add('visible');
  }, { passive: true });
  document.addEventListener('pointerleave', () => glow.classList.remove('visible'));
  loadGames();
  loadFriends();
  setInterval(loadFriends, 20000);
})();
