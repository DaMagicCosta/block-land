// Fehler-Box (Leitner-Prinzip) — pure Logik, kein State, kein DOM.
//
// Warum es das gibt: Bisher verschwand eine Aufgabe, die das Kind NICHT konnte, für immer.
// Nach zwei Fehlversuchen wurde die Lösung gezeigt, das Kind nickte — und sah die Aufgabe nie
// wieder. Trainiert wurde damit Wiedererkennen statt Abruf. Das ist ein Unterschied ums Ganze:
// Mit einem Stupser ist alles da, von selbst kommt man nicht dran — und in der Schularbeit
// sitzt niemand daneben, der stupst.
//
// Die Fehler-Box legt falsche Aufgaben gezielt wieder vor — in wachsenden Abständen. Und sie
// nimmt die Hilfe dabei planmäßig zurück (Fach 1 volle Lösung → Fach 2 nur ein Anstoß →
// Fach 3 gar nichts). Erst wer dreimal in wachsendem Abstand OHNE Hilfe geliefert hat, kann es.
//
// Check: node tools/check-fehlerbox-logik.mjs

import { tagesSchluessel } from './statistik-logik.js';

// Fach → Tage bis zur Wiedervorlage. Wachsende Abstände (spaced repetition).
export const FACH_TAGE = { 1: 1, 2: 3, 3: 7 };
export const MAX_FACH = 3;

// Fach → wie viel Hilfe die Aufgabe beim Wiedersehen bekommt.
// Das Ausschleichen ist der eigentliche Wirkmechanismus: nicht "keine Hilfe geben"
// (das erzeugt nur Frust), sondern Hilfe planmäßig zurücknehmen, bis das Kind selbst abruft.
export const HILFE = { 1: 'voll', 2: 'anstoss', 3: 'keine' };

export function hilfeStufeFuer(eintrag) {
  return HILFE[eintrag?.fach] ?? 'voll';
}

// Eindeutiger Schlüssel einer konkreten Aufgabe (nicht des Aufgabentyps!).
// 7·8 und 8·7 sind bewusst verschiedene Einträge — das Kind muss beide abrufen können.
export function aufgabeSchluessel(aufgabe) {
  if (!aufgabe?.aufgabentyp) return null;
  const { aufgabentyp: typ, a, b, ergebnis, text } = aufgabe;
  if (a === undefined && b === undefined) {
    return text ? `${typ}|${text}` : null;
  }
  return `${typ}|${a ?? ''}|${b ?? ''}|${ergebnis ?? ''}`;
}

function plusTage(datumSchluessel, tage) {
  const [j, m, t] = datumSchluessel.split('-').map(Number);
  const d = new Date(j, m - 1, t);
  d.setDate(d.getDate() + tage);
  return tagesSchluessel(d);
}

// Neuer Eintrag, wenn eine Aufgabe zum ersten Mal danebengeht: Fach 1, morgen wieder.
export function neuerEintrag(aufgabe, heute = tagesSchluessel(new Date())) {
  const schluessel = aufgabeSchluessel(aufgabe);
  if (!schluessel) return null;
  return {
    schluessel,
    typ: aufgabe.aufgabentyp,
    aufgabe: structuredClone(aufgabe),   // komplett, damit sie identisch wiedervorgelegt werden kann
    fach: 1,
    faelligAm: plusTage(heute, FACH_TAGE[1]),
    fehler: 1,
    zuletzt: heute,
  };
}

// Ergebnis einer wiedervorgelegten (oder erstmals falschen) Aufgabe verarbeiten.
// Rückgabe: aktualisierter Eintrag — oder null, wenn die Aufgabe die Box verlässt (gekonnt).
export function planeWieder(eintrag, warRichtig, heute = tagesSchluessel(new Date())) {
  if (!eintrag) return null;
  const e = structuredClone(eintrag);
  e.zuletzt = heute;

  if (!warRichtig) {
    // Zurück auf Anfang. Wer in Fach 3 patzt, hat es nicht gekonnt, sondern geraten.
    e.fach = 1;
    e.fehler = (e.fehler ?? 0) + 1;
    e.faelligAm = plusTage(heute, FACH_TAGE[1]);
    return e;
  }

  if (e.fach >= MAX_FACH) return null;   // dreimal in wachsendem Abstand selbst geschafft → sitzt
  e.fach += 1;
  e.faelligAm = plusTage(heute, FACH_TAGE[e.fach]);
  return e;
}

// „Im zweiten Anlauf richtig" ist weder Aufstieg noch Rückfall.
// Er hat es geschafft, aber nicht abgerufen — also: Fach bleibt, morgen nochmal.
// Kein Fehlerzähler, denn bestraft wird hier nichts.
export function verschiebeAufMorgen(eintrag, heute = tagesSchluessel(new Date())) {
  if (!eintrag) return null;
  const e = structuredClone(eintrag);
  e.zuletzt = heute;
  e.faelligAm = plusTage(heute, 1);
  return e;
}

export function istFaellig(eintrag, heute = tagesSchluessel(new Date())) {
  if (!eintrag?.faelligAm) return false;
  return eintrag.faelligAm <= heute;    // ISO-Datum: lexikografischer Vergleich = chronologisch
}

// Alle fälligen Einträge eines Aufgabentyps, dringendste zuerst
// (ältestes Fälligkeitsdatum, bei Gleichstand die mit den meisten Fehlern).
export function faellige(box, typ, heute = tagesSchluessel(new Date())) {
  return Object.values(box ?? {})
    .filter(e => e && e.typ === typ && istFaellig(e, heute))
    .sort((x, y) => x.faelligAm.localeCompare(y.faelligAm) || (y.fehler ?? 0) - (x.fehler ?? 0));
}

// Die nächste fällige Aufgabe ziehen. `ausser` verhindert, dass dieselbe Aufgabe
// zweimal hintereinander kommt (wirkt sonst wie ein Vorwurf).
export function naechsteFaellige(box, typ, heute = tagesSchluessel(new Date()), ausser = null) {
  const kandidaten = faellige(box, typ, heute);
  if (!kandidaten.length) return null;
  const gefiltert = kandidaten.filter(e => e.schluessel !== ausser);
  return (gefiltert.length ? gefiltert[0] : kandidaten[0]) ?? null;
}

// Für die Eltern-Ansicht: Wie viel liegt offen, und was drückt am meisten?
export function boxStatistik(box, heute = tagesSchluessel(new Date())) {
  const alle = Object.values(box ?? {}).filter(Boolean);
  return {
    gesamt: alle.length,
    faellig: alle.filter(e => istFaellig(e, heute)).length,
    proFach: { 1: alle.filter(e => e.fach === 1).length, 2: alle.filter(e => e.fach === 2).length, 3: alle.filter(e => e.fach === 3).length },
    proTyp: alle.reduce((acc, e) => { acc[e.typ] = (acc[e.typ] ?? 0) + 1; return acc; }, {}),
  };
}
