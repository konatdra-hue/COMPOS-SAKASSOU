// COMPOS SAKASSOU — Service Worker v6
const CACHE_NAME = "compos-sakassou-v6";
const ASSETS_CACHE = "compos-assets-v6";

// Fichiers à mettre en cache pour fonctionnement hors-ligne
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
];

// Installation — mettre en cache les ressources core
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS).catch(err => {
        console.warn("Cache partiel:", err);
      }))
      .then(() => self.skipWaiting())
  );
});

// Activation — nettoyer anciens caches
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== ASSETS_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Stratégie de fetch intelligente
self.addEventListener("fetch", e => {
  const url = e.request.url;

  // JSONBin — Network First (données temps réel) avec fallback cache
  if (url.includes("api.jsonbin.io")) {
    e.respondWith(
      fetch(e.request.clone())
        .then(res => {
          // Mettre en cache la réponse JSONBin
          if (res.ok) {
            const clone = res.clone();
            caches.open(ASSETS_CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(async () => {
          // Hors-ligne : utiliser le cache
          const cached = await caches.match(e.request);
          if (cached) return cached;
          // Réponse vide JSON si pas de cache
          return new Response(JSON.stringify({record: null, error: "offline"}),
            {headers: {"Content-Type": "application/json"}});
        })
    );
    return;
  }

  // Fonts Google — Cache First
  if (url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com")) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          caches.open(ASSETS_CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        }).catch(() => new Response("", {status: 408}));
      })
    );
    return;
  }

  // CDN (React, Babel, SheetJS) — Cache First
  if (url.includes("cdnjs.cloudflare.com")) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
          return res;
        }).catch(() => caches.match("/index.html"));
      })
    );
    return;
  }

  // App Shell (index.html, icons) — Cache First avec refresh réseau
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(res => {
        if (res.ok) {
          caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => cached || new Response("Hors-ligne", {status: 503}));
      return cached || networkFetch;
    })
  );
});

// Message du client pour forcer une mise à jour
self.addEventListener("message", e => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open("app-cache").then(cache => {
      return cache.addAll([
        "/",
        "/index.html"
      ]);
    })
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});
