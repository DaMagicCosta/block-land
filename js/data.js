const cache = new Map();

async function loadJson(path) {
  if (cache.has(path)) return cache.get(path);
  // no-cache: beim Server nachfragen statt bis zu 10 Min alte Kopie nehmen (GitHub Pages max-age=600,
  // Befund 15.09.2026). Greift auch beim allerersten Start, bevor der Service Worker die Seite steuert.
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`[data] ${path} nicht geladen: ${res.status}`);
  const data = await res.json();
  cache.set(path, data);
  return data;
}

export function loadAvatare() {
  return loadJson('./data/avatare.json');
}

export function loadBiom(id) {
  return loadJson(`./data/biome/${id}.json`);
}

export function loadBiomManifest() {
  return loadJson('./data/biome-manifest.json');
}

export function loadAufgabenPool() {
  return loadJson('./data/aufgaben-pool.json');
}

export function loadTextaufgaben() {
  return loadJson('./data/textaufgaben.json');
}
