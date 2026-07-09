// Familien-Sync: EINZIGER Ort für die Übermittlung von Lern-Ereignissen.
// Queue in eigenem localStorage-Key (getrennt vom App-State), Versand fire-and-forget:
// Fehler/Offline lassen die Queue liegen — der nächste Flush (Start / nach Ereignis)
// sendet nach. Der Kind-Flow merkt vom Sync nichts.
import { getProfile, getSyncConfig } from './state.js';
import { ereignisAufgabe, ereignisAufsagen, ereignisEintragen, fuegeInQueue } from './sync-logik.js';

const QUEUE_KEY = 'block-land-sync-queue-v1';
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
  if (!queue.length) return { ok: true, gesendet: 0 };
  try {
    const res = await fetch(cfg.url, {
      method: 'POST',
      body: JSON.stringify({ schluessel: cfg.schluessel, events: queue }),
    });
    const json = await res.json();
    if (!json.ok) return { ok: false, grund: json.fehler ?? 'abgelehnt' };
    const gesendeteIds = new Set(queue.map(e => e.id));
    schreibeQueue(leseQueue().filter(e => !gesendeteIds.has(e.id)));
    return { ok: true, gesendet: queue.length };
  } catch {
    return { ok: false, grund: 'netzwerk' };
  }
}

// Beim App-Start: Nachzügler der letzten Session senden (leicht verzögert,
// damit der Start-Render nicht mit dem Netz-Roundtrip konkurriert).
export function initSync() {
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
