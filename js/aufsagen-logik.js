// Pure Logik für den Reihen-Trainer (Mal + Geteilt): Schritte einer Reihe,
// Quiz-Fakten und Distraktoren. KEINE DOM-/State-Abhängigkeit (node-testbar).

import { mische } from './utils.js';

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

// 10 Quiz-Fakten: eine Reihe (1..10 gemischt) oder 'gemischt' (Faktoren/Teiler 2..10).
// Faktum: { a, b, richtig, frageText } — geteilt fragt den Quotienten ab (a : b = ?).
export function baueQuizFakten(reihe, rechenart = 'mal') {
  if (reihe === 'gemischt') {
    const alle = [];
    for (let x = 2; x <= 10; x++) for (let y = 2; y <= 10; y++) alle.push([x, y]);
    return mische(alle).slice(0, 10).map(([x, y]) => baueFakt(x, y, rechenart));
  }
  return mische([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).map(x => baueFakt(x, reihe, rechenart));
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
