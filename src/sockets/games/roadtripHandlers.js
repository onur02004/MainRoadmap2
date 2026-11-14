import { query } from '../../config/db.js';
import { setGameActivity, getOnlineUser } from '../presence/presenceManager.js';

const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 8;
const ROLES = ['gas', 'brake', 'left', 'right'];
const WORLD_SCALE = 3.2;
const RECONNECT_GRACE_MS = 30000;
let catalogueConfig = null;

async function getGameConfig() {
  if (catalogueConfig) return catalogueConfig;
  const result = await query("SELECT config FROM game_catalog WHERE game_key = 'roadtrip' AND status = 'active' AND is_active = TRUE LIMIT 1");
  if (!result.rowCount) throw new Error('Co-Driver is not active in game_catalog.');
  catalogueConfig = result.rows[0].config || {};
  return catalogueConfig;
}
function makeCode() { let code; do { code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); } while (rooms.has(code)); return code; }
function playerByUser(room, userId) { return room.players.find(p => p.userId === userId); }
function roomForSocket(socketId) { return [...rooms.values()].find(r => r.players.some(p => p.socketId === socketId)); }
function roomForHost(userId) { return [...rooms.values()].find(r => r.hostUserId === userId && r.status === 'waiting'); }
function socketForPlayer(io, player) { return player?.socketId ? io.sockets.sockets.get(player.socketId) : null; }
function updatePresence(io, player, activity) {
  const s = socketForPlayer(io, player);
  if (!s?.user) return;
  const game = activity ? { key: 'roadtrip', name: 'Co-Driver', state: activity } : null;
  if (setGameActivity(s.user.id, s.id, game)) io.emit('presence:user-activity', getOnlineUser(s.user.id));
}
function publicRoom(room) {
  return {
    code: room.code, gameKey: 'roadtrip', gameName: 'Co-Driver', status: room.status,
    track: room.track, trackId: room.track.id, trackName: room.track.name,
    carId: room.carId, carName: room.carName, carColor: room.carColor,
    timeLimitSeconds: room.timeLimitSeconds, timeRemaining: room.timeRemaining, mode: room.mode,
    players: room.players.map(p => ({ id: p.userId, name: p.name, roles: p.roles || [], connected: p.connected !== false })),
    playerCount: room.players.length, maxPlayers: MAX_PLAYERS, minPlayers: 2
  };
}
function snapshot(room) {
  return {
    code: room.code, status: room.status, track: room.track, x: room.x, y: room.y,
    angle: room.angle, speed: room.speed, drift: room.drift || 0, police: room.police ? { ...room.police } : null, progress: room.progress,
    checkpoint: room.checkpoint, finished: room.finished, timeRemaining: room.timeRemaining,
    timeExpired: room.timeExpired, runner: room.runner ? { ...room.runner } : null, caught: room.caught, skidMarks: room.skidMarks.slice(-450),
    players: room.players.map(p => ({ id: p.userId, name: p.name, roles: p.roles || [], connected: p.connected !== false }))
  };
}
function broadcastRooms(io) {
  io.emit('roadtrip:rooms:list', [...rooms.values()].filter(r => ['waiting', 'playing'].includes(r.status)).map(publicRoom));
}
function emitRoom(io, room) {
  const payload = { room: publicRoom(room), state: snapshot(room) };
  io.to(room.code).emit('roadtrip:room:update', { ...payload, isHost: false });
  for (const p of room.players) socketForPlayer(io, p)?.emit('roadtrip:room:update', { ...payload, isHost: p.userId === room.hostUserId });
  broadcastRooms(io);
}
function addSkidMark(room, x, y, angle) {
  const rearX = x - Math.cos(angle) * 24;
  const rearY = y - Math.sin(angle) * 24;
  const sideX = Math.cos(angle + Math.PI / 2) * 11;
  const sideY = Math.sin(angle + Math.PI / 2) * 11;
  const prev = room.lastTirePoints;
  if (prev) {
    for (const side of [-1, 1]) {
      const old = prev[side === -1 ? 0 : 1];
      const nx = rearX + sideX * side, ny = rearY + sideY * side;
      if (Math.hypot(nx - old.x, ny - old.y) > 2) room.skidMarks.push({ x1: old.x, y1: old.y, x2: nx, y2: ny });
    }
  }
  room.lastTirePoints = [
    { x: rearX - sideX, y: rearY - sideY },
    { x: rearX + sideX, y: rearY + sideY }
  ];
  if (room.skidMarks.length > 600) room.skidMarks.splice(0, room.skidMarks.length - 600);
}
function finishRoom(io, room, expired = false) {
  room.status = 'finished'; room.finished = true; room.timeExpired = expired;
  if (room.interval) clearInterval(room.interval);
  room.interval = null;
  io.to(room.code).emit('roadtrip:finished', snapshot(room));
  broadcastRooms(io);
}
function step(io, room) {
  if (room.status !== 'playing') return;
  const held = role => room.players.some(p => p.roles?.includes(role) && p.input?.[role]);
  const gas = held('gas'), brake = held('brake');
  const steer = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
  if (gas) room.speed = Math.min(12.2, room.speed + 0.22);
  if (brake) room.speed = Math.max(-5.0, room.speed - 0.20);
  if (!gas && !brake) room.speed += room.speed > 0 ? -0.010 : room.speed < 0 ? 0.010 : 0;
  if (Math.abs(room.speed) < 0.025) room.speed = 0;

  // Unforgiving arcade handling: steering changes heading slowly while momentum
  // keeps carrying the car sideways. Counter-steering is required to recover.
  const speedRatio = Math.min(1, Math.abs(room.speed) / 8.5);
  const driftInput = Math.abs(steer) * speedRatio * (brake ? 1.65 : 1.25);
  room.drift = Math.max(0, Math.min(1, (room.drift || 0) * 0.965 + driftInput * 0.075));
  const direction = room.speed < 0 ? -1 : 1;
  const turnRate = steer * (0.010 + speedRatio * 0.014) * direction;
  room.angle += turnRate * (1 - room.drift * 0.28);

  // Persistent velocity vector creates real inertia rather than instantly pointing
  // movement wherever the front wheels face.
  if (!Number.isFinite(room.vx)) room.vx = Math.cos(room.angle) * room.speed;
  if (!Number.isFinite(room.vy)) room.vy = Math.sin(room.angle) * room.speed;
  const targetVx = Math.cos(room.angle) * room.speed;
  const targetVy = Math.sin(room.angle) * room.speed;
  const grip = Math.max(0.035, 0.19 - room.drift * 0.145 - speedRatio * 0.035);
  room.vx += (targetVx - room.vx) * grip;
  room.vy += (targetVy - room.vy) * grip;
  // Lateral momentum grows when turning hard at speed; release and counter-steer to settle.
  room.vx += -Math.sin(room.angle) * steer * room.drift * Math.abs(room.speed) * 0.055;
  room.vy +=  Math.cos(room.angle) * steer * room.drift * Math.abs(room.speed) * 0.055;
  const maxVelocity = 12.5;
  const velocityLength = Math.hypot(room.vx, room.vy);
  if (velocityLength > maxVelocity) { room.vx *= maxVelocity / velocityLength; room.vy *= maxVelocity / velocityLength; }
  room.x += room.vx;
  room.y += room.vy;
  if (room.drift > 0.24 && Math.abs(room.speed) > 2.2 && steer) addSkidMark(room, room.x, room.y, room.angle);
  else room.lastTirePoints = null;

  // Pursuit mode: a server-driven getaway car follows a longer street route.
  if (room.mode === 'pursuit' && room.runner && !room.caught) {
    const route = room.track.chaseRoute || room.track.checkpoints;
    const goal = route[room.runner.index % route.length];
    const gx = goal.x * WORLD_SCALE, gy = goal.y * WORLD_SCALE;
    const dx = gx - room.runner.x, dy = gy - room.runner.y;
    const distance = Math.hypot(dx, dy);
    room.runner.angle = Math.atan2(dy, dx);
    const move = Math.min(distance, room.runner.speed);
    room.runner.x += Math.cos(room.runner.angle) * move;
    room.runner.y += Math.sin(room.runner.angle) * move;
    if (distance < 26) room.runner.index = (room.runner.index + 1) % route.length;
    if (Math.hypot(room.x - room.runner.x, room.y - room.runner.y) < 78) {
      room.caught = true; room.progress = 100; finishRoom(io, room, false); return;
    }
  }

  // Escape mode: the shared player car is the fugitive; server-controlled police pursue it.
  if (room.mode === 'escape' && room.police && !room.caught) {
    const dx = room.x - room.police.x, dy = room.y - room.police.y;
    const distance = Math.hypot(dx, dy);
    const desired = Math.atan2(dy, dx);
    let delta = ((desired - room.police.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    room.police.angle += Math.max(-0.055, Math.min(0.055, delta));
    const policeSpeed = distance > 900 ? 7.8 : distance > 420 ? 7.0 : 6.2;
    room.police.x += Math.cos(room.police.angle) * policeSpeed;
    room.police.y += Math.sin(room.police.angle) * policeSpeed;
    if (distance < 82) { room.caught = true; finishRoom(io, room, false); return; }
  }

  const target = room.track.checkpoints[room.checkpoint];
  if (room.mode === 'rally' && target && Math.hypot(room.x - target.x * WORLD_SCALE, room.y - target.y * WORLD_SCALE) < 92) {
    room.checkpoint++;
    if (room.checkpoint >= room.track.checkpoints.length) { room.progress = 100; finishRoom(io, room, false); }
  }
  const worldW = room.track.width || 1200, worldH = room.track.height || 720;
  if (room.x < 35 * WORLD_SCALE || room.x > (worldW - 35) * WORLD_SCALE || room.y < 35 * WORLD_SCALE || room.y > (worldH - 35) * WORLD_SCALE) {
    room.speed *= 0.86;
    room.x = Math.max(25 * WORLD_SCALE, Math.min((worldW - 25) * WORLD_SCALE, room.x));
    room.y = Math.max(25 * WORLD_SCALE, Math.min((worldH - 25) * WORLD_SCALE, room.y));
  }
  room.timeRemaining = Math.max(0, room.timeRemaining - 1 / 30);
  if (room.timeRemaining <= 0 && !room.finished) finishRoom(io, room, true);
  room.progress = room.mode === 'pursuit' && room.runner ? Math.max(0, Math.min(99, Math.round((1 - Math.hypot(room.x-room.runner.x, room.y-room.runner.y)/1800)*100))) : Math.min(99, Math.round(room.checkpoint / room.track.checkpoints.length * 100));
  io.to(room.code).volatile.emit('roadtrip:state', snapshot(room));
}
function removePlayer(io, room, player, reason) {
  if (!player) return;
  if (player.reconnectTimer) clearTimeout(player.reconnectTimer);
  socketForPlayer(io, player)?.leave(room.code);
  room.players = room.players.filter(p => p !== player);
  if (room.hostUserId === player.userId && room.players.length) room.hostUserId = room.players[0].userId;
  if (!room.players.length) {
    if (room.interval) clearInterval(room.interval);
    rooms.delete(room.code);
    io.to(room.code).emit('roadtrip:player:left', { reason, empty: true });
  } else {
    emitRoom(io, room);
    io.to(room.code).emit('roadtrip:player:left', { reason, userId: player.userId });
  }
  broadcastRooms(io);
}

export function registerRoadtripHandlers(io, socket) {
  const userId = socket.user?.id;
  const userName = socket.user?.user_name || 'Player';
  const error = message => socket.emit('roadtrip:error', { message });
  socket.emit('roadtrip:rooms:list', [...rooms.values()].filter(r => ['waiting', 'playing'].includes(r.status)).map(publicRoom));

  // A browser refresh creates a new socket id. Reattach by authenticated user id.
  let resumed = false;
  for (const room of rooms.values()) {
    const player = playerByUser(room, userId);
    if (!player) continue;
    if (player.reconnectTimer) clearTimeout(player.reconnectTimer);
    player.reconnectTimer = null; player.socketId = socket.id; player.connected = true; player.input = {};
    socket.join(room.code); resumed = true;
    socket.emit('roadtrip:room:joined', { code: room.code, resumed: true });
    emitRoom(io, room);
    if (room.status === 'playing') socket.emit('roadtrip:match:started', { room: publicRoom(room), state: snapshot(room), myId: userId, resumed: true });
    break;
  }
  if (resumed) updatePresence(io, { userId, socketId: socket.id }, 'playing');

  socket.on('roadtrip:room:resume', () => {
    for (const room of rooms.values()) {
      const player = playerByUser(room, userId);
      if (!player) continue;
      if (player.reconnectTimer) clearTimeout(player.reconnectTimer);
      player.reconnectTimer = null; player.socketId = socket.id; player.connected = true; player.input = {};
      socket.join(room.code);
      emitRoom(io, room);
      if (room.status === 'playing') socket.emit('roadtrip:match:started', { room: publicRoom(room), state: snapshot(room), myId: userId, resumed: true });
      updatePresence(io, { userId, socketId: socket.id }, room.status === 'playing' ? 'playing' : 'lobby');
      return;
    }
  });

  socket.on('roadtrip:room:create', async () => {
    try {
      if (roomForSocket(socket.id)) return error('You are already in a room.');
      const config = await getGameConfig();
      const track = (config.tracks || [])[0]; const car = (config.cars || [])[0];
      if (!track || !car) return error('Tracks or cars are missing from the game catalogue.');
      const code = makeCode();
      const room = {
        code, hostUserId: userId, status: 'waiting', track: JSON.parse(JSON.stringify(track)),
        carId: car.id, carName: car.name, carColor: car.defaultColor || (car.id === 'opel-astra-j' ? '#111111' : '#ffffff'),
        mode: 'rally', timeLimitSeconds: 240, timeRemaining: 240, timeExpired: false, caught: false, runner: null,
        players: [{ userId, socketId: socket.id, name: userName, roles: [], input: {}, connected: true }],
        x: track.start.x * WORLD_SCALE, y: track.start.y * WORLD_SCALE, angle: track.start.angle || 0,
        speed: 0, drift: 0, progress: 0, checkpoint: 0, finished: false, interval: null,
        skidMarks: [], lastTirePoints: null
      };
      rooms.set(code, room); socket.join(code); socket.emit('roadtrip:room:created', { code });
      updatePresence(io, { userId, socketId: socket.id }, 'lobby'); emitRoom(io, room);
    } catch (e) { error(e.message || 'Could not create room.'); }
  });

  socket.on('roadtrip:room:join', payload => {
    const room = rooms.get(String(payload?.code || '').trim().toUpperCase());
    if (!room) return error('Room not found.');
    if (room.status !== 'waiting') return error('This room is no longer open.');
    if (room.players.some(p => p.userId === userId)) return error('You are already in this room.');
    if (room.players.length >= MAX_PLAYERS) return error('This room is full.');
    if (roomForSocket(socket.id)) return error('Leave your current room first.');
    room.players.push({ userId, socketId: socket.id, name: userName, roles: [], input: {}, connected: true });
    socket.join(room.code); socket.emit('roadtrip:room:joined', { code: room.code });
    updatePresence(io, { userId, socketId: socket.id }, 'lobby'); emitRoom(io, room);
  });

  socket.on('roadtrip:room:track', async payload => {
    const room = roomForHost(userId); if (!room) return error('Only the host can change the track.');
    try { const config = await getGameConfig(); const track = (config.tracks || []).find(t => t.id === payload?.trackId); if (!track) return error('Selected track is not available.');
      room.track = JSON.parse(JSON.stringify(track)); room.x = track.start.x * WORLD_SCALE; room.y = track.start.y * WORLD_SCALE;
      room.angle = track.start.angle || 0; room.vx = 0; room.vy = 0; room.speed = 0; room.progress = 0; room.checkpoint = 0; room.skidMarks = []; room.lastTirePoints = null; emitRoom(io, room);
    } catch (e) { error(e.message || 'Could not change track.'); }
  });
  socket.on('roadtrip:room:car', async payload => {
    const room = roomForHost(userId); if (!room) return error('Only the host can change the car.');
    try { const config = await getGameConfig(); const car = (config.cars || []).find(c => c.id === payload?.carId); if (!car) return error('Selected car is not available.');
      room.carId = car.id; room.carName = car.name;
      room.carColor = String(payload?.color || car.defaultColor || '#ffffff').match(/^#[0-9a-fA-F]{6}$/)?.[0] || '#ffffff'; emitRoom(io, room);
    } catch (e) { error(e.message || 'Could not change the car.'); }
  });
  socket.on('roadtrip:room:mode', payload => {
    const room = roomForHost(userId); if (!room) return error('Only the host can change the game mode.');
    const mode = payload?.mode; if (!['rally','pursuit','escape'].includes(mode)) return error('Invalid game mode.');
    room.mode = mode; room.runner = null; room.police = null; emitRoom(io, room);
  });
  socket.on('roadtrip:room:timer', payload => { const room = roomForHost(userId); if (!room) return error('Only the host can set the time limit.'); const seconds = Number(payload?.seconds); if (![180,240,300,420].includes(seconds)) return error('Invalid time limit.'); room.timeLimitSeconds = seconds; room.timeRemaining = seconds; emitRoom(io, room); });
  socket.on('roadtrip:roles:update', payload => {
    const room = roomForHost(userId); if (!room) return error('Only the host can assign controls.');
    if (!Array.isArray(payload?.assignments)) return error('Invalid control assignments.');
    const assignments = new Map(room.players.map(p => [p.userId, []]));
    for (const a of payload.assignments) if (assignments.has(a.playerId) && Array.isArray(a.roles)) assignments.set(a.playerId, [...new Set(a.roles)].filter(r => ROLES.includes(r)));
    if (!ROLES.every(role => [...assignments.values()].some(list => list.includes(role)))) return error('Assign every control to at least one player.');
    room.players.forEach(p => { p.roles = assignments.get(p.userId); p.input = {}; }); emitRoom(io, room);
  });
  socket.on('roadtrip:room:start', () => {
    const room = roomForHost(userId); if (!room) return error('Only the host can start this room.');
    if (room.players.length < 2) return error('At least 2 players are required.');
    if (!ROLES.every(role => room.players.some(p => p.roles.includes(role)))) return error('Assign all four controls before starting.');
    room.status = 'playing'; room.x = room.track.start.x * WORLD_SCALE; room.y = room.track.start.y * WORLD_SCALE;
    room.angle = room.track.start.angle || 0; room.vx = 0; room.vy = 0; room.speed = 0; room.drift = 0; room.progress = 0; room.checkpoint = 0;
    room.finished = false; room.timeExpired = false; room.caught = false; room.timeRemaining = room.timeLimitSeconds; room.skidMarks = []; room.lastTirePoints = null;
    if (room.mode === 'pursuit') {
      const first = room.track.chaseRoute?.[0] || room.track.checkpoints[0];
      const sx = room.x + Math.cos(room.angle) * 520, sy = room.y + Math.sin(room.angle) * 520;
      room.runner = { x: sx, y: sy, angle: room.angle, index: 0, speed: 6.8 };
      room.police = null;
    } else if (room.mode === 'escape') {
      room.runner = null;
      room.police = { x: room.x - Math.cos(room.angle) * 360, y: room.y - Math.sin(room.angle) * 360, angle: room.angle, speed: 0 };
    } else { room.runner = null; room.police = null; }
    room.players.forEach(p => { p.input = {}; updatePresence(io, p, 'playing'); socketForPlayer(io, p)?.emit('roadtrip:match:started', { room: publicRoom(room), state: snapshot(room), myId: p.userId }); });
    room.interval = setInterval(() => step(io, room), 1000 / 30); room.interval.unref?.(); emitRoom(io, room);
  });
  socket.on('roadtrip:input', payload => {
    const room = roomForSocket(socket.id); if (!room || room.status !== 'playing' || room.finished) return;
    const player = room.players.find(p => p.socketId === socket.id); const role = payload?.role;
    if (player?.roles?.includes(role)) player.input[role] = payload.pressed === true;
  });
  socket.on('roadtrip:room:leave', () => { const room = roomForSocket(socket.id); if (!room) return; const player = room.players.find(p => p.socketId === socket.id); updatePresence(io, player, null); removePlayer(io, room, player, 'player-left'); });
  socket.on('disconnect', () => {
    const room = roomForSocket(socket.id); if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id); if (!player) return;
    player.connected = false; player.input = {}; player.socketId = null;
    room.lastTirePoints = null; emitRoom(io, room);
    player.reconnectTimer = setTimeout(() => {
      const stillThere = playerByUser(room, userId);
      if (stillThere && !stillThere.connected) { updatePresence(io, { userId, socketId: socket.id }, null); removePlayer(io, room, stillThere, 'reconnect-timeout'); }
    }, RECONNECT_GRACE_MS);
    player.reconnectTimer.unref?.();
  });
}
