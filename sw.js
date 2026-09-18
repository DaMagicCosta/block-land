// Service Worker für Block-Land — NETWORK-FIRST.
// Online wird IMMER die neueste Version geladen (kein manuelles Cache-Leeren / App-Neustart mehr);
// der Cache dient nur als Offline-Fallback. Der neue Worker übernimmt sofort (skipWaiting + claim).
const CACHE_VERSION = "block-land-v98";
const DATEIEN = [
  "BlockLand.html",
  "manifest.webmanifest",
  "icon.svg"
];

// Version auf Anfrage melden (js/app-version.js → Eltern-Bereich): Antwort über den
// mitgeschickten MessageChannel-Port. So zeigt die App, was auf DIESEM Gerät wirklich
// läuft — bei Cache-/Update-Verdacht ist das die einzig ehrliche Auskunft.
self.addEventListener("message", (e) => {
  if (e.data === "version?" && e.ports && e.ports[0]) {
    e.ports[0].postMessage({ typ: "sw-version", version: CACHE_VERSION });
  }
});

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
//
// cache: "no-cache" (Befund 15.09.2026): GitHub Pages schickt max-age=600. Ein normales fetch()
// nahm deshalb bis zu 10 Minuten nach einem Update noch die alte Kopie aus dem HTTP-Cache des
// Browsers — die App meldete schon die neue Fassung (sw.js lädt immer frisch), rechnete aber mit
// dem alten Aufgaben-Pool. So entstehen Mischstände, die sich später nicht nachstellen lassen.
// "no-cache" fragt jedes Mal beim Server nach (If-Modified-Since/ETag); unverändert = kleine
// 304-Antwort. Navigationen lassen sich nicht mit RequestInit neu bauen, daher über die URL.
function frischHolen(req) {
  return req.mode === "navigate"
    ? fetch(req.url, { cache: "no-cache", credentials: "same-origin" })
    : fetch(req, { cache: "no-cache" });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    frischHolen(req)
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
