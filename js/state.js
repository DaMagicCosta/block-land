import { istFrei, freieBiome, naechstesBiom, hoechstesFreies } from './biome-logik.js';
import { gruppiereGutscheine, entferneAusStapel } from './gutschein-logik.js';
import { aktualisiereVerlauf, tagesSchluessel } from './statistik-logik.js';
import { fuegeEintragHinzu } from './aufsage-protokoll-logik.js';
import { offeneBiome } from './reihe-logik.js';
import { zielFuer, neuerAuftrag, aktualisiereTagesauftrag } from './tagesauftrag-logik.js';
import { klemmeInventar, deserialisiereAnzahl, serialisiereAnzahl } from './zustand-sync-logik.js';
import { normalisiereTimer } from './timer-logik.js';
import { hatOffeneAnfrage, fuegeAnfrageHinzu, setzeAnfrageStatus, entferneAnfrage, entferneNachStatus, klemmeAnzahl } from './gutschein-anfrage-logik.js';

// --- Spielstand-Sync: Melde-Hook (sync.js registriert sich hier — kein Import-Zyklus).
// Im Einspiel-Modus (fremde Ereignisse anwenden) wird NICHT erneut gemeldet (Echo-Schutz).
let zustandsMelder = null;   // (op, args) => void
let einspielModus = false;

export function registriereZustandsMelder(fn) { zustandsMelder = fn; }

function melde(op, args) {
  if (einspielModus || !zustandsMelder) return;
  try { zustandsMelder(op, args); }
  catch (err) { console.warn('[state] Zustands-Meldung fehlgeschlagen.', err); }
}

const STORAGE_KEY = 'block-land-state-v1';

// WICHTIG — Beschluss 13.07.2026 (siehe 09_Kinder/Block-Land-Brücke.md):
// Gutscheine sind BESTIMMUNGSRECHTE, niemals erspielte Elternzeit.
// Zeit mit Mama und Papa ist gesetzt und findet immer statt — sie ist nie Belohnung und nie
// Druckmittel. Wird sie zur erspielten Ware, lernt ein Kind bei Misserfolg: „Ich habe mir die
// Zeit mit Papa nicht verdient." Was der Gutschein freischaltet, ist nicht OB, sondern WAS.
// Deshalb hier kein „Papa-Zeit"/„Mama-Zeit" mehr. Bitte auch nie wieder einführen.
const STANDARD_REZEPTE = [
  { id: 'r_papa',       name: "Papa: ich such's aus", emoji: '👨', kategorie: 'Ich bestimme',    kosten: { holz: 6 },            aktiv: true },
  { id: 'r_mama',       name: "Mama: ich such's aus", emoji: '👩', kategorie: 'Ich bestimme',    kosten: { holz: 6 },            aktiv: true },
  { id: 'r_brettspiel', name: 'Brettspiel aussuchen', emoji: '🧩', kategorie: 'Ich bestimme',    kosten: { holz: 8 },            aktiv: true },
  { id: 'r_forschen',   name: 'Forscher-Wunsch',      emoji: '🔬', kategorie: 'Ich bestimme',    kosten: { holz: 10 },           aktiv: true },
  { id: 'r_geschichte', name: 'Extra-Geschichte',     emoji: '📖', kategorie: 'Extra obendrauf', kosten: { holz: 4 },            aktiv: true },
  { id: 'r_nachtisch',  name: 'Nachtisch wünschen',  emoji: '🍨', kategorie: 'Naschen & Essen', kosten: { stein: 6 },           aktiv: true },
  { id: 'r_nasch',      name: 'Nasch-Gutschein',     emoji: '🍫', kategorie: 'Naschen & Essen', kosten: { stein: 8 },           aktiv: true },
  { id: 'r_spiel15',    name: '15 Min Spielen',      emoji: '⏱️', kategorie: 'Bildschirm-Zeit', kosten: { holz: 10, stein: 4 }, aktiv: true, wert: 15, einheit: 'Min' },
  { id: 'r_film',       name: 'Extra-Filmzeit',      emoji: '📺', kategorie: 'Bildschirm-Zeit', kosten: { holz: 12, stein: 6 }, aktiv: true },
  { id: 'r_aufbleiben', name: 'Länger aufbleiben',   emoji: '🌙', kategorie: 'Extra obendrauf', kosten: { holz: 8, blume: 6 },  aktiv: true },
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
    sync: { url: '', schluessel: '', aktiv: false },   // Familien-Sync pro Gerät (Eltern-Bereich)
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
    verlauf: {},                 // Tages-Verlauf pro Rechenart (Statistik-Tab)
    aufsagenProtokoll: [],       // Ereignis-Log Mal-Reihen-Aufsagen (Zeit + Durchgänge je Stufe)
    eintragenProtokoll: [],      // Ereignis-Log Mal-Reihen-Eintragen (richtig/fehler/verraten je Reihe)
    aktiveReihen: {},            // laufende Übungsreihen pro Biom (Wiedereinstieg)
    fehlerbox: {},               // Leitner-Box: falsche Aufgaben kommen gezielt wieder (fehlerbox-logik.js)
    schwierigkeit: { plus: 2 },
    statistik: { plus: { gesamt: 0, richtig: 0 } },
    biome: { aktiv: null, autoFrei: [], elternFrei: [], elternGesperrt: [] },
    tagesauftrag: neuerAuftrag(tagesSchluessel(new Date())),  // Tafel-Fortschritt „N/Ziel", lazy Reset pro Tag
    timer: { tagSekunden: 0, nachtBis: null, zuletztAktiv: null },  // Übungs-Timer „Wandernde Sonne"
    timerKonfig: null,   // null = Studien-Standard nach alter (timer-logik.standardFuer)
  };
  save(state);
  melde('profilAngelegt', { profil: structuredClone(state.profiles[id]) });
  return id;
}

