// Check-Runner für js/aufgaben/konserven-grenzen.js — gespeicherte Aufgaben gegen den heutigen Pool.
// Hintergrund (Befund 15.09.2026): offene Mal-Reihe mit 12 · 11 aus der alten Stufe „großes 1x1".
import { readFileSync } from 'node:fs';
import { passtZumPool } from '../js/aufgaben/konserven-grenzen.js';

const pool = JSON.parse(readFileSync(new URL('../data/aufgaben-pool.json', import.meta.url), 'utf8'));

let fehler = 0;
function check(name, bedingung) {
  if (bedingung) { console.log(`  OK  ${name}`); }
  else { console.error(`  FEHLER  ${name}`); fehler++; }
}
const mal = (a, b, stufe = 4) => ({ aufgabentyp: 'mal', stufe, a, b, ergebnis: a * b });

check('der Befund: 12 · 11 wird verworfen', !passtZumPool(mal(12, 11), pool));
check('11 · 12 ebenso', !passtZumPool(mal(11, 12), pool));
check('10 · 12 (heutige Stufe 4) bleibt', passtZumPool(mal(10, 12), pool));
check('7 · 8 bleibt', passtZumPool(mal(7, 8, 2), pool));
check('Trainer-Konserve stufe 0 (10 · 10) bleibt', passtZumPool(mal(10, 10, 0), pool));
check('Einserreihe (1 · 5, Stufe 1) bleibt', passtZumPool(mal(1, 5, 1), pool));

check('Mal mit falschem Ergebnis wird verworfen', !passtZumPool({ ...mal(7, 8), ergebnis: 54 }, pool));
check('Plus 45 + 7 bleibt', passtZumPool({ aufgabentyp: 'plus', stufe: 3, a: 45, b: 7, ergebnis: 52 }, pool));
check('Plus 95 + 30 (über allen Stufen) wird verworfen', !passtZumPool({ aufgabentyp: 'plus', stufe: 4, a: 95, b: 30, ergebnis: 125 }, pool));
check('Minus 72 − 18 bleibt', passtZumPool({ aufgabentyp: 'minus', stufe: 4, a: 72, b: 18, ergebnis: 54 }, pool));
check('Minus mit falschem Ergebnis wird verworfen', !passtZumPool({ aufgabentyp: 'minus', stufe: 4, a: 72, b: 18, ergebnis: 64 }, pool));

check('Uhr wird nie verworfen', passtZumPool({ aufgabentyp: 'uhr', stufe: 1, a: 15, b: 45, ergebnis: 945 }, pool));
check('Würfel-Teich wird nie verworfen', passtZumPool({ aufgabentyp: 'rechnen10', form: 'zerlegung', ergebnis: 3 }, pool));
check('ohne Pool nie verwerfen', passtZumPool(mal(12, 11), null));
check('fehlende Zahlen bei Mal → verworfen', !passtZumPool({ aufgabentyp: 'mal', stufe: 2, a: 7, ergebnis: 56 }, pool));

// Gegenprobe: Jede Aufgabe, die die heutigen Erzeuger bauen, muss passen (sonst würde die
// Prüfung frisch erzeugte Aufgaben verwerfen und Reihen unendlich neu würfeln).
const { generiereMalAufgabe } = await import('../js/aufgaben/mal.js');
const { generierePlusAufgabe } = await import('../js/aufgaben/plus.js');
const { generiereMinusAufgabe } = await import('../js/aufgaben/minus.js');
let ausreisser = 0;
for (let i = 0; i < 3000; i++) {
  for (const s of pool.mal.stufen) if (!passtZumPool(generiereMalAufgabe(s, pool.mal.distraktoren), pool)) ausreisser++;
  for (const s of pool.plus.stufen) if (!passtZumPool(generierePlusAufgabe(s, pool.plus.distraktoren), pool)) ausreisser++;
  for (const s of pool.minus.stufen) if (!passtZumPool(generiereMinusAufgabe(s, pool.minus.distraktoren), pool)) ausreisser++;
}
check(`frisch erzeugte Aufgaben passen alle (Ausreißer: ${ausreisser})`, ausreisser === 0);

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle konserven-grenzen-Checks grün.');
