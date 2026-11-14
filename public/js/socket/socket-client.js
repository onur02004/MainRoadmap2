(() => {
  if (window.mainSocket) return;

  if (typeof window.io !== 'function') {
    console.error('[Socket] Socket.IO client library not loaded.');
    return;
  }

  const token = localStorage.getItem('token');

  if (!token || token === 'null' || token === 'undefined') {
    console.log('[Socket] No authentication token. Connection skipped.');
    return;
  }

  const socket = window.io({
    auth: {
      token
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  });

  window.mainSocket = socket;

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    socket.emit('presence:get-list');
    window.dispatchEvent(new CustomEvent('socket:connected'));
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    window.dispatchEvent(new CustomEvent('socket:disconnected', {
      detail: { reason }
    }));
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message);

    if (
      error.message === 'TOKEN_EXPIRED' ||
      error.message === 'INVALID_TOKEN' ||
      error.message === 'USER_NOT_FOUND' ||
      error.message === 'AUTH_REQUIRED'
    ) {
      socket.disconnect();
      window.dispatchEvent(new CustomEvent('socket:auth-error', {
        detail: { message: error.message }
      }));
    }
  });

  socket.on('hockey:rooms:list', (rooms) => {
    window.dispatchEvent(new CustomEvent('hockey:rooms:list', {
      detail: rooms || []
    }));
  });

  socket.on('roadtrip:rooms:list', (rooms) => {
    window.dispatchEvent(new CustomEvent('roadtrip:rooms:list', { detail: rooms || [] }));
  });

  socket.on('presence:list', (users) => {
    window.dispatchEvent(new CustomEvent('presence:list', {
      detail: users
    }));
  });

  socket.on('presence:user-online', (user) => {
    window.dispatchEvent(new CustomEvent('presence:user-online', {
      detail: user
    }));
  });

  socket.on('presence:user-offline', (data) => {
    window.dispatchEvent(new CustomEvent('presence:user-offline', {
      detail: data
    }));
  });

  socket.on('presence:user-activity', (data) => {
    window.dispatchEvent(new CustomEvent('presence:user-activity', { detail: data }));
  });

  socket.on('presence:user-status', (data) => {
    window.dispatchEvent(new CustomEvent('presence:user-status', { detail: data }));
  });

  socket.on('presence:list-updated', (users) => {
    window.dispatchEvent(new CustomEvent('presence:list-updated', { detail: users || [] }));
  });
})();