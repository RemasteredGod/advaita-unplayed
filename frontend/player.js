const whoamiEl = document.getElementById("whoami");
const statusEl = document.getElementById("status");
const sourceLabelEl = document.getElementById("source-label");
const syncStateEl = document.getElementById("sync-state");
const latencyEl = document.getElementById("latency");
const networkLatencyEl = document.getElementById("network-latency");
const breakStatusEl = document.getElementById("break-status");
const offsetEl = document.getElementById("offset");
const fullscreenBtnEl = document.getElementById("fullscreen-btn");
const syncNowBtnEl = document.getElementById("sync-now");
const breakFormEl = document.getElementById("break-form");
const sidebarEl = document.getElementById("user-sidebar");
const toggleSidebarBtnEl = document.getElementById("toggle-sidebar");
const chatSidebarEl = document.getElementById("chat-sidebar");
const toggleChatBtnEl = document.getElementById("toggle-chat");
const chatMessagesEl = document.getElementById("chat-messages");
const chatFormEl = document.getElementById("chat-form");
const chatInputEl = document.getElementById("chat-input");

const localWrapper = document.getElementById("local-wrapper");
const ytWrapper = document.getElementById("yt-wrapper");
const localVideo = document.getElementById("local-video");

let socket;
let currentSource = null;
let currentSourceKey = "";
let latencyMs = 120;
let fullscreenHintShown = false;
let currentUserId = null;
let ytPlayer = null;
let ytReadyResolve;
const ytReady = new Promise((resolve) => {
  ytReadyResolve = resolve;
});

window.onYouTubeIframeAPIReady = function onYouTubeIframeAPIReady() {
  ytPlayer = new window.YT.Player("yt-player", {
    width: "100%",
    height: "480",
    videoId: "",
    playerVars: {
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      rel: 0,
    },
    events: {
      onReady: () => ytReadyResolve(),
    },
  });
};

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function setSidebarOpen(open) {
  sidebarEl.classList.toggle("open", Boolean(open));
  toggleSidebarBtnEl.textContent = open ? "CLOSE" : "CONTROLS";
}

function setChatOpen(open) {
  chatSidebarEl.classList.toggle("open", Boolean(open));
  toggleChatBtnEl.textContent = open ? "CLOSE CHAT" : "CHAT";
}

function appendChatMessage(item = {}) {
  const row = document.createElement("div");
  row.className = "chat-row";

  const mine = Number(item.userId) === Number(currentUserId);
  if (mine) {
    row.classList.add("mine");
  }

  const name = document.createElement("span");
  name.className = "chat-name";
  name.textContent = item.username || "user";

  const text = document.createElement("span");
  text.className = "chat-text";
  text.textContent = item.message || "";

  row.append(name, text);
  chatMessagesEl.append(row);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function renderChatHistory(items = []) {
  chatMessagesEl.innerHTML = "";
  items.forEach((entry) => appendChatMessage(entry));
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Request failed");
  }
  return body;
}

function setSource(source) {
  const nextKey = source
    ? source.type === "youtube"
      ? `youtube:${source.youtubeId}`
      : `local:${source.streamUrl}`
    : "";
  const sourceChanged = nextKey !== currentSourceKey;

  currentSource = source;
  currentSourceKey = nextKey;

  if (!source) {
    sourceLabelEl.textContent = "Awaiting source...";
    localWrapper.classList.add("hidden");
    ytWrapper.classList.add("hidden");
    return;
  }

  sourceLabelEl.textContent = `${source.type.toUpperCase()}: ${source.title}`;

  if (source.type === "local") {
    ytWrapper.classList.add("hidden");
    localWrapper.classList.remove("hidden");
    if (sourceChanged || localVideo.src !== source.streamUrl) {
      localVideo.src = source.streamUrl;
      localVideo.load();
    }
    return;
  }

  localWrapper.classList.add("hidden");
  ytWrapper.classList.remove("hidden");

  if (!sourceChanged) {
    return;
  }

  ytReady.then(() => {
    if (ytPlayer && ytPlayer.loadVideoById) {
      ytPlayer.loadVideoById({ videoId: source.youtubeId, startSeconds: 0 });
      ytPlayer.pauseVideo();
    }
  });
}

