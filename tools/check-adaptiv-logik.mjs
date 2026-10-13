// Ad-hoc-Checks für js/adaptiv-logik.js (kein Test-Runner im Projekt).
// Lauf: node tools/check-adaptiv-logik.mjs  (aus dem Block-Land-Root)
import { neuerVerlauf, verbuche, mechanikFuer, passeStufeAn } from '../js/adaptiv-logik.js';

let fehler = 0;
function pruefe(name, bedingung) {
  if (bedingung) { console.log(`  OK  ${name}`); }
  else { console.error(`FEHLT ${name}`); fehler += 1; }
}

// Spielt Antworten durch und gibt je Antwort Stufe und Mechanik der NÄCHSTEN Aufgabe zurück.
function spiele(antworten, startStufe, maxStufe = 5, zeit = 3000) {
  const v = neuerVerlauf();
  let stufe = startStufe;
  return antworten.map(richtig => {
    verbuche(v, richtig, zeit);
    stufe = passeStufeAn(v, stufe, maxStufe);
    return { stufe, mechanik: mechanikFuer(v) };
  });
}

// --- Fehlerserie auf höherer Stufe: Abstieg UND Legen ---
const serie = spiele([false, false, false, false, false], 4);
pruefe('1 Fehler: Stufe bleibt, kein Legen', serie[0].stufe === 4 && serie[0].mechanik === 'A');
pruefe('2 Fehler: eine Stufe tiefer, noch kein Legen', serie[1].stufe === 3 && serie[1].mechanik === 'A');
pruefe('3 Fehler in Folge: Legen, auch nach dem Abstieg', serie[2].mechanik === 'B');
pruefe('3 Fehler: kein zweiter Abstieg nach nur einem Fehler auf der neuen Stufe', serie[2].stufe === 3);
pruefe('4 Fehler: nächster Abstieg erst nach zwei Fehlern auf der Stufe', serie[3].stufe === 2);
pruefe('5 Fehler: Stufe bleibt, Legen bleibt', serie[4].stufe === 2 && serie[4].mechanik === 'B');

// --- Unterste Stufe: wie bisher ---
const unten = spiele([false, false, false], 1);
pruefe('Stufe 1: bleibt 1', unten.every(e => e.stufe === 1));
pruefe('Stufe 1: Legen nach 3 Fehlern', unten[1].mechanik === 'A' && unten[2].mechanik === 'B');

// --- Eine richtige Antwort beendet beide Serien ---
const erholt = spiele([false, false, false, true, false], 4);
pruefe('richtig nach Serie: zurück zum Auswählen', erholt[3].mechanik === 'A');
pruefe('ein Fehler danach: kein Abstieg, kein Legen', erholt[4].stufe === 3 && erholt[4].mechanik === 'A');

// --- Aufstieg ---
const hoch = spiele([true, true, true, true, true], 2);
pruefe('4 richtige: eine Stufe höher', hoch[2].stufe === 2 && hoch[3].stufe === 3);
pruefe('danach beginnt die Erfolgsserie neu', hoch[4].stufe === 3);
pruefe('Obergrenze wird gehalten', spiele([true, true, true, true], 5, 5)[3].stufe === 5);

// --- Legen über langsame Antworten ---
const v = neuerVerlauf();
verbuche(v, true, 13000); verbuche(v, true, 2000);
pruefe('eine langsame Antwort: kein Legen', mechanikFuer(v) === 'A');
verbuche(v, true, 15000);
pruefe('zwei langsame unter den letzten drei: Legen', mechanikFuer(v) === 'B');

if (fehler > 0) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle Checks bestanden.');
