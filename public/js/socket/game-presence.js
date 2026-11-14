(() => {
  window.setGamePresence = (gameKey, state = 'playing') => {
    if (!window.mainSocket?.connected) return false;
    window.mainSocket.emit('games:activity:update', { gameKey, state });
    return true;
  };

  window.clearGamePresence = () => {
    if (!window.mainSocket?.connected) return false;
    window.mainSocket.emit('games:activity:update', { clear: true });
    return true;
  };
})();
