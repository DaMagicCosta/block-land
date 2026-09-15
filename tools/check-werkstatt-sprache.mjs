// Check-Runner für js/werkstatt-sprache-logik.js — Sätze der Werkstatt-Sprachführung.
import {
  mengeText, aufzaehlung, vorratSatz, willkommenSatz, rezeptSatz, gebautSatz, tabSatz, gutscheinSatz,
} from '../js/werkstatt-sprache-logik.js';

let fehler = 0;
function check(name, ist, soll) {
  if (ist === soll) { console.log(`  OK  ${name}`); }
  else { console.error(`  FEHLER  ${name}\n      ist:  ${ist}\n      soll: ${soll}`); fehler++; }
}

check('Eins ausgeschrieben (Stein)', mengeText('stein', 1), 'einen Stein');
check('Eins ausgeschrieben (Holz)', mengeText('holz', 1), 'ein Stück Holz');
check('Mehrzahl (Blume)', mengeText('blume', 6), '6 Blumen');
check('Mehrzahl ohne Endung (Holz)', mengeText('holz', 10), '10 Holz');
check('Unbekanntes Material bricht nicht', mengeText('gold', 2), '2 gold');

check('Aufzählung leer', aufzaehlung([]), '');
check('Aufzählung eins', aufzaehlung(['a']), 'a');
check('Aufzählung zwei', aufzaehlung(['a', 'b']), 'a und b');
check('Aufzählung drei', aufzaehlung(['a', 'b', 'c']), 'a, b und c');

check('Vorrat leer', vorratSatz({ holz: 0 }), 'Du hast noch keine Rohstoffe. Übe in der Welt, dann findest du welche.');
check('Vorrat ohne Nullen', vorratSatz({ holz: 5, stein: 0, blume: 1 }), 'Du hast 5 Holz und eine Blume.');
check('Willkommen enthält Vorrat', willkommenSatz({ stein: 2 }).includes('Du hast 2 Steine.'), true);

const film = { name: 'Extra-Filmzeit', kosten: { holz: 12, stein: 6 } };
check('Rezept machbar', rezeptSatz(film, { holz: 12, stein: 9 }),
  'Extra-Filmzeit. Dafür brauchst du 12 Holz und 6 Steine. Du hast genug. Tippe auf Bauen!');
check('Rezept: nur Fehlendes, Nominativ + Einzahl-Verb', rezeptSatz(film, { holz: 20, stein: 5 }),
  'Extra-Filmzeit. Dafür brauchst du 12 Holz und 6 Steine. Dir fehlt noch ein Stein.');
check('Rezept: zwei fehlende Materialien → Mehrzahl-Verb', rezeptSatz(film, { holz: 11, stein: 5 }),
  'Extra-Filmzeit. Dafür brauchst du 12 Holz und 6 Steine. Dir fehlen noch ein Stück Holz und ein Stein.');
check('Nominativ Diamant', mengeText('diamant', 1, 'nom'), 'ein Diamant');
check('Rezept: leeres Inventar', rezeptSatz({ name: 'Nachtisch', kosten: { stein: 6 } }, {}),
  'Nachtisch. Dafür brauchst du 6 Steine. Dir fehlen noch 6 Steine.');

check('Gebaut', gebautSatz({ name: 'Nasch-Gutschein' }), 'Gebaut! Nasch-Gutschein. Der Gutschein liegt jetzt bei deinen Gutscheinen.');
check('Tab Gutscheine', tabSatz('gutscheine'), 'Hier liegen deine Gutscheine.');
check('Tab Rezepte', tabSatz('bauen'), 'Hier kannst du Wünsche bauen.');
check('Gutschein einer', gutscheinSatz('Nachtisch wünschen', 1), 'Nachtisch wünschen. Du hast einen Gutschein.');
check('Gutschein offen', gutscheinSatz('Film', 3, 'offen'), 'Film. Du hast 3 Gutscheine. Du hast Mama und Papa schon gefragt. Warte auf ihre Antwort.');

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle werkstatt-sprache-Checks grün.');
