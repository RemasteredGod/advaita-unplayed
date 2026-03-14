const whoamiEl = document.getElementById("whoami");
const statusEl = document.getElementById("status");
const sourceLabelEl = document.getElementById("source-label");
const mediaListEl = document.getElementById("media-list");
const connectedUsersEl = document.getElementById("connected-users");
const breakRequestsEl = document.getElementById("break-requests");
const offsetEl = document.getElementById("offset");
const latencySliderEl = document.getElementById("latency-slider");
const latencyValueEl = document.getElementById("latency-value");
const networkLatencyEl = document.getElementById("network-latency");

const localWrapper = document.getElementById("local-wrapper");
const ytWrapper = document.getElementById("yt-wrapper");
const localVideo = document.getElementById("local-video");
const seekSlider = document.getElementById("seek-slider");

let socket;
let currentSource = null;
let currentSourceKey = "";
let latencyMs = Number(latencySliderEl.value || 120);
let ytPlayer = null;
let ytReadyResolve;
const ytReady = new Promise((resolve) => {
  ytReadyResolve = resolve;
});

window.onYouTubeIframeAPIReady = function onYouTubeIframeAPIReady() {
  ytPlayer = new window.YT.Player("yt-player", {
    width: "100%",
    height: "420",
    videoId: "",
    playerVars: {
      controls: 1,
      rel: 0,
      modestbranding: 1,
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

async function request(url, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(url, {
    headers: isFormData ? {} : { "Content-Type": "application/json" },
    ...options,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Request failed");
  }
  return body;
}

function setSourceLabel(source) {
  if (!source) {
    sourceLabelEl.textContent = "No active source";
    return;
  }

  const kind = source.type === "youtube" ? "YOUTUBE" : "LOCAL";
  sourceLabelEl.textContent = `${kind}: ${source.title}`;
}

function setMode(source) {
  const nextKey = source
    ? source.type === "youtube"
      ? `youtube:${source.youtubeId}`
      : `local:${source.streamUrl}`
    : "";
  const sourceChanged = nextKey !== currentSourceKey;

  currentSource = source;
  currentSourceKey = nextKey;
  setSourceLabel(source);

  if (!source) {
    localWrapper.classList.add("hidden");
    ytWrapper.classList.add("hidden");
    return;
  }

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
    if (ytPlayer && source.youtubeId) {
      ytPlayer.loadVideoById({ videoId: source.youtubeId, startSeconds: 0 });
      ytPlayer.pauseVideo();
    }
  });
}

function setLatency(value) {
  const numeric = Number(value);
  const bounded = Number.isFinite(numeric) ? Math.max(0, Math.min(1500, numeric)) : 120;
  latencyMs = bounded;
  latencySliderEl.value = String(bounded);
  latencyValueEl.textContent = `${bounded}ms`;
}

function setNetworkLatency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    networkLatencyEl.textContent = "-- ms";
    return;
  }
  networkLatencyEl.textContent = `${Math.round(numeric)} ms`;
}

function renderBreakRequests(items = []) {
  breakRequestsEl.innerHTML = "";

  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "No pending or recent break requests";
    breakRequestsEl.append(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    const status = String(item.status || "pending").toUpperCase();
    const details = `${item.username} | ${item.durationMin}m | ${item.reason}`;
    li.innerHTML = `<div>${details}</div><div class="muted">STATUS: ${status}</div>`;

    if (item.status === "pending") {
      const actions = document.createElement("div");
      actions.className = "inline-actions";

      const approve = document.createElement("button");
      approve.type = "button";
      approve.textContent = "APPROVE";
      approve.dataset.requestId = String(item.id);
      approve.dataset.approve = "1";

      const deny = document.createElement("button");
      deny.type = "button";
      deny.textContent = "DENY";
      deny.dataset.requestId = String(item.id);
      deny.dataset.approve = "0";

      actions.append(approve, deny);
      li.append(actions);
    }

    breakRequestsEl.append(li);
  });
}

function renderMediaList(items, activeId) {
  mediaListEl.innerHTML = "";
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = String(item.id);
    option.textContent = `[${item.type}] ${item.title}`;
    if (item.id === activeId) {
      option.selected = true;
    }
    mediaListEl.append(option);
  });
}

