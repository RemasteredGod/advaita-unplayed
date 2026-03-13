const express = require("express");
const bcrypt = require("bcryptjs");

const {
  createUser,
  findUserByUsername,
  findUserById,
  updateUsername,
} = require("./database");

const router = express.Router();

const strangerNames = [
  "hopper",
  "dustin",
  "max",
  "eleven",
  "lucas",
  "mike",
  "will",
  "vecna",
  "joyce",
  "nancy",
  "steve",
  "robin",
];

function randomUsername() {
  const name = strangerNames[Math.floor(Math.random() * strangerNames.length)];
  const number = Math.floor(100 + Math.random() * 900);
  return `${name}-${number}`;
}

function sanitizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 30);
}

async function generateUniqueUsername(maxAttempts = 15) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const candidate = randomUsername();
    const exists = await findUserByUsername(candidate);
    if (!exists) {
      return candidate;
    }
  }

  return `agent-${Date.now().toString().slice(-6)}`;
}

function exposeUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
  };
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user || req.session.user.role !== "admin") {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  next();
}

router.post("/register", async (req, res) => {
  try {
    const password = String(req.body.password || "");
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const requested = sanitizeUsername(req.body.username);
    const username = requested || (await generateUniqueUsername());

    const existing = await findUserByUsername(username);
    if (existing) {
      res.status(409).json({ error: "Username is already taken" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await createUser(username, passwordHash, "user");
    const user = await findUserById(result.lastID);

    req.session.user = exposeUser(user);
    res.json({ user: exposeUser(user) });
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE")) {
      res.status(409).json({ error: "Username is already taken" });
      return;
    }

    res.status(500).json({ error: "Failed to register" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const username = sanitizeUsername(req.body.username);
    const password = String(req.body.password || "");

    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    const user = await findUserByUsername(username);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    req.session.user = exposeUser(user);
    res.json({ user: exposeUser(user) });
  } catch (error) {
    res.status(500).json({ error: "Failed to login" });
  }
});

router.post("/logout", requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

router.put("/me/username", requireAuth, async (req, res) => {
  try {
    const nextName = sanitizeUsername(req.body.username);
    if (!nextName || nextName.length < 3) {
      res.status(400).json({ error: "Username must be at least 3 characters" });
      return;
    }

    const existing = await findUserByUsername(nextName);
    if (existing && existing.id !== req.session.user.id) {
      res.status(409).json({ error: "Username is already taken" });
      return;
    }

    await updateUsername(req.session.user.id, nextName);
    req.session.user.username = nextName;

    res.json({ user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: "Failed to update username" });
  }
});

module.exports = {
  authRouter: router,
  requireAuth,
  requireAdmin,
};
