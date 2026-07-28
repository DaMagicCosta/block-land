// Check-Runner für js/aufgaben/normalisiere.js — Aufgaben-Konserven (Fehlerbox,
// persistierte Reihen, Sync-Einspielungen) müssen beim Wiedereinspielen numerisch
// sauber sein. Hintergrund (Live-Befund 2026-07-16): Eine Konserve mit ergebnis als
// String ("10" statt 10) lässt den strikten Vergleich in antwortPruefen fehlschlagen —
// die richtige Antwort wird abgelehnt, obwohl die Anzeige überall korrekt aussieht.
import { normalisiereAufgabe } from '../js/aufgaben/normalisiere.js';

let fehler = 0;
function check(name, bedingung) {
  if (bedingung) { console.log(`  OK  ${name}`); }
  else { console.error(`  FEHLER  ${name}`); fehler++; }
}

// 1) String-Zahlen werden zu echten Zahlen (der Live-Befund).
{
  const a = normalisiereAufgabe({
    aufgabentyp: 'plus', stufe: '1', a: '1', b: '9', ergebnis: '10',
    text: '1 + 9 = ?', vorlese_text: '1 plus 9', antwort_optionen: ['11', '12', '9', '20', '10'],
  });
  check('ergebnis "10" → 10 (number)', a !== null && a.ergebnis === 10);
  check('a/b/stufe koerziert', a !== null && a.a === 1 && a.b === 9 && a.stufe === 1);
  check('antwort_optionen elementweise koerziert', a !== null && a.antwort_optionen.every(o => typeof o === 'number'));
  check('text unangetastet', a !== null && a.text === '1 + 9 = ?');
}

// 2) Saubere Aufgaben bleiben unverändert (Idempotenz).
{
  const rein = {
    aufgabentyp: 'mal', stufe: 2, a: 7, b: 8, ergebnis: 56,
    text: '7 · 8', vorlese_text: '7 mal 8', antwort_optionen: [48, 54, 56, 63, 64],
  };
  const a = normalisiereAufgabe(rein);
  check('saubere Aufgabe unverändert', JSON.stringify(a) === JSON.stringify(rein));
}

// 3) Form-spezifische Zahlenfelder (rechnen10/mengen) werden mitkoerziert.
{
  const a = normalisiereAufgabe({
    aufgabentyp: 'rechnen10', stufe: 1, form: 'zerlegung', ganze: '8', teil_a: '5', ergebnis: '3',
    text: '5 + ⬚ = 8', vorlese_text: '5 plus wie viel ist 8?', antwort_optionen: [1, 2, 3, 4, 5],
  });
  check('ganze/teil_a koerziert', a !== null && a.ganze === 8 && a.teil_a === 5 && a.ergebnis === 3);
  const b = normalisiereAufgabe({
    aufgabentyp: 'mengen', stufe: 1, ziel: '4', ergebnis: '4', antwort_optionen: [3, 4, 5],
  });
  check('ziel koerziert', b !== null && b.ziel === 4 && b.ergebnis === 4);
}

// 4) Nicht reparierbare Konserven werden verworfen (null) — kein NaN-Frust-Loop,
//    bei dem KEINE Antwort mehr richtig sein kann.
{
  check('ergebnis "abc" → null', normalisiereAufgabe({ aufgabentyp: 'plus', a: 1, b: 9, ergebnis: 'abc', antwort_optionen: [10] }) === null);
  check('ergebnis fehlt → null', normalisiereAufgabe({ aufgabentyp: 'plus', a: 1, b: 9, antwort_optionen: [10] }) === null);
  check('antwort_optionen fehlt → null', normalisiereAufgabe({ aufgabentyp: 'plus', a: 1, b: 9, ergebnis: 10 }) === null);
  check('kaputte Option → null', normalisiereAufgabe({ aufgabentyp: 'plus', a: 1, b: 9, ergebnis: 10, antwort_optionen: [10, 'x'] }) === null);
  check('null/undefined → null', normalisiereAufgabe(null) === null && normalisiereAufgabe(undefined) === null);
}

// 5) Optionale Felder dürfen fehlen, ohne dass sie erfunden werden.
{
  const a = normalisiereAufgabe({ aufgabentyp: 'plus', stufe: 1, a: 3, b: 4, ergebnis: 7, text: '3 + 4 = ?', antwort_optionen: [7, 8, 6] });
  check('keine erfundenen Felder (ziel/ganze/teil_a bleiben weg)', a !== null && !('ziel' in a) && !('ganze' in a) && !('teil_a' in a));
}

// 6) Eingabe-Objekt wird nicht mutiert (Konserven sind geteilte State-Kopien).
{
  const roh = { aufgabentyp: 'plus', stufe: 1, a: '3', b: 4, ergebnis: '7', antwort_optionen: ['7'] };
  normalisiereAufgabe(roh);
  check('Eingabe unangetastet', roh.a === '3' && roh.ergebnis === '7' && roh.antwort_optionen[0] === '7');
}

// 7) Uhr-Konserve: Minuten seit Mitternacht. Kommt sie als String aus localStorage oder Sync
//    zurück, muss sie koerziert werden — sonst lehnt der strikte Vergleich in antwortPruefen
//    die richtige Antwort ab, obwohl jede Anzeige korrekt aussieht.
{
  const uhrKonserve = {
    aufgabentyp: 'uhr', stufe: 3, a: '15', b: '45',
    ergebnis: '945', antwort_optionen: ['945', '189', '1005', '195', '555'],
    text: 'Wie spät ist es?', vorlese_text: 'Wie spät ist es?',
  };
  const uhrSauber = normalisiereAufgabe(uhrKonserve);
  check('Uhr-Konserve wird koerziert, nicht verworfen', uhrSauber !== null);
  check('Uhr-Ergebnis ist danach eine Zahl', uhrSauber?.ergebnis === 945);
  check('Uhr-Optionen sind danach Zahlen',
    uhrSauber?.antwort_optionen.every(Number.isInteger) && uhrSauber.antwort_optionen.includes(945));
  check('Uhr-Stunde/Minute sind danach Zahlen', uhrSauber?.a === 15 && uhrSauber?.b === 45);
}

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle aufgabe-normalisierung-Checks grün.');
