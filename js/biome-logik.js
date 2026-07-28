// Pure Logik für das Biom-System: Reihenfolge + Freigabe-Berechnung. KEINE DOM-/State-Abhängigkeit.
// Persistenz liegt in state.js, Anzeige-Daten im Manifest. Hier nur die Regeln.

export const BIOME_REIHENFOLGE = ['mengen', 'rechnen10', 'plus', 'minus', 'mal', 'geteilt', 'text', 'zeitenland'];

// Höchster standardmäßig offener Biom-Index je Schulstufe (alle darunter ebenfalls offen).
// Geschichten-Dorf (Index 6) ist ab Klasse 2 offen. Zeitenland (Index 7) ist ebenfalls ab Klasse 2 offen.
const ALTER_BASELINE = { 'kindergarten': 1, 'klasse-1': 3, 'klasse-2': 7, 'klasse-3': 7 };

export function baselineMaxIndex(alter) {
  return ALTER_BASELINE[alter] ?? 0; // Unbekannt → konservativ nur Mengen
}

function index(id) { return BIOME_REIHENFOLGE.indexOf(id); }

// freigabe = { alter, autoFrei?, elternFrei?, elternGesperrt? }
export function istFrei(id, freigabe = {}) {
  if (index(id) === -1) return false;
  if ((freigabe.elternGesperrt ?? []).includes(id)) return false; // Eltern-Sperre überstimmt alles
  if (index(id) <= baselineMaxIndex(freigabe.alter)) return true;
  if ((freigabe.autoFrei ?? []).includes(id)) return true;
  if ((freigabe.elternFrei ?? []).includes(id)) return true;
  return false;
}

export function freieBiome(freigabe = {}) {
  return BIOME_REIHENFOLGE.filter(id => istFrei(id, freigabe));
}

export function naechstesBiom(id) {
  const i = index(id);
  if (i === -1 || i + 1 >= BIOME_REIHENFOLGE.length) return null;
  return BIOME_REIHENFOLGE[i + 1];
}

// Höchstes freigeschaltetes Biom — Default für das aktive Biom beim Eintritt.
export function hoechstesFreies(freigabe = {}) {
  const frei = freieBiome(freigabe);
  return frei.length ? frei[frei.length - 1] : BIOME_REIHENFOLGE[0];
}