export function updateProfile(id, updates) {
  if (!state.profiles[id]) throw new Error(`[state] Profil ${id} existiert nicht`);
  state.profiles[id] = { ...state.profiles[id], ...updates };
  save(state);
  melde('profilGeaendert', { id, updates: structuredClone(updates) });
}

export function deleteProfile(id) {
  if (!state.profiles[id]) return; // no-op: idempotent, kein Fehler
  delete state.profiles[id];
  if (state.currentProfileId === id) state.currentProfileId = null;
  save(state);
  melde('profilGeloescht', { id });
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
  melde('inventarPlus', { profilId: profileId, item, anzahl });
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
  melde('schwierigkeitGesetzt', { profilId: profileId, typ: aufgabentyp, stufe });
}

export function trackeAufgabe(profileId, aufgabentyp, war_richtig, zeit_ms = 0, datum = new Date()) {
  if (!state.profiles[profileId]) throw new Error(`[state] Profil ${profileId} existiert nicht`);
  const stat = state.profiles[profileId].statistik ?? {};
  stat[aufgabentyp] = stat[aufgabentyp] ?? { gesamt: 0, richtig: 0, zeit_summe_ms: 0 };
  stat[aufgabentyp].gesamt += 1;
  if (war_richtig) stat[aufgabentyp].richtig += 1;
  stat[aufgabentyp].zeit_summe_ms = (stat[aufgabentyp].zeit_summe_ms ?? 0) + (zeit_ms || 0);
  state.profiles[profileId].statistik = stat;
  const p = state.profiles[profileId];
  p.verlauf = aktualisiereVerlauf(p.verlauf, aufgabentyp, war_richtig, datum, 60, zeit_ms);
  // Tagesauftrag nur für HEUTE zählen: ein nachträglich eingespieltes Ereignis von
  // gestern (Gerät war offline) darf den heutigen Fortschritt nicht durch einen
  // veralteten Auftrag ersetzen („im Zweifel zugunsten des Kindes").
  const heute = tagesSchluessel(new Date());
  if (tagesSchluessel(datum) === heute) {
    p.tagesauftrag = aktualisiereTagesauftrag(p.tagesauftrag, heute);
  }
  save(state);
  melde('aufgabeGetrackt', { profilId: profileId, typ: aufgabentyp, richtig: !!war_richtig, zeitMs: zeit_ms });
}

