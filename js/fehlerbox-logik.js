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

// ---------------------------------------------------------------------------
// Bestandsgrenze und Verfall (18.09.2026)
//
// Warum es das gibt: Ohne Obergrenze wächst die Box monoton. Der Ausstieg verlangt drei
// Treffer auf Anhieb in wachsenden Abständen — wer eine Aufgabe schlicht noch nicht kann,
// schafft das selten, während unten laufend neue Fehler nachkommen. Je länger die
// Warteschlange, desto seltener kommt die einzelne Aufgabe wieder: zu selten, um etwas zu
// lernen, und oft genug, um zu nerven. Damit verliert die Wiedervorlage genau die
// Eigenschaft, für die es sie gibt. (Im Betrieb bestätigt, Auswertung 18.09.2026 — Zahlen
// in der Projektdoku, nicht hier: dieses Repo ist öffentlich.)
//
// Zwei Grenzen halten den Bestand übbar:
// 1. Je Aufgabentyp nur MAX_AKTIV Einträge. Kommt ein neuer Fehler dazu, während die Box
//    voll ist, weicht der am längsten nicht berührte Eintrag. Der frische Fehler ist der
//    aktuellere Lernstand — ein sechs Wochen alter hat seine Chance gehabt.
// 2. Was VERFALL_TAGE nicht mehr angefasst wurde, fällt heraus. Ohne das entsteht statt
//    einer Warteschlange eine Halde. Die Box wird nach Aufgabentyp gezogen und der Typ
//    hängt am aktiven Biom: Wer das Biom wechselt, lässt seine Fehler dort liegen, und sie
//    warten ewig.
//
// Beides ist bewusst kein „gekonnt" — siehe grund-Feld in state.js, damit eine spätere
// Auswertung Gemeistertes nicht mit Ausgeräumtem verwechselt.

export const MAX_AKTIV = 20;        // je Aufgabentyp
export const VERFALL_TAGE = 42;     // sechs Wochen ohne Berührung

function tageZwischen(vonSchluessel, bisSchluessel) {
  if (!vonSchluessel || !bisSchluessel) return 0;
  const [j1, m1, t1] = vonSchluessel.split('-').map(Number);
  const [j2, m2, t2] = bisSchluessel.split('-').map(Number);
  return Math.round((new Date(j2, m2 - 1, t2) - new Date(j1, m1 - 1, t1)) / 86400000);
}

// Wie kalt ist ein Eintrag? Maßstab ist die letzte Berührung, nicht das Fälligkeitsdatum:
// Ein Eintrag, der nie drankam, ist überfällig — aber deshalb noch lange nicht bearbeitet.
export function tageUnberuehrt(eintrag, heute = tagesSchluessel(new Date())) {
  return tageZwischen(eintrag?.zuletzt, heute);
}

// Schlüssel aller Einträge, die zu lange unberührt liegen.
export function verfallene(box, heute = tagesSchluessel(new Date())) {
  return Object.values(box ?? {})
    .filter(e => e && tageUnberuehrt(e, heute) >= VERFALL_TAGE)
    .map(e => e.schluessel);
}

// Der Eintrag, der weichen muss, wenn ein neuer aufgenommen wird: der am längsten
// unberührte. Bei Gleichstand das niedrigere Fach — wer schon zweimal geliefert hat,
// ist näher dran und bleibt lieber drin.
export function verdraengungsKandidat(box, typ, heute = tagesSchluessel(new Date())) {
  const kandidaten = Object.values(box ?? {})
    .filter(e => e && e.typ === typ)
    .sort((x, y) => tageUnberuehrt(y, heute) - tageUnberuehrt(x, heute) || (x.fach ?? 1) - (y.fach ?? 1));
  return kandidaten.length >= MAX_AKTIV ? (kandidaten[0]?.schluessel ?? null) : null;
}

// Je Typ die Einträge über der Bestandsgrenze, kälteste zuerst. Das ist die Grenze für den
// BESTAND; verdraengungsKandidat() ist dieselbe Regel für den laufenden Betrieb (ein Abgang je
// Zugang). Beides braucht es: Ohne den Bestandsschnitt bliebe eine volle Box wochenlang voll
// und baute sich nur im Takt neuer Fehler ab — die Wiedervorlage-Abstände blieben genau so
// lang, wie sie nicht sein sollen. Eine Grenze, die den Altbestand ausnimmt, ist keine.
export function ueberzaehlige(box, heute = tagesSchluessel(new Date())) {
  const proTyp = {};
  for (const e of Object.values(box ?? {})) {
    if (!e?.typ) continue;
    (proTyp[e.typ] = proTyp[e.typ] ?? []).push(e);
  }
  const raus = [];
  for (const liste of Object.values(proTyp)) {
    if (liste.length <= MAX_AKTIV) continue;
    liste.sort((x, y) => tageUnberuehrt(y, heute) - tageUnberuehrt(x, heute) || (x.fach ?? 1) - (y.fach ?? 1));
    raus.push(...liste.slice(0, liste.length - MAX_AKTIV).map(e => e.schluessel));
  }
  return raus;
}

// Liegt diese Aufgabe in der Box, ohne fällig zu sein? Dann darf der Zufallsgenerator sie
// nicht erneut würfeln: Sie käme außerhalb ihres Takts, würde als neuer Fehler eingetragen
// (der Weg über neuerEintrag) und setzte den Leitner-Stand zurück. Im Betrieb traf das einen
// nennenswerten Teil aller Wiedervorlagen; im Extremfall kam dieselbe Aufgabe dreimal
// innerhalb weniger Sekunden.
export function istGesperrt(box, aufgabe, heute = tagesSchluessel(new Date())) {
  const schluessel = aufgabeSchluessel(aufgabe);
  if (!schluessel) return false;
  const eintrag = box?.[schluessel];
  return !!eintrag && !istFaellig(eintrag, heute);
}
