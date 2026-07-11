// Pure Logik für den Spielstand-Sync: Zustands-Ereignisse bauen, filtern, Klemm-Regeln.
// KEINE DOM-/State-/fetch-Abhängigkeit (node-testbar, siehe tools/check-zustand-sync-logik.mjs).
// Ereignis-Schema (= Zeilen im Sheet-Blatt „Zustand"):
//   { id, geraet, ts, op, args }
// Konfliktklassen und Op-Katalog: docs/superpowers/specs/2026-07-11-spielstand-sync-design.md §3.

// Bewusst größer als die Statistik-Queue (500): verworfene Zustands-Ereignisse wären
// stiller Spielstand-Verlust auf den anderen Geräten.
export const ZUSTAND_QUEUE_MAX = 2000;

// Ereignis bauen; der Zufallsteil der Id macht Kollisionen zweier Geräte praktisch unmöglich.
export function baueZustandsEreignis(geraet, op, args, jetzt = new Date()) {
  return {
    id: `z_${jetzt.getTime()}_${Math.random().toString(36).slice(2, 7)}`,
    geraet: String(geraet ?? ''),
    ts: jetzt.toISOString(),
    op: String(op ?? ''),
    args: args ?? {},
  };
}

// Nur Ereignisse fremder Geräte (eigene sind lokal längst passiert) — kaputte Einträge raus.
export function fremdeEreignisse(events, eigenesGeraet) {
  return (Array.isArray(events) ? events : [])
    .filter(e => e && e.op && e.geraet !== eigenesGeraet);
}

// Inventar-Klemme: parallele Ausgaben können rechnerisch unter 0 fallen —
// Beschluss „im Zweifel zugunsten des Kindes": bei 0 kappen, leere Einträge raus.
export function klemmeInventar(inventar) {
  const ergebnis = {};
  for (const [item, n] of Object.entries(inventar ?? {})) {
    if (Number(n) > 0) ergebnis[item] = Number(n);
  }
  return ergebnis;
}

// Infinity überlebt JSON nicht: -1 steht für „alle" (loescheGutscheinStapel).
export function serialisiereAnzahl(anzahl) {
  return anzahl === Infinity ? -1 : (Number(anzahl) || 0);
}

export function deserialisiereAnzahl(wert) {
  return wert === -1 ? Infinity : (Number(wert) || 0);
}
