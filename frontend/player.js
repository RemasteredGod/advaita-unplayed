const whoamiEl = document.getElementById("whoami");
const statusEl = document.getElementById("status");
const sourceLabelEl = document.getElementById("source-label");
const syncStateEl = document.getElementById("sync-state");
const offsetEl = document.getElementById("offset");

const localWrapper = document.getElementById("local-wrapper");
const ytWrapper = document.getElementById("yt-wrapper");
const localVideo = document.getElementById("local-video");

let socket;
let currentSource = null;
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
  currentSource = source;

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
    if (localVideo.src !== source.streamUrl) {
      localVideo.src = source.streamUrl;
      localVideo.load();
    }
    return;
  }

  localWrapper.classList.add("hidden");
  ytWrapper.classList.remove("hidden");

  ytReady.then(() => {
    if (ytPlayer && ytPlayer.loadVideoById) {
      ytPlayer.loadVideoById({ videoId: source.youtubeId, startSeconds: 0 });
      ytPlayer.pauseVideo();
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
  if (event.source) {
    setSource(event.source);
  }

  const time = Number(event.time ?? event.currentTime ?? 0);
  const action = event.action || (event.isPlaying ? "play" : "pause");

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
}

async function boot() {
  const { user } = await request("/api/auth/me");
  whoamiEl.textContent = `${user.username} [${user.role}]`;
  if (user.role === "admin") {
    window.location.href = "/static/admin.html";
    return;
  }

  localVideo.controls = false;

  socket = io();

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

boot().catch((error) => {
  showStatus(error.message, true);
  window.location.href = "/static/login.html";
});
