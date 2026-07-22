// Pure Logik der Reihen-Freischaltung: Sequenz, Beherrschungs-Kriterium, Klemm-Erkennung
// und die Mischung der Abschluss-Prüfung. KEINE DOM-/State-Abhängigkeit (node-testbar).
//
// Die Sequenz folgt dem Kernaufgaben-Ansatz (Gaidoschik, Recheninstitut Wien), NICHT der
// aufsteigenden Reihenfolge: erst 2er/10er/5er, der Rest wird über Verdoppeln, Nachbar- und
// Tauschaufgaben abgeleitet. 8er und 7er stehen am Schluss, weil dort die beiden einzigen
// nicht ableitbaren Aufgaben liegen (7·8 und 8·8). Begründung und Belege:
// 09_Kinder/Block-Land-Einmaleins-Recherche.md

import { mische } from './utils.js';

export const SEQUENZ = [
  [1, 2],   // Stufe 1 — Kernaufgabe Verdoppeln; die 1er läuft trivial mit
  [10],     // Stufe 2 — Kernaufgabe
  [5],      // Stufe 3 — Kernaufgabe, „Kraft der 5"
  [4],      // Stufe 4 — Verdoppeln der 2er
  [3],      // Stufe 5
  [6],      // Stufe 6 — Verdoppeln der 3er
  [9],      // Stufe 7 — Nachbaraufgabe zur 10er
  [8],      // Stufe 8 — Verdoppeln der 4er, enthält 8·8
  [7],      // Stufe 9 — zuletzt, enthält 7·8
];

export const ANFANGSSTAND = { stufe: 1, pruefungen: {}, fehlversuche: {} };

const TAGE_ZUM_SITZEN = 2;      // zwei verschiedene Tage — ein guter Abend beweist nichts
const TAGE_ZUM_KLEMMEN = 3;     // danach öffnet die nächste Reihe trotzdem (Umweg)
const MAX_FEHLER_PRO_PRUEFUNG = 1;

// Die Reihe, an der eine Stufe gemessen wird: die letzte der Stufe. Bei Stufe 1 ([1,2]) ist
// das die 2er — die 1er ist trivial und wird bewusst nicht eigens geprüft.
export function pruefReihe(stufe) {
  const gruppe = SEQUENZ[stufe - 1] ?? SEQUENZ[0];
  return gruppe[gruppe.length - 1];
}

export function offeneReihen(stand) {
  const stufe = Math.min(Math.max(1, stand?.stufe ?? 1), SEQUENZ.length);
  return SEQUENZ.slice(0, stufe).flat();
}

export function istOffen(stand, reihe) {
  return offeneReihen(stand).includes(Number(reihe));
}

export function bestanden(fehlerAnzahl) {
  return Number(fehlerAnzahl) <= MAX_FEHLER_PRO_PRUEFUNG;
}

// Notiert einen Prüfungstag. Rein: liefert IMMER ein neues Objekt, Eingabe bleibt unberührt.
// Mehrfache Versuche am selben Tag zählen einmal — sonst könnte ein Kind eine Reihe an einem
// einzigen Abend durchdrücken, und genau das soll das Kriterium verhindern.
export function notierePruefung(stand, reihe, datum, warBestanden) {
  const basis = {
    stufe: stand?.stufe ?? 1,
    pruefungen: { ...(stand?.pruefungen ?? {}) },
    fehlversuche: { ...(stand?.fehlversuche ?? {}) },
  };
  const feld = warBestanden ? 'pruefungen' : 'fehlversuche';
  const schluessel = String(reihe);
  const tage = new Set(basis[feld][schluessel] ?? []);
  tage.add(datum);
  basis[feld] = { ...basis[feld], [schluessel]: [...tage].sort() };
  return basis;
}

export function sitzt(stand, reihe) {
  return (stand?.pruefungen?.[String(reihe)] ?? []).length >= TAGE_ZUM_SITZEN;
}

export function klemmt(stand, reihe) {
  return (stand?.fehlversuche?.[String(reihe)] ?? []).length >= TAGE_ZUM_KLEMMEN;
}

// Aufstieg entweder weil die Reihe sitzt — oder weil sie klemmt. Der zweite Fall ist der
// Umweg: Wer Inhalte sperrt UND das Tempo dem Kind überlässt, riskiert Steckenbleiben
// (belegt in 23 von 32 Mastery-Studien). Es darf nie eine Sackgasse geben.
export function sollAufsteigen(stand) {
  const reihe = pruefReihe(stand?.stufe ?? 1);
  return sitzt(stand, reihe) || klemmt(stand, reihe);
}

export function steigeAuf(stand) {
  const stufe = Math.min((stand?.stufe ?? 1) + 1, SEQUENZ.length);
  return { ...stand, stufe, pruefungen: { ...(stand?.pruefungen ?? {}) },
           fehlversuche: { ...(stand?.fehlversuche ?? {}) } };
}

// Reihenfolge der Fragen einer Abschluss-Prüfung: überwiegend die neue Reihe, dazu
// Wiederholungen aus dem bereits Offenen. Das Mischen wirkt INNERHALB einer Sitzung —
// deshalb eine gemischte Runde und keine über Tage verteilte Streuung.
export function mischeQuizReihen(neueReihe, alteReihen, anzahl = 10, anteilNeu = 6) {
  const alte = (alteReihen ?? []).filter(r => Number(r) !== Number(neueReihe));
  const neu = alte.length ? Math.min(anteilNeu, anzahl) : anzahl;
  const liste = Array.from({ length: neu }, () => Number(neueReihe));
  for (let i = liste.length; i < anzahl; i++) {
    liste.push(Number(alte[Math.floor(Math.random() * alte.length)]));
  }
  return mische(liste);
}
