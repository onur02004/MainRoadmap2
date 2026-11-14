const onlineUsers = new Map();

const AWAY_AFTER = 5 * 60 * 1000;

const getStatus = (entry, now = Date.now()) => {
  const connections = Array.from(entry.connections.values());
  const hasActiveConnection = connections.some(
    connection => now - connection.lastActiveAt < AWAY_AFTER
  );
  return hasActiveConnection ? 'online' : 'away';
};

const buildPublicUser = (entry) => {
  const connections = Array.from(entry.connections.values());
  // Prefer an active game session over generic page browsing from another
  // device/tab. Otherwise a second connection can hide the fact that the user
  // is currently in a game.
  const gameConnections = connections.filter(connection => connection.game);
  const candidates = gameConnections.length ? gameConnections : connections;
  const latestConnection = candidates.reduce((latest, current) =>
    current.updatedAt > latest.updatedAt ? current : latest
  );

  return {
    ...entry.user,
    status: entry.status,
    activity: {
      page: latestConnection.page,
      activity: latestConnection.activity,
      game: latestConnection.game || null
    },
    connectedAt: entry.connectedAt
  };
};

export const addConnection = (user, socketId) => {
  let entry = onlineUsers.get(user.id);
  const isFirstConnection = !entry;

  if (!entry) {
    entry = {
      user,
      connections: new Map(),
      connectedAt: new Date().toISOString(),
      status: 'online'
    };
    onlineUsers.set(user.id, entry);
  }

  const now = Date.now();
  entry.connections.set(socketId, {
    page: 'home',
    activity: 'browsing',
    game: null,
    lastActiveAt: now,
    updatedAt: now
  });
  entry.status = 'online';

  return { isFirstConnection };
};

export const updateActivity = (userId, socketId, activity) => {
  const entry = onlineUsers.get(userId);
  if (!entry) return false;

  const connection = entry.connections.get(socketId);
  if (!connection) return false;

  const now = Date.now();
  entry.connections.set(socketId, {
    ...connection,
    ...activity,
    ...(Object.hasOwn(activity, 'game') ? { game: activity.game } : {}),
    lastActiveAt: now,
    updatedAt: now
  });
  entry.status = 'online';

  return true;
};

export const setGameActivity = (userId, socketId, game) => {
  const entry = onlineUsers.get(userId);
  const connection = entry?.connections.get(socketId);
  if (!connection) return false;

  const now = Date.now();
  connection.game = game || null;
  connection.page = game ? 'games' : connection.page;
  connection.activity = !game
    ? 'browsing_games'
    : game.state === 'lobby'
      ? 'in_lobby'
      : game.state === 'playing'
        ? 'playing_game'
        : 'browsing_games';
  connection.lastActiveAt = now;
  connection.updatedAt = now;
  entry.status = 'online';

  return true;
};

export const markConnectionActive = (userId, socketId) => {
  const entry = onlineUsers.get(userId);
  if (!entry) return false;

  const connection = entry.connections.get(socketId);
  if (!connection) return false;

  const previousStatus = entry.status;
  const now = Date.now();
  connection.lastActiveAt = now;
  connection.updatedAt = now;
  entry.status = 'online';

  return previousStatus !== 'online';
};

export const removeConnection = (userId, socketId) => {
  const entry = onlineUsers.get(userId);
  if (!entry) return { isFullyOffline: false };

  entry.connections.delete(socketId);

  if (entry.connections.size === 0) {
    onlineUsers.delete(userId);
    return { isFullyOffline: true };
  }

  entry.status = getStatus(entry);
  return {
    isFullyOffline: false,
    user: buildPublicUser(entry)
  };
};

export const getOnlineUser = userId => {
  const entry = onlineUsers.get(userId);
  return entry ? buildPublicUser(entry) : null;
};

export const getOnlineUsers = () =>
  Array.from(onlineUsers.values()).map(buildPublicUser);

export const refreshPresenceStatuses = () => {
  const changedUsers = [];

  for (const entry of onlineUsers.values()) {
    const nextStatus = getStatus(entry);
    if (entry.status !== nextStatus) {
      entry.status = nextStatus;
      changedUsers.push(buildPublicUser(entry));
    }
  }

  return changedUsers;
};

export const isUserOnline = userId => onlineUsers.has(userId);
