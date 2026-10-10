// Pure Logik für den Familien-Sync: Ereignisse normalisieren + Queue mit Cap.
// KEINE DOM-/State-/fetch-Abhängigkeit (node-testbar, siehe tools/check-sync-logik.mjs).
// Ereignis-Schema (= Spalten im Familien-Sheet):
//   { ts, kind, alter, art: 'aufgabe'|'eintragen'|'aufsagen', typ, richtig, gesamt, zeit_ms, detail }
// `detail` beschreibt die konkrete Übungssituation (z.B. 'stufe 2', 'reihe 7') —
// Grundlage für spätere reihengenaue Auswertungen.

export const QUEUE_MAX = 500;

// Stichtag der Zeitmessung. Mit Fassung 100 (veröffentlicht am 10.10.2026) hat sich geändert,
// was die Antwortzeit enthält: Die Erklärschritte bei Plus/Minus laufen nicht mehr vor jeder
// Antwort mit (Zeiten fallen stark), und die Uhr startet nicht mehr erst nach „Gelesen"
// (Zeiten steigen leicht, bei allen Aufgaben der Großen). Festlegung: Antwortzeiten werden
// nur INNERHALB der Abschnitte vor und ab diesem Tag verglichen, nie darüber hinweg.
// Im Familien-Blatt erkennbar: Zeilen ohne Fassungsangabe im Detail stammen aus der Zeit davor.
export const MESS_STICHTAG = '2026-10-10';

// Hängt Kennzeichen an die Übungssituation an („stufe 3" + ['legen', 'v102'] → „stufe 3 ·
// legen · v102"). Immer HINTEN: Auswertungen lesen den Anfang („stufe N", „reihe N", „T1 …").
// Leere Kennzeichen fallen weg; ein Kennzeichen, das schon dasteht, wird nicht verdoppelt.
export function ergaenzeDetail(detail, zusaetze = []) {
  const teile = String(detail ?? '').split(' · ').map(t => t.trim()).filter(Boolean);
  for (const z of zusaetze) {
    const s = String(z ?? '').trim();
    if (s && !teile.includes(s)) teile.push(s);
  }
  return teile.join(' · ');
}

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
