const cache = new Map();

async function loadJson(path) {
  if (cache.has(path)) return cache.get(path);
  const res = await fetch(path);
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
