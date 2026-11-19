import { setGameActivity, getOnlineUser } from '../presence/presenceManager.js';

const games = new Map();
const COLORS = ['red', 'yellow', 'blue', 'black'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ROOMS = 250;
const RECONNECT_GRACE_MS = 90_000;

const safeName = value => String(value || 'Player').slice(0, 24);
const shuffle = array => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};
const makeCode = () => {
  let code;
  do {
    code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (games.has(code));
  return code;
};
const makeDeck = () => {
  const tiles = [];
  let id = 1;
  for (let copy = 0; copy < 2; copy++) {
    for (const color of COLORS) {
      for (let value = 1; value <= 13; value++) tiles.push({ id: id++, color, value, kind: 'normal' });
    }
  }
  tiles.push({ id: id++, color: 'fake', value: 0, kind: 'fake' });
  tiles.push({ id: id++, color: 'fake', value: 0, kind: 'fake' });
  return shuffle(tiles);
};
const nextValue = value => value === 13 ? 1 : value + 1;
const publicTile = (tile, indicator, joker) => {
  if (!tile) return null;
  return { ...tile, isOkey: tile.kind === 'normal' && tile.color === joker.color && tile.value === joker.value,
    isFakeJoker: tile.kind === 'fake', jokerValue: indicator.value, jokerColor: indicator.color };
};
const getMeldValue = (tiles, indicator, joker) => tiles.reduce((sum, tile) => {
  if (tile.kind === 'fake') return sum + indicator.value;
  if (tile.color === joker.color && tile.value === joker.value) return sum + 0;
  return sum + tile.value;
}, 0);

function canFormMeld(tiles, joker) {
  if (!Array.isArray(tiles) || tiles.length < 3 || tiles.length > 13) return false;
  const wild = tiles.filter(t => t.kind === 'fake' || (t.color === joker.color && t.value === joker.value)).length;
  const natural = tiles.filter(t => !(t.kind === 'fake' || (t.color === joker.color && t.value === joker.value)));
  if (!natural.length) return true;

  // Same-number group: each natural tile has a different colour.
  if (natural.every(t => t.value === natural[0].value) &&
      new Set(natural.map(t => t.color)).size === natural.length &&
      natural.length + wild <= 4) return true;

  // Same-colour consecutive run. Jokers may fill gaps; Ace is low only.
  if (natural.every(t => t.color === natural[0].color) &&
      new Set(natural.map(t => t.value)).size === natural.length) {
    const values = natural.map(t => t.value).sort((a, b) => a - b);
    const span = values[values.length - 1] - values[0] + 1;
    if (span <= tiles.length && span - natural.length <= wild && tiles.length <= 13) return true;
    // A joker may extend either end of a run.
    for (let start = 1; start + tiles.length - 1 <= 13; start++) {
      const slots = new Set(Array.from({ length: tiles.length }, (_, i) => start + i));
      if (values.every(v => slots.has(v)) && tiles.length - natural.length === wild) return true;
    }
  }
  return false;
}

function canPartition(tiles, joker, memo = new Map()) {
  if (tiles.length === 0) return true;
  if (tiles.length > 14) return false;
  const key = tiles.map(t => t.id).sort((a, b) => a - b).join(',');
  if (memo.has(key)) return memo.get(key);
  const first = tiles[0];
  const rest = tiles.slice(1);
  for (let size = 3; size <= Math.min(13, tiles.length); size++) {
    let found = false;
    const choose = (start, picked) => {
      if (found) return;
      if (picked.length === size - 1) {
        const meld = [first, ...picked];
        if (canFormMeld(meld, joker)) {
          const used = new Set(meld.map(t => t.id));
          if (canPartition(tiles.filter(t => !used.has(t.id)), joker, memo)) found = true;
        }
        return;
      }
      for (let i = start; i < rest.length && !found; i++) choose(i + 1, [...picked, rest[i]]);
    };
    choose(0, []);
    if (found) { memo.set(key, true); return true; }
  }
  memo.set(key, false);
  return false;
}

function makeRoom(code, type, socket) {
  return {
    code, type, hostId: socket.user.id, status: 'waiting',
    players: [{ userId: socket.user.id, socketId: socket.id, name: safeName(socket.user.user_name), connected: true, hand: [], opened: false, score: 0 }, null, null, null],
    deck: [], discard: [], indicator: null, joker: null, current: 0, hasDrawn: false,
    table: [], round: 1, winner: null, createdAt: Date.now(), reconnectTimers: new Map()
  };
}
const playerIndex = (room, userId) => room.players.findIndex(p => p?.userId === userId);
const activePlayers = room => room.players.filter(Boolean);
const currentPlayer = room => room.players[room.current];
const tileById = (room, id) => room.players.flatMap(p => p?.hand || []).find(t => t.id === Number(id));

function roomList() {
  return [...games.values()].filter(r => ['waiting', 'playing'].includes(r.status)).map(r => ({
    code: r.code, gameKey: r.type, gameName: r.type === 'okey' ? 'Okey' : '101 Okey',
    status: r.status, playerCount: activePlayers(r).length, maxPlayers: 4,
    players: r.players.filter(Boolean).map(p => ({ name: p.name, connected: p.connected })),
    round: r.round
  }));
}
function broadcastRoomList(io) { io.emit('tiles:rooms:list', roomList()); }
function playerView(room, index) {
  const player = room.players[index];
  return {
    code: room.code, game: room.type, status: room.status, round: room.round,
    players: room.players.map((p, i) => p ? ({ seat: i, name: p.name, connected: p.connected, opened: p.opened, score: p.score, isYou: i === index }) : null),
    you: index, current: room.current, hasDrawn: room.hasDrawn && room.current === index,
    hand: player ? player.hand.map(t => publicTile(t, room.indicator, room.joker)) : [],
    indicator: room.indicator && publicTile(room.indicator, room.indicator, room.joker),
    joker: room.joker, discardTop: room.discard.length ? publicTile(room.discard[room.discard.length - 1], room.indicator, room.joker) : null,
    stockCount: room.deck.length, table: room.table.map(m => ({ owner: m.owner, tiles: m.tiles.map(id => {
      const t = room.tableTiles?.get(id);
      return t ? publicTile(t, room.indicator, room.joker) : null;
    }).filter(Boolean) })),
    message: room.message || null, winner: room.winner
  };
}
function emitState(io, room) {
  for (let i = 0; i < room.players.length; i++) {
    const p = room.players[i];
    if (!p?.socketId) continue;
    io.to(p.socketId).emit('tiles:state', playerView(room, i));
  }
  broadcastRoomList(io);
}
function updateActivity(io, socket, state) {
  if (!socket?.user) return;
  const name = socket.data?.tileGameName || 'Okey';
  const game = state ? { key: socket.data?.tileGameKey || 'okey', name, state } : null;
  if (setGameActivity(socket.user.id, socket.id, game)) io.emit('presence:user-activity', getOnlineUser(socket.user.id));
}
function deal(room) {
  room.deck = makeDeck();
  const indicatorCandidates = room.deck.filter(tile => tile.kind === 'normal');
  room.indicator = indicatorCandidates[Math.floor(Math.random() * indicatorCandidates.length)];
  room.deck = room.deck.filter(tile => tile.id !== room.indicator.id);
  room.joker = { color: room.indicator.color, value: nextValue(room.indicator.value) };
  room.discard = [];
  room.table = [];
  room.tableTiles = new Map();
  const count = room.type === 'okey' ? 14 : 21;
  room.players.forEach((p, i) => {
    if (!p) return;
    p.hand = room.deck.splice(0, count + (i === 0 ? 1 : 0));
    p.hand.sort((a, b) => COLORS.indexOf(a.color) - COLORS.indexOf(b.color) || a.value - b.value || a.id - b.id);
    p.opened = false;
  });
  room.current = 0;
  room.hasDrawn = true; // Seat zero starts with the extra tile.
  room.status = 'playing';
  room.winner = null;
  room.message = `${room.players[0].name} starts.`;
}
function ensureTurn(room, socket) {
  const index = playerIndex(room, socket.user.id);
  if (index < 0) throw new Error('You are not seated in this room.');
  if (room.status !== 'playing') throw new Error('The game is not running.');
  if (room.current !== index) throw new Error('It is not your turn.');
  return { index, player: room.players[index] };
}
function sendError(socket, message) { socket.emit('tiles:error', { message }); }

function startIfReady(io, room) {
  if (activePlayers(room).length !== 4) return;
  deal(room);
  for (const player of room.players) {
    const playerSocket = player?.socketId ? io.sockets.sockets.get(player.socketId) : null;
    if (playerSocket) updateActivity(io, playerSocket, 'playing');
  }
  emitState(io, room);
}
function cleanupRoom(io, room) {
  if (room.reconnectTimers) for (const timer of room.reconnectTimers.values()) clearTimeout(timer);
  games.delete(room.code);
  broadcastRoomList(io);
}

function finishGame(io, room, winnerIndex, winningTile = null) {
  const winner = room.players[winnerIndex];
  room.status = 'finished';
  room.winner = winner?.name || 'Unknown';
  room.players.forEach((p, i) => {
    if (!p || i === winnerIndex) return;
    if (room.type === 'okey101') {
      p.score += p.opened ? p.hand.reduce((sum, t) => sum + (t.kind === 'fake' ? room.indicator.value : t.value), 0) : 202;
    } else {
      const doubled = winningTile && winningTile.kind === 'normal' &&
        winningTile.color === room.joker.color && winningTile.value === room.joker.value;
      p.score += doubled ? 40 : 20;
    }
  });
  room.message = `${room.winner} wins!`;
  for (const p of room.players) {
    const playerSocket = p?.socketId ? io.sockets.sockets.get(p.socketId) : null;
    if (playerSocket) updateActivity(io, playerSocket, null);
  }
}

export const registerOkeyHandlers = (io, socket) => {
  socket.emit('tiles:rooms:list', roomList());

  socket.on('tiles:rooms:list:request', () => socket.emit('tiles:rooms:list', roomList()));

  socket.on('tiles:room:create', payload => {
    try {
      const type = payload?.game === '101' ? 'okey101' : payload?.game === 'okey101' ? 'okey101' : 'okey';
      if (games.size >= MAX_ROOMS) throw new Error('Room capacity reached. Try again later.');
      if ([...games.values()].some(r => playerIndex(r, socket.user.id) >= 0)) throw new Error('You are already in a tile-game room.');
      const code = makeCode();
      const room = makeRoom(code, type, socket);
      room.players[0].socketId = socket.id;
      games.set(code, room);
      socket.join(code);
      socket.data.tileRoom = code;
      socket.data.tileGameKey = type;
      socket.data.tileGameName = type === 'okey' ? 'Okey' : '101 Okey';
      updateActivity(io, socket, 'lobby');
      socket.emit('tiles:room:created', { code, game: type });
      emitState(io, room);
    } catch (error) { sendError(socket, error.message); }
  });

  socket.on('tiles:room:join', payload => {
    try {
      const code = String(payload?.code || '').trim().toUpperCase();
      const room = games.get(code);
      if (!room) throw new Error('Room not found.');
      if (room.status !== 'waiting') throw new Error('This game has already started.');
      if ([...games.values()].some(r => playerIndex(r, socket.user.id) >= 0)) throw new Error('You are already in a tile-game room.');
      const index = room.players.findIndex(p => !p);
      if (index < 0) throw new Error('This room is full.');
      room.players[index] = { userId: socket.user.id, socketId: socket.id, name: safeName(socket.user.user_name), connected: true, hand: [], opened: false, score: 0 };
      socket.join(code);
      socket.data.tileRoom = code;
      socket.data.tileGameKey = room.type;
      socket.data.tileGameName = room.type === 'okey' ? 'Okey' : '101 Okey';
      updateActivity(io, socket, 'lobby');
      socket.emit('tiles:room:joined', { code, game: room.type });
      startIfReady(io, room);
      emitState(io, room);
    } catch (error) { sendError(socket, error.message); }
  });

  socket.on('tiles:room:rejoin', payload => {
    const room = games.get(String(payload?.code || '').trim().toUpperCase());
    if (!room) return sendError(socket, 'Room is no longer available.');
    const index = playerIndex(room, socket.user.id);
    if (index < 0) return sendError(socket, 'You are not a member of this room.');
    const player = room.players[index];
    const timer = room.reconnectTimers.get(socket.user.id);
    if (timer) clearTimeout(timer);
    room.reconnectTimers.delete(socket.user.id);
    player.socketId = socket.id;
    player.connected = true;
    socket.join(room.code);
    socket.data.tileRoom = room.code;
    socket.data.tileGameKey = room.type;
    socket.data.tileGameName = room.type === 'okey' ? 'Okey' : '101 Okey';
    updateActivity(io, socket, room.status === 'playing' ? 'playing' : 'lobby');
    emitState(io, room);
  });

  socket.on('tiles:draw', payload => {
    try {
      const { player } = ensureTurn([...games.values()].find(r => r.code === socket.data.tileRoom), socket);
      const room = games.get(socket.data.tileRoom);
      if (room.hasDrawn) throw new Error('You have already drawn this turn.');
      let tile;
      if (payload?.from === 'discard') tile = room.discard.pop();
      else {
        if (!room.deck.length && room.discard.length > 1) {
          const top = room.discard.pop();
          room.deck = shuffle(room.discard);
          room.discard = [top];
        }
        tile = room.deck.pop();
      }
      if (!tile) throw new Error('No tile available in that pile.');
      player.hand.push(tile);
      player.hand.sort((a, b) => COLORS.indexOf(a.color) - COLORS.indexOf(b.color) || a.value - b.value || a.id - b.id);
      room.hasDrawn = true;
      room.message = `${player.name} drew a tile.`;
      emitState(io, room);
    } catch (error) { sendError(socket, error.message || 'Room not found.'); }
  });

  socket.on('tiles:discard', payload => {
    try {
      const room = games.get(socket.data.tileRoom);
      if (!room) throw new Error('Room not found.');
      const { index, player } = ensureTurn(room, socket);
      if (!room.hasDrawn) throw new Error('Draw a tile before discarding.');
      const tileIndex = player.hand.findIndex(t => t.id === Number(payload?.tileId));
      if (tileIndex < 0) throw new Error('That tile is not in your hand.');
      const [tile] = player.hand.splice(tileIndex, 1);
      room.discard.push(tile);
      const win = payload?.declareWin === true && (room.type === 'okey'
        ? player.hand.length === 14 && canPartition(player.hand, room.joker)
        : player.opened && player.hand.length === 0);
      if (payload?.declareWin && !win) {
        player.hand.push(tile);
        room.discard.pop();
        throw new Error('Your remaining tiles do not satisfy the winning condition.');
      }
      if (win) {
        finishGame(io, room, index, tile);
      } else {
        room.current = (index + 1) % 4;
        room.hasDrawn = false;
        room.message = `${player.name} discarded.`;
      }
      emitState(io, room);
    } catch (error) { sendError(socket, error.message); }
  });

  socket.on('tiles:lay', payload => {
    try {
      const room = games.get(socket.data.tileRoom);
      if (!room || room.type !== 'okey101') throw new Error('This action is only available in 101 Okey.');
      const { player } = ensureTurn(room, socket);
      if (!room.hasDrawn) throw new Error('Draw a tile first.');
      const sets = Array.isArray(payload?.sets) ? payload.sets : [];
      if (!sets.length || sets.length > 10) throw new Error('Select one or more valid melds.');
      const ids = sets.flat().map(Number);
      if (new Set(ids).size !== ids.length) throw new Error('A tile can only be used once.');
      const selected = ids.map(id => player.hand.find(t => t.id === id));
      if (selected.some(t => !t)) throw new Error('One or more selected tiles are not in your hand.');
      const melds = sets.map(set => set.map(id => player.hand.find(t => t.id === Number(id))));
      const pairsOpening = !player.opened && melds.length === 5 &&
        melds.every(m => m.length === 2 && m[0].kind === 'normal' && m[1].kind === 'normal' &&
          m[0].color === m[1].color && m[0].value === m[1].value);
      if (!pairsOpening && melds.some(m => !canFormMeld(m, room.joker))) {
        throw new Error('Every meld must be a valid run or group of at least three tiles.');
      }
      if (!player.opened) {
        const total = melds.flat().reduce((sum, t) => sum + (t.kind === 'fake' ? room.indicator.value : t.value), 0);
        if (total < 101 && !pairsOpening) throw new Error('You need at least 101 points or five identical pairs to open.');
        player.opened = true;
      }
      for (const meld of melds) {
        room.table.push({ owner: player.name, tiles: meld.map(t => t.id) });
        for (const t of meld) room.tableTiles.set(t.id, t);
      }
      const used = new Set(ids);
      player.hand = player.hand.filter(t => !used.has(t.id));
      if (player.hand.length === 0) {
        finishGame(io, room, playerIndex(room, socket.user.id));
      } else {
        room.message = `${player.name} laid ${ids.length} tiles.`;
      }
      emitState(io, room);
    } catch (error) { sendError(socket, error.message); }
  });

  socket.on('tiles:attach', payload => {
    try {
      const room = games.get(socket.data.tileRoom);
      if (!room || room.type !== 'okey101') throw new Error('This action is only available in 101 Okey.');
      const { player } = ensureTurn(room, socket);
      if (!room.hasDrawn || !player.opened) throw new Error('You must open before adding tiles.');
      const meldIndex = Number(payload?.meldIndex);
      const meld = room.table[meldIndex];
      const ids = (Array.isArray(payload?.tileIds) ? payload.tileIds : []).map(Number);
      if (!meld || !ids.length || ids.length > 13) throw new Error('Choose a table meld and one or more tiles.');
      if (new Set(ids).size !== ids.length) throw new Error('A tile can only be used once.');
      if (meld.tiles.length < 3) throw new Error('Pair melds cannot be extended.');
      const added = ids.map(id => player.hand.find(t => t.id === id));
      if (added.some(t => !t)) throw new Error('Selected tile is not in your hand.');
      const combined = [...meld.tiles.map(id => room.tableTiles.get(id)), ...added];
      if (!canFormMeld(combined, room.joker)) throw new Error('Those tiles cannot be added to this meld.');
      for (const t of added) room.tableTiles.set(t.id, t);
      meld.tiles.push(...ids);
      const used = new Set(ids);
      player.hand = player.hand.filter(t => !used.has(t.id));
      room.message = `${player.name} added ${ids.length} tile(s) to the table.`;
      emitState(io, room);
    } catch (error) { sendError(socket, error.message); }
  });

  socket.on('tiles:leave', () => {
    const room = games.get(socket.data.tileRoom);
    if (!room) return;
    const index = playerIndex(room, socket.user.id);
    if (index < 0) return;
    socket.leave(room.code);
    if (room.status === 'waiting') {
      room.players[index] = null;
      if (!activePlayers(room).length) cleanupRoom(io, room);
      else {
        if (room.hostId === socket.user.id) room.hostId = activePlayers(room)[0].userId;
        emitState(io, room);
      }
    } else {
      const p = room.players[index];
      p.connected = false;
      p.socketId = null;
      room.message = `${p.name} disconnected. Rejoin within 90 seconds.`;
      const timer = setTimeout(() => {
        const current = games.get(room.code);
        if (current && current.players[index]?.userId === p.userId && !current.players[index].connected) {
          current.status = 'finished';
          current.message = `${p.name} did not reconnect.`;
          emitState(io, current);
          setTimeout(() => cleanupRoom(io, current), 10_000);
        }
      }, RECONNECT_GRACE_MS);
      room.reconnectTimers.set(p.userId, timer);
      emitState(io, room);
    }
    socket.data.tileRoom = null;
    updateActivity(io, socket, null);
  });

  socket.on('disconnect', () => {
    const room = games.get(socket.data.tileRoom);
    if (!room) return;
    const index = playerIndex(room, socket.user.id);
    if (index < 0) return;
    const player = room.players[index];
    player.connected = false;
    const timer = setTimeout(() => {
      const current = games.get(room.code);
      if (current && current.players[index]?.userId === player.userId && !current.players[index].connected) {
        current.status = 'finished';
        current.message = `${player.name} disconnected.`;
        emitState(io, current);
        setTimeout(() => cleanupRoom(io, current), 10_000);
      }
    }, RECONNECT_GRACE_MS);
    room.reconnectTimers.set(player.userId, timer);
    emitState(io, room);
  });
};
