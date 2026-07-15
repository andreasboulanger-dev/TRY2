// Bump this on every deploy that changes any cached file, so old clients
// pick up the new shell instead of serving stale assets forever.
const CACHE_NAME = "shell-cache-v17";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./splash/iphone-se.png",
  "./splash/iphone-8.png",
  "./splash/iphone-8-plus.png",
  "./splash/iphone-x.png",
  "./splash/iphone-xr.png",
  "./splash/iphone-xs-max.png",
  "./splash/iphone-12.png",
  "./splash/iphone-12-pro-max.png",
  "./splash/iphone-14-pro.png",
  "./splash/iphone-14-pro-max.png",
  "./splash/iphone-16-pro.png",
  "./splash/iphone-16-pro-max.png",
  "./splash/ipad-9.7.png",
  "./splash/ipad-pro-10.5.png",
  "./splash/ipad-pro-11.png",
  "./splash/ipad-pro-12.9.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // cache.addAll() is all-or-nothing: if a single URL 404s, the whole
      // install rejects and the SW never activates. Cache each entry
      // independently instead, so one missing/renamed asset (e.g. a splash
      // image that didn't ship) doesn't break offline support / installability
      // for everything else.
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[sw] failed to precache ${url}:`, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Cache-first for the app shell, falling back to network, falling back to
// the cached index.html for any navigation (so deep links work offline).
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Only handle same-origin requests. Cross-origin requests (CDN fonts,
  // analytics, etc.) are left to the browser's default handling — the
  // catch() below would otherwise turn a cross-origin failure into a
  // thrown network error via respondWith(undefined).
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
    })
  );
});
