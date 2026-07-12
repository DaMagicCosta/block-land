// Ad-hoc-Checks für js/sitzungs-logik.js (kein Test-Runner im Projekt).
// Lauf: node tools/check-sitzungs-logik.mjs  (aus dem Block-Land-Root)
import { clustereTag, sitzungsKennzahlen, minutenVon } from '../js/sitzungs-logik.js';

let fehler = 0;
function pruefe(name, bedingung) {
  if (bedingung) { console.log(`  OK  ${name}`); }
  else { console.error(`FEHLT ${name}`); fehler += 1; }
}

// Minuten-Parser
pruefe('minutenVon 10:41 = 641', minutenVon('10:41') === 641);
pruefe('minutenVon 07:00 = 420', minutenVon('07:00') === 420);

// Ein Block: Lücken ≤ 5 Min bleiben zusammen
const eins = clustereTag(['10:00', '10:03', '10:08']);
pruefe('1 Block bei ≤5-Min-Lücken', eins.bloecke.length === 1 && eins.luecken.length === 0);
pruefe('Block start/ende/anzahl', eins.bloecke[0].start === '10:00' && eins.bloecke[0].ende === '10:08' && eins.bloecke[0].anzahl === 3);

// Pause: Lücke >5 und ≤30 trennt Blöcke, gilt als Pause
const zwei = clustereTag(['10:00', '10:02', '10:11', '10:13']);
pruefe('2 Blöcke bei 9-Min-Lücke', zwei.bloecke.length === 2);
pruefe('Lücke 9 Min als Pause', zwei.luecken.length === 1 && zwei.luecken[0].minuten === 9 && zwei.luecken[0].pause === true);

// Neue Sitzung: Lücke >30 trennt, KEINE Pause
const drei = clustereTag(['10:00', '10:02', '11:00']);
pruefe('Lücke 58 Min keine Pause', drei.bloecke.length === 2 && drei.luecken[0].pause === false && drei.luecken[0].minuten === 58);

// Grenzwerte: exakt 5 = zusammen, exakt 30 = noch Pause, 31 = keine
pruefe('exakt 5 Min bleibt ein Block', clustereTag(['10:00', '10:05']).bloecke.length === 1);
pruefe('exakt 30 Min ist Pause', clustereTag(['10:00', '10:30']).luecken[0]?.pause === true);
pruefe('31 Min ist keine Pause', clustereTag(['10:00', '10:31']).luecken[0]?.pause === false);

// Einzelner Zeitpunkt und leer
pruefe('einzelner Zeitpunkt = 1 Block', clustereTag(['12:00']).bloecke.length === 1
  && clustereTag(['12:00']).bloecke[0].start === '12:00' && clustereTag(['12:00']).bloecke[0].ende === '12:00');
pruefe('leer = keine Blöcke', clustereTag([]).bloecke.length === 0 && clustereTag(undefined).bloecke.length === 0);

// Unsortierte Eingabe wird sortiert
pruefe('unsortiert wird sortiert', clustereTag(['10:08', '10:00', '10:03']).bloecke[0].start === '10:00');

// Kennzahlen: ⌀ erster Start über aktive Tage, ⌀ Pausen
const kz = sitzungsKennzahlen({
  '2026-07-11': ['10:00', '10:02', '10:11'],   // erster Start 10:00 = 600, eine 9-Min-Pause
  '2026-07-12': ['11:00'],                      // erster Start 11:00 = 660
});
pruefe('⌀ erster Start 10:30 = 630', kz.ersterStartMin === 630);
pruefe('⌀ Wiederaufnahme 9', kz.wiederaufnahmeMin === 9);
const leerKz = sitzungsKennzahlen({});
pruefe('leer → null/null', leerKz.ersterStartMin === null && leerKz.wiederaufnahmeMin === null);
pruefe('ohne Pausen → wiederaufnahme null', sitzungsKennzahlen({ t: ['10:00'] }).wiederaufnahmeMin === null);

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle sitzungs-logik-Checks grün.');
