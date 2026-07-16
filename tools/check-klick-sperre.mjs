// Check-Runner für js/klick-sperre.js — Doppeltipp-Entprellung der Antwort-Wertungen.
import { neueKlickSperre, KLICK_SPERRE_MS } from '../js/klick-sperre.js';

let fehler = 0;
function check(name, bedingung) {
  if (bedingung) { console.log(`  OK  ${name}`); }
  else { console.error(`  FEHLER  ${name}`); fehler++; }
}

check('Fenster ist 300 ms', KLICK_SPERRE_MS === 300);

{
  const s = neueKlickSperre(300);
  check('frisch: nicht gesperrt', !s.istGesperrt(1000));
  s.verriegeln(1000);
  check('direkt nach Wertung: gesperrt', s.istGesperrt(1001));
  check('Doppeltipp nach 150 ms: gesperrt', s.istGesperrt(1150));
  check('knapp vor Fenster-Ende: gesperrt', s.istGesperrt(1299));
  check('nach 300 ms: frei', !s.istGesperrt(1300));
}

{
  // Jede Verriegelung startet das Fenster NEU (auch mitten im laufenden Fenster) —
  // wichtig für Reveal direkt nach einer Wertung.
  const s = neueKlickSperre(300);
  s.verriegeln(1000);
  s.verriegeln(1200);
  check('erneutes Verriegeln verlängert', s.istGesperrt(1400) && !s.istGesperrt(1500));
}

{
  // Eigenes Fenster injizierbar (Tests / spätere Feinjustierung).
  const s = neueKlickSperre(100);
  s.verriegeln(0);
  check('injiziertes Fenster greift', s.istGesperrt(99) && !s.istGesperrt(100));
}

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle klick-sperre-Checks grün.');
