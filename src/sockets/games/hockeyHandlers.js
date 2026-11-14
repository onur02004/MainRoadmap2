import { setGameActivity, getOnlineUser } from '../presence/presenceManager.js';

const rooms = new Map();

function updatePresence(io, socketId, state) {
  const playerSocket = io.sockets.sockets.get(socketId);
  if (!playerSocket?.user) return;
  const game = state ? { key: 'hockey', name: 'Air Hockey', state } : null;
  if (setGameActivity(playerSocket.user.id, socketId, game)) {
    io.emit('presence:user-activity', getOnlineUser(playerSocket.user.id));
  }
}

function publicRooms() {
  return [...rooms.values()]
    .filter(room => room.status === 'waiting' || room.status === 'playing')
    .map(room => ({
      code: room.code,
      gameKey: 'hockey',
      gameName: 'Air Hockey',
      status: room.status,
      players: room.players.filter(Boolean).map(player => ({
        name: player.name,
        side: player.side
      })),
      playerCount: room.players.filter(Boolean).length,
      maxPlayers: 2,
      target: room.target
    }));
}

function broadcastRooms(io) {
  io.emit('hockey:rooms:list', publicRooms());
}
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const WORLD = { width: 1000, height: 530 };

function makeCode() {
  let code;
  do {
    code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function makePuck(direction = Math.random() > 0.5 ? 1 : -1) {
  return { x: 500, y: 265, vx: direction * 5.2, vy: (Math.random() - 0.5) * 2.8, r: 11 };
}

function makeRoom(code, host, target) {
  return {
    code, hostId: host.id, target, status: 'waiting', players: [
      { id: host.id, name: host.user.user_name, side: 'left', input: { up: false, down: false, y: null }, y: 265, connected: true },
      null
    ],
    score: { left: 0, right: 0 }, puck: makePuck(), winner: null,
    interval: null, goalLock: false, lastEmit: 0
  };
}

function snapshot(room) {
  return {
    code: room.code, status: room.status, target: room.target,
    score: { ...room.score }, puck: { ...room.puck }, winner: room.winner,
    paddles: room.players.filter(Boolean).map(p => ({ side: p.side, x: p.side === 'left' ? 120 : 880, y: p.y, r: 23 }))
  };
}

function emitRoom(io, room) {
  io.to(room.code).emit('hockey:room:update', {
    code: room.code,
    isHost: false,
    players: room.players.filter(Boolean).map(p => ({ id: p.id, name: p.name, side: p.side })),
    snapshot: snapshot(room)
  });
  const host = io.sockets.sockets.get(room.hostId);
  if (host) host.emit('hockey:room:update', {
    code: room.code, isHost: true,
    players: room.players.filter(Boolean).map(p => ({ id: p.id, name: p.name, side: p.side })),
    snapshot: snapshot(room)
  });
  broadcastRooms(io);
}

function finishRoom(io, room, winner) {
  room.status = 'finished';
  room.winner = winner;
  if (room.interval) clearInterval(room.interval);
  room.interval = null;
  io.to(room.code).emit('hockey:state', snapshot(room));
  broadcastRooms(io);
}

function stepRoom(io, room) {
  if (room.status !== 'playing' || room.goalLock) return;
  const puck = room.puck;
  for (const player of room.players) {
    if (!player) continue;
    const input = player.input;
    if (Number.isFinite(input.y)) {
      player.y = Math.max(31, Math.min(WORLD.height - 31, input.y * WORLD.height));
    } else {
      const direction = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      player.y = Math.max(31, Math.min(WORLD.height - 31, player.y + direction * 6));
    }
  }

  puck.x += puck.vx;
  puck.y += puck.vy;
  if (puck.y - puck.r < 8) { puck.y = 8 + puck.r; puck.vy = Math.abs(puck.vy) * 0.97; }
  if (puck.y + puck.r > WORLD.height - 8) { puck.y = WORLD.height - 8 - puck.r; puck.vy = -Math.abs(puck.vy) * 0.97; }
  const goalTop = WORLD.height * 0.34, goalBottom = WORLD.height * 0.66;
  if (puck.x - puck.r < 12 && (puck.y < goalTop || puck.y > goalBottom)) { puck.x = 12 + puck.r; puck.vx = Math.abs(puck.vx) * 0.96; }
  if (puck.x + puck.r > WORLD.width - 12 && (puck.y < goalTop || puck.y > goalBottom)) { puck.x = WORLD.width - 12 - puck.r; puck.vx = -Math.abs(puck.vx) * 0.96; }

  for (const player of room.players) {
    if (!player) continue;
    const px = player.side === 'left' ? 120 : 880;
    const dx = puck.x - px, dy = puck.y - player.y;
    const dist = Math.hypot(dx, dy), min = puck.r + 23;
    if (dist < min && dist > 0) {
      const nx = dx / dist, ny = dy / dist;
      puck.x = px + nx * min; puck.y = player.y + ny * min;
      puck.vx = (player.side === 'left' ? 1 : -1) * Math.min(10.5, Math.max(4.2, Math.abs(puck.vx) + 0.8));
      puck.vy = Math.max(-8.5, Math.min(8.5, puck.vy + ny * 3.4));
    }
  }

  let scored = null;
  if (puck.x < -puck.r) { room.score.right++; scored = 'right'; }
  else if (puck.x > WORLD.width + puck.r) { room.score.left++; scored = 'left'; }
  if (scored) {
    room.goalLock = true;
    io.to(room.code).emit('hockey:goal', { side: scored, score: { ...room.score } });
    if (room.score.left >= room.target || room.score.right >= room.target) {
      const winnerPlayer = room.players.find(p => p?.side === (room.score.left > room.score.right ? 'left' : 'right'));
      finishRoom(io, room, winnerPlayer?.id || null);
    } else {
      setTimeout(() => {
        if (room.status !== 'playing') return;
        room.puck = makePuck(scored === 'left' ? -1 : 1);
        room.goalLock = false;
      }, 850);
    }
  }
  io.to(room.code).volatile.emit('hockey:state', snapshot(room));
}

export const registerHockeyHandlers = (io, socket) => {
  const sendError = message => socket.emit('hockey:error', { message });
  socket.emit('hockey:rooms:list', publicRooms());

  socket.on('hockey:room:create', payload => {
    if ([...rooms.values()].some(room => room.players.some(p => p?.id === socket.id))) return sendError('You are already in a room.');
    const target = [5, 7, 10].includes(Number(payload?.target)) ? Number(payload.target) : 7;
    const code = makeCode();
    const room = makeRoom(code, socket, target);
    rooms.set(code, room);
    socket.join(code);
    socket.emit('hockey:room:created', { code, target });
    updatePresence(io, socket.id, 'lobby');
    emitRoom(io, room);
  });

  socket.on('hockey:room:join', payload => {
    const code = String(payload?.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return sendError('Room not found. Check the code and try again.');
    if (room.status !== 'waiting') return sendError('This match has already started.');
    if (room.players.some(p => p?.id === socket.id)) return sendError('You are already in this room.');
    if (room.players[1]) return sendError('This room is full.');
    room.players[1] = { id: socket.id, name: socket.user.user_name, side: 'right', input: { up: false, down: false, y: null }, y: 265, connected: true };
    socket.join(code);
    socket.emit('hockey:room:joined', { code, target: room.target });
    updatePresence(io, socket.id, 'lobby');
    emitRoom(io, room);
  });

  socket.on('hockey:room:start', () => {
    const room = [...rooms.values()].find(r => r.hostId === socket.id);
    if (!room) return sendError('Only the room creator can start the match.');
    if (room.status !== 'waiting' || room.players.some(p => !p)) return sendError('Wait until both players have joined.');
    room.status = 'playing'; room.score = { left: 0, right: 0 }; room.puck = makePuck(); room.goalLock = false;
    room.players.forEach(p => { p.y = 265; p.input = { up: false, down: false, y: null }; });
    room.players.forEach(p => {
      updatePresence(io, p.id, 'playing');
      const playerSocket = io.sockets.sockets.get(p.id);
      playerSocket?.emit('hockey:match:started', {
        code: room.code, side: p.side, target: room.target,
        players: room.players.map(x => ({ id: x.id, name: x.name, side: x.side })),
        snapshot: snapshot(room)
      });
    });
    room.interval = setInterval(() => stepRoom(io, room), 1000 / 30);
    room.interval.unref?.();
    broadcastRooms(io);
  });

  socket.on('hockey:input', payload => {
    const room = [...rooms.values()].find(r => r.status === 'playing' && r.players.some(p => p?.id === socket.id));
    if (!room || !payload || typeof payload !== 'object') return;
    const player = room.players.find(p => p?.id === socket.id);
    player.input = {
      up: payload.up === true,
      down: payload.down === true,
      y: Number.isFinite(payload.y) ? Math.max(0, Math.min(1, payload.y)) : null
    };
  });

  const leaveRoom = () => {
    const room = [...rooms.values()].find(r => r.players.some(p => p?.id === socket.id));
    if (!room) return;
    socket.leave(room.code);
    if (room.interval) clearInterval(room.interval);
    for (const player of room.players.filter(Boolean)) {
      updatePresence(io, player.id, null);
    }
    rooms.delete(room.code);
    io.to(room.code).emit('hockey:opponent:left');
    broadcastRooms(io);
  };
  socket.on('hockey:room:leave', leaveRoom);
  socket.on('disconnect', leaveRoom);
};
