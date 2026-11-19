(() => {
  const $ = s => document.querySelector(s);
  const state = { game: location.pathname.includes('okey101') ? '101' : 'okey', room: null, selected: new Set(), draftSets: [], rooms: [], lastRoomCode: sessionStorage.getItem('tileRoomCode') || null, connectedHandled: false };
  const socket = window.mainSocket;
  const colorNames = { red:'Kırmızı', yellow:'Sarı', blue:'Mavi', black:'Siyah', fake:'Sahte' };
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2500);
  }
  function emit(event, payload = {}) {
    if (!socket?.connected) return toast('Sunucu bağlantısı yok. Tekrar bağlanmayı bekle.');
    socket.emit(event, payload);
  }
  function tileHTML(tile, selected = false, small = false) {
    if (!tile) return '';
    const value = tile.kind === 'fake' ? '★' : tile.value;
    const cls = tile.kind === 'fake' ? 'fake' : tile.color;
    return `<div class="tile ${cls} ${selected ? 'selected' : ''}" data-tile="${tile.id}" title="${escapeHTML(colorNames[tile.color] || tile.color)} ${tile.value || ''}" style="${small ? 'width:30px;height:44px;font-size:18px' : ''}"><span>${value}</span><i class="tile-color">${tile.kind === 'fake' ? 'SAHTE' : colorNames[tile.color]}</i></div>`;
  }
  function renderRooms() {
    $('#roomCount').textContent = `${state.rooms.length} ROOMS`;
    if (!state.rooms.length) { $('#rooms').innerHTML = '<div class="empty">Şu anda açık masa yok.</div>'; return; }
    $('#rooms').innerHTML = state.rooms.map(room => `<article class="room-card"><strong>${room.gameName}</strong><p>${escapeHTML(room.code)} · ${room.playerCount}/4 OYUNCU</p><p>${room.status === 'playing' ? 'OYUN DEVAM EDİYOR' : 'OYUNCU BEKLİYOR'}</p><button class="secondary" data-join="${escapeHTML(room.code)}" ${room.status !== 'waiting' ? 'disabled' : ''}>Masaya katıl</button></article>`).join('');
  }
  function setGame(game) {
    state.game = game;
    document.querySelectorAll('.game-choice').forEach(button => button.classList.toggle('active', button.dataset.game === game));
    $('#lobby h1').innerHTML = game === '101' ? '101 Okey<span>.</span>' : 'Okey<span>.</span>';
    $('.intro').textContent = game === '101'
      ? '101 puanla aç, taşlarını işle ve masayı bitir.'
      : 'Aynı masada buluş. Taşlarını diz, sıranı bekle ve oyunu kazan.';
  }
  document.querySelectorAll('.game-choice').forEach(button => button.addEventListener('click', () => setGame(button.dataset.game)));
  setGame(state.game);
  $('#createRoom').addEventListener('click', () => emit('tiles:room:create', { game: state.game }));
  $('#joinRoom').addEventListener('click', () => {
    const code = $('#roomCode').value.trim().toUpperCase();
    if (code.length !== 6) return toast('Oda kodu 6 karakter olmalı.');
    emit('tiles:room:join', { code });
  });
  $('#rooms').addEventListener('click', event => {
    const button = event.target.closest('[data-join]');
    if (button) emit('tiles:room:join', { code: button.dataset.join });
  });
  $('#copyCode').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(state.room?.code || ''); toast('Oda kodu kopyalandı.'); }
    catch { toast(`Oda kodu: ${state.room?.code || ''}`); }
  });
  $('#leaveRoom').addEventListener('click', () => {
    emit('tiles:leave'); state.room = null; state.selected.clear(); state.draftSets = []; state.lastRoomCode = null; sessionStorage.removeItem('tileRoomCode');
    $('#tableView').hidden = true; $('#lobby').hidden = false;
  });
  $('#stock').addEventListener('click', () => {
    if (state.room?.you === state.room?.current && !state.room.hasDrawn) emit('tiles:draw', { from: 'stock' });
  });
  $('#discardPile').addEventListener('click', () => {
    if (state.room?.you === state.room?.current && !state.room.hasDrawn) emit('tiles:draw', { from: 'discard' });
  });
  $('#hand').addEventListener('click', event => {
    const tile = event.target.closest('[data-tile]');
    if (!tile) return;
    const id = Number(tile.dataset.tile);
    if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
    renderHand();
  });
  $('#sortHand').addEventListener('click', () => {
    if (!state.room) return;
    state.room.hand.sort((a,b) => ['red','yellow','blue','black','fake'].indexOf(a.color)-['red','yellow','blue','black','fake'].indexOf(b.color) || a.value-b.value);
    renderHand();
  });
  $('#clearSelection').addEventListener('click', () => { state.selected.clear(); renderHand(); });
  $('#finish').addEventListener('click', () => {
    const id = [...state.selected][0];
    if (!id || state.selected.size !== 1) return toast('Bitirmek için son atacağın taşı seç.');
    emit('tiles:discard', { tileId: id, declareWin: true });
    state.selected.clear();
  });
  $('#discard').addEventListener('click', () => {
    const id = [...state.selected][0];
    if (!id) return toast('Atmak için bir taş seç.');
    if (state.selected.size !== 1) return toast('Bir seferde yalnızca bir taş atabilirsin.');
    emit('tiles:discard', { tileId: id });
    state.selected.clear();
  });
  $('#addSet').addEventListener('click', () => {
    const ids = [...state.selected];
    if (ids.length < 2) return toast('Bir set için en az 2 taş seç.');
    state.draftSets.push(ids);
    state.selected.clear();
    renderHand(); renderDraftSets();
  });
  $('#submitMelds').addEventListener('click', () => {
    if (!state.draftSets.length) return toast('Önce en az bir set oluştur.');
    emit('tiles:lay', { sets: state.draftSets });
    state.selected.clear(); renderHand();
  });
  $('#draftSets').addEventListener('click', event => {
    const button = event.target.closest('[data-remove-set]');
    if (button) { state.draftSets.splice(Number(button.dataset.removeSet), 1); renderDraftSets(); }
  });
  $('#attachTiles').addEventListener('click', () => {
    const ids = [...state.selected];
    if (!ids.length) return toast('İşlemek için taş seç.');
    const target = Number($('#attachTarget').value);
    if (!Number.isInteger(target)) return toast('Önce masadaki bir seti seç.');
    emit('tiles:attach', { meldIndex: target, tileIds: ids });
    state.selected.clear(); renderHand();
  });
  $('#toast').addEventListener('click', () => $('#toast').classList.remove('show'));

  function renderPlayers(room) {
    const filled = room.players.filter(Boolean);
    $('#playerCount').textContent = `${filled.length}/4`;
    $('#players').innerHTML = room.players.map((p, i) => p ? `<div class="player ${room.current === i ? 'current' : ''}"><span class="player-avatar">${escapeHTML(p.name.slice(0,1).toUpperCase())}</span><span class="player-name">${escapeHTML(p.name)}${p.isYou ? ' (Sen)' : ''}</span><span class="player-state">${p.connected ? (p.opened ? 'AÇTI' : 'ONLINE') : 'OFFLINE'} · ${p.score || 0} puan</span></div>` : `<div class="player"><span class="player-avatar">+</span><span class="player-name">Oyuncu bekleniyor</span><span class="player-state">EMPTY</span></div>`).join('');
    const opponents = room.players.filter((p, i) => p && i !== room.you);
    $('#opponentHands').innerHTML = opponents.map(p => `<div class="opponent">${escapeHTML(p.name)}<div class="back-tiles">${'<i></i>'.repeat(Math.min(14, room.game === 'okey' ? 14 : 21))}</div></div>`).join('');
  }
  function renderHand() {
    const room = state.room; if (!room) return;
    $('#hand').innerHTML = room.hand.map(t => tileHTML(t, state.selected.has(t.id))).join('');
    $('#handCount').textContent = `${room.hand.length} taş`;
  }
  function renderDraftSets() {
    const room = state.room;
    $('#draftSets').innerHTML = state.draftSets.map((set, index) => {
      const tiles = set.map(id => room?.hand.find(t => t.id === id)).filter(Boolean);
      return `<div class="draft-set"><span>${tiles.map(t => `${t.kind === 'fake' ? '★' : t.value}`).join(' · ')}</span><button data-remove-set="${index}" title="Seti kaldır">×</button></div>`;
    }).join('') || '<span class="empty">Henüz set oluşturulmadı.</span>';
  }
  function renderTable(room) {
    if (!room) return;
    const isMyTurn = room.you === room.current;
    const game101 = room.game === 'okey101';
    $('#lobby').hidden = true; $('#tableView').hidden = false;
    $('#tableTitle').innerHTML = game101 ? '101 Okey<span>.</span>' : 'Okey<span>.</span>';
    $('#tableType').textContent = game101 ? 'TURKISH CLASSIC / 101' : 'TURKISH CLASSIC / OKEY';
    $('#roomLabel').textContent = `ROOM ${room.code}`;
    $('#roundLabel').textContent = `ROUND ${room.round}`;
    const currentName = room.players[room.current]?.name || '—';
    $('#turnLabel').textContent = room.status === 'playing' ? (isMyTurn ? 'YOUR TURN' : `${currentName.toUpperCase()} TURN`) : room.status.toUpperCase();
    $('#gameMessage').textContent = room.message || 'Dört oyuncu bekleniyor…';
    $('#stockCount').textContent = `${room.stockCount} taş`;
    $('#indicator').innerHTML = room.indicator ? tileHTML(room.indicator, false, true) : '—';
    $('#jokerText').textContent = room.joker ? `Okey: ${room.joker.value} ${colorNames[room.joker.color]}` : 'Okey belirleniyor';
    $('#discardTile').innerHTML = room.discardTop ? tileHTML(room.discardTop, false, true) : '—';
    renderPlayers(room); renderHand();
    $('#tableMelds').innerHTML = room.table.length ? room.table.map((meld, index) => `<div class="meld"><small>${index+1} · ${escapeHTML(meld.owner)}</small>${meld.tiles.map(t => tileHTML(t,false,true)).join('')}</div>`).join('') : '<div class="table-placeholder">101 Okey açılışları ve işlenen taşlar burada görünür.</div>';
    $('#attachTarget')?.remove();
    if (game101 && room.you === room.current && room.players[room.you]?.opened) {
      const select = document.createElement('select'); select.id = 'attachTarget'; select.className = 'secondary';
      select.innerHTML = room.table.map((m,i) => `<option value="${i}">Set ${i+1} · ${escapeHTML(m.owner)}</option>`).join('');
      $('#attachTiles').before(select);
      $('#attachTiles').hidden = !room.table.length;
    } else $('#attachTiles').hidden = true;
    $('#meldBuilder').hidden = !game101 || !isMyTurn || !room.hasDrawn;
    $('#builderHint').textContent = room.players[room.you]?.opened ? 'Yeni geçerli setler oluşturup açabilir veya mevcut sete işleyebilirsin.' : '101 puanlık setler ya da 5 aynı taş çifti oluştur.';
    $('#discard').disabled = !isMyTurn || !room.hasDrawn || !room.hand.length;
    $('#finish').disabled = !isMyTurn || !room.hasDrawn || !room.hand.length ||
      (game101 && !(room.players[room.you]?.opened && room.hand.length === 1)) ||
      (!game101 && room.hand.length !== 15);
    $('#actionHint').textContent = room.status !== 'playing' ? 'Dört oyuncu masaya katıldığında oyun otomatik başlar.' : !isMyTurn ? `${currentName} oynuyor. Sıra sana geldiğinde taş çek.` : !room.hasDrawn ? 'Ortadan veya atılan taşın üstünden bir taş çek.' : 'Elinden bir taş seç ve at.';
    renderDraftSets();
    if (room.status === 'finished') toast(room.winner ? `${room.winner} kazandı!` : room.message || 'Oyun sona erdi.');
  }
  function onRooms(rooms) { state.rooms = Array.isArray(rooms) ? rooms : []; renderRooms(); }
  if (socket) {
    socket.on('connect', () => {
      state.connectedHandled = true;
      $('#connection').textContent = 'CONNECTED'; $('#connection').classList.add('online');
      socket.emit('tiles:rooms:list:request');
      if (state.lastRoomCode) socket.emit('tiles:room:rejoin', { code: state.lastRoomCode });
    });
    socket.on('disconnect', () => { $('#connection').textContent = 'RECONNECTING'; $('#connection').classList.remove('online'); });
    socket.on('tiles:rooms:list', onRooms);
    socket.on('tiles:room:created', data => { state.lastRoomCode = data.code; sessionStorage.setItem('tileRoomCode', data.code); toast(`Masa oluşturuldu: ${data.code}`); });
    socket.on('tiles:room:joined', data => { state.lastRoomCode = data.code; sessionStorage.setItem('tileRoomCode', data.code); toast('Masaya katıldın.'); });
    socket.on('tiles:state', room => {
      state.room = room; state.lastRoomCode = room.code; sessionStorage.setItem('tileRoomCode', room.code);
      if (state.draftSets.length && state.draftSets.flat().every(id => !room.hand.some(t => t.id === id))) state.draftSets = [];
      state.selected.clear();
      if (room.status === 'waiting') state.draftSets = [];
      renderTable(room);
    });
    socket.on('tiles:error', data => toast(data?.message || 'Bir hata oluştu.'));
    socket.on('connect_error', () => { $('#connection').textContent = 'OFFLINE'; });
  } else {
    $('#connection').textContent = 'LOGIN REQUIRED';
    toast('Oyuna katılmak için giriş yapmalısın.');
  }
  window.addEventListener('socket:connected', () => {
    if (state.lastRoomCode && socket) socket.emit('tiles:room:rejoin', { code: state.lastRoomCode });
  });
  // Ask for the current room list after the shared socket client initializes.
  setTimeout(() => {
    if (socket?.connected && !state.connectedHandled) {
      $('#connection').textContent = 'CONNECTED'; $('#connection').classList.add('online');
      socket.emit('tiles:rooms:list:request');
      if (state.lastRoomCode) socket.emit('tiles:room:rejoin', { code: state.lastRoomCode });
    }
  }, 0);
})();
