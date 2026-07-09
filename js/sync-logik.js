// Pure Logik für den Familien-Sync: Ereignisse normalisieren + Queue mit Cap.
// KEINE DOM-/State-/fetch-Abhängigkeit (node-testbar, siehe tools/check-sync-logik.mjs).
// Ereignis-Schema (= Spalten im Familien-Sheet):
//   { ts, kind, alter, art: 'aufgabe'|'eintragen'|'aufsagen', typ, richtig, gesamt, zeit_ms, detail }
// `detail` beschreibt die konkrete Übungssituation (z.B. 'stufe 2', 'reihe 7') —
// Grundlage für spätere reihengenaue Auswertungen.

export const QUEUE_MAX = 500;

function zahl(n) {
  const x = Number(n);
  return Number.isFinite(x) && x > 0 ? Math.round(x) : 0;
}

function basis({ kind, alter, ts }, rest) {
  return { ts: ts ?? '', kind: kind ?? '', alter: alter ?? '', ...rest };
}

// Eine beantwortete Aufgabe (alle Rechenarten, aus adaptiv.rapportiereErgebnis).
export function ereignisAufgabe({ kind, alter, aufgabentyp, warRichtig, zeitMs, ts, detail }) {
  return basis({ kind, alter, ts }, {
    art: 'aufgabe', typ: aufgabentyp ?? '',
    richtig: warRichtig ? 1 : 0, gesamt: 1, zeit_ms: zahl(zeitMs),
    detail: detail ?? '',
  });
}

// Eine abgeschlossene Eintragen-Einheit im Mal-Trainer (10 Abfragen).
export function ereignisEintragen({ kind, alter, richtig, fehler, verraten, ts, detail }) {
  const r = zahl(richtig);
  return basis({ kind, alter, ts }, {
    art: 'eintragen', typ: 'mal',
    richtig: r, gesamt: r + zahl(fehler) + zahl(verraten), zeit_ms: 0,
    detail: detail ?? '',
  });
}

// Eine abgeschlossene Aufsage-Einheit (kein richtig/falsch — nur Zeit zählt).
export function ereignisAufsagen({ kind, alter, zeitMs, ts, detail }) {
  return basis({ kind, alter, ts }, {
    art: 'aufsagen', typ: 'mal',
    richtig: 0, gesamt: 0, zeit_ms: zahl(zeitMs),
    detail: detail ?? '',
  });
}

// Ereignis hinten anfügen, bei Überlauf ältestes (vorne) verwerfen. NEUES Array.
export function fuegeInQueue(queue, ereignis, max = QUEUE_MAX) {
  const next = [...(Array.isArray(queue) ? queue : []), ereignis];
  return next.length > max ? next.slice(next.length - max) : next;
}
