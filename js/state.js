import { istFrei, freieBiome, naechstesBiom, hoechstesFreies } from './biome-logik.js';

const STORAGE_KEY = 'block-land-state-v1';

const STANDARD_REZEPTE = [
  { id: 'r_geschichte', name: 'Extra-Geschichte',    emoji: '📖', kategorie: 'Eltern-Zeit',     kosten: { holz: 4 },            aktiv: true },
  { id: 'r_mama',       name: 'Mama-Zeit',           emoji: '👩', kategorie: 'Eltern-Zeit',     kosten: { holz: 6 },            aktiv: true },
  { id: 'r_papa',       name: 'Papa-Zeit',           emoji: '👨', kategorie: 'Eltern-Zeit',     kosten: { holz: 6 },            aktiv: true },
  { id: 'r_brettspiel', name: 'Brettspiel zusammen', emoji: '🧩', kategorie: 'Eltern-Zeit',     kosten: { holz: 8 },            aktiv: true },
  { id: 'r_nachtisch',  name: 'Nachtisch wünschen',  emoji: '🍨', kategorie: 'Naschen & Essen', kosten: { stein: 6 },           aktiv: true },
  { id: 'r_nasch',      name: 'Nasch-Gutschein',     emoji: '🍫', kategorie: 'Naschen & Essen', kosten: { stein: 8 },           aktiv: true },
  { id: 'r_spiel15',    name: '15 Min Spielen',      emoji: '⏱️', kategorie: 'Bildschirm-Zeit', kosten: { holz: 10, stein: 4 }, aktiv: true },
  { id: 'r_film',       name: 'Extra-Filmzeit',      emoji: '📺', kategorie: 'Bildschirm-Zeit', kosten: { holz: 12, stein: 6 }, aktiv: true },
  { id: 'r_aufbleiben', name: 'Länger aufbleiben',   emoji: '🌙', kategorie: 'Erlebnisse',      kosten: { holz: 8, blume: 6 },  aktiv: true },
  { id: 'r_filmabend',  name: 'Filmabend aussuchen', emoji: '🎬', kategorie: 'Erlebnisse',      kosten: { eisen: 2 },           aktiv: true },
  { id: 'r_ausflug',    name: 'Ausflug aussuchen',   emoji: '🦖', kategorie: 'Erlebnisse',      kosten: { diamant: 3 },         aktiv: true },
];

const DEFAULT_STATE = {
  profiles: {},        // { profileId: { id, name, weltName, avatar, alter, createdAt } }
  currentProfileId: null,
  rezepte: STANDARD_REZEPTE,   // familienweit gemeinsamer Belohnungs-Katalog
  rezepteVerwaltet: false,     // true, sobald Eltern den Katalog angepasst haben
  parentSettings: {
    pinEnabled: false,
    pin: null,
    diamantSeltenheit: 'sehr_selten',  // (Alt, ungenutzt seit Material-Reglern)
    dropChancen: { holz: 0.9, stein: 0.85, blume: 0.85, eisen: 0.4, diamant: 0.07 },
  },
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      parentSettings: {
        ...structuredClone(DEFAULT_STATE).parentSettings,
        ...(parsed.parentSettings ?? {}),
      },
    };
  } catch (err) {
    console.warn('[state] Konnte State nicht laden, starte mit Default.', err);
    return structuredClone(DEFAULT_STATE);
  }
}

function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('[state] Speichern fehlgeschlagen — Daten sind NICHT persistent.', err);
  }
}

let state = load();

export function getState() {
  return state;
}

export function getProfiles() {
  return Object.values(state.profiles).map(p => structuredClone(p));
}

export function getProfile(id) {
  return state.profiles[id] ? structuredClone(state.profiles[id]) : null;
}

export function getCurrentProfile() {
  return state.currentProfileId ? structuredClone(state.profiles[state.currentProfileId]) : null;
}

export function setCurrentProfile(id) {
  if (id !== null && !state.profiles[id]) {
    throw new Error(`[state] Profil ${id} existiert nicht`);
  }
  state.currentProfileId = id;
  save(state);
}

export function addProfile({ name, weltName, avatar, alter, kindPin = null }) {
  const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  state.profiles[id] = {
    id,
    name,
    weltName,
    avatar,
    alter,                       // 'kindergarten' | 'klasse-1' | 'klasse-2' | 'klasse-3'
    kindPin: kindPin || null,    // optionale PIN pro Kind (Soft-Lock gegen Verwechslung)
    createdAt: new Date().toISOString(),
    inventar: {},
    gutscheine: [],
    schwierigkeit: { plus: 2 },
    statistik: { plus: { gesamt: 0, richtig: 0 } },
    biome: { aktiv: null, autoFrei: [], elternFrei: [], elternGesperrt: [] },
  };
  save(state);
  return id;
}

export function updateProfile(id, updates) {
  if (!state.profiles[id]) throw new Error(`[state] Profil ${id} existiert nicht`);
  state.profiles[id] = { ...state.profiles[id], ...updates };
  save(state);
}

