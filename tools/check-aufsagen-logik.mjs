// Check-Runner für js/aufsagen-logik.js — Reihen-Schritte, Quiz-Fakten und
// Distraktoren des Reihen-Trainers, beide Rechenarten (mal + geteilt).
import { baueReihe, baueQuizFakten, baueDistraktoren, mische } from '../js/aufsagen-logik.js';

let fehler = 0;
function check(name, bedingung) {
  if (bedingung) { console.log(`  OK  ${name}`); }
  else { console.error(`  FEHLER  ${name}`); fehler++; }
}

// --- baueReihe: mal (Bestandsverhalten + neues Feld aufgabeText) ---
{
  const s = baueReihe(3);
  check('mal: 10 Schritte', s.length === 10);
  check('mal: Ergebnis = i·reihe', s.every((x, idx) => x.ergebnis === (idx + 1) * 3));
  check('mal: aufgabeText', s[3].aufgabeText === '4 · 3 =');
  check('mal: text', s[3].text === '4 · 3 = 12');
  check('mal: vorlese', s[3].vorlese === '4 mal 3 gleich 12');
}

// --- baueReihe: geteilt (Divisionsreihe, Ergebnis = Quotient) ---
{
  const s = baueReihe(3, 'geteilt');
  check('geteilt: 10 Schritte', s.length === 10);
  check('geteilt: Ergebnis = Quotient i', s.every((x, idx) => x.ergebnis === idx + 1));
  check('geteilt: aufgabeText', s[3].aufgabeText === '12 : 3 =');
  check('geteilt: text', s[3].text === '12 : 3 = 4');
  check('geteilt: vorlese', s[3].vorlese === '12 geteilt durch 3 gleich 4');
  check('geteilt: beginnt bei 3 : 3 = 1', s[0].text === '3 : 3 = 1');
}

// --- baueQuizFakten: einzelne Reihe ---
{
  const f = baueQuizFakten(4, 'mal');
  check('quiz mal: 10 Fakten', f.length === 10);
  check('quiz mal: jedes a von 1..10 genau einmal',
    new Set(f.map(x => x.a)).size === 10 && f.every(x => x.a >= 1 && x.a <= 10));
  check('quiz mal: richtig = a·b, b = Reihe', f.every(x => x.richtig === x.a * x.b && x.b === 4));
  check('quiz mal: frageText', f.every(x => x.frageText === `${x.a} · 4 = ?`));
}
{
  const f = baueQuizFakten(4, 'geteilt');
  check('quiz geteilt: 10 Fakten', f.length === 10);
  check('quiz geteilt: a = b·richtig, b = Reihe', f.every(x => x.a === x.b * x.richtig && x.b === 4));
  check('quiz geteilt: jeder Quotient von 1..10 genau einmal',
    new Set(f.map(x => x.richtig)).size === 10 && f.every(x => x.richtig >= 1 && x.richtig <= 10));
  check('quiz geteilt: frageText', f.every(x => x.frageText === `${x.a} : 4 = ?`));
}

// --- baueQuizFakten: gemischt (Faktoren/Teiler/Quotienten 2..10) ---
{
  const f = baueQuizFakten('gemischt', 'mal');
  check('gemischt mal: 10 Fakten, Faktoren 2..10',
    f.length === 10 && f.every(x => x.a >= 2 && x.a <= 10 && x.b >= 2 && x.b <= 10 && x.richtig === x.a * x.b));
}
{
  const f = baueQuizFakten('gemischt', 'geteilt');
  check('gemischt geteilt: 10 Fakten, Teiler+Quotient 2..10',
    f.length === 10 && f.every(x => x.b >= 2 && x.b <= 10 && x.richtig >= 2 && x.richtig <= 10 && x.a === x.b * x.richtig));
}

// --- baueDistraktoren: immer 3 Stück, > 0, ≠ richtig, paarweise verschieden ---
// Reihe 1 ist der Härtefall (kleine Werte -> Kandidaten kollidieren/fallen weg).
{
  for (const rechenart of ['mal', 'geteilt']) {
    const fakten = [...baueQuizFakten('gemischt', rechenart), ...baueQuizFakten(1, rechenart)];
    const ok = fakten.every(f => {
      const d = baueDistraktoren(f, rechenart);
      return d.length === 3 && d.every(x => x > 0 && x !== f.richtig) && new Set(d).size === 3;
    });
    check(`distraktoren ${rechenart}: 3 Stück, > 0, ≠ richtig, unique`, ok);
  }
}

// --- mische: pure (Eingabe unverändert), gleiche Elemente ---
{
  const orig = [1, 2, 3, 4, 5];
  const kopie = [...orig];
  const g = mische(orig);
  check('mische: Eingabe unverändert', JSON.stringify(orig) === JSON.stringify(kopie));
  check('mische: gleiche Elemente', [...g].sort((a, b) => a - b).join(',') === '1,2,3,4,5');
}

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle aufsagen-logik-Checks grün.');
