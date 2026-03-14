const { getActiveMedia, getPlaybackState, setPlaybackState } = require("./database");
const { formatMedia } = require("./media");

function createInitialState(activeMedia) {
  return {
    source: formatMedia(activeMedia),
    currentTime: 0,
    isPlaying: false,
    latencyMs: 120,
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
  const breakRequests = new Map();
  const chatMessages = [];
  const maxChatMessages = 120;
  let breakRequestSeq = 1;
  let playbackState = null;

  function sanitizeLatency(value, fallback = 120) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return Math.max(0, Math.min(1500, numeric));
  }

  function setPlaybackStateSnapshot(nextState = {}) {
    const previous = playbackState || createInitialState(null);
    playbackState = {
      source: nextState.source ?? previous.source ?? null,
      currentTime: Number.isFinite(Number(nextState.currentTime))
        ? Math.max(0, Number(nextState.currentTime))
        : Number(previous.currentTime || 0),
      isPlaying: Boolean(nextState.isPlaying),
      latencyMs: sanitizeLatency(nextState.latencyMs, previous.latencyMs || 120),
      updatedAt: Number.isFinite(Number(nextState.updatedAt))
        ? Number(nextState.updatedAt)
        : Date.now(),
    };
    return playbackState;
  }

  async function ensurePlaybackState() {
    if (playbackState) {
      return playbackState;
    }

    const activeMedia = await getActiveMedia();
    const fromDb = await getPlaybackState();

    if (!fromDb) {
      playbackState = createInitialState(activeMedia);
    } else {
      setPlaybackStateSnapshot({
        source: fromDb.source || formatMedia(activeMedia),
        currentTime: Number(fromDb.currentTime || 0),
        isPlaying: Boolean(fromDb.isPlaying),
        latencyMs: Number(fromDb.latencyMs),
        updatedAt: Number(fromDb.updatedAt || Date.now()),
      });
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

  function toBreakPayload(entry) {
    return {
      id: entry.id,
      userId: entry.userId,
      username: entry.username,
      reason: entry.reason,
      durationMin: entry.durationMin,
      status: entry.status,
      createdAt: entry.createdAt,
      resolvedAt: entry.resolvedAt,
      resolvedBy: entry.resolvedBy,
    };
  }

  function listBreakRequests() {
    return Array.from(breakRequests.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(toBreakPayload);
  }

  function emitToUser(userId, eventName, payload) {
    connectedUsers.forEach((member, socketId) => {
      if (member.id === userId) {
        io.to(socketId).emit(eventName, payload);
      }
    });
  }

  function emitBreakSnapshotToAdmins() {
    const snapshot = listBreakRequests();
    connectedUsers.forEach((member, socketId) => {
      if (member.role === "admin") {
        io.to(socketId).emit("break_requests_snapshot", snapshot);
      }
    });
  }

  function toChatPayload(entry) {
    return {
      id: entry.id,
      userId: entry.userId,
      username: entry.username,
      message: entry.message,
      createdAt: entry.createdAt,
    };
  }

  function pushChatMessage(entry) {
    chatMessages.push(entry);
    if (chatMessages.length > maxChatMessages) {
      chatMessages.splice(0, chatMessages.length - maxChatMessages);
    }
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
      latencyMs: playbackState.latencyMs,
      updatedAt: Date.now(),
    });

    socket.emit("chat_history", chatMessages.map(toChatPayload));

    if (user.role === "admin") {
      socket.emit("break_requests_snapshot", listBreakRequests());
    }

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
        latencyMs: sanitizeLatency(payload.latencyMs, playbackState.latencyMs),
        updatedAt: Date.now(),
      };

      await persistState();
      io.emit("source_update", {
        source: playbackState.source,
        currentTime: 0,
        isPlaying: false,
        latencyMs: playbackState.latencyMs,
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
      const submittedLatency = Number(payload.latencyMs);
      const now = Date.now();

      if (!["play", "pause", "seek"].includes(action)) {
        socket.emit("sync_error", { error: "Unsupported action" });
        return;
      }

      const canonicalTime = Number.isFinite(submittedTime)
        ? Math.max(0, submittedTime)
        : buildCurrentTime(playbackState);

      if (Number.isFinite(submittedLatency)) {
        playbackState.latencyMs = sanitizeLatency(submittedLatency, playbackState.latencyMs);
      }

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
        latencyMs: playbackState.latencyMs,
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
        latencyMs: playbackState.latencyMs,
        updatedAt: Date.now(),
      });
    });

    socket.on("latency_probe", (payload = {}) => {
      socket.emit("latency_pong", {
        sentAt: Number(payload.sentAt),
        serverAt: Date.now(),
      });
    });

    socket.on("chat_send", (payload = {}) => {
      const message = String(payload.message || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 280);

      if (!message) {
        return;
      }

      const chatEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId: user.id,
        username: user.username,
        message,
        createdAt: Date.now(),
      };

      pushChatMessage(chatEntry);
      io.emit("chat_message", toChatPayload(chatEntry));
    });

    socket.on("break_request_submit", (payload = {}) => {
      if (user.role === "admin") {
        socket.emit("sync_error", { error: "Admins cannot request breaks" });
        return;
      }

      const reason = String(payload.reason || "Need a short break")
        .trim()
        .slice(0, 120);
      const durationMin = Math.max(1, Math.min(30, Number(payload.durationMin) || 5));

      const pendingExisting = Array.from(breakRequests.values()).find(
        (entry) => entry.userId === user.id && entry.status === "pending"
      );

      if (pendingExisting) {
        socket.emit("sync_error", { error: "You already have a pending break request" });
        return;
      }

      const request = {
        id: breakRequestSeq,
        userId: user.id,
        username: user.username,
        reason,
        durationMin,
        status: "pending",
        createdAt: Date.now(),
        resolvedAt: null,
        resolvedBy: null,
      };

      breakRequestSeq += 1;
      breakRequests.set(request.id, request);

      emitToUser(user.id, "break_request_status", toBreakPayload(request));
      emitBreakSnapshotToAdmins();
    });

    socket.on("break_request_decision", async (payload = {}) => {
      if (user.role !== "admin") {
        socket.emit("sync_error", { error: "Admin role required" });
        return;
      }

      const requestId = Number(payload.requestId);
      const approve = Boolean(payload.approve);
      const request = breakRequests.get(requestId);

      if (!request) {
        socket.emit("sync_error", { error: "Break request not found" });
        return;
      }

      if (request.status !== "pending") {
        socket.emit("sync_error", { error: "Break request already resolved" });
        return;
      }

      request.status = approve ? "approved" : "denied";
      request.resolvedAt = Date.now();
      request.resolvedBy = user.username;
      breakRequests.set(request.id, request);

      if (approve) {
        await ensurePlaybackState();
        playbackState.currentTime = buildCurrentTime(playbackState);
        playbackState.isPlaying = false;
        playbackState.updatedAt = Date.now();
        await persistState();

        io.emit("sync_command", {
          action: "pause",
          time: playbackState.currentTime,
          latencyMs: playbackState.latencyMs,
          source: playbackState.source,
          updatedAt: playbackState.updatedAt,
        });
      }

      emitToUser(request.userId, "break_request_status", toBreakPayload(request));
      emitBreakSnapshotToAdmins();
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
    setPlaybackStateSnapshot,
  };
}

module.exports = {
  setupSocket,
};