// --- Fehler-Box (Leitner) ---
// Pure Logik in fehlerbox-logik.js. Hier nur Persistenz.
// Bestehende Profile haben das Feld nicht — überall defensiv mit ?? {} lesen.

export function getFehlerbox(profileId) {
  return structuredClone(state.profiles[profileId]?.fehlerbox ?? {});
}

// Eintrag setzen (neu oder aktualisiert) — oder entfernen, wenn `eintrag` null ist.
// Ein Aufruf für beides, damit der Aufrufer das Ergebnis von planeWieder() direkt durchreichen
// kann: null heißt dort „die Aufgabe sitzt jetzt" und hier „raus aus der Box".
export function setzeFehlerboxEintrag(profileId, schluessel, eintrag) {
  const p = state.profiles[profileId];
  if (!p || !schluessel) return;
  p.fehlerbox = p.fehlerbox ?? {};
  if (eintrag) p.fehlerbox[schluessel] = structuredClone(eintrag);
  else delete p.fehlerbox[schluessel];
  save(state);
  melde('fehlerboxGesetzt', { profilId: profileId, schluessel, eintrag: eintrag ? structuredClone(eintrag) : null });
}

export function getVerlauf(profileId) {
  return structuredClone(state.profiles[profileId]?.verlauf ?? {});
}

// --- Tagesauftrag (Auftrags-Tafel im Welt-Header, kein Streak) ---
// Lazy Reset auch beim reinen Lesen (defensive Init für Altprofile ohne das Feld).
export function getTagesauftrag(profileId) {
  const p = state.profiles[profileId];
  if (!p) return null;
  const heute = tagesSchluessel(new Date());
  if (!p.tagesauftrag || p.tagesauftrag.datum !== heute) {
    p.tagesauftrag = neuerAuftrag(heute);
    save(state);
  }
  return { ...structuredClone(p.tagesauftrag), ziel: zielFuer(p.alter) };
}

export function markiereTagesauftragBelohnt(profileId) {
  const p = state.profiles[profileId];
  if (!p || !p.tagesauftrag) return;
  p.tagesauftrag.belohnt = true;
  save(state);
  melde('tagesauftragBelohnt', { profilId: profileId });
}

// --- Übungs-Timer (Wandernde Sonne) ---
// Defensive Init für Altprofile ohne die Felder (Muster wie sichereBiom).
function sichereTimer(p) {
  if (!p.timer) p.timer = { tagSekunden: 0, nachtBis: null, zuletztAktiv: null };
  return p.timer;
}

export function getTimer(profileId) {
  const p = state.profiles[profileId];
  if (!p) return null;
  return structuredClone(sichereTimer(p));
}

// Persistiert den Timer-Stand. melden:true NUR bei Phasenwechseln und Verlassen-Checkpoint
// (Spec §4) — 15-s-Raster-Ticks laufen mit melden:false, sonst spammt der Timer das Familien-Log.
export function setzeTimerStand(profileId, timer, { melden = false } = {}) {
  const p = state.profiles[profileId];
  if (!p || !timer) return;
  p.timer = structuredClone(timer);
  save(state);
  if (melden) melde('timerStandGesetzt', { profilId: profileId, timer: structuredClone(timer) });
}