function renderConnectedUsers(users) {
  connectedUsersEl.innerHTML = "";
  users.forEach((user) => {
    const li = document.createElement("li");
    li.textContent = `${user.username} (${user.role})`;
    connectedUsersEl.append(li);
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

function getDuration() {
  if (!currentSource) {
    return 0;
  }

  if (currentSource.type === "local") {
    return Number(localVideo.duration || 0);
  }

  if (ytPlayer && ytPlayer.getDuration) {
    return Number(ytPlayer.getDuration() || 0);
  }

  return 0;
}

function updateOffset(targetTime) {
  const offset = Math.abs(getCurrentTime() - targetTime);
  offsetEl.textContent = `${offset.toFixed(2)}s`;
}

function applySeek(time) {
  if (!currentSource) {
    return;
  }

  if (currentSource.type === "local") {
    localVideo.currentTime = time;
    return;
  }

  if (ytPlayer && ytPlayer.seekTo) {
    ytPlayer.seekTo(time, true);
  }
}

function applyPlay() {
  if (!currentSource) {
    return;
  }

  if (currentSource.type === "local") {
    localVideo.play().catch(() => {});
    return;
  }

  if (ytPlayer && ytPlayer.playVideo) {
    ytPlayer.playVideo();
  }
}

function applyPause() {
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

function handleSync(action, time) {
  const run = () => {
    applySeek(time);
    if (action === "play") {
      applyPlay();
    }
    if (action === "pause") {
      applyPause();
    }
    if (action === "seek") {
      // seek only
    }
    updateOffset(time);
  };

  if (action === "play" || action === "pause") {
    window.setTimeout(run, latencyMs);
    return;
  }

  run();
}

async function boot() {
  const { user } = await request("/api/auth/me");
  if (user.role !== "admin") {
    window.location.href = "/static/player.html";
    return;
  }

  whoamiEl.textContent = `${user.username} [admin]`;

  const mediaResponse = await request("/api/media");
  renderMediaList(mediaResponse.items, mediaResponse.activeId);

  const activeResponse = await request("/api/media/active");
  setMode(activeResponse.active);

  socket = io();

  socket.on("connected_users", (users) => {
    renderConnectedUsers(users);
  });

  socket.on("source_update", (payload) => {
    setLatency(payload.latencyMs ?? latencyMs);
    setMode(payload.source);
    handleSync("seek", Number(payload.currentTime || 0));
    showStatus(`Active source updated to ${payload.source.title}`);
  });

  socket.on("sync_state", (state) => {
    setLatency(state.latencyMs ?? latencyMs);
    setMode(state.source);
    handleSync(state.isPlaying ? "play" : "pause", Number(state.currentTime || 0));
  });

  socket.on("sync_command", (event) => {
    setLatency(event.latencyMs ?? latencyMs);
    if (event.source) {
      setMode(event.source);
    }
    handleSync(event.action, Number(event.time || 0));
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

  socket.on("break_requests_snapshot", (items) => {
    renderBreakRequests(Array.isArray(items) ? items : []);
  });

  setInterval(() => {
    const duration = getDuration();
    const currentTime = getCurrentTime();

    if (duration > 0) {
      const value = Math.max(0, Math.min(100, (currentTime / duration) * 100));
      seekSlider.value = String(value);
    }
  }, 500);
}

document.getElementById("logout").addEventListener("click", async () => {
  await request("/api/auth/logout", { method: "POST" });
  window.location.href = "/static/login.html";
});

document.getElementById("upload-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  try {
    await request("/api/media/upload", {
      method: "POST",
      body: formData,
    });

    const mediaResponse = await request("/api/media");
    renderMediaList(mediaResponse.items, mediaResponse.activeId);
    showStatus("Upload complete");
    event.currentTarget.reset();
  } catch (error) {
    showStatus(error.message, true);
  }
});

document.getElementById("youtube-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const payload = {
    url: formData.get("url"),
    title: formData.get("title"),
  };

  try {
    await request("/api/media/youtube", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const mediaResponse = await request("/api/media");
    renderMediaList(mediaResponse.items, mediaResponse.activeId);
    showStatus("YouTube source added");
    event.currentTarget.reset();
  } catch (error) {
    showStatus(error.message, true);
  }
});

document.getElementById("activate-source").addEventListener("click", async () => {
  const selected = Number(mediaListEl.value);
  if (!Number.isInteger(selected)) {
    showStatus("Select a source first", true);
    return;
  }

  try {
    const { active } = await request("/api/admin/activate-source", {
      method: "POST",
      body: JSON.stringify({ mediaId: selected }),
    });

    setMode(active);
    showStatus(`Active source set to ${active.title}`);
  } catch (error) {
    showStatus(error.message, true);
  }
});

document.getElementById("play").addEventListener("click", () => {
  if (!currentSource) {
    showStatus("Set an active source before playback", true);
    return;
  }
  const time = getCurrentTime();
  socket.emit("admin_control", { action: "play", time, latencyMs });
});

document.getElementById("pause").addEventListener("click", () => {
  if (!currentSource) {
    showStatus("Set an active source before playback", true);
    return;
  }
  const time = getCurrentTime();
  socket.emit("admin_control", { action: "pause", time, latencyMs });
});

document.getElementById("seek-back").addEventListener("click", () => {
  if (!currentSource) {
    showStatus("Set an active source before playback", true);
    return;
  }
  const time = Math.max(0, getCurrentTime() - 10);
  socket.emit("admin_control", { action: "seek", time, latencyMs });
});

document.getElementById("seek-forward").addEventListener("click", () => {
  if (!currentSource) {
    showStatus("Set an active source before playback", true);
    return;
  }
  const time = getCurrentTime() + 10;
  socket.emit("admin_control", { action: "seek", time, latencyMs });
});

seekSlider.addEventListener("change", () => {
  if (!currentSource) {
    showStatus("Set an active source before playback", true);
    return;
  }
  const duration = getDuration();
  if (duration <= 0) {
    return;
  }

  const target = (Number(seekSlider.value) / 100) * duration;
  socket.emit("admin_control", { action: "seek", time: target, latencyMs });
});

latencySliderEl.addEventListener("input", () => {
  setLatency(latencySliderEl.value);
});

breakRequestsEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const requestId = Number(target.dataset.requestId);
  if (!Number.isInteger(requestId)) {
    return;
  }

  const approve = target.dataset.approve === "1";
  socket.emit("break_request_decision", { requestId, approve });
});

boot().catch((error) => {
  showStatus(error.message, true);
});
