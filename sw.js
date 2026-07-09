// Service Worker für Block-Land — NETWORK-FIRST.
// Online wird IMMER die neueste Version geladen (kein manuelles Cache-Leeren / App-Neustart mehr);
// der Cache dient nur als Offline-Fallback. Der neue Worker übernimmt sofort (skipWaiting + claim).
const CACHE_VERSION = "block-land-v53";
const DATEIEN = [
  "BlockLand.html",
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

// Network-first: erst Netz versuchen (frische Version), dabei in den Cache spiegeln;
// nur bei Netz-Fehler (offline) aus dem Cache bedienen, für Navigationen die Hülle.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((antwort) => {
        if (antwort && antwort.ok) {
          const kopie = antwort.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, kopie));
        }
        return antwort;
      })
      .catch(() =>
        caches.match(req).then((treffer) =>
          treffer || (req.mode === "navigate" ? caches.match("BlockLand.html") : Response.error())
        )
      )
  );
});