// --- Aufsage-Protokoll (Mal-Reihen) ---
// Eigenes Profil-Feld (NICHT unter statistik, sonst zählt summen() es als Pseudo-Rechenart).
// Defensive Init für Altprofile ohne das Feld.
export function protokolliereAufsagen(profileId, eintrag) {
  const p = state.profiles[profileId];
  if (!p) return;
  p.aufsagenProtokoll = fuegeEintragHinzu(p.aufsagenProtokoll ?? [], eintrag, 50);
  save(state);
  melde('aufsagenProtokolliert', { profilId: profileId, eintrag: structuredClone(eintrag) });
}

export function getAufsagenProtokoll(profileId) {
  return structuredClone(state.profiles[profileId]?.aufsagenProtokoll ?? []);
}

// --- Eintragen-Protokoll (Mal-Trainer) ---
export function protokolliereEintragen(profileId, eintrag) {
  const p = state.profiles[profileId];
  if (!p) return;
  p.eintragenProtokoll = fuegeEintragHinzu(p.eintragenProtokoll ?? [], eintrag, 50);
  save(state);
  melde('eintragenProtokolliert', { profilId: profileId, eintrag: structuredClone(eintrag) });
}

export function getEintragenProtokoll(profileId) {
  return structuredClone(state.profiles[profileId]?.eintragenProtokoll ?? []);
}

// --- Übungsreihe (Wiedereinstieg) ---
// Eine offene Reihe PRO Biom (Map biom→reihe), damit unterbrochene Übungen in
// mehreren Ländern unabhängig fortsetzbar sind.
export function getAktiveReihe(profileId, biom) {
  const r = state.profiles[profileId]?.aktiveReihen?.[biom];
  return r ? structuredClone(r) : null;
}

export function setzeAktiveReihe(profileId, biom, reihe) {
  const p = state.profiles[profileId];
  if (!p) return;
  p.aktiveReihen = p.aktiveReihen ?? {};
  if (reihe) p.aktiveReihen[biom] = structuredClone(reihe);
  else delete p.aktiveReihen[biom];
  save(state);
  melde('aktiveReiheGesetzt', { profilId: profileId, biom, reihe: reihe ? structuredClone(reihe) : null });
}

// Biom-Ids mit offener Reihe (für Karten-Flaggen + Welt-Hinweispunkt).
export function getOffeneReihen(profileId) {
  return offeneBiome(state.profiles[profileId]?.aktiveReihen ?? {});
}

export function getRezepte() {
  // Eltern-Katalog nur, wenn explizit angepasst; sonst Code-Defaults (Balancing greift sofort).
  const quelle = (state.rezepteVerwaltet && Array.isArray(state.rezepte) && state.rezepte.length)
    ? state.rezepte
    : STANDARD_REZEPTE;
  // Seed-Merge: Standard-Rezepte bringen wert/einheit mit. Ein älterer Eltern-Katalog
  // (vor diesem Feature gespeichert) hat diese Felder nicht — hier zerstörungsfrei ergänzen,
  // damit das Aufsummieren auch in bestehenden Familien-Setups greift. Eltern-Overrides bleiben.
  const seed = Object.fromEntries(STANDARD_REZEPTE.map(r => [r.id, r]));
  return quelle.map(r => {
    const klon = structuredClone(r);
    if (klon.wert === undefined && seed[klon.id]?.wert !== undefined) {
      klon.wert = seed[klon.id].wert;
      klon.einheit = seed[klon.id].einheit;
    }
    return klon;
  });
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
    wert: rezept.wert,
    einheit: rezept.einheit,
    erstelltAm: new Date().toISOString(),
    eingeloest: false,
  };
  p.gutscheine = p.gutscheine ?? [];
  p.gutscheine.push(gutschein);
  save(state);
  melde('gutscheinGebaut', { profilId: profileId, gutschein: structuredClone(gutschein), kosten: structuredClone(rezept.kosten) });
  return gutschein;
}

