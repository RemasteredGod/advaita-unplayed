// sw.js — clean service worker
// Immediately replaces any stale cached SW (skipWaiting) and never
// intercepts socket.io or video-stream requests, fixing the polling errors.

const BYPASS = [/\/socket\.io\//, /\/stream\//];

self.addEventListener("install", () => {
  // Activate right away — don't wait for tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of all open pages immediately.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // For socket.io polling/WS and video streaming, do NOT call
  // respondWith() — the browser handles these natively with no SW overhead.
  if (BYPASS.some((re) => re.test(event.request.url))) {
    return;
  }
  // All other requests: pass straight through to the network.
  event.respondWith(fetch(event.request));
});
