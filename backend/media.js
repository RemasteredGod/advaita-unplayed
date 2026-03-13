const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const {
  createLocalMedia,
  createYoutubeMedia,
  listMedia,
  getMediaById,
  setActiveMedia,
  getActiveMedia,
} = require("./database");

const uploadDir = path.join(__dirname, "..", "videos");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function sanitizeBaseName(input) {
  return String(input || "video")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 40);
}

function extractYouTubeId(urlValue) {
  const value = String(urlValue || "").trim();
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      return id || null;
    }

    if (host.endsWith("youtube.com")) {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }

      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.split("/")[2] || null;
      }

      if (parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/")[2] || null;
      }
    }
  } catch (error) {
    return null;
  }

  return null;
}

function formatMedia(media) {
  if (!media) {
    return null;
  }

  if (media.type === "local") {
    return {
      id: media.id,
      type: "local",
      title: media.title,
      fileName: media.file_name,
      streamUrl: `/stream/${encodeURIComponent(media.file_name)}`,
      createdAt: media.created_at,
    };
  }

  return {
    id: media.id,
    type: "youtube",
    title: media.title,
    youtubeId: media.youtube_id,
    youtubeUrl: `https://www.youtube.com/watch?v=${media.youtube_id}`,
    createdAt: media.created_at,
  };
}

function createMediaRouter({ requireAuth, requireAdmin }) {
  const router = express.Router();

  const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase() || ".mp4";
      const safe = sanitizeBaseName(path.parse(file.originalname).name) || "video";
      cb(null, `${Date.now()}-${safe}${extension}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = [".mp4", ".webm", ".mov", ".mkv", ".m4v"];
      const extension = path.extname(file.originalname).toLowerCase();
      if (!allowed.includes(extension)) {
        cb(new Error("Unsupported video file type"));
        return;
      }
      cb(null, true);
    },
  });

  router.get("/", requireAuth, async (req, res) => {
    try {
      const media = await listMedia();
      const active = await getActiveMedia();
      res.json({
        items: media.map(formatMedia),
        activeId: active ? active.id : null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to load media" });
    }
  });

  router.get("/active", requireAuth, async (req, res) => {
    try {
      const active = await getActiveMedia();
      res.json({ active: formatMedia(active) });
    } catch (error) {
      res.status(500).json({ error: "Failed to load active media" });
    }
  });

  router.post("/upload", requireAdmin, (req, res) => {
    upload.single("video")(req, res, async (err) => {
      if (err) {
        res.status(400).json({ error: err.message || "Upload failed" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "Video file is required" });
        return;
      }

      try {
        const title = String(req.body.title || path.parse(req.file.originalname).name || "Untitled").trim();
        const result = await createLocalMedia(title, req.file.filename, req.session.user.id);
        const media = await getMediaById(result.lastID);
        res.json({ media: formatMedia(media) });
      } catch (error) {
        res.status(500).json({ error: "Failed to store uploaded media" });
      }
    });
  });

  router.post("/youtube", requireAdmin, async (req, res) => {
    try {
      const url = String(req.body.url || "").trim();
      const title = String(req.body.title || "YouTube Source").trim();
      const youtubeId = extractYouTubeId(url);

      if (!youtubeId || youtubeId.length < 6) {
        res.status(400).json({ error: "Invalid YouTube URL" });
        return;
      }

      const result = await createYoutubeMedia(title, youtubeId, req.session.user.id);
      const media = await getMediaById(result.lastID);
      res.json({ media: formatMedia(media) });
    } catch (error) {
      res.status(500).json({ error: "Failed to add YouTube source" });
    }
  });

  router.post("/active", requireAdmin, async (req, res) => {
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

      await setActiveMedia(media.id);
      res.json({ active: formatMedia(media) });
    } catch (error) {
      res.status(500).json({ error: "Failed to activate media" });
    }
  });

  return router;
}

module.exports = {
  createMediaRouter,
  extractYouTubeId,
  formatMedia,
};