// --- Rezept-Verwaltung (Eltern) ---
export function speichereRezepte(rezepte) {
  state.rezepte = rezepte.map(r => structuredClone(r));
  state.rezepteVerwaltet = true;
  save(state);
  melde('rezepteGespeichert', { rezepte: state.rezepte.map(r => structuredClone(r)) });
}

export function setzeRezepteStandard() {
  state.rezepteVerwaltet = false;
  state.rezepte = STANDARD_REZEPTE;
  save(state);
  melde('rezepteStandard', {});
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
  melde('pinGesetzt', { pin: String(pin) });
}

// --- Gutschein-Verwaltung (Eltern) ---
// Offene Gutscheine gruppiert (für Werkstatt + Eltern-Anzeige).
// Fallback: Gutscheine, die VOR diesem Feature gebaut wurden, haben keinen wert/einheit-Snapshot.
// Fehlt der Wert, wird er aus dem aktuellen Katalog (getRezepte, inkl. Seed-Merge) nachgefüllt,
// damit die Minuten-Summe auch für Altbestände erscheint.
export function getGutscheinStapel(profileId) {
  const stapel = gruppiereGutscheine(state.profiles[profileId]?.gutscheine ?? []);
  const katalog = Object.fromEntries(getRezepte().map(r => [r.id, r]));
  return stapel.map(s => {
    if (typeof s.wert === 'number') return s;
    const r = katalog[s.rezeptId];
    return (r && typeof r.wert === 'number') ? { ...s, wert: r.wert, einheit: r.einheit } : s;
  });
}

// Bis zu `anzahl` offene Gutscheine einer Sorte einlösen (= aus dem Stapel entfernen).
// Manuelles Einlösen zieht OFFENE Anfragen der Sorte zurück (Spec §4, Vor-Ort-Fallback):
// melde() ist im Einspiel-Modus stumm — kommt die Einlösung per Telegram-Freigabe rein,
// steht die Anfrage dank Server-Reihenfolge (erst _e, dann _g) bereits auf 'freigegeben'
// und der Guard greift nicht (Feier bleibt erhalten).
export function loeseGutscheineEin(profileId, rezeptId, anzahl) {
  const p = state.profiles[profileId];
  if (!p || !p.gutscheine) return;
  p.gutscheine = entferneAusStapel(p.gutscheine, rezeptId, anzahl);
  const offene = (p.gutscheinAnfragen ?? []).filter(a => a.status === 'offen' && a.rezeptId === rezeptId);
  for (const a of offene) {
    p.gutscheinAnfragen = entferneAnfrage(p.gutscheinAnfragen, a.anfrageId);
    melde('gutscheinAnfrageZurueckgezogen', { anfrageId: a.anfrageId, profilId: profileId });
  }
  save(state);
  melde('gutscheineEingeloest', { profilId: profileId, rezeptId, anzahl: serialisiereAnzahl(anzahl) });
}

// Ganzen offenen Stapel einer Sorte entfernen (Eltern-Korrektur).
export function loescheGutscheinStapel(profileId, rezeptId) {
  loeseGutscheineEin(profileId, rezeptId, Infinity);
}

// --- Gutschein-Anfragen (Kind fragt Einlösung an, Eltern entscheiden per Telegram) ---
// Spec: docs/superpowers/specs/2026-07-11-gutschein-anfrage-design.md
export function getGutscheinAnfragen(profileId) {
  return structuredClone(state.profiles[profileId]?.gutscheinAnfragen ?? []);
}

