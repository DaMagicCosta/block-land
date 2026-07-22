// Pure Logik für den Reihen-Trainer (Mal + Geteilt): Schritte einer Reihe,
// Quiz-Fakten und Distraktoren. KEINE DOM-/State-Abhängigkeit (node-testbar).

import { mische } from './utils.js';
import { mischeQuizReihen } from './freischaltung-logik.js';

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
