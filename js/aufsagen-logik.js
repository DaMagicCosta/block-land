// Pure Logik für den Reihen-Trainer (Mal + Geteilt): Schritte einer Reihe,
// Quiz-Fakten und Distraktoren. KEINE DOM-/State-Abhängigkeit (node-testbar).

import { mische } from './utils.js';
import { mischeQuizReihen } from './freischaltung-logik.js';
import { normalisiereAufgabe } from './aufgaben/normalisiere.js';

// Re-exportiert für js/trainer.js (`import { ..., mische } from './aufsagen-logik.js'`).
export { mische };

// Schritte 1..10 der `reihe`er-Reihe. `aufgabeText` = Aufgabenteil fürs Rendern,
// `ergebnis` = erwartete Antwort, `text` = ganze Zeile, `vorlese` = gesprochener Satz.
// mal: "4 · 3 =" -> 12 · geteilt: "12 : 3 =" -> 4 (Quotient; klassische Divisionsreihe).
export function baueReihe(reihe, rechenart = 'mal') {
  const schritte = [];
  for (let i = 1; i <= 10; i++) {
    if (rechenart === 'geteilt') {
      const a = i * reihe;
      schritte.push({
        i,
        ergebnis: i,
        aufgabeText: `${a} : ${reihe} =`,
        text: `${a} : ${reihe} = ${i}`,
        vorlese: `${a} geteilt durch ${reihe} gleich ${i}`,
      });
    } else {
      const ergebnis = i * reihe;
      schritte.push({
        i,
        ergebnis,
        aufgabeText: `${i} · ${reihe} =`,
        text: `${i} · ${reihe} = ${ergebnis}`,
        vorlese: `${i} mal ${reihe} gleich ${ergebnis}`,
      });
    }
  }
  return schritte;
}