// Anfrage stellen: klemmt die Anzahl, wehrt Doppel-Anfragen pro Sorte ab, legt den
// Pending-Eintrag an und meldet das Ereignis (Sofort-Flush macht der Aufrufer via sync.js).
export function stelleGutscheinAnfrage(profileId, stapelEintrag, anzahl) {
  const p = state.profiles[profileId];
  if (!p || !stapelEintrag?.rezeptId) return null;
  if (hatOffeneAnfrage(p.gutscheinAnfragen, stapelEintrag.rezeptId)) return null;
  const n = klemmeAnzahl(anzahl, stapelEintrag.anzahl);
  if (n < 1) return null;
  const eintrag = {
    anfrageId: `a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    rezeptId: stapelEintrag.rezeptId,
    name: stapelEintrag.name,
    emoji: stapelEintrag.emoji,
    anzahl: n,
    wert: stapelEintrag.wert,
    einheit: stapelEintrag.einheit,
    ts: new Date().toISOString(),
    status: 'offen',
  };
  p.gutscheinAnfragen = fuegeAnfrageHinzu(p.gutscheinAnfragen, eintrag);
  save(state);
  melde('gutscheinEinloesungAngefragt', {
    anfrageId: eintrag.anfrageId, profilId: profileId, kindName: p.name,
    rezeptId: eintrag.rezeptId, name: eintrag.name, emoji: eintrag.emoji,
    anzahl: n, wert: eintrag.wert, einheit: eintrag.einheit,
  });
  return structuredClone(eintrag);
}

// Feier gezeigt → Eintrag lokal entfernen. Bewusst KEIN melde: der Status 'freigegeben'
// kam per Sync auf jedes Gerät, jedes Gerät feiert genau einmal und räumt selbst auf.
export function quittiereGutscheinAnfrage(profileId, anfrageId) {
  const p = state.profiles[profileId];
  if (!p?.gutscheinAnfragen) return;
  p.gutscheinAnfragen = entferneAnfrage(p.gutscheinAnfragen, anfrageId);
  save(state);
}

// Werkstatt geschlossen → 🌙-Hinweise abräumen (Spec, Beschluss 4: „beim nächsten Besuch normal").
export function raeumeAbgelehnteAnfragenAuf(profileId) {
  const p = state.profiles[profileId];
  if (!p?.gutscheinAnfragen?.some(a => a.status === 'abgelehnt')) return;
  p.gutscheinAnfragen = entferneNachStatus(p.gutscheinAnfragen, 'abgelehnt');
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
  melde('rohstoffGesetzt', { profilId: profileId, item, anzahl });
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
  melde('kindPinGesetzt', { profilId: profileId, pin: pin ? String(pin) : null });
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
  melde('dropChanceGesetzt', { item, wert });
}

// --- Familien-Sync (Konfiguration pro Gerät, Eltern-Bereich) ---
export function getSyncConfig() {
  const s = state.parentSettings?.sync ?? {};
  return { url: s.url ?? '', schluessel: s.schluessel ?? '', aktiv: !!s.aktiv };
}

export function setzeSyncConfig({ url, schluessel, aktiv }) {
  state.parentSettings = state.parentSettings ?? {};
  state.parentSettings.sync = {
    url: String(url ?? '').trim(),
    schluessel: String(schluessel ?? '').trim(),
    aktiv: !!aktiv,
  };
  save(state);
}

// --- Spielstand-Sync: fremdes Ereignis anwenden (Spec §3–§5) ---
// Einspiel-Modus unterdrückt melde() — sonst Echo-Schleife über die Geräte.
// true = angewendet oder idempotent übersprungen; false = unbekannt/kaputt/Profil fehlt
// (Aufrufer überspringt mit console.warn und schreibt den Cursor trotzdem fort — Spec §8).
export function wendeZustandsEreignisAn(ereignis) {
  const { op, args, ts } = ereignis ?? {};
  const datum = ts ? new Date(ts) : new Date();
  einspielModus = true;
  try {
    switch (op) {
      case 'profilAngelegt': {
        const profil = args?.profil;
        if (!profil?.id) return false;
        // Idempotent: existiert die Id schon (eigener Upload, doppelter Pull), nichts tun.
        if (!state.profiles[profil.id]) { state.profiles[profil.id] = structuredClone(profil); save(state); }
        return true;
      }
      case 'profilGeaendert':
        if (!state.profiles[args?.id]) return false;
        updateProfile(args.id, args.updates ?? {});
        return true;
      case 'profilGeloescht':
        deleteProfile(args?.id);
        return true;
      case 'inventarPlus':
        if (!state.profiles[args?.profilId]) return false;
        addInventar(args.profilId, args.item, args.anzahl);
        return true;
      case 'aufgabeGetrackt':
        if (!state.profiles[args?.profilId]) return false;
        trackeAufgabe(args.profilId, args.typ, !!args.richtig, args.zeitMs ?? 0, datum);
        return true;
      case 'fehlerboxGesetzt': {
        // Last-write-wins pro Aufgabe. Bewusst simpel: Übt das Kind auf zwei Geräten
        // parallel dieselbe Aufgabe, gewinnt das zuletzt eingespielte Ereignis. Im
        // schlimmsten Fall kommt eine Aufgabe einmal zu oft — nie eine zu wenig.
        const p = state.profiles[args?.profilId];
        if (!p || !args?.schluessel) return false;
        p.fehlerbox = p.fehlerbox ?? {};
        if (args.eintrag) p.fehlerbox[args.schluessel] = structuredClone(args.eintrag);
        else delete p.fehlerbox[args.schluessel];
        save(state);
        return true;
      }
      case 'gutscheinGebaut': {
        const p = state.profiles[args?.profilId];
        if (!p || !args?.gutschein?.id) return false;
        p.gutscheine = p.gutscheine ?? [];
        if (p.gutscheine.some(g => g.id === args.gutschein.id)) return true; // idempotent
        p.inventar = p.inventar ?? {};
        for (const [item, n] of Object.entries(args.kosten ?? {})) {
          p.inventar[item] = (p.inventar[item] ?? 0) - n;
        }
        p.inventar = klemmeInventar(p.inventar); // Beschluss: parallele Ausgaben → bei 0 kappen
        p.gutscheine.push(structuredClone(args.gutschein));
        save(state);
        return true;
      }
      case 'gutscheineEingeloest':
        if (!state.profiles[args?.profilId]) return false;
        loeseGutscheineEin(args.profilId, args.rezeptId, deserialisiereAnzahl(args.anzahl));
        return true;
      case 'gutscheinEinloesungAngefragt': {
        const p = state.profiles[args?.profilId];
        if (!p || !args?.anfrageId) return false;
        p.gutscheinAnfragen = fuegeAnfrageHinzu(p.gutscheinAnfragen, {
          anfrageId: args.anfrageId, rezeptId: args.rezeptId, name: args.name,
          emoji: args.emoji, anzahl: Number(args.anzahl) || 1,
          wert: args.wert, einheit: args.einheit,
          ts: String(ereignis?.ts ?? new Date().toISOString()), status: 'offen',
        });
        save(state);
        return true;
      }
      case 'gutscheinAnfrageEntschieden': {
        const p = state.profiles[args?.profilId];
        if (!p || !args?.anfrageId) return false;
        const status = args.entscheidung === 'freigegeben' ? 'freigegeben' : 'abgelehnt';
        p.gutscheinAnfragen = setzeAnfrageStatus(p.gutscheinAnfragen, args.anfrageId, status);
        save(state);
        return true;
      }
      case 'gutscheinAnfrageZurueckgezogen': {
        const p = state.profiles[args?.profilId];
        if (!p || !args?.anfrageId) return false;
        p.gutscheinAnfragen = entferneAnfrage(p.gutscheinAnfragen, args.anfrageId);
        save(state);
        return true;
      }
      case 'tagesauftragBelohnt': {
        const p = state.profiles[args?.profilId];
        if (!p?.tagesauftrag) return false;
        // Nur derselbe Tag: ein gestriges „belohnt" darf den heutigen Auftrag nicht schließen.
        if (p.tagesauftrag.datum === tagesSchluessel(datum)) { p.tagesauftrag.belohnt = true; save(state); }
        return true;
      }
      case 'timerStandGesetzt': {
        const p = state.profiles[args?.profilId];
        // Shape-Sicherung: fremde Geräte könnten ein kaputtes timer-Objekt melden —
        // normalisiereTimer erzwingt das dokumentierte Format (weich degradierend).
        const timer = normalisiereTimer(args?.timer);
        if (!p || !timer) return false;
        p.timer = timer;
        save(state);
        return true;
      }
      case 'aufsagenProtokolliert':
        if (!state.profiles[args?.profilId]) return false;
        protokolliereAufsagen(args.profilId, args.eintrag);
        return true;
      case 'eintragenProtokolliert':
        if (!state.profiles[args?.profilId]) return false;
        protokolliereEintragen(args.profilId, args.eintrag);
        return true;
      case 'aktiveReiheGesetzt':
        if (!state.profiles[args?.profilId]) return false;
        setzeAktiveReihe(args.profilId, args.biom, args.reihe ?? null);
        return true;
      case 'schwierigkeitGesetzt':
        if (!state.profiles[args?.profilId]) return false;
        setSchwierigkeit(args.profilId, args.typ, args.stufe);
        return true;
      case 'rohstoffGesetzt':
        if (!state.profiles[args?.profilId]) return false;
        setzeRohstoff(args.profilId, args.item, args.anzahl);
        return true;
      case 'rezepteGespeichert': speichereRezepte(args?.rezepte ?? []); return true;
      case 'rezepteStandard':    setzeRezepteStandard(); return true;
      case 'pinGesetzt':         setzePin(args?.pin); return true;
      case 'kindPinGesetzt':
        if (!state.profiles[args?.profilId]) return false;
        setzeKindPin(args.profilId, args.pin);
        return true;
      case 'dropChanceGesetzt':  setzeDropChance(args?.item, args?.wert); return true;
      case 'biomAktivGesetzt':
        if (!state.profiles[args?.profilId]) return false;
        setAktivesBiom(args.profilId, args.id);
        return true;
      case 'biomAutoFrei': {
        const p = state.profiles[args?.profilId];
        if (!p || !args?.id) return false;
        const b = sichereBiom(p);
        if (!b.autoFrei.includes(args.id)) { b.autoFrei.push(args.id); save(state); } // idempotent
        return true;
      }
      case 'biomElternStatus':
        if (!state.profiles[args?.profilId]) return false;
        setBiomElternStatus(args.profilId, args.id, !!args.offen);
        return true;
      default:
        return false;
    }
  } catch (err) {
    console.warn('[state] Zustands-Ereignis übersprungen.', op, err);
    return false;
  } finally {
    einspielModus = false;
  }
}

// Übernahme „Familien-Spielstand" (Spec §7): lokale Profile + Rezept-Katalog verwerfen,
// OHNE Ereignisse zu melden — der anschließende Pull ab Cursor 0 baut alles aus dem Log auf.
export function ersetzeProfileFuerUebernahme() {
  state.profiles = {};
  state.currentProfileId = null;
  state.rezepte = STANDARD_REZEPTE;
  state.rezepteVerwaltet = false;
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
  return { alter: p.alter, autoFrei: [...b.autoFrei], elternFrei: [...b.elternFrei], elternGesperrt: [...b.elternGesperrt] };
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
  melde('biomAktivGesetzt', { profilId: profileId, id });
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
  melde('biomAutoFrei', { profilId: profileId, id: next });
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
  melde('biomElternStatus', { profilId: profileId, id, offen: !!offen });
}

// Summe aller richtig gelösten Aufgaben eines Profils (über alle Aufgabentypen) — Antrieb der Burg.
export function getGesamtErfolge(profileId) {
  const stat = state.profiles[profileId]?.statistik ?? {};
  return Object.values(stat).reduce((summe, t) => summe + (t?.richtig ?? 0), 0);
}