function setLatency(value) {
  const numeric = Number(value);
  const bounded = Number.isFinite(numeric) ? Math.max(0, Math.min(1500, numeric)) : 120;
  latencyMs = bounded;
  latencyEl.textContent = `${bounded}ms`;
}

function setNetworkLatency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    networkLatencyEl.textContent = "-- ms";
    return;
  }
  networkLatencyEl.textContent = `${Math.round(numeric)} ms`;
}

function getFullscreenTarget() {
  return document.querySelector(".player-panel") || document.documentElement;
}

async function requestFullscreenNow() {
  const target = getFullscreenTarget();

  if (document.fullscreenElement) {
    return true;
  }

  if (target.requestFullscreen) {
    await target.requestFullscreen();
    return true;
  }

  if (target.webkitRequestFullscreen) {
    target.webkitRequestFullscreen();
    return true;
  }

  if (localVideo.webkitEnterFullscreen && currentSource && currentSource.type === "local") {
    localVideo.webkitEnterFullscreen();
    return true;
  }

  return false;
}

function ensureFullscreen() {
  requestFullscreenNow().catch(() => {
    if (!fullscreenHintShown) {
      showStatus("Auto fullscreen blocked. Tap ENTER FULLSCREEN.", true);
      fullscreenHintShown = true;
    }
  });
}

function getCurrentTime() {
  if (!currentSource) {
    return 0;
  }

  if (currentSource.type === "local") {
    return Number(localVideo.currentTime || 0);
  }

  if (ytPlayer && ytPlayer.getCurrentTime) {
    return Number(ytPlayer.getCurrentTime() || 0);
  }

  return 0;
}

function applySeek(time) {
  if (!currentSource) {
    return;
  }

  if (currentSource.type === "local") {
    if (Math.abs(localVideo.currentTime - time) > 0.3) {
      localVideo.currentTime = time;
    }
    return;
  }

  if (ytPlayer && ytPlayer.seekTo) {
    const current = Number(ytPlayer.getCurrentTime() || 0);
    if (Math.abs(current - time) > 0.5) {
      ytPlayer.seekTo(time, true);
    }
  }
}

function applyPlay() {
  syncStateEl.textContent = "SYNCHRONIZED";

  if (!currentSource) {
    return;
  }

  ensureFullscreen();

  if (currentSource.type === "local") {
    localVideo.play().catch(() => {});
    return;
  }

  if (ytPlayer && ytPlayer.playVideo) {
    ytPlayer.playVideo();
  }
}

function applyPause() {
  syncStateEl.textContent = "PAUSED";

  if (!currentSource) {
    return;
  }

  if (currentSource.type === "local") {
    localVideo.pause();
    return;
  }

  if (ytPlayer && ytPlayer.pauseVideo) {
    ytPlayer.pauseVideo();
  }
}

function syncTo(event) {
  setLatency(event.latencyMs ?? latencyMs);

  if (event.source) {
    setSource(event.source);
  }

  const time = Number(event.time ?? event.currentTime ?? 0);
  const action = event.action || (event.isPlaying ? "play" : "pause");

  const run = () => {
    applySeek(time);

    if (action === "play") {
      applyPlay();
    }
    if (action === "pause") {
      applyPause();
    }
    if (action === "seek") {
      syncStateEl.textContent = "SYNCHRONIZING";
    }

    const offset = Math.abs(getCurrentTime() - time);
    offsetEl.textContent = `${offset.toFixed(2)}s`;
  };

  if (action === "play" || action === "pause") {
    window.setTimeout(run, latencyMs);
    return;
  }

  run();
}

