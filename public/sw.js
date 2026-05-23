// Minimal service worker for FNOL PWA.
// - Network-first for everything (insurance data is sensitive; stale offline
//   responses could mislead someone mid-claim).
// - Caches the offline shell so the app still loads enough to say "you're
//   offline, please reconnect."

const CACHE = "fnol-shell-v1";
const SHELL = ["/", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept API or auth callbacks.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/callback") ||
    event.request.method !== "GET"
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // Cache successful navigations for offline fallback only.
        if (res.ok && url.pathname === "/") {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cached) =>
            cached ||
            new Response("Offline. Reconnect to continue your claim.", {
              status: 503,
              headers: { "content-type": "text/plain" },
            }),
        ),
      ),
  );
});

// Push notifications fired by /api/push (M14).
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || "Alchemy update";
  const body = data.body || "You have an update on your claim.";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(self.clients.openWindow(url));
});
