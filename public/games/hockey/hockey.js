(() => {
  const $ = s => document.querySelector(s);
  const canvas = $('#rink');
  const ctx = canvas.getContext('2d');
  const modeButtons = [...document.querySelectorAll('.mode-card')];
  const state = {
    mode: 'solo', target: 7, online: false, onlineRoomCode: null, onlineSide: null, onlineSnapshot: null, onlineStarted: false, running: false, paused: false,
    leftScore: 0, rightScore: 0, startAt: 0, elapsed: 0, lastTime: 0, matchOver: false, scoringPending: false,
    width: 1000, height: 530, dpr: 1, puck: null, paddles: [], keys: {},
    countdownTimer: null, goalTimer: null, flashTimer: null, raf: null, touchPointers: new Map()
  };
  const COLORS = { mint: '#49dda6', orange: '#ff9867', white: '#e8f0eb' };
  let currentRoomIsHost = false;
  const keyMap = {
    left: [{up:'KeyW',down:'KeyS'},{up:'KeyE',down:'KeyD'},{up:'KeyT',down:'KeyG'}],
    right: [{up:'ArrowUp',down:'ArrowDown'},{up:'KeyI',down:'KeyK'},{up:'KeyO',down:'KeyL'}]
  };

  function setMode(mode) {
    if (!['solo', 'duel', 'online'].includes(mode)) return;
    state.mode = mode;
    modeButtons.forEach(b => b.classList.toggle('selected', b.dataset.mode === mode));
    $('#setupNote').textContent = mode === 'solo'
      ? 'W / S or ↑ / ↓ to move. First to the target wins.'
      : mode === 'duel' ? 'Player 1: W / S. Player 2: ↑ / ↓.' : 'Create a room or join with a room code.';
    $('#onlineRoom').hidden = mode !== 'online';
    $('#setupRow').hidden = mode === 'online';
    $('#modeGrid').hidden = mode === 'online';
    const heading = $('#modePanel .panel-heading h2');
    heading.textContent = mode === 'online' ? 'Online Duel' : 'Choose your game mode';
    $('#modePanel .step').textContent = mode === 'online' ? 'ROOM / 1 VS 1' : '01 / 02';
    if (mode !== 'online') {
      $('#roomLobby').hidden = true;
      currentRoomIsHost = false;
    }
  }
  modeButtons.forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * state.dpr);
    canvas.height = Math.round(rect.height * state.dpr);
    state.width = rect.width;
    state.height = rect.height;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    draw();
  }
  new ResizeObserver(resize).observe(canvas);

  function makePaddles() {
    const centerY = state.height / 2;
    state.paddles = [
      { side: 'left', index: 0, x: state.width * .12, y: centerY, r: 23, vy: 0, color: COLORS.mint }
    ];
    // The CPU is a real opponent paddle in Solo mode, not an absent right side.
    state.paddles.push({
      side: 'right', index: 0, x: state.width * .88, y: centerY,
      r: 23, vy: 0, color: COLORS.orange
    });
  }
  function resetPuck(direction = Math.random() > .5 ? 1 : -1) {
    state.puck = { x: state.width / 2, y: state.height / 2, vx: direction * 5.3, vy: (Math.random() - .5) * 3.2, r: 11, spin: 0 };
  }
  function setupMatch() {
    clearTimeout(state.countdownTimer);
    clearTimeout(state.goalTimer);
    clearTimeout(state.flashTimer);
    cancelAnimationFrame(state.raf);
    state.keys = {};
    state.touchPointers.clear();
    state.matchOver = false;
    state.scoringPending = false;
    state.target = Number($('#targetScore').value);
    state.leftScore = state.rightScore = 0;
    state.elapsed = 0;
    state.startAt = performance.now();
    makePaddles();
    resetPuck();
    updateScore();
    $('#modeLabel').textContent = state.mode === 'solo' ? 'SOLO' : state.mode === 'duel' ? 'LOCAL DUEL' : 'ONLINE DUEL';
    $('#leftLabel').textContent = 'PLAYER 01';
    $('#rightLabel').textContent = state.mode === 'solo' ? 'CPU' : state.mode === 'online' ? 'PLAYER 02' : 'PLAYER 02';
    $('#matchState').textContent = `FIRST TO ${state.target}`;
    $('#controlsText').innerHTML = state.mode === 'solo'
      ? '<b>YOU</b> &nbsp; W / S or ↑ / ↓'
      : state.mode === 'online' ? '<b>YOU</b> &nbsp; W / S · Move your striker' : '<b>P1</b> W / S &nbsp; <b>P2</b> ↑ / ↓';
    $('#modePanel').hidden = true;
    $('#gamePanel').hidden = false;
    state.running = true;
    state.online = false;
    state.onlineStarted = false;
    state.paused = false;
    $('#pauseOverlay').hidden = true;
    $('#pauseButton').textContent = 'PAUSE';
    resize();
    countdown();
  }
  function updateScore() {
    $('#leftScore').textContent = state.leftScore;
    $('#rightScore').textContent = state.rightScore;
  }
  function countdown() {
    const el = $('#countdown');
    let n = 3;
    el.hidden = false;
    el.textContent = n;
    const tick = () => {
      n--;
      if (n <= 0) {
        el.hidden = true;
        state.lastTime = performance.now();
        cancelAnimationFrame(state.raf);
        state.raf = requestAnimationFrame(loop);
      } else {
        el.textContent = n;
        state.countdownTimer = setTimeout(tick, 650);
      }
    };
    state.countdownTimer = setTimeout(tick, 650);
  }
  function endMatch(winner) {
    if (state.matchOver) return;
    state.matchOver = true;
    state.running = false;
    state.paused = true;
    $('#pauseOverlay').hidden = false;
    $('#pauseOverlay').innerHTML = `<strong>${winner} WINS</strong><span>${state.leftScore} — ${state.rightScore}</span>`;
    $('#pauseButton').textContent = 'MATCH ENDED';
  }
  function goal(side) {
    if (!state.running || state.scoringPending || state.matchOver) return;
    state.scoringPending = true;
    if (side === 'left') state.rightScore++;
    else state.leftScore++;
    updateScore();
    const flash = $('#goalFlash');
    flash.hidden = false;
    flash.textContent = side === 'left' ? (state.mode === 'solo' ? 'CPU SCORES' : 'PLAYER 02 SCORES') : 'PLAYER 01 SCORES';
    clearTimeout(state.flashTimer);
    state.flashTimer = setTimeout(() => { flash.hidden = true; }, 700);
    if (state.leftScore >= state.target || state.rightScore >= state.target) {
      state.goalTimer = setTimeout(() => endMatch(state.leftScore > state.rightScore ? 'PLAYER 01' : (state.mode === 'solo' ? 'CPU' : 'PLAYER 02')), 720);
      return;
    }
    state.goalTimer = setTimeout(() => {
      if (!state.running || state.matchOver) return;
      resetPuck(side === 'left' ? -1 : 1);
      state.scoringPending = false;
    }, 720);
  }
  function movePaddles(dt) {
    const h = state.height;
    for (const p of state.paddles) {
      let direction = 0;
      if (state.mode === 'solo' && p.side === 'right') {
        const puck = state.puck;
        // Track the puck only when it approaches the CPU half. Add a small
        // reaction offset so the opponent remains beatable.
        let desired = h / 2;
        if (puck.vx > 0 && puck.x > state.width * .38) {
          const travel = Math.max(0, (p.x - puck.x) / Math.max(1.5, puck.vx));
          desired = puck.y + puck.vy * Math.min(travel, 18);
        }
        desired = Math.max(p.r + 8, Math.min(h - p.r - 8, desired));
        const diff = desired - p.y;
        direction = Math.abs(diff) > 5 ? Math.sign(diff) : 0;
      } else {
        const up = p.side === 'left' ? 'KeyW' : 'ArrowUp';
        const down = p.side === 'left' ? 'KeyS' : 'ArrowDown';
        const upPressed = state.keys[up] || (state.mode === 'solo' && p.side === 'left' && state.keys.ArrowUp);
        const downPressed = state.keys[down] || (state.mode === 'solo' && p.side === 'left' && state.keys.ArrowDown);
        direction = (downPressed ? 1 : 0) - (upPressed ? 1 : 0);
      }
      const speed = state.mode === 'solo' && p.side === 'right' ? 3.45 : 5.5;
      p.vy = direction * speed;
      p.y += p.vy * dt;
      p.y = Math.max(p.r + 8, Math.min(h - p.r - 8, p.y));
    }
  }
  function collidePaddles() {
    const puck = state.puck;
    for (const p of state.paddles) {
      const dx = puck.x - p.x, dy = puck.y - p.y;
      const dist = Math.hypot(dx, dy);
      const min = puck.r + p.r;
      if (dist < min && dist > 0) {
        const nx = dx / dist, ny = dy / dist;
        puck.x = p.x + nx * min;
        puck.y = p.y + ny * min;
        const impact = Math.max(2.5, Math.abs(puck.vx * nx + puck.vy * ny));
        const direction = p.side === 'left' ? 1 : -1;
        puck.vx = direction * Math.min(11, Math.max(4.2, Math.abs(puck.vx) + 1.1));
        puck.vy = Math.max(-9, Math.min(9, puck.vy + ny * impact * .8 + p.vy * .42));
        puck.spin += p.vy * .02;
      }
    }
  }
  function update(dt) {
    movePaddles(dt);
    const p = state.puck;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.spin * dt;
    p.spin *= .985;
    p.vx *= Math.pow(.999, dt);
    p.vy *= Math.pow(.999, dt);
    if (p.y - p.r < 8) { p.y = 8 + p.r; p.vy = Math.abs(p.vy) * .96; }
    if (p.y + p.r > state.height - 8) { p.y = state.height - 8 - p.r; p.vy = -Math.abs(p.vy) * .96; }
    const goalTop = state.height * .34, goalBottom = state.height * .66;
    if (p.x - p.r < 12 && (p.y < goalTop || p.y > goalBottom)) { p.x = 12 + p.r; p.vx = Math.abs(p.vx) * .95; }
    if (p.x + p.r > state.width - 12 && (p.y < goalTop || p.y > goalBottom)) { p.x = state.width - 12 - p.r; p.vx = -Math.abs(p.vx) * .95; }
    collidePaddles();
    if (p.x < -p.r) goal('left');
    else if (p.x > state.width + p.r) goal('right');
    state.elapsed += dt / 60;
    const total = Math.floor(state.elapsed);
    $('#matchClock').textContent = `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
  }
  function roundedRect(x,y,w,h,r) {
    ctx.beginPath(); ctx.roundRect(x,y,w,h,r);
  }
  function draw() {
    const w = state.width, h = state.height;
    if (!w || !h) return;
    ctx.clearRect(0,0,w,h);
    const bg = ctx.createLinearGradient(0,0,w,h);
    bg.addColorStop(0,'#0b1a11'); bg.addColorStop(.5,'#0b2116'); bg.addColorStop(1,'#08150e');
    ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);
    // subtle ice grain / court lines
    ctx.strokeStyle = 'rgba(123,226,169,.14)'; ctx.lineWidth = 1;
    ctx.strokeRect(12,12,w-24,h-24);
    ctx.beginPath(); ctx.moveTo(w/2,12); ctx.lineTo(w/2,h-12); ctx.stroke();
    ctx.beginPath(); ctx.arc(w/2,h/2,Math.min(h*.19,90),0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(w/2,h/2,3,0,Math.PI*2); ctx.fillStyle='rgba(123,226,169,.6)'; ctx.fill();
    const goalH = h*.32, goalY=(h-goalH)/2;
    ctx.fillStyle='rgba(73,221,166,.08)'; ctx.fillRect(0,goalY,18,goalH);
    ctx.fillStyle='rgba(255,152,103,.08)'; ctx.fillRect(w-18,goalY,18,goalH);
    ctx.strokeStyle='rgba(73,221,166,.6)'; ctx.strokeRect(1,goalY,17,goalH);
    ctx.strokeStyle='rgba(255,152,103,.6)'; ctx.strokeRect(w-18,goalY,17,goalH);
    // faceoff markings
    for (const x of [w*.25,w*.75]) { ctx.beginPath();ctx.arc(x,h/2,Math.min(h*.11,45),0,Math.PI*2);ctx.strokeStyle='rgba(123,226,169,.09)';ctx.stroke(); }
    // table light
    const glow=ctx.createRadialGradient(w/2,h/2,10,w/2,h/2,w*.55);glow.addColorStop(0,'rgba(73,221,166,.045)');glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    for (const paddle of state.paddles) {
      ctx.save();ctx.shadowBlur=20;ctx.shadowColor=paddle.color;ctx.fillStyle=paddle.color;
      ctx.beginPath();ctx.arc(paddle.x,paddle.y,paddle.r,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;ctx.fillStyle='#07120c';ctx.beginPath();ctx.arc(paddle.x,paddle.y,paddle.r*.43,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(paddle.x,paddle.y,paddle.r*.76,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    if (state.puck) {
      const p=state.puck;
      ctx.save();ctx.shadowBlur=22;ctx.shadowColor='#d9f7e8';ctx.fillStyle='#f2fff7';
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;ctx.fillStyle='#8fa99a';ctx.beginPath();ctx.arc(p.x-3,p.y-3,p.r*.35,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    // tiny decorative corner marks
    
  }
  function loop(now) {
    if (!state.running || state.paused) return;
    if (state.online) {
      applyOnlineSnapshot();
      draw();
      state.raf = requestAnimationFrame(loop);
      return;
    }
    const dt = Math.min(2, (now - state.lastTime) / 16.6667 || 1);
    state.lastTime = now;
    update(dt);
    draw();
    state.raf = requestAnimationFrame(loop);
  }
  function pause() {
    if (state.online) return;
    if (state.matchOver || !state.running) return;
    state.paused = !state.paused;
    $('#pauseOverlay').hidden = !state.paused;
    if (state.paused) {
      $('#pauseOverlay').innerHTML = '<strong>PAUSED</strong><span>Press SPACE or RESUME</span>';
      $('#pauseButton').textContent = 'RESUME';
      cancelAnimationFrame(state.raf);
    } else {
      $('#pauseButton').textContent = 'PAUSE';
      state.lastTime = performance.now();
      state.raf = requestAnimationFrame(loop);
    }
  }
  function restart() { if (!state.online) setupMatch(); }
  $('#startButton').addEventListener('click', () => { if (state.mode !== 'online') { document.documentElement.requestFullscreen?.().catch?.(() => {}); setupMatch(); } });
  $('#pauseButton').addEventListener('click', pause);
  $('#restartButton').addEventListener('click', restart);
  $('#changeModeButton').addEventListener('click', () => {
    if (state.online || state.onlineRoomCode) leaveOnline();
    $('#roomLobby').hidden = true; $('#roomCodeInput').value = ''; roomStatus('Create a room or enter a code to join.');
    state.running = false; state.paused = false; state.matchOver = false;
    cancelAnimationFrame(state.raf);
    clearTimeout(state.countdownTimer); clearTimeout(state.goalTimer); clearTimeout(state.flashTimer);
    state.keys = {}; state.touchPointers.clear();
    $('#gamePanel').hidden = true; $('#modePanel').hidden = false;
  });
  window.addEventListener('keydown', event => {
    if (['ArrowUp','ArrowDown','Space'].includes(event.code)) event.preventDefault();
    state.keys[event.code] = true;
    if (state.online) sendOnlineInput();
    if (event.code === 'Space' && !$('#gamePanel').hidden && !state.online) pause();
  });
  window.addEventListener('keyup', event => { state.keys[event.code] = false; if (state.online) sendOnlineInput(); });
  // Touch / pointer: drag a striker vertically on its own half.
  canvas.addEventListener('pointerdown', event => {
    if (!state.running || state.paused) return;
    canvas.setPointerCapture(event.pointerId);
    const rect=canvas.getBoundingClientRect(), x=event.clientX-rect.left, y=event.clientY-rect.top;
    const side = state.mode === 'solo' || (state.online && state.onlineSide === 'left') ? 'left' : (x < rect.width / 2 ? 'left' : 'right');
    const candidates = state.paddles.filter(p => p.side === side && !(state.mode === 'solo' && p.side === 'right') && (!state.online || p.side === state.onlineSide));
    if (!candidates.length) return;
    const closest=candidates.reduce((a,b)=>Math.abs(a.y-y)<Math.abs(b.y-y)?a:b);
    state.touchPointers.set(event.pointerId,closest);
    closest.y=Math.max(closest.r,Math.min(state.height-closest.r,y)); if (state.online) sendOnlineInput(y / rect.height);
  });
  canvas.addEventListener('pointermove', event => {
    const paddle=state.touchPointers.get(event.pointerId);
    if (!paddle) return;
    const rect=canvas.getBoundingClientRect(), y=event.clientY-rect.top;
    paddle.y=Math.max(paddle.r+8,Math.min(state.height-paddle.r-8,y)); if (state.online) sendOnlineInput(y / rect.height);
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(type => canvas.addEventListener(type,event=>state.touchPointers.delete(event.pointerId)));
  // Online Duel uses the site's existing authenticated Socket.IO connection.
  const socket = window.mainSocket;
  let onlineInput = { up: false, down: false, y: null };
  function roomStatus(message) { $('#roomStatus').textContent = message; }
  function renderRoomPlayers(players = []) {
    const host = players.find(player => player.side === 'left');
    const guest = players.find(player => player.side === 'right');
    const card = (player, label) => player
      ? `<div class="room-player"><span class="player-avatar">${String(player.name || '?').slice(0,1).toUpperCase()}</span><span>${escapeText(player.name || 'Player')}<small>${label}</small></span></div>`
      : `<div class="room-player empty"><span class="player-avatar">+</span><span>Waiting for player 2<small>Share the room code</small></span></div>`;
    $('#roomPlayers').innerHTML = card(host, 'HOST') + card(guest, 'PLAYER 2');
  }
  function escapeText(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  function sendOnlineInput(y = null) {
    if (!socket?.connected || !state.onlineRoomCode) return;
    onlineInput = {
      up: !!(state.keys.KeyW || state.keys.ArrowUp),
      down: !!(state.keys.KeyS || state.keys.ArrowDown),
      y: Number.isFinite(y) ? Math.max(0, Math.min(1, y)) : null
    };
    socket.emit('hockey:input', onlineInput);
  }
  function applyOnlineSnapshot() {
    const snap = state.onlineSnapshot;
    if (!snap) return;
    const sx = state.width / 1000, sy = state.height / 530;
    state.leftScore = snap.score.left; state.rightScore = snap.score.right;
    $('#leftScore').textContent = state.leftScore; $('#rightScore').textContent = state.rightScore;
    state.puck = { ...snap.puck, x: snap.puck.x * sx, y: snap.puck.y * sy, r: snap.puck.r * Math.min(sx, sy) };
    state.paddles = snap.paddles.map(p => ({ ...p, x: p.x * sx, y: p.y * sy, r: p.r * Math.min(sx, sy), vy: 0, color: p.side === 'left' ? COLORS.mint : COLORS.orange }));
    if (snap.status === 'finished') {
      state.running = false; state.matchOver = true;
      $('#pauseOverlay').hidden = false;
      const winner = snap.winner === socket.id ? 'YOU WIN' : 'YOU LOSE';
      $('#pauseOverlay').innerHTML = `<strong>${winner}</strong><span>${state.leftScore} — ${state.rightScore}</span><span>Return to modes for another match</span>`;
      $('#pauseButton').disabled = true;
    }
    if (snap.status === 'playing' && !state.onlineStarted) {
      state.onlineStarted = true; state.running = true; state.paused = false;
      $('#countdown').hidden = true; $('#pauseOverlay').hidden = true;
      state.lastTime = performance.now(); cancelAnimationFrame(state.raf); state.raf = requestAnimationFrame(loop);
    }
  }
  function enterOnlineGame(payload) {
    state.mode = 'online'; state.online = true; state.onlineRoomCode = payload.code; state.onlineSide = payload.side;
    state.onlineSnapshot = payload.snapshot; state.onlineStarted = false;
    state.running = true; state.paused = false; state.matchOver = false;
    $('#modePanel').hidden = true; $('#gamePanel').hidden = false;
    $('#modeLabel').textContent = 'ONLINE DUEL';
    state.target = payload.target || state.target;
    const me = payload.players?.find(player => player.id === socket.id);
    const opponent = payload.players?.find(player => player.id !== socket.id);
    $('#leftLabel').textContent = payload.side === 'left' ? 'YOU' : (opponent?.name || 'PLAYER 1');
    $('#rightLabel').textContent = payload.side === 'right' ? 'YOU' : (opponent?.name || 'PLAYER 2');
    $('#matchState').textContent = 'FIRST TO ' + state.target;
    $('#controlsText').textContent = 'W / S or drag your striker';
    $('#pauseButton').disabled = true; $('#restartButton').disabled = true;
    $('#pauseButton').textContent = 'PAUSE';
    $('#pauseOverlay').hidden = true; resize();
    applyOnlineSnapshot();
  }
  function leaveOnline() {
    if (socket?.connected && state.onlineRoomCode) socket.emit('hockey:room:leave');
    state.online = false; state.onlineRoomCode = null; state.onlineSide = null; state.onlineSnapshot = null; state.onlineStarted = false;
    state.running = false; state.paused = false; state.matchOver = false;
    cancelAnimationFrame(state.raf); $('#pauseButton').disabled = false; $('#restartButton').disabled = false;
  }
  function joinRoomFromUrl() {
    const code = new URLSearchParams(window.location.search).get('room');
    if (!code || !/^[A-Z0-9]{6}$/i.test(code)) return;
    setMode('online');
    $('#roomCodeInput').value = code.toUpperCase();
    if (!socket?.connected) return;
    socket.emit('hockey:room:join', { code: code.toUpperCase() });
  }


  function renderAvailableRooms(rooms = []) {
    const list = $('#availableRooms');
    const openRooms = rooms.filter(room => room.gameKey === 'hockey' && room.status === 'waiting' && room.playerCount < room.maxPlayers && room.code !== state.onlineRoomCode);
    $('#roomCount').textContent = `${openRooms.length} ${openRooms.length === 1 ? 'room' : 'rooms'}`;
    if (!openRooms.length) {
      list.innerHTML = '<div class="rooms-empty">No open rooms right now. Create one and invite a friend.</div>';
      return;
    }
    list.innerHTML = openRooms.map(room => {
      const host = room.players?.[0]?.name || 'Player';
      return `<div class="available-room"><div class="room-host"><span class="room-avatar">${escapeText(host.slice(0,1).toUpperCase())}</span><span><strong>${escapeText(host)}</strong><small>Air Hockey · First to ${Number(room.target) || 7}</small></span></div><span class="room-slots">${room.playerCount}/2</span><button class="quiet-button room-join" type="button" data-join-room="${escapeText(room.code)}">JOIN</button></div>`;
    }).join('');
  }
  $('#availableRooms').addEventListener('click', event => {
    const button = event.target.closest('[data-join-room]');
    if (!button) return;
    $('#roomCodeInput').value = button.dataset.joinRoom;
    if (!socket?.connected) return roomStatus('Connect to the server before joining.');
    socket.emit('hockey:room:join', { code: button.dataset.joinRoom });
  });
  $('#backToModesButton').addEventListener('click', () => setMode('solo'));
  if (socket) {
    socket.on('hockey:rooms:list', rooms => {
      window.dispatchEvent(new CustomEvent('hockey:rooms:list', { detail: rooms || [] }));
    });
    socket.on('hockey:room:created', data => {
      state.onlineRoomCode = data.code;
      currentRoomIsHost = true;
      $('#roomLobby').hidden = false; $('#roomCodeDisplay').textContent = data.code;
      $('#onlineStartButton').disabled = true;
      $('#roomHostHint').textContent = 'You are the host. Start becomes available when player 2 joins.';
      renderRoomPlayers([{ name: 'You', side: 'left' }]);
      roomStatus('Share this code with your opponent.');

    });
    socket.on('hockey:room:joined', data => {
      state.onlineRoomCode = data.code;
      currentRoomIsHost = false;
      $('#roomLobby').hidden = false;
      $('#roomCodeDisplay').textContent = data.code;
      $('#onlineStartButton').disabled = true;
      $('#roomHostHint').textContent = 'Waiting for the room host to start the match.';
      roomStatus('You joined the room.');
    });
    socket.on('hockey:room:update', data => {
      if (data.code !== state.onlineRoomCode) return;
      $('#roomLobby').hidden = false;
      $('#roomCodeDisplay').textContent = data.code;
      currentRoomIsHost = data.isHost === true;
      const canStart = currentRoomIsHost && data.players.length === 2 && data.snapshot?.status === 'waiting';
      $('#onlineStartButton').disabled = !canStart;
      $('#onlineStartButton').textContent = canStart ? 'START MATCH' : currentRoomIsHost ? 'WAITING FOR PLAYER' : 'HOST STARTS';
      $('#roomHostHint').textContent = currentRoomIsHost
        ? (canStart ? 'Both players are here. You can start.' : 'You are the host. Waiting for player 2.')
        : 'Only the room host can start the match.';
      renderRoomPlayers(data.players || []);
      roomStatus(data.players.length === 2 ? 'Both players are in the room.' : 'Waiting for another player…');
      if (data.snapshot) state.onlineSnapshot = data.snapshot;
    });
    socket.on('hockey:match:started', data => enterOnlineGame(data));
    socket.on('hockey:state', snapshot => { if (state.online) { state.onlineSnapshot = snapshot; applyOnlineSnapshot(); } });
    socket.on('hockey:goal', data => { if (!state.online) return; const flash = $('#goalFlash'); flash.hidden = false; flash.textContent = data.side === state.onlineSide ? 'GOAL' : 'CONCEDED'; clearTimeout(state.flashTimer); state.flashTimer = setTimeout(() => { flash.hidden = true; }, 650); });
    socket.on('hockey:error', data => roomStatus(data?.message || 'Something went wrong.'));
    socket.on('hockey:opponent:left', () => {
      state.running = false; state.paused = true; cancelAnimationFrame(state.raf);
      $('#pauseOverlay').hidden = false; $('#pauseOverlay').innerHTML = '<strong>OPPONENT LEFT</strong><span>Return to modes to play again</span>';
    });
    socket.on('disconnect', () => { if (state.online) roomStatus('Connection lost. Reconnecting…'); });
    socket.on('connect', () => { if (state.online) roomStatus('Reconnected. Return to the room to continue.'); });
  }
  if (socket) {
    socket.on('connect', joinRoomFromUrl);
    if (socket.connected) joinRoomFromUrl();
  }

  $('#createRoomButton').addEventListener('click', () => {
    document.documentElement.requestFullscreen?.().catch?.(() => {});
    if (!socket?.connected) return roomStatus('Please sign in and wait for the connection.');
    setMode('online');
    socket.emit('hockey:room:create', { target: Number($('#targetScore').value) });
  });
  $('#joinRoomButton').addEventListener('click', () => {
    document.documentElement.requestFullscreen?.().catch?.(() => {});
    if (!socket?.connected) return roomStatus('Please sign in and wait for the connection.');
    const code = $('#roomCodeInput').value.trim().toUpperCase();
    if (code.length !== 6) return roomStatus('Enter the 6-character room code.');
    setMode('online');
    socket.emit('hockey:room:join', { code });
  });
  $('#onlineStartButton').addEventListener('click', () => {
    if (!currentRoomIsHost || $('#onlineStartButton').disabled) return;
    document.documentElement.requestFullscreen?.().catch?.(() => {});
    socket?.emit('hockey:room:start');
  });
  $('#copyRoomButton').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(state.onlineRoomCode || $('#roomCodeDisplay').textContent); roomStatus('Room code copied.'); }
    catch { roomStatus('Could not copy. Select the room code to copy it.'); }
  });
  $('#fullscreenButton').addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch { roomStatus('Full screen is not available in this browser.'); }
  });
  document.addEventListener('fullscreenchange', () => { $('#fullscreenButton').textContent = document.fullscreenElement ? 'EXIT FULL SCREEN' : 'FULL SCREEN'; setTimeout(resize, 80); });
  // Full-viewport presentation is the default; browser fullscreen requires a user gesture.

  setMode('solo');
  // Draw a table preview before a match starts.
  state.width = 1000; state.height = 530; makePaddles(); resetPuck(); resize();
})();
