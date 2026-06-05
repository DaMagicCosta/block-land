// Service Worker für die 1×1-App — cache-first, damit sie offline läuft.
// Bei Änderungen an den Dateien einfach CACHE_VERSION hochzählen.
const CACHE_VERSION = "einmaleins-v1";
const DATEIEN = [
  "Einmaleins.html",
  "manifest.webmanifest",
  "icon.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((treffer) => {
      if (treffer) return treffer;
      return fetch(e.request)
        .then((antwort) => {
          // neue gleiche-Origin-Antworten in den Cache legen
          if (antwort.ok && new URL(e.request.url).origin === self.location.origin) {
            const kopie = antwort.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(e.request, kopie));
          }
          return antwort;
        })
        .catch(() => treffer);
    })
  );
});