// 10 Quiz-Fakten. `reihe` ist die geprüfte Reihe, `offeneAlte` die bereits gelernten Reihen,
// aus denen Wiederholungen eingestreut werden (kumulative Prüfung: sonst verblasst alles
// früher Gelernte). 'gemischt' zieht weiterhin quer — aber nur aus `offeneAlte`, sofern
// angegeben, damit nie eine ungeübte Reihe auftaucht.
export function baueQuizFakten(reihe, rechenart = 'mal', offeneAlte = []) {
  if (reihe === 'gemischt') {
    const quelle = offeneAlte.length ? offeneAlte : bereichVonZweiBisZehn();
    const paare = [];
    for (const y of quelle) for (const x of bereichVonZweiBisZehn()) paare.push([x, y]);
    const gezogen = mische(paare);
    // Bei wenig offenen Reihen liefert die Paar-Bildung weniger als zehn Kombinationen (z.B.
    // bei nur EINER offenen Reihe nur neun Paare = "8 von 9 richtig" statt "X von 10"). Die
    // Leitplanke verlangt aber immer ein sichtbares Ende bei genau zehn Fragen — deshalb wird
    // mit weiteren Zufallspaaren aus derselben Quelle aufgefüllt (Wiederholungen erlaubt,
    // besser als eine verkürzte Prüfung).
    while (gezogen.length < 10) {
      const y = quelle[Math.floor(Math.random() * quelle.length)];
      const x = bereichVonZweiBisZehn()[Math.floor(Math.random() * 9)];
      gezogen.push([x, y]);
    }
    return gezogen.slice(0, 10).map(([x, y]) => baueFakt(x, y, rechenart));
  }
  const reihenFolge = mischeQuizReihen(reihe, offeneAlte);
  // Faktoren 1..10 gemischt und positionsweise mit der Reihenfolge verknüpft (statt Ziehung
  // mit Zurücklegen): so bleibt "jedes a von 1..10 genau einmal" erhalten — Bestandsverhalten,
  // das der zweistellige Aufruf laut Vertrag weiterhin zeigen muss.
  const faktoren = mische([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  return reihenFolge.map((r, i) => baueFakt(faktoren[i], r, rechenart));
}

function bereichVonZweiBisZehn() {
  return [2, 3, 4, 5, 6, 7, 8, 9, 10];
}

function baueFakt(x, reihe, rechenart) {
  if (rechenart === 'geteilt') {
    const a = x * reihe;
    return { a, b: reihe, richtig: x, frageText: `${a} : ${reihe} = ?` };
  }
  return { a: x, b: reihe, richtig: x * reihe, frageText: `${x} · ${reihe} = ?` };
}

// 3 plausible Distraktoren (> 0, ≠ richtig, paarweise verschieden).
// mal: Nachbar-Fakten + knapp daneben (wie bisher im Trainer) ·
// geteilt: Quotienten knapp daneben (typische Verwechslung, wie js/aufgaben/geteilt.js).
export function baueDistraktoren(fakt, rechenart = 'mal') {
  const richtig = fakt.richtig;
  const kandidaten = rechenart === 'geteilt'
    ? [richtig + 1, richtig - 1, richtig + 2, richtig - 2, richtig + 3]
    : [fakt.a * (fakt.b + 1), fakt.a * (fakt.b - 1), (fakt.a + 1) * fakt.b, (fakt.a - 1) * fakt.b,
       richtig + 1, richtig - 1, richtig + 2];
  const set = new Set(kandidaten.filter(x => x > 0 && x !== richtig));
  // Auffüllen, falls zu wenige übrig (kleine Reihen: Kandidaten kollidieren/fallen weg).
  let zusatz = 4;
  while (set.size < 3 && zusatz < 20) {
    set.add(richtig + zusatz);
    zusatz++;
  }
  return mische([...set]).slice(0, 3);
}

// Box-Eintrag → Fakt: gleiche Übersetzung wie js/aufgabe-ui.js beim Wiedervorlegen (Konserven-
// Regel!). eintrag.aufgabe kann Zahlenfelder als Zeichenkette enthalten (Sync-Konserven,
// Live-Befund 16.07.2026) — normalisiereAufgabe() koerziert oder verwirft eine kaputte Konserve.
// `text` ist wortgleich zu baueFakt()s frageText ("${x} · ${reihe} = ?" bzw. "${a} : ${reihe} = ?"),
// egal ob die Konserve aus dem Trainer selbst oder aus einer freien Mal-/Geteilt-Aufgabe stammt
// (gleiches Schema in js/aufgaben/mal.js und geteilt.js) — deshalb reicht die Übernahme 1:1.
function faktAusBoxeintrag(eintrag) {
  const sauber = normalisiereAufgabe(eintrag?.aufgabe);
  if (!sauber || sauber.a === undefined || sauber.b === undefined || !sauber.text) return null;
  return { a: sauber.a, b: sauber.b, richtig: sauber.ergebnis, frageText: sauber.text };
}

// Ersetzt Fragen des Wiederholungsanteils einer fertig gemischten Prüfung durch fällige
// Fehler-Box-Aufgaben (Nachtrag C zu „Reihen-Freischaltung", Design §6): Wiederholung wird damit
// zielgerichtet statt zufällig — sie zeigt bevorzugt, was das Kind nachweislich nicht konnte,
// statt beliebiger alter Fragen.
//
// - Ersetzt werden NUR Fragen, deren Reihe (b) nicht `neueReihe` ist — die geprüfte Reihe bleibt
//   für das Freischalt-Kriterium unberührt. Bei 'gemischt' gibt es keine geprüfte Reihe
//   (`neueReihe = null`) — dann ist der gesamte Fragensatz Wiederholungsanteil.
// - Nur Box-Aufgaben der passenden Rechenart (`rechenart`, doppelt gegen den Aufrufer geprüft)
//   und aus `offeneReihen` (bereits gelernt) kommen infrage.
// - Höchstens so viele werden ersetzt, wie es Wiederholungsplätze gibt — die Obergrenze ergibt
//   sich allein daraus, dass nur in Wiederholungsplätze ersetzt wird (kein extra Deckel nötig).
//   Sind weniger Box-Aufgaben fällig als Plätze frei sind, bleiben die übrigen Plätze bei den
//   ursprünglich gezogenen (zufälligen) Fragen — unverändertes Bestandsverhalten.
// - `boxAufgaben` kommt vorsortiert vom Aufrufer (`faellige()` aus fehlerbox-logik.js,
//   dringendste zuerst) — diese Funktion fasst Fälligkeit/Reihenfolge nicht selbst an.
//
// Reine Funktion: `fakten` und `boxAufgaben` bleiben unangetastet, es entsteht ein neues Array.
// Jedes Element trägt zusätzlich `boxEintrag` (den rohen Fehlerbox-Eintrag oder null) — der
// Aufrufer (js/trainer.js) braucht ihn beim Zurückschreiben, um denselben Schlüssel zu treffen.
export function mitFaelligenBoxaufgaben(fakten, rechenart, { neueReihe = null, offeneReihen = [], boxAufgaben = [] } = {}) {
  const erlaubt = new Set((offeneReihen ?? []).map(Number));
  const passtNichtZurGeprueftenReihe = (b) => neueReihe === null || Number(b) !== Number(neueReihe);

  const kandidaten = (boxAufgaben ?? [])
    .filter(e => e && e.typ === rechenart)
    .map(e => ({ eintrag: e, fakt: faktAusBoxeintrag(e) }))
    .filter(({ fakt }) => fakt && erlaubt.has(Number(fakt.b)) && passtNichtZurGeprueftenReihe(fakt.b));

  let i = 0;
  return (fakten ?? []).map(f => {
    if (!passtNichtZurGeprueftenReihe(f.b) || i >= kandidaten.length) return { ...f, boxEintrag: null };
    const { eintrag, fakt } = kandidaten[i++];
    return { ...fakt, boxEintrag: eintrag };
  });
}
