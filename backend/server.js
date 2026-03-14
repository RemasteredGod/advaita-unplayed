const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { Server } = require("socket.io");

const {
  initDatabase,
  ensureDefaultAdmin,
  getMediaById,
  setActiveMedia,
  setPlaybackState,
} = require("./database");
const { authRouter, requireAuth, requireAdmin } = require("./auth");
const { createMediaRouter, formatMedia } = require("./media");
const { setupSocket } = require("./socket");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "hawkins-dev-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    sameSite: "lax",
  },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

io.engine.use((req, res, next) => {
  sessionMiddleware(req, res, next);
});

const frontendDir = path.join(__dirname, "..", "frontend");
const videosDir = path.join(__dirname, "..", "videos");

app.use("/static", express.static(frontendDir));
app.use("/api/auth", authRouter);
app.use("/api/media", createMediaRouter({ requireAuth, requireAdmin }));

// Serve the service worker from root so its scope covers all paths (socket.io, /stream/, etc.)
app.get("/sw.js", (req, res) => {
  res.set("Service-Worker-Allowed", "/");
  res.set("Cache-Control", "no-cache");
  res.sendFile(path.join(frontendDir, "sw.js"));
});

app.get("/", (req, res) => {
  res.redirect("/static/login.html");
});

app.get("/admin", (req, res) => {
  res.redirect("/static/admin.html");
});

app.get("/player", (req, res) => {
  res.redirect("/static/player.html");
});

app.get("/api/admin/connected-users", requireAdmin, (req, res) => {
  const users = socketApi.getConnectedUsers();
  res.json({ users });
});

app.get("/stream/:filename", requireAuth, (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(videosDir, safeName);

  if (!fs.existsSync(filePath)) {
    res.status(404).send("Video not found");
    return;
  }

  const stat = fs.statSync(filePath);
  const total = stat.size;
  const range = req.headers.range;

  if (!range) {
    res.writeHead(200, {
      "Content-Length": total,
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const parts = range.replace(/bytes=/, "").split("-");
  const start = Number(parts[0]);
  const end = parts[1] ? Number(parts[1]) : total - 1;

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start < 0 || end >= total) {
    res.status(416).send("Invalid range");
    return;
  }

  const chunkSize = end - start + 1;
  const stream = fs.createReadStream(filePath, { start, end });

  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${total}`,
    "Accept-Ranges": "bytes",
    "Content-Length": chunkSize,
    "Content-Type": "video/mp4",
  });

  stream.pipe(res);
});

let socketApi;

async function bootstrap() {
  await initDatabase();

  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const hash = await bcrypt.hash(adminPassword, 10);
  await ensureDefaultAdmin(hash);

  socketApi = setupSocket(io);

  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "0.0.0.0";

  server.listen(port, host, () => {
    const displayHost = host === "0.0.0.0" ? "localhost" : host;
    // eslint-disable-next-line no-console
    console.log(`Hawkins Sync server listening on http://${displayHost}:${port}`);
  });
}

// Keep active playback state coherent when admin chooses a source via REST.
app.post("/api/admin/activate-source", requireAdmin, async (req, res) => {
  try {
    const mediaId = Number(req.body.mediaId);
    if (!Number.isInteger(mediaId)) {
      res.status(400).json({ error: "mediaId is required" });
      return;
    }

    const media = await getMediaById(mediaId);
    if (!media) {
      res.status(404).json({ error: "Media not found" });
      return;
    }

    await setActiveMedia(mediaId);
    const source = formatMedia(media);

    const payload = {
      source,
      currentTime: 0,
      isPlaying: false,
      latencyMs: 120,
      updatedAt: Date.now(),
    };

    await setPlaybackState(payload);
    if (socketApi && typeof socketApi.setPlaybackStateSnapshot === "function") {
      socketApi.setPlaybackStateSnapshot(payload);
    }
    io.emit("source_update", payload);

    res.json({ active: source });
  } catch (error) {
    res.status(500).json({ error: "Failed to activate source" });
  }
});

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to bootstrap server", error);
  process.exit(1);
});
