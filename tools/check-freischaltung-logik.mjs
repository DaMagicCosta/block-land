// Check der puren Freischaltungs-Logik. Aufruf: node tools/check-freischaltung-logik.mjs
import {
  SEQUENZ, ANFANGSSTAND, pruefReihe, offeneReihen, istOffen, notierePruefung,
  sitzt, klemmt, sollAufsteigen, steigeAuf, mischeQuizReihen, bestanden,
} from '../js/freischaltung-logik.js';

let fehler = 0;
function pruefe(name, bedingung) {
  if (bedingung) { console.log(`  ok   ${name}`); }
  else { console.error(`  FEHL ${name}`); fehler++; }
}

console.log('Sequenz');
pruefe('neun Stufen', SEQUENZ.length === 9);
pruefe('Stufe 1 ist 1er und 2er', JSON.stringify(SEQUENZ[0]) === '[1,2]');
pruefe('Stufe 2 ist die 10er', JSON.stringify(SEQUENZ[1]) === '[10]');
pruefe('Stufe 3 ist die 5er', JSON.stringify(SEQUENZ[2]) === '[5]');
pruefe('letzte Stufe ist die 7er', JSON.stringify(SEQUENZ[8]) === '[7]');
pruefe('vorletzte Stufe ist die 8er', JSON.stringify(SEQUENZ[7]) === '[8]');
pruefe('alle Reihen 1 bis 10 kommen genau einmal vor',
  JSON.stringify([...SEQUENZ.flat()].sort((a, b) => a - b)) === '[1,2,3,4,5,6,7,8,9,10]');
pruefe('vollständige Reihenfolge steht fest',
  JSON.stringify(SEQUENZ) === '[[1,2],[10],[5],[4],[3],[6],[9],[8],[7]]');

console.log('Prüfreihe');
pruefe('Stufe 1 wird an der 2er gemessen, nicht an der 1er', pruefReihe(1) === 2);
pruefe('Stufe 2 wird an der 10er gemessen', pruefReihe(2) === 10);
pruefe('Stufe 4 wird an der 4er gemessen', pruefReihe(4) === 4);
pruefe('Stufe 5 wird an der 3er gemessen', pruefReihe(5) === 3);
pruefe('Stufe 6 wird an der 6er gemessen', pruefReihe(6) === 6);
pruefe('Stufe 7 wird an der 9er gemessen', pruefReihe(7) === 9);
pruefe('Stufe 9 wird an der 7er gemessen', pruefReihe(9) === 7);

console.log('Offene Reihen');
pruefe('Anfangsstand ist Stufe 1', ANFANGSSTAND.stufe === 1);
pruefe('am Anfang sind 1er und 2er offen',
  JSON.stringify(offeneReihen(ANFANGSSTAND).sort((a, b) => a - b)) === '[1,2]');
pruefe('bei Stufe 3 sind 1,2,5,10 offen',
  JSON.stringify(offeneReihen({ ...ANFANGSSTAND, stufe: 3 }).sort((a, b) => a - b)) === '[1,2,5,10]');
pruefe('7er ist am Anfang nicht offen', istOffen(ANFANGSSTAND, 7) === false);
pruefe('2er ist am Anfang offen', istOffen(ANFANGSSTAND, 2) === true);

console.log('Bestanden-Schwelle');
pruefe('0 Fehler besteht', bestanden(0) === true);
pruefe('1 Fehler besteht', bestanden(1) === true);
pruefe('2 Fehler bestehen nicht', bestanden(2) === false);

console.log('Kriterium: zwei verschiedene Tage');
let s = notierePruefung(ANFANGSSTAND, 2, '2026-07-22', true);
pruefe('ein Tag reicht nicht', sitzt(s, 2) === false);
s = notierePruefung(s, 2, '2026-07-22', true);
pruefe('zweimal am selben Tag reicht nicht', sitzt(s, 2) === false);
s = notierePruefung(s, 2, '2026-07-23', true);
pruefe('zwei verschiedene Tage reichen', sitzt(s, 2) === true);
pruefe('Eingabe wurde nicht verändert (pur)', ANFANGSSTAND.pruefungen['2'] === undefined);

console.log('Klemmen: drei gescheiterte Tage');
let k = notierePruefung(ANFANGSSTAND, 2, '2026-07-22', false);
k = notierePruefung(k, 2, '2026-07-23', false);
pruefe('zwei gescheiterte Tage klemmen noch nicht', klemmt(k, 2) === false);
k = notierePruefung(k, 2, '2026-07-24', false);
pruefe('drei gescheiterte Tage klemmen', klemmt(k, 2) === true);
pruefe('mehrfaches Scheitern am selben Tag zählt einmal',
  klemmt(notierePruefung(notierePruefung(notierePruefung(ANFANGSSTAND, 2, '2026-07-22', false),
    2, '2026-07-22', false), 2, '2026-07-22', false), 2) === false);

console.log('Aufstieg');
pruefe('Aufstieg wenn die Reihe sitzt', sollAufsteigen(s) === true);
pruefe('Aufstieg wenn die Reihe klemmt (Umweg)', sollAufsteigen(k) === true);
pruefe('kein Aufstieg ohne beides', sollAufsteigen(ANFANGSSTAND) === false);
const auf = steigeAuf(s);
pruefe('Stufe steigt um eins', auf.stufe === 2);
pruefe('10er ist danach offen', istOffen(auf, 10) === true);
pruefe('bestandene Tage bleiben erhalten', sitzt(auf, 2) === true);
let ende = { ...ANFANGSSTAND, stufe: 9 };
pruefe('über die letzte Stufe hinaus geht nichts', steigeAuf(ende).stufe === 9);

console.log('Quiz-Mischung');
const m = mischeQuizReihen(5, [1, 2, 10], 10, 6);
pruefe('liefert zehn Reihen', m.length === 10);
pruefe('sechs davon sind die neue Reihe', m.filter(r => r === 5).length === 6);
pruefe('vier stammen aus den alten', m.filter(r => [1, 2, 10].includes(r)).length === 4);
pruefe('keine fremde Reihe dabei', m.every(r => [1, 2, 5, 10].includes(r)));
const allein = mischeQuizReihen(2, [], 10, 6);
pruefe('ohne alte Reihen kommen alle zehn aus der neuen', allein.filter(r => r === 2).length === 10);
const einsAlt = mischeQuizReihen(10, [2], 10, 6);
pruefe('mit nur einer alten Reihe bleibt es bei zehn Fragen', einsAlt.length === 10);

console.log(fehler === 0 ? '\nAlles grün.' : `\n${fehler} Fehler.`);
process.exit(fehler === 0 ? 0 : 1);
