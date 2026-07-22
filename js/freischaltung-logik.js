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

// Die 1er-Reihe läuft in der SEQUENZ nur trivial mit (sie wird nie eigens geprüft, siehe
// pruefReihe) und ist als Übungsstoff wertlos: a·1 bzw. a:1 verlangt kein Rechnen. Für freie
// Übung — den Biom-Erzeuger (Mal) und die Trainer-Wiederholung (alte Reihen im Quiz) — wird sie
// deshalb an EINER gemeinsamen Stelle herausgefiltert, statt an mehreren Aufrufern dieselbe
// Filterregel zu duplizieren. Geteilt filtert die 1 unabhängig davon direkt im eigenen Erzeuger
// (js/aufgaben/geteilt.js), weil „durch 1 teilen" schon dort nie sinnvoll ist — nicht nur als
// Wiederholung.
export function ohneEinserreihe(reihen) {
  return (reihen ?? []).filter(r => Number(r) !== 1);
}

// Bleibt nach Abzug der wertlosen 1er (siehe ohneEinserreihe) genau EINE Reihe offen? Bei Mal
// entfällt nur die 1 (Stufe 1: [1,2] -> [2]); bei Geteilt filtert der Erzeuger (js/aufgaben/
// geteilt.js) jede Reihe <= 1 aus demselben Grund heraus, deshalb hier dieselbe Regel statt
// ohneEinserreihe. Solange das zutrifft, kommt im Biom JEDE freie Aufgabe aus dieser einen
// Reihe — Fund Schlussdurchsicht 21.07.2026: nichts sagte dem Kind, dass mehr über den
// Reihen-Trainer in der Hütte kommt (js/aufgabe-ui.js: Hütten-Hinweis).
export function nurEineReiheOffen(stand, rechenart = 'mal') {
  const offen = rechenart === 'geteilt'
    ? offeneReihen(stand).filter(r => Number(r) > 1)
    : ohneEinserreihe(offeneReihen(stand));
  return offen.length === 1;
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

// Abschluss-Erkennung: „alles sitzt" ist NICHT dasselbe wie „letzte Stufe erreicht". steigeAuf
// kappt an der letzten Stufe (siehe oben) — Stufe 9 bedeutet nur „die 7er ist gerade dran",
// unabhängig davon, ob sie schon bestanden ist. Fertig ist erst, wenn zusätzlich die Prüfreihe
// GENAU dieser letzten Stufe an zwei verschiedenen Tagen sitzt (echtes Bestehen, siehe sitzt —
// bewusst NICHT klemmt: der Umweg ist dafür da, dass eine Reihe die nächste nicht versperrt,
// aber am Ende der Sequenz gibt es keine nächste Reihe mehr, die er öffnen müsste, also bleibt
// hier nur das echte Kriterium).
// Skaliert die Chance auf Eisen/Diamant mit dem Reihen-Fortschritt (0.3 .. 1.0).
//
// Warum überhaupt: Die Premium-Beute hing bisher allein an der ADAPTIVEN Stufe. Seit die
// Reihen-Freischaltung den Reihen-Faktor bestimmt, ist die höchste adaptive Stufe schon mit
// lauter Zweier-Aufgaben erreichbar — das Kind könnte also Diamanten sammeln, während erst
// die 2er offen ist. An Diamanten hängen echte Gutscheine (Ausflug), die Beute soll deshalb
// wieder etwas mit Können zu tun haben.
//
// Warum GLEITEND und nicht als Sperre: In den ersten Wochen gibt die App ohnehin weniger her
// (nur eine offene Reihe). Ausgerechnet dann auch noch die Beute ganz zu streichen, wäre bei
// einem Kind, dessen Thema Antrieb ist, das falsche Signal. Der Sockel von 0.3 sorgt dafür,
// dass es nie leer ausgeht — das Beste kommt mit dem Können, nicht statt seiner.
const BEUTE_SOCKEL = 0.3;

export function beuteFaktor(stand) {
  const stufe = Math.min(Math.max(1, stand?.stufe ?? 1), SEQUENZ.length);
  const anteil = SEQUENZ.length > 1 ? (stufe - 1) / (SEQUENZ.length - 1) : 1;
  return BEUTE_SOCKEL + (1 - BEUTE_SOCKEL) * anteil;
}

export function alleReihenSitzen(stand) {
  const stufe = stand?.stufe ?? 1;
  if (stufe < SEQUENZ.length) return false;
  return sitzt(stand, pruefReihe(SEQUENZ.length));
}

export function steigeAuf(stand) {
  const stufe = Math.min((stand?.stufe ?? 1) + 1, SEQUENZ.length);
  return { ...stand, stufe, pruefungen: { ...(stand?.pruefungen ?? {}) },
           fehlversuche: { ...(stand?.fehlversuche ?? {}) } };
}

// Reihen, deren SEQUENZ-Gruppe STRIKT UNTERHALB der übergebenen Stufe liegt (nicht die
// öffentliche offeneReihen(): die schließt die Stufe selbst ein, hier soll sie ausgeschlossen
// bleiben — siehe kappeTageslistenAbStufe).
function reihenUnterhalb(stufe) {
  return SEQUENZ.slice(0, Math.max(0, (stufe ?? 1) - 1)).flat();
}

// Für den Eltern-Setz-Knopf (erzwingeFreischaltungsstufe in state.js): entfernt die
// Prüfungs-/Fehlversuchs-Tageslisten aller Reihen AB der übergebenen Stufe — also auch die der
// Reihe, die GENAU an dieser Stufe geprüft wird, nicht nur die darüber. Grund: pruefReihe(stufe)
// ist bei jeder Stufe eindeutig eine bestimmte Reihe (z.B. Stufe 3 -> 5er) — wurde diese Stufe
// früher schon einmal durchlaufen (das Kind stand also inzwischen höher), trägt ihr Eintrag
// noch die alten "sitzt"-Tage von damals. Ohne das Kappen würde eine Rückstufung wirkungslos:
// die nächste Prüfung an der (jetzt wieder aktuellen) Reihe sähe dank der alten Tage sofort
// "sitzt", unabhängig vom tatsächlichen heutigen Ergebnis, und die Stufe stiege augenblicklich
// wieder. Reihen UNTERHALB der neuen Stufe bleiben unangetastet — deren Historie beeinflusst das
// Freischalt-Kriterium ohnehin nicht mehr (pruefReihe prüft nur die aktuelle Stufe) und bleibt
// als Nachvollziehbarkeit erhalten.
export function kappeTageslistenAbStufe(stand, stufe) {
  const erlaubt = new Set(reihenUnterhalb(stufe));
  const kappe = (tageslisten) => Object.fromEntries(
    Object.entries(tageslisten ?? {}).filter(([reihe]) => erlaubt.has(Number(reihe)))
  );
  return { pruefungen: kappe(stand?.pruefungen), fehlversuche: kappe(stand?.fehlversuche) };
}

// Verschmilzt zwei Freischaltungsstände statt einen zu ersetzen. Der Zustand ist MONOTON —
// die Stufe wächst nur, die Tageslisten wachsen nur — deshalb ist eine Verschmelzung immer
// sicher und reihenfolgeunabhängig: verschmelzeStaende(a, b) === verschmelzeStaende(b, a).
// Das ist der Kern des Fixes für den Geräte-Abgleich: Ereignisse treffen in Ankunfts-, nicht
// in Entstehungsreihenfolge ein. Ein Gerät, das lange offline war und auf einem alten Stand
// eine Prüfung ablegt, darf einen inzwischen auf einem anderen Gerät erreichten höheren Stand
// nie zurückdrehen — nur ERGÄNZEN.
export function verschmelzeStaende(a, b) {
  return {
    stufe: Math.max(a?.stufe ?? 1, b?.stufe ?? 1),
    pruefungen: vereinigeTageslisten(a?.pruefungen, b?.pruefungen),
    fehlversuche: vereinigeTageslisten(a?.fehlversuche, b?.fehlversuche),
  };
}

// Vereinigt je Reihe (Schlüssel) die Tageslisten zweier Stände — ohne Dubletten, sortiert.
// Gleiche Form wie notierePruefung() erzeugt, damit beide Wege austauschbar bleiben.
function vereinigeTageslisten(x, y) {
  const schluessel = new Set([...Object.keys(x ?? {}), ...Object.keys(y ?? {})]);
  const ergebnis = {};
  for (const k of schluessel) {
    const tage = new Set([...(x?.[k] ?? []), ...(y?.[k] ?? [])]);
    ergebnis[k] = [...tage].sort();
  }
  return ergebnis;
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
