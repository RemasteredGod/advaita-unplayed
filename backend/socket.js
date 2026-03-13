const { getActiveMedia, getPlaybackState, setPlaybackState } = require("./database");
const { formatMedia } = require("./media");

function createInitialState(activeMedia) {
  return {
    source: formatMedia(activeMedia),
    currentTime: 0,
    isPlaying: false,
    updatedAt: Date.now(),
  };
}

function buildCurrentTime(state) {
  if (!state.isPlaying) {
    return state.currentTime;
  }

  const elapsed = Math.max(0, Date.now() - Number(state.updatedAt || Date.now())) / 1000;
  return state.currentTime + elapsed;
}

function setupSocket(io) {
  const connectedUsers = new Map();
  let playbackState = null;

  async function ensurePlaybackState() {
    if (playbackState) {
      return playbackState;
    }

    const activeMedia = await getActiveMedia();
    const fromDb = await getPlaybackState();

    if (!fromDb) {
      playbackState = createInitialState(activeMedia);
    } else {
      playbackState = {
        source: fromDb.source || formatMedia(activeMedia),
        currentTime: Number(fromDb.currentTime || 0),
        isPlaying: Boolean(fromDb.isPlaying),
        updatedAt: Number(fromDb.updatedAt || Date.now()),
      };
    }

    return playbackState;
  }

  async function persistState() {
    if (!playbackState) {
      return;
    }
    await setPlaybackState(playbackState);
  }

  function broadcastUsers() {
    const users = Array.from(connectedUsers.values()).map((user) => ({
      id: user.id,
      username: user.username,
      role: user.role,
    }));

    io.emit("connected_users", users);
  }

  io.on("connection", async (socket) => {
    const user = socket.request.session && socket.request.session.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    connectedUsers.set(socket.id, user);
    broadcastUsers();

    await ensurePlaybackState();

    socket.emit("sync_state", {
      source: playbackState.source,
      currentTime: buildCurrentTime(playbackState),
      isPlaying: playbackState.isPlaying,
      updatedAt: Date.now(),
    });

    socket.on("admin_set_source", async (payload = {}) => {
      if (user.role !== "admin") {
        socket.emit("sync_error", { error: "Admin role required" });
        return;
      }

      if (!payload.source || !payload.source.id) {
        socket.emit("sync_error", { error: "Invalid source payload" });
        return;
      }

      playbackState = {
        source: payload.source,
        currentTime: 0,
        isPlaying: false,
        updatedAt: Date.now(),
      };

      await persistState();
      io.emit("source_update", {
        source: playbackState.source,
        currentTime: 0,
        isPlaying: false,
        updatedAt: playbackState.updatedAt,
      });
    });

    socket.on("admin_control", async (payload = {}) => {
      if (user.role !== "admin") {
        socket.emit("sync_error", { error: "Admin role required" });
        return;
      }

      await ensurePlaybackState();

      const action = String(payload.action || "").toLowerCase();
      const submittedTime = Number(payload.time);
      const now = Date.now();

      if (!["play", "pause", "seek"].includes(action)) {
        socket.emit("sync_error", { error: "Unsupported action" });
        return;
      }

      const canonicalTime = Number.isFinite(submittedTime)
        ? Math.max(0, submittedTime)
        : buildCurrentTime(playbackState);

      if (action === "seek") {
        playbackState.currentTime = canonicalTime;
        playbackState.updatedAt = now;
      }

      if (action === "play") {
        playbackState.currentTime = canonicalTime;
        playbackState.isPlaying = true;
        playbackState.updatedAt = now;
      }

      if (action === "pause") {
        playbackState.currentTime = canonicalTime;
        playbackState.isPlaying = false;
        playbackState.updatedAt = now;
      }

      await persistState();

      io.emit("sync_command", {
        action,
        time: playbackState.currentTime,
        source: playbackState.source,
        updatedAt: playbackState.updatedAt,
      });
    });

    socket.on("request_sync", async () => {
      await ensurePlaybackState();
      socket.emit("sync_state", {
        source: playbackState.source,
        currentTime: buildCurrentTime(playbackState),
        isPlaying: playbackState.isPlaying,
        updatedAt: Date.now(),
      });
    });

    socket.on("disconnect", () => {
      connectedUsers.delete(socket.id);
      broadcastUsers();
    });
  });

  return {
    getConnectedUsers() {
      return Array.from(connectedUsers.values());
    },
  };
}

module.exports = {
  setupSocket,
};
