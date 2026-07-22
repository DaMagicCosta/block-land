// Check der Freischaltungs-Persistenz (Form des gespeicherten Standes, ohne Browser).
// Aufruf: node tools/check-freischaltung-state.mjs
import { ANFANGSSTAND, notierePruefung, sollAufsteigen, steigeAuf, offeneReihen }
  from '../js/freischaltung-logik.js';

let fehler = 0;
function pruefe(name, bedingung) {
  if (bedingung) { console.log(`  ok   ${name}`); }
  else { console.error(`  FEHL ${name}`); fehler++; }
}

// Bildet nach, was trainer.js nach einer Prüfung mit dem Stand macht.
function nachPruefung(stand, reihe, datum, warBestanden) {
  const neu = notierePruefung(stand, reihe, datum, warBestanden);
  return sollAufsteigen(neu) ? steigeAuf(neu) : neu;
}

console.log('Ablauf über mehrere Tage');
let s = ANFANGSSTAND;
s = nachPruefung(s, 2, '2026-07-22', true);
pruefe('nach einem guten Tag noch Stufe 1', s.stufe === 1);
s = nachPruefung(s, 2, '2026-07-23', true);
pruefe('nach zwei guten Tagen Stufe 2', s.stufe === 2);
pruefe('10er ist jetzt offen', offeneReihen(s).includes(10));
pruefe('2er bleibt offen', offeneReihen(s).includes(2));

console.log('Umweg bei Klemmen');
let k = ANFANGSSTAND;
k = nachPruefung(k, 2, '2026-07-22', false);
k = nachPruefung(k, 2, '2026-07-23', false);
pruefe('nach zwei Fehlschlägen noch Stufe 1', k.stufe === 1);
k = nachPruefung(k, 2, '2026-07-24', false);
pruefe('nach drei Fehlschlägen geht es trotzdem weiter', k.stufe === 2);

console.log('Form des Standes (JSON-tauglich für localStorage und Sync)');
const roh = JSON.parse(JSON.stringify(s));
pruefe('überlebt JSON-Rundreise', roh.stufe === s.stufe);
pruefe('Prüfungstage sind ein Array', Array.isArray(roh.pruefungen['2']));
pruefe('Schlüssel sind Zeichenketten', Object.keys(roh.pruefungen).every(x => typeof x === 'string'));

console.log(fehler === 0 ? '\nAlles grün.' : `\n${fehler} Fehler.`);
process.exit(fehler === 0 ? 0 : 1);
