// Check-Runner für js/aufsagen-logik.js — Reihen-Schritte, Quiz-Fakten und
// Distraktoren des Reihen-Trainers, beide Rechenarten (mal + geteilt).
import { baueReihe, baueQuizFakten, baueDistraktoren, mische, mitFaelligenBoxaufgaben } from '../js/aufsagen-logik.js';
import { neuerEintrag as neuerAufsagenEintrag } from '../js/aufsage-protokoll-logik.js';
import { neuerEintrag as neuerEintragenEintrag } from '../js/eintragen-protokoll-logik.js';

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

// --- Protokoll-Einträge: rechenart (geteilt explizit, sonst Fallback mal) ---
{
  const e = neuerAufsagenEintrag({ datum: '2026-07-17', reihe: 4, stufe: 'auswendig', durchgaenge: 2, zeit_ms: 1000, rechenart: 'geteilt' });
  check('aufsagen-eintrag: rechenart geteilt', e.rechenart === 'geteilt');
  const alt = neuerAufsagenEintrag({ datum: '2026-07-17', reihe: 4, stufe: 'mitsprechen', durchgaenge: 1, zeit_ms: 0 });
  check('aufsagen-eintrag: fehlend -> mal', alt.rechenart === 'mal');
  const kaputt = neuerAufsagenEintrag({ datum: '', reihe: 4, stufe: 'mitsprechen', durchgaenge: 0, zeit_ms: 0, rechenart: 'quatsch' });
  check('aufsagen-eintrag: unbekannt -> mal', kaputt.rechenart === 'mal');
}
{
  const e = neuerEintragenEintrag({ datum: '2026-07-17', reihe: 4, richtig: 8, fehler: 1, verraten: 1, rechenart: 'geteilt' });
  check('eintragen-eintrag: rechenart geteilt', e.rechenart === 'geteilt');
  const alt = neuerEintragenEintrag({ datum: '2026-07-17', reihe: 4, richtig: 8, fehler: 1, verraten: 1 });
  check('eintragen-eintrag: fehlend -> mal', alt.rechenart === 'mal');
}

// --- mitFaelligenBoxaufgaben (Nachtrag C: Fehler-Box im Wiederholungsanteil) ---
// Hilfsbauer für Fehlerbox-Einträge — gleiche Form wie fehlerbox-logik.js sie anlegt.
function boxEintrag(typ, a, b, ergebnis, overrides = {}) {
  const istGeteilt = typ === 'geteilt';
  const aufgabe = {
    aufgabentyp: typ, a, b, ergebnis,
    text: istGeteilt ? `${a} : ${b} = ?` : `${a} · ${b} = ?`,
    vorlese_text: istGeteilt ? `${a} geteilt durch ${b}` : `${a} mal ${b}`,
    antwort_optionen: [ergebnis, ergebnis + 1, ergebnis - 1, ergebnis + 2],
    stufe: 0,
  };
  return {
    schluessel: `${typ}|${a}|${b}|${ergebnis}`, typ, aufgabe,
    fach: 1, faelligAm: '2026-07-01', fehler: 1, zuletzt: '2026-06-30',
    ...overrides,
  };
}
function fakt(a, b, richtig, rechenart = 'mal') {
  return { a, b, richtig, frageText: rechenart === 'geteilt' ? `${a} : ${b} = ?` : `${a} · ${b} = ?` };
}

// Fall „keine fälligen Aufgaben" — Verhalten muss exakt dem heutigen entsprechen: gleiche
// Werte, gleiche Reihenfolge, nur boxEintrag:null zusätzlich.
{
  const fakten = [fakt(1, 5, 5), fakt(2, 3, 6), fakt(3, 3, 9)];
  const roh = JSON.stringify(fakten);
  const r = mitFaelligenBoxaufgaben(fakten, 'mal', { neueReihe: 5, offeneReihen: [3], boxAufgaben: [] });
  check('keine fällig: Länge unverändert', r.length === fakten.length);
  check('keine fällig: Werte unverändert', r.every((f, i) => f.a === fakten[i].a && f.b === fakten[i].b && f.richtig === fakten[i].richtig && f.frageText === fakten[i].frageText));
  check('keine fällig: kein boxEintrag', r.every(f => f.boxEintrag === null));
  check('mitFaelligenBoxaufgaben: pure (Eingabe unverändert)', JSON.stringify(fakten) === roh);
}

// Nur passende Rechenart — im Mal-Trainer keine Divisionen, auch wenn die Reihe offen ist.
{
  const fakten = [fakt(1, 5, 5), fakt(2, 3, 6), fakt(4, 3, 12), fakt(6, 3, 18)];
  const box = [boxEintrag('geteilt', 12, 3, 4), boxEintrag('mal', 9, 3, 27)];
  const r = mitFaelligenBoxaufgaben(fakten, 'mal', { neueReihe: 5, offeneReihen: [3], boxAufgaben: box });
  const genutzt = r.filter(f => f.boxEintrag);
  check('rechenart: nur 1 Substitution (nur der mal-Kandidat)', genutzt.length === 1);
  check('rechenart: keine Divisions-Frage im Mal-Quiz gelandet', r.every(f => !f.frageText.includes(':')));
  check('rechenart: die mal-Aufgabe kam durch', genutzt[0].a === 9 && genutzt[0].b === 3 && genutzt[0].richtig === 27);
}

