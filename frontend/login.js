const statusEl = document.getElementById("status");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

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

async function routeByRole() {
  try {
    const { user } = await request("/api/auth/me");
    if (user.role === "admin") {
      window.location.href = "/static/admin.html";
      return;
    }
    window.location.href = "/static/player.html";
  } catch (error) {
    // no active session
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showStatus("Authenticating...");

  const formData = new FormData(loginForm);
  const payload = {
    username: formData.get("username"),
    password: formData.get("password"),
  };

  try {
    const { user } = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    showStatus(`Logged in as ${user.username}`);
    await routeByRole();
  } catch (error) {
    showStatus(error.message, true);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showStatus("Creating account...");

  const formData = new FormData(registerForm);
  const payload = {
    username: formData.get("username"),
    password: formData.get("password"),
  };

  try {
    const { user } = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    showStatus(`Registered as ${user.username}`);
    await routeByRole();
  } catch (error) {
    showStatus(error.message, true);
  }
});

routeByRole();
