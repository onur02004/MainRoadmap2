(() => {
  window.onlineUsers = [];

  const detectPage = () => {
    // HTML üzerinde özel bir sayfa tanımı varsa onu kullan.
    const customPage = document.body.dataset.presencePage;
    if (customPage) return customPage;

    const path = window.location.pathname.toLowerCase();

    if (path.includes("/account")) return "account";
    if (path.includes("/songshare")) return "songshare";
    if (path.includes("/games/hockey")) return "hockey";
    if (path.includes("/games")) return "games";
    if (path.includes("/login")) return "login";

    return "home";
  };

  const defaultActivity = {
    home: "browsing",
    account: "editing_profile",
    songshare: "browsing",
    games: "browsing_games",
    hockey: "playing_game",
    login: "browsing",
  };

  window.setPresenceActivity = (activity) => {
    if (!window.mainSocket?.connected) return;

    window.mainSocket.emit("presence:update", {
      page: detectPage(),
      activity,
    });
  };

  const publishCurrentPage = () => {
    const page = detectPage();

    window.setPresenceActivity(defaultActivity[page] || "browsing");
  };

  window.addEventListener("socket:connected", publishCurrentPage);

  // Socket zaten bağlandıysa sayfa bilgisini gönder.
  if (window.mainSocket?.connected) {
    publishCurrentPage();
  }

  window.addEventListener("presence:list", (event) => {
    window.onlineUsers = event.detail || [];
  });

  window.addEventListener("presence:user-online", (event) => {
    const user = event.detail;

    if (!window.onlineUsers.some((item) => item.id === user.id)) {
      window.onlineUsers.push(user);
    }
  });

  window.addEventListener("presence:user-activity", (event) => {
    const updatedUser = event.detail;
    const index = window.onlineUsers.findIndex(
      (item) => item.id === updatedUser.id,
    );

    if (index !== -1) {
      window.onlineUsers[index] = updatedUser;
    } else {
      window.onlineUsers.push(updatedUser);
    }
  });

  window.addEventListener("presence:user-offline", (event) => {
    window.onlineUsers = window.onlineUsers.filter(
      (user) => user.id !== event.detail.userId,
    );
  });

  // Kullanıcı etkileşimlerini Socket.IO üzerinden bildir.
  let lastActivitySentAt = 0;

  const sendActive = () => {
    if (!window.mainSocket?.connected) return;

    const now = Date.now();

    // Çok sık event göndermemek için 30 saniyede bir sınırla.
    if (now - lastActivitySentAt < 30000) return;

    lastActivitySentAt = now;
    window.mainSocket.emit("presence:active");
  };

  [
    "mousedown",
    "mousemove",
    "keydown",
    "scroll",
    "touchstart",
    "click",
  ].forEach((eventName) => {
    document.addEventListener(eventName, sendActive, {
      passive: true,
    });
  });

  // Sayfa yeniden görünür olduğunda da aktifliği bildir.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      lastActivitySentAt = 0;
      sendActive();
    }
  });

  // Socket yeniden bağlandığında aktiflik zamanını sıfırla.
  window.addEventListener("socket:connected", () => {
    lastActivitySentAt = 0;
    sendActive();
  });

  window.addEventListener('presence:user-status', event => {
  const updatedUser = event.detail;

  const index = window.onlineUsers.findIndex(
    user => user.id === updatedUser.id
  );

  if (index !== -1) {
    window.onlineUsers[index] = updatedUser;
  } else {
    window.onlineUsers.push(updatedUser);
  }

  window.dispatchEvent(new CustomEvent('presence:list-updated'));
});
})();