// Nur bereits offene Reihen — eine fällige Box-Aufgabe einer noch nicht offenen Reihe
// (hier 8er, offen ist nur die 3er) darf nicht auftauchen.
{
  const fakten = [fakt(1, 5, 5), fakt(2, 3, 6), fakt(4, 3, 12)];
  const box = [boxEintrag('mal', 3, 8, 24), boxEintrag('mal', 6, 3, 18)];
  const r = mitFaelligenBoxaufgaben(fakten, 'mal', { neueReihe: 5, offeneReihen: [3], boxAufgaben: box });
  check('offene Reihen: 8er-Box-Aufgabe wird nicht verwendet', r.every(f => f.b !== 8));
  check('offene Reihen: 3er-Box-Aufgabe wird verwendet', r.some(f => f.boxEintrag && f.b === 3 && f.richtig === 18));
}

// Geprüfte Reihe bleibt unberührt — auch wenn (fehlerhaft) eine Box-Aufgabe genau dieser
// Reihe fällig wäre, darf sie NICHT die Prüfungs-Fragen der neuen Reihe ersetzen.
{
  const fakten = [fakt(1, 5, 5), fakt(2, 5, 10), fakt(4, 3, 12), fakt(6, 3, 18)];
  const box = [boxEintrag('mal', 7, 5, 35), boxEintrag('mal', 9, 3, 27)];
  const r = mitFaelligenBoxaufgaben(fakten, 'mal', { neueReihe: 5, offeneReihen: [3, 5], boxAufgaben: box });
  check('geprüfte Reihe: keine der 5er-Fragen wurde ersetzt', r.slice(0, 2).every((f, i) => f.boxEintrag === null && f.a === fakten[i].a && f.richtig === fakten[i].richtig));
  check('geprüfte Reihe: die 5er-Box-Aufgabe wurde nirgends eingesetzt', r.every(f => !(f.boxEintrag && f.boxEintrag.schluessel === 'mal|7|5|35')));
  check('geprüfte Reihe: die 3er-Box-Aufgabe kam im Wiederholungsanteil durch', r.some(f => f.boxEintrag && f.boxEintrag.schluessel === 'mal|9|3|27'));
}

// Obergrenze: mehr fällige Box-Aufgaben als Wiederholungsplätze -> nur so viele wie Plätze frei.
{
  const fakten = [fakt(1, 5, 5), fakt(2, 3, 6), fakt(4, 3, 12), fakt(6, 3, 18)]; // 1 geprüfte + 3 Wiederholung
  const box = [
    boxEintrag('mal', 1, 3, 3), boxEintrag('mal', 5, 3, 15),
    boxEintrag('mal', 8, 3, 24), boxEintrag('mal', 10, 3, 30), boxEintrag('mal', 2, 3, 6, { schluessel: 'mal|2|3|6b' }),
  ];
  const r = mitFaelligenBoxaufgaben(fakten, 'mal', { neueReihe: 5, offeneReihen: [3], boxAufgaben: box });
  const genutzt = r.filter(f => f.boxEintrag);
  check('obergrenze: genau 3 Substitutionen (= Wiederholungsplätze), nicht 5', genutzt.length === 3);
  check('obergrenze: geprüfte Reihe weiterhin unberührt', r[0].boxEintrag === null && r[0].a === 1 && r[0].b === 5);
}

// Auffüllen: weniger fällige Box-Aufgaben als Wiederholungsplätze -> Rest bleibt die
// ursprünglich gezogene (zufällige) Frage.
{
  const fakten = [fakt(1, 5, 5), fakt(2, 3, 6), fakt(4, 3, 12), fakt(6, 3, 18)];
  const box = [boxEintrag('mal', 9, 3, 27)];
  const r = mitFaelligenBoxaufgaben(fakten, 'mal', { neueReihe: 5, offeneReihen: [3], boxAufgaben: box });
  const genutzt = r.filter(f => f.boxEintrag);
  check('auffüllen: genau 1 Substitution', genutzt.length === 1 && genutzt[0].a === 9 && genutzt[0].richtig === 27);
  // Der EINE Kandidat besetzt den ersten Wiederholungsplatz (fakt(2,3,6)); die übrigen zwei
  // Wiederholungsplätze bleiben bei ihren ursprünglich gezogenen (zufälligen) Fragen.
  const unveraendert = r.filter(f => !f.boxEintrag && f.b === 3);
  check('auffüllen: übrige Wiederholungsplätze bleiben die ursprünglichen Fragen',
    unveraendert.length === 2 && unveraendert.some(f => f.a === 4 && f.richtig === 12) && unveraendert.some(f => f.a === 6 && f.richtig === 18));
}

// 'gemischt': keine geprüfte Reihe -> der GESAMTE Fragensatz ist Wiederholungsanteil.
{
  const fakten = [fakt(2, 3, 6), fakt(5, 4, 20), fakt(7, 3, 21)];
  const box = [boxEintrag('mal', 9, 3, 27), boxEintrag('mal', 6, 4, 24)];
  const r = mitFaelligenBoxaufgaben(fakten, 'mal', { neueReihe: null, offeneReihen: [3, 4], boxAufgaben: box });
  check('gemischt: beide Box-Aufgaben kommen unter (kein neueReihe-Ausschluss)', r.filter(f => f.boxEintrag).length === 2);
}

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle aufsagen-logik-Checks grün.');
