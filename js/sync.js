// Familien-Sync: EINZIGER Ort für die Übermittlung von Lern-Ereignissen.
// Queue in eigenem localStorage-Key (getrennt vom App-State), Versand fire-and-forget:
// Fehler/Offline lassen die Queue liegen — der nächste Flush (Start / nach Ereignis)
// sendet nach. Der Kind-Flow merkt vom Sync nichts.
import { getProfile, getSyncConfig, registriereZustandsMelder } from './state.js';
import { ereignisAufgabe, ereignisAufsagen, ereignisEintragen, fuegeInQueue } from './sync-logik.js';
import { baueZustandsEreignis, ZUSTAND_QUEUE_MAX } from './zustand-sync-logik.js';

const QUEUE_KEY = 'block-land-sync-queue-v1';
const ZUSTAND_QUEUE_KEY = 'block-land-zustand-queue-v1';
const GERAET_KEY = 'block-land-geraet-v1';
const FLUSH_VERZOEGERUNG_MS = 5000;
let flushTimer = null;

function leseQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) ?? []; }
  catch { return []; }
}

function schreibeQueue(queue) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); }
  catch (err) { console.warn('[sync] Queue speichern fehlgeschlagen.', err); }
}

// Stabile Geräte-Identität — nur zur Fremd-Erkennung beim Pull und für die Diagnose.
export function geraetId() {
  let id = localStorage.getItem(GERAET_KEY);
  if (!id) {
    id = `d_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem(GERAET_KEY, id);
  }
  return id;
}

function leseZustandQueue() {
  try { return JSON.parse(localStorage.getItem(ZUSTAND_QUEUE_KEY)) ?? []; }
  catch { return []; }
}

function schreibeZustandQueue(queue) {
  try { localStorage.setItem(ZUSTAND_QUEUE_KEY, JSON.stringify(queue)); }
  catch (err) { console.warn('[sync] Zustand-Queue speichern fehlgeschlagen.', err); }
}

// Melder für state.js: Mutation → Ereignis → Queue → entprellter Flush.
// Überlauf (wochenlang offline) verwirft die ältesten — akzeptiertes Restrisiko (Spec §4).
export function meldeZustand(op, args) {
  const vorher = leseZustandQueue();
  if (vorher.length >= ZUSTAND_QUEUE_MAX) console.warn('[sync] Zustand-Queue voll — ältestes Ereignis wird verworfen.');
  schreibeZustandQueue(fuegeInQueue(vorher, baueZustandsEreignis(geraetId(), op, args), ZUSTAND_QUEUE_MAX));
  planeFlush();
}

export function anzahlWartendZustand() {
  return leseZustandQueue().length;
}

function melde(bauFn, profileId, daten) {
  const p = getProfile(profileId);
  if (!p) return;
  const ereignis = {
    id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...bauFn({ kind: p.name, alter: p.alter, ts: new Date().toISOString(), ...daten }),
  };
  schreibeQueue(fuegeInQueue(leseQueue(), ereignis));
  planeFlush();
}

export function meldeAufgabe(profileId, aufgabentyp, warRichtig, zeitMs, detail = '') {
  melde(ereignisAufgabe, profileId, { aufgabentyp, warRichtig, zeitMs, detail });
}

export function meldeAufsagen(profileId, { zeit_ms, detail = '' }) {
  melde(ereignisAufsagen, profileId, { zeitMs: zeit_ms, detail });
}

export function meldeEintragen(profileId, { richtig, fehler, verraten, detail = '' }) {
  melde(ereignisEintragen, profileId, { richtig, fehler, verraten, detail });
}

export function anzahlWartend() {
  return leseQueue().length;
}

// Entprellt: erst ~5 Sek. nach dem letzten Ereignis senden (bündelt eine Übungs-Serie).
function planeFlush() {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { flushSync(); }, FLUSH_VERZOEGERUNG_MS);
}

let laufenderFlush = null;

// Sendet die komplette Queue. Parallelaufrufe (2s-Start-Timer und 5s-Debounce können
// gleichzeitig feuern) teilen sich denselben Lauf — kein Doppel-Versand.
export function flushSync() {
  if (laufenderFlush) return laufenderFlush;
  laufenderFlush = fuehreFlushAus().finally(() => { laufenderFlush = null; });
  return laufenderFlush;
}

// Sendet die komplette Queue. Erst nach bestätigtem Empfang ({ok:true}) werden genau
// die gesendeten Ereignisse (per Id) entfernt — während des Sendens neu entstandene
// bleiben, auch wenn ein Queue-Cap zwischenzeitlich Einträge vorne verdrängt hat.
// KEIN Content-Type-Header: Simple Request, Apps Script beantwortet keine Preflights.
async function fuehreFlushAus() {
  const cfg = getSyncConfig();
  if (!cfg.aktiv || !cfg.url || !cfg.schluessel) return { ok: false, grund: 'nicht konfiguriert' };
  const queue = leseQueue();
  const zustandQueue = leseZustandQueue();
  if (!queue.length && !zustandQueue.length) return { ok: true, gesendet: 0 };
  try {
    const res = await fetch(cfg.url, {
      method: 'POST',
      body: JSON.stringify({ schluessel: cfg.schluessel, events: queue, zustandEvents: zustandQueue }),
    });
    const json = await res.json();
    if (!json.ok) return { ok: false, grund: json.fehler ?? 'abgelehnt' };
    const gesendeteIds = new Set(queue.map(e => e.id));
    schreibeQueue(leseQueue().filter(e => !gesendeteIds.has(e.id)));
    const gesendeteZustandIds = new Set(zustandQueue.map(e => e.id));
    schreibeZustandQueue(leseZustandQueue().filter(e => !gesendeteZustandIds.has(e.id)));
    return { ok: true, gesendet: queue.length + zustandQueue.length };
  } catch {
    return { ok: false, grund: 'netzwerk' };
  }
}

// Beim App-Start: Nachzügler der letzten Session senden (leicht verzögert,
// damit der Start-Render nicht mit dem Netz-Roundtrip konkurriert).
export function initSync() {
  registriereZustandsMelder(meldeZustand);
  setTimeout(() => { flushSync(); }, 2000);
}

// Holt die aggregierte Familien-Statistik (letzte 30 Tage) vom Sync-Server.
// Wirft bei fehlender Konfiguration oder Serverfehler — der Aufrufer zeigt die Fehler-UI.
export async function holeFamilienStatistik() {
  const cfg = getSyncConfig();
  if (!cfg.url || !cfg.schluessel) throw new Error('nicht konfiguriert');
  const res = await fetch(`${cfg.url}?schluessel=${encodeURIComponent(cfg.schluessel)}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.fehler ?? 'abgelehnt');
  return json;
}
