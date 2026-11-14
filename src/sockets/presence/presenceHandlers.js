import {
  addConnection,
  removeConnection,
  updateActivity,
  markConnectionActive,
  getOnlineUser,
  getOnlineUsers,
  refreshPresenceStatuses
} from './presenceManager.js';

const PAGES = {
  home: true,
  account: true,
  songshare: true,
  games: true,
  hockey: true,
  login: true
};

const ACTIVITIES = {
  browsing: true,
  editing_profile: true,
  listening_music: true,
  browsing_games: true,
  playing_game: true,
  in_lobby: true,
  transferring_file: true
};

export const registerPresenceHandlers = (io, socket) => {
  const user = socket.user;
  const { isFirstConnection } = addConnection(user, socket.id);

  if (isFirstConnection) {
    socket.broadcast.emit('presence:user-online', getOnlineUser(user.id));
  }

  socket.emit('presence:list', getOnlineUsers());

  socket.on('presence:update', data => {
    if (!data || typeof data !== 'object') return;
    if (!Object.hasOwn(PAGES, data.page)) return;
    if (!Object.hasOwn(ACTIVITIES, data.activity)) return;

    if (!updateActivity(user.id, socket.id, {
      page: data.page,
      activity: data.activity
    })) return;

    io.emit('presence:user-activity', getOnlineUser(user.id));
  });

  socket.on('presence:active', () => {
    const statusChanged = markConnectionActive(user.id, socket.id);
    if (statusChanged) {
      io.emit('presence:user-status', getOnlineUser(user.id));
    }
  });

  socket.on('presence:get-list', () => {
    socket.emit('presence:list', getOnlineUsers());
  });

  socket.on('disconnect', () => {
    const result = removeConnection(user.id, socket.id);

    if (result.isFullyOffline) {
      io.emit('presence:user-offline', { userId: user.id });
      return;
    }

    io.emit('presence:user-activity', result.user);
  });
};

export const startPresenceMonitor = io => {
  const interval = setInterval(() => {
    refreshPresenceStatuses().forEach(user => {
      io.emit('presence:user-status', user);
    });
  }, 15000);

  interval.unref?.();
  return interval;
};