export function deleteProfile(id) {
  if (!state.profiles[id]) return; // no-op: idempotent, kein Fehler
  delete state.profiles[id];
  if (state.currentProfileId === id) state.currentProfileId = null;
  save(state);
}

export function resetAll() {
  state = structuredClone(DEFAULT_STATE);
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

export function addInventar(profileId, item, anzahl = 1) {
  if (!state.profiles[profileId]) throw new Error(`[state] Profil ${profileId} existiert nicht`);
  const inv = state.profiles[profileId].inventar ?? {};
  inv[item] = (inv[item] ?? 0) + anzahl;
  state.profiles[profileId].inventar = inv;
  save(state);
}

export function getInventar(profileId) {
  return structuredClone(state.profiles[profileId]?.inventar ?? {});
}

export function getSchwierigkeit(profileId, aufgabentyp) {
  return state.profiles[profileId]?.schwierigkeit?.[aufgabentyp] ?? 1;
}

export function setSchwierigkeit(profileId, aufgabentyp, stufe) {
  if (!state.profiles[profileId]) throw new Error(`[state] Profil ${profileId} existiert nicht`);
  state.profiles[profileId].schwierigkeit = state.profiles[profileId].schwierigkeit ?? {};
  state.profiles[profileId].schwierigkeit[aufgabentyp] = stufe;
  save(state);
}

export function trackeAufgabe(profileId, aufgabentyp, war_richtig, zeit_ms = 0) {
  if (!state.profiles[profileId]) throw new Error(`[state] Profil ${profileId} existiert nicht`);
  const stat = state.profiles[profileId].statistik ?? {};
  stat[aufgabentyp] = stat[aufgabentyp] ?? { gesamt: 0, richtig: 0, zeit_summe_ms: 0 };
  stat[aufgabentyp].gesamt += 1;
  if (war_richtig) stat[aufgabentyp].richtig += 1;
  stat[aufgabentyp].zeit_summe_ms = (stat[aufgabentyp].zeit_summe_ms ?? 0) + (zeit_ms || 0);
  state.profiles[profileId].statistik = stat;
  save(state);
}

export function getRezepte() {
  // Eltern-Katalog nur, wenn explizit angepasst; sonst Code-Defaults (Balancing greift sofort).
  const quelle = (state.rezepteVerwaltet && Array.isArray(state.rezepte) && state.rezepte.length)
    ? state.rezepte
    : STANDARD_REZEPTE;
  return quelle.map(r => structuredClone(r));
}

export function getGutscheine(profileId) {
  return structuredClone(state.profiles[profileId]?.gutscheine ?? []);
}

export function kannBauen(profileId, kosten) {
  const inv = state.profiles[profileId]?.inventar ?? {};
  return Object.entries(kosten).every(([item, n]) => (inv[item] ?? 0) >= n);
}

// Baut einen Gutschein: zieht die Kosten vom Inventar ab, legt den Gutschein an.
// Gibt den Gutschein zurück oder null, wenn nicht genug Rohstoffe da sind.
export function baueGutschein(profileId, rezept) {
  const p = state.profiles[profileId];
  if (!p) return null;
  if (!kannBauen(profileId, rezept.kosten)) return null;

  p.inventar = p.inventar ?? {};
  for (const [item, n] of Object.entries(rezept.kosten)) {
    p.inventar[item] = (p.inventar[item] ?? 0) - n;
    if (p.inventar[item] <= 0) delete p.inventar[item];
  }

  const gutschein = {
    id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    rezeptId: rezept.id,
    name: rezept.name,
    emoji: rezept.emoji,
    erstelltAm: new Date().toISOString(),
    eingeloest: false,
  };
  p.gutscheine = p.gutscheine ?? [];
  p.gutscheine.push(gutschein);
  save(state);
  return gutschein;
}

// --- Rezept-Verwaltung (Eltern) ---
export function speichereRezepte(rezepte) {
  state.rezepte = rezepte.map(r => structuredClone(r));
  state.rezepteVerwaltet = true;
  save(state);
}

export function setzeRezepteStandard() {
  state.rezepteVerwaltet = false;
  state.rezepte = STANDARD_REZEPTE;
  save(state);
}

// --- Diamant-Seltenheit ---
export function getDiamantSeltenheit() {
  return state.parentSettings?.diamantSeltenheit ?? 'sehr_selten';
}

export function setzeDiamantSeltenheit(wert) {
  state.parentSettings = state.parentSettings ?? {};
  state.parentSettings.diamantSeltenheit = wert;
  save(state);
}

// --- PIN (Soft-Lock) ---
export function istPinGesetzt() {
  return !!(state.parentSettings && state.parentSettings.pin);
}

export function pruefePin(eingabe) {
  return !!(state.parentSettings && state.parentSettings.pin === String(eingabe));
}

export function setzePin(pin) {
  state.parentSettings = state.parentSettings ?? {};
  state.parentSettings.pin = String(pin);
  state.parentSettings.pinEnabled = true;
  save(state);
}

// --- Gutschein-Verwaltung (Eltern) ---
export function setGutscheinEingeloest(profileId, gutscheinId, eingeloest) {
  const p = state.profiles[profileId];
  if (!p || !p.gutscheine) return;
  const g = p.gutscheine.find(x => x.id === gutscheinId);
  if (g) { g.eingeloest = !!eingeloest; save(state); }
}

export function loescheGutschein(profileId, gutscheinId) {
  const p = state.profiles[profileId];
  if (!p || !p.gutscheine) return;
  p.gutscheine = p.gutscheine.filter(x => x.id !== gutscheinId);
  save(state);
}

// --- Rohstoff-Korrektur (Eltern) ---
export function setzeRohstoff(profileId, item, anzahl) {
  const p = state.profiles[profileId];
  if (!p) return;
  p.inventar = p.inventar ?? {};
  if (anzahl > 0) p.inventar[item] = anzahl;
  else delete p.inventar[item];
  save(state);
}

// --- Kind-PIN (optional pro Profil, Soft-Lock gegen versehentliches Üben beim anderen) ---
export function hatKindPin(profileId) {
  return !!state.profiles[profileId]?.kindPin;
}

export function pruefeKindPin(profileId, eingabe) {
  return !!(state.profiles[profileId] && state.profiles[profileId].kindPin === String(eingabe));
}

export function setzeKindPin(profileId, pin) {
  const p = state.profiles[profileId];
  if (!p) return;
  p.kindPin = pin ? String(pin) : null;
  save(state);
}

// --- Drop-Häufigkeit pro Material (Eltern-Regler) ---
const DEFAULT_DROP = { holz: 0.9, stein: 0.85, blume: 0.85, eisen: 0.4, diamant: 0.07 };

export function getDropChancen() {
  return { ...DEFAULT_DROP, ...(state.parentSettings?.dropChancen ?? {}) };
}

export function setzeDropChance(item, wert) {
  state.parentSettings = state.parentSettings ?? {};
  state.parentSettings.dropChancen = { ...DEFAULT_DROP, ...(state.parentSettings.dropChancen ?? {}) };
  state.parentSettings.dropChancen[item] = wert;
  save(state);
}

// Debug-Helper: globaler Zugriff im Browser-Konsole
window.__blockLandState = { getState, resetAll };

// --- Biom-System ---
// Stellt sicher, dass ein Profil den biome-Block hat (für Altprofile ohne Migration).
function sichereBiom(p) {
  if (!p.biome) p.biome = { aktiv: null, autoFrei: [], elternFrei: [], elternGesperrt: [] };
  p.biome.autoFrei = p.biome.autoFrei ?? [];
  p.biome.elternFrei = p.biome.elternFrei ?? [];
  p.biome.elternGesperrt = p.biome.elternGesperrt ?? [];
  return p.biome;
}

// Freigabe-Objekt für die pure Logik (alter + Unlock-Listen).
export function getBiomFreigabe(profileId) {
  const p = state.profiles[profileId];
  if (!p) return { alter: 'kindergarten', autoFrei: [], elternFrei: [], elternGesperrt: [] };
  const b = sichereBiom(p);
  return { alter: p.alter, autoFrei: b.autoFrei, elternFrei: b.elternFrei, elternGesperrt: b.elternGesperrt };
}

// Aktives Biom: gespeicherte Wahl, falls noch freigeschaltet; sonst höchstes freies.
export function getAktivesBiom(profileId) {
  const p = state.profiles[profileId];
  if (!p) return hoechstesFreies({ alter: 'kindergarten' });
  const b = sichereBiom(p);
  const frei = getBiomFreigabe(profileId);
  if (b.aktiv && istFrei(b.aktiv, frei)) return b.aktiv;
  return hoechstesFreies(frei);
}

export function setAktivesBiom(profileId, id) {
  const p = state.profiles[profileId];
  if (!p) return;
  sichereBiom(p).aktiv = id;
  save(state);
}

// Liste freigeschalteter Biom-Ids (für die Karte).
export function getFreieBiome(profileId) {
  return freieBiome(getBiomFreigabe(profileId));
}

// Schaltet das nächste Biom frei, falls noch gesperrt. Gibt die neue Id zurück oder null.
export function schalteNaechstesBiomFrei(profileId, vonId) {
  const p = state.profiles[profileId];
  if (!p) return null;
  const next = naechstesBiom(vonId);
  if (!next) return null;
  const frei = getBiomFreigabe(profileId);
  if (istFrei(next, frei)) return null; // schon offen
  const b = sichereBiom(p);
  b.autoFrei.push(next);
  save(state);
  return next;
}

// Eltern: Biom öffnen (offen=true) oder schließen (offen=false).
export function setBiomElternStatus(profileId, id, offen) {
  const p = state.profiles[profileId];
  if (!p) return;
  const b = sichereBiom(p);
  b.elternFrei = b.elternFrei.filter(x => x !== id);
  b.elternGesperrt = b.elternGesperrt.filter(x => x !== id);
  if (offen) b.elternFrei.push(id);
  else b.elternGesperrt.push(id);
  save(state);
}