async function boot() {
  const { user } = await request("/api/auth/me");
  currentUserId = user.id;
  whoamiEl.textContent = `${user.username} [${user.role}]`;
  if (user.role === "admin") {
    window.location.href = "/static/admin.html";
    return;
  }

  localVideo.controls = false;

  socket = io();

  setSidebarOpen(false);
  setChatOpen(false);

  socket.on("sync_state", (state) => {
    syncTo(state);
  });

  socket.on("sync_command", (event) => {
    syncTo(event);
  });

  socket.on("source_update", (event) => {
    syncTo(event);
  });

  socket.on("sync_error", (event) => {
    showStatus(event.error || "Sync error", true);
  });

  socket.on("latency_pong", (event = {}) => {
    const sentAt = Number(event.sentAt);
    if (!Number.isFinite(sentAt)) {
      return;
    }
    setNetworkLatency(Date.now() - sentAt);
  });

  setInterval(() => {
    socket.emit("latency_probe", { sentAt: Date.now() });
  }, 2500);

  socket.on("break_request_status", (request = {}) => {
    if (Number(request.userId) !== Number(currentUserId)) {
      return;
    }

    if (request.status === "pending") {
      breakStatusEl.textContent = `PENDING (${request.durationMin}m)`;
      showStatus("Break request sent to admin");
      setSidebarOpen(true);
      return;
    }

    if (request.status === "approved") {
      breakStatusEl.textContent = `APPROVED (${request.durationMin}m)`;
      showStatus("Break approved by admin");
      setSidebarOpen(true);
      return;
    }

    if (request.status === "denied") {
      breakStatusEl.textContent = "DENIED";
      showStatus("Break request denied", true);
      setSidebarOpen(true);
    }
  });

  socket.on("chat_history", (messages = []) => {
    renderChatHistory(Array.isArray(messages) ? messages : []);
  });

  socket.on("chat_message", (message = {}) => {
    appendChatMessage(message);
  });

  setInterval(() => {
    socket.emit("request_sync");
  }, 10000);
}

document.getElementById("logout").addEventListener("click", async () => {
  await request("/api/auth/logout", { method: "POST" });
  window.location.href = "/static/login.html";
});

document.getElementById("rename-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const username = String(formData.get("username") || "");

  try {
    const { user } = await request("/api/auth/me/username", {
      method: "PUT",
      body: JSON.stringify({ username }),
    });

    whoamiEl.textContent = `${user.username} [${user.role}]`;
    showStatus("Username updated");
    event.currentTarget.reset();
  } catch (error) {
    showStatus(error.message, true);
  }
});

fullscreenBtnEl.addEventListener("click", () => {
  requestFullscreenNow().catch(() => {
    showStatus("Fullscreen not available in this browser context", true);
  });
});

toggleSidebarBtnEl.addEventListener("click", () => {
  setSidebarOpen(!sidebarEl.classList.contains("open"));
});

toggleChatBtnEl.addEventListener("click", () => {
  setChatOpen(!chatSidebarEl.classList.contains("open"));
});

syncNowBtnEl.addEventListener("click", () => {
  if (!socket) {
    return;
  }
  socket.emit("request_sync");
  showStatus("Resync requested");
});

breakFormEl.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!socket) {
    return;
  }

  const formData = new FormData(breakFormEl);
  const reason = String(formData.get("reason") || "").trim();
  const durationMin = Number(formData.get("durationMin") || 5);

  if (!reason) {
    showStatus("Please add a break reason", true);
    return;
  }

  socket.emit("break_request_submit", {
    reason,
    durationMin,
  });

  breakStatusEl.textContent = "PENDING";
  setSidebarOpen(true);
});

chatFormEl.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!socket) {
    return;
  }

  const message = String(chatInputEl.value || "").trim();
  if (!message) {
    return;
  }

  socket.emit("chat_send", { message });
  chatInputEl.value = "";
  setChatOpen(true);
});

boot().catch((error) => {
  showStatus(error.message, true);
  window.location.href = "/static/login.html";
});
