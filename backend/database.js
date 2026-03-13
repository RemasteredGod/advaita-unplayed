const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dataDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "hawkins.sqlite");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

async function initDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS media_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('local', 'youtube')),
      title TEXT NOT NULL,
      file_name TEXT,
      youtube_id TEXT,
      uploaded_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(uploaded_by) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

async function ensureDefaultAdmin(passwordHash) {
  const existing = await findUserByUsername("admin");
  if (existing) {
    return existing;
  }

  const result = await run(
    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')",
    ["admin", passwordHash]
  );

  return findUserById(result.lastID);
}

function createUser(username, passwordHash, role = "user") {
  return run(
    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
    [username, passwordHash, role]
  );
}

function findUserByUsername(username) {
  return get("SELECT * FROM users WHERE username = ?", [username]);
}

function findUserById(id) {
  return get("SELECT * FROM users WHERE id = ?", [id]);
}

function updateUsername(userId, username) {
  return run("UPDATE users SET username = ? WHERE id = ?", [username, userId]);
}

function createLocalMedia(title, fileName, uploadedBy) {
  return run(
    "INSERT INTO media_sources (type, title, file_name, uploaded_by) VALUES ('local', ?, ?, ?)",
    [title, fileName, uploadedBy]
  );
}

function createYoutubeMedia(title, youtubeId, uploadedBy) {
  return run(
    "INSERT INTO media_sources (type, title, youtube_id, uploaded_by) VALUES ('youtube', ?, ?, ?)",
    [title, youtubeId, uploadedBy]
  );
}

function listMedia() {
  return all("SELECT * FROM media_sources ORDER BY id DESC");
}

function getMediaById(id) {
  return get("SELECT * FROM media_sources WHERE id = ?", [id]);
}

async function setActiveMedia(mediaId) {
  await run(
    `INSERT INTO settings (key, value) VALUES ('active_media_id', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(mediaId)]
  );
}

async function getActiveMedia() {
  const row = await get("SELECT value FROM settings WHERE key = 'active_media_id'");
  if (!row) {
    return null;
  }
  return getMediaById(Number(row.value));
}

async function setPlaybackState(state) {
  await run(
    `INSERT INTO settings (key, value) VALUES ('playback_state', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [JSON.stringify(state)]
  );
}

async function getPlaybackState() {
  const row = await get("SELECT value FROM settings WHERE key = 'playback_state'");
  if (!row) {
    return null;
  }

  try {
    return JSON.parse(row.value);
  } catch (error) {
    return null;
  }
}

module.exports = {
  db,
  initDatabase,
  ensureDefaultAdmin,
  createUser,
  findUserByUsername,
  findUserById,
  updateUsername,
  createLocalMedia,
  createYoutubeMedia,
  listMedia,
  getMediaById,
  setActiveMedia,
  getActiveMedia,
  setPlaybackState,
  getPlaybackState,
};
