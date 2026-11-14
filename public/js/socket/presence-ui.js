(() => {
  if (window.__presenceUIInitialized) return;
  window.__presenceUIInitialized = true;

  let avatarAPI = null;
  let currentUserId = null;

  const loadAvatarRenderer = async () => {
    try {
      await import("/avatarRenderer.js");
      avatarAPI = window.AvatarRenderer;

      const currentUser = await avatarAPI.getCurrentUser();
      currentUserId = currentUser?.id || null;

      render();
    } catch (error) {
      console.error("[Presence UI] Avatar renderer error:", error);
    }
  };

  const createWidget = () => {
    if (document.getElementById("presence-widget")) return;

    const widget = document.createElement("div");
    widget.id = "presence-widget";

    widget.innerHTML = `
      <div id="presence-panel">
        <div class="presence-header">
          <strong>Çevrimiçi</strong>
          <span id="presence-subtitle">Kullanıcılar yükleniyor...</span>
        </div>
        <div id="presence-list">
          <div class="presence-empty">Kullanıcılar yükleniyor...</div>
        </div>
      </div>

      <button id="presence-toggle" type="button">
        <span>Çevrimiçi</span>
        <span id="presence-count">0</span>
      </button>
    `;

    document.body.appendChild(widget);

    document.getElementById("presence-toggle").addEventListener("click", () => {
      document.getElementById("presence-panel").classList.toggle("open");
    });

    document.addEventListener("click", (event) => {
      if (!widget.contains(event.target)) {
        document.getElementById("presence-panel")?.classList.remove("open");
      }
    });
  };

  const render = () => {
    const list = document.getElementById("presence-list");
    const count = document.getElementById("presence-count");
    const subtitle = document.getElementById("presence-subtitle");

    if (!list || !count || !subtitle) return;

    const users = window.onlineUsers || [];

    count.textContent = users.length;
    subtitle.textContent = `${users.length} kullanıcı çevrimiçi`;

    if (!users.length) {
      list.innerHTML =
        '<div class="presence-empty">Şu anda kimse çevrimiçi değil.</div>';
      return;
    }

    list.innerHTML = "";

    users.forEach((user) => {
      const row = document.createElement("div");
      row.className = "presence-user";

      const avatar = document.createElement("div");
      avatar.className = "presence-avatar";

      const dot = document.createElement("span");
      dot.className = "presence-online-dot";
      avatar.appendChild(dot);

      const info = document.createElement("div");
      info.className = "presence-user-info";

      const name = document.createElement("div");
      name.className = "presence-user-name";
      name.textContent =
        user.id === currentUserId ? `${user.user_name} (Sen)` : user.user_name;

      const status = document.createElement("div");
      status.className = "presence-user-status";
      const activityLabels = {
        browsing: "Geziniyor",
        editing_profile: "Hesabını düzenliyor",
        listening_music: "Müzik dinliyor",
        browsing_games: "Oyunlara göz atıyor",
        playing_game: "Oyun oynuyor",
        in_lobby: "Oyun lobisinde bekliyor",
        transferring_file: "Dosya gönderiyor",
      };

      const pageLabels = {
        home: "Ana sayfada",
        account: "Hesap ayarlarında",
        songshare: "SongShare",
        games: "Games",
        hockey: "Hockey",
      };

      const isAway = user.status === "away";

      status.textContent = isAway ? "Uzakta" : "Çevrimiçi";

      dot.classList.toggle("away", isAway);

      info.append(name, status);
      row.append(avatar, info);
      list.appendChild(row);

      if (avatarAPI) {
        avatarAPI.render(avatar, user, { size: 38 });
      }
    });
  };

  const initialize = () => {
    createWidget();
    render();
    loadAvatarRenderer();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }

  window.addEventListener("presence:list", render);
  window.addEventListener("presence:user-online", render);
  window.addEventListener("presence:user-offline", render);
  window.addEventListener("presence:list-updated", render);
  window.addEventListener("presence:user-status", render);
})();
