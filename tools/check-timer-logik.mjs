// Ad-hoc-Checks für js/timer-logik.js (kein Test-Runner im Projekt).
// Lauf: node tools/check-timer-logik.mjs  (aus dem Block-Land-Root)
import {
  GRENZEN, standardFuer, wirksameKonfig, frischerTag,
  istNacht, istAbend, sonnenPosition, nachtRestMin,
  wendeAbwesenheitAn, ticke,
} from '../js/timer-logik.js';

let fehler = 0;
function pruefe(name, bedingung) {
  if (bedingung) { console.log(`  OK  ${name}`); }
  else { console.error(`FEHLT ${name}`); fehler += 1; }
}

const jetzt = new Date('2026-07-11T15:00:00.000Z');

// Studien-Standards (Spec §2, bindend)
pruefe('standard: kindergarten 10/5', JSON.stringify(standardFuer('kindergarten')) === JSON.stringify({ uebenMin: 10, pauseMin: 5, aktiv: true }));
pruefe('standard: klasse-1 15/5', standardFuer('klasse-1').uebenMin === 15 && standardFuer('klasse-1').pauseMin === 5);
pruefe('standard: klasse-2 20/5', standardFuer('klasse-2').uebenMin === 20);
pruefe('standard: klasse-3 25/5', standardFuer('klasse-3').uebenMin === 25);
pruefe('standard: unbekanntes alter → kindergarten', standardFuer('quatsch').uebenMin === 10);

// Wirksame Konfig
pruefe('konfig: null → Standard', wirksameKonfig('klasse-2', null).uebenMin === 20);
pruefe('konfig: Override greift', wirksameKonfig('klasse-2', { uebenMin: 30, pauseMin: 10, aktiv: true }).uebenMin === 30);
pruefe('konfig: Klemme oben (99 → 45)', wirksameKonfig('klasse-2', { uebenMin: 99, pauseMin: 5 }).uebenMin === GRENZEN.ueben[1]);
pruefe('konfig: Klemme unten (1 → 5)', wirksameKonfig('klasse-2', { uebenMin: 1, pauseMin: 5 }).uebenMin === GRENZEN.ueben[0]);
pruefe('konfig: kaputter Wert → Standard-Wert', wirksameKonfig('klasse-2', { uebenMin: 'x', pauseMin: 5 }).uebenMin === 20);
pruefe('konfig: aktiv default true, false bleibt false', wirksameKonfig('klasse-2', { uebenMin: 20, pauseMin: 5 }).aktiv === true && wirksameKonfig('klasse-2', { uebenMin: 20, pauseMin: 5, aktiv: false }).aktiv === false);

// Phasen
const konfig = standardFuer('klasse-2'); // 20/5
const frisch = frischerTag(jetzt);
pruefe('frischerTag: Felder', frisch.tagSekunden === 0 && frisch.nachtBis === null && frisch.zuletztAktiv === jetzt.toISOString());
pruefe('nacht: läuft', istNacht({ tagSekunden: 1200, nachtBis: '2026-07-11T15:05:00.000Z' }, jetzt) === true);
pruefe('nacht: abgelaufen', istNacht({ tagSekunden: 1200, nachtBis: '2026-07-11T14:59:00.000Z' }, jetzt) === false);
pruefe('nacht: kein timer/keine nachtBis', istNacht(null, jetzt) === false && istNacht(frisch, jetzt) === false);
pruefe('sonne: 0 / halb / Kappe 1', sonnenPosition(frisch, konfig) === 0
  && sonnenPosition({ tagSekunden: 600 }, konfig) === 0.5
  && sonnenPosition({ tagSekunden: 99999 }, konfig) === 1);
pruefe('abend: ab 80%', istAbend({ tagSekunden: 960 }, konfig, jetzt) === true && istAbend({ tagSekunden: 900 }, konfig, jetzt) === false);
pruefe('nachtRest: aufgerundet, min 1', nachtRestMin({ nachtBis: '2026-07-11T15:04:30.000Z' }, jetzt) === 5
  && nachtRestMin({ nachtBis: '2026-07-11T15:00:01.000Z' }, jetzt) === 1
  && nachtRestMin(frisch, jetzt) === 0);

// Abwesenheits-Regel
const kurzWeg = { tagSekunden: 600, nachtBis: null, zuletztAktiv: '2026-07-11T14:58:00.000Z' }; // 2 Min weg
pruefe('abwesenheit: kurz weg → identisch (Referenz)', wendeAbwesenheitAn(kurzWeg, konfig, jetzt) === kurzWeg);
const langWeg = { tagSekunden: 600, nachtBis: null, zuletztAktiv: '2026-07-11T14:54:00.000Z' }; // 6 Min ≥ 5 Min Pause
pruefe('abwesenheit: lang weg → frischer Tag', wendeAbwesenheitAn(langWeg, konfig, jetzt).tagSekunden === 0);
const nachtVorbei = { tagSekunden: 1200, nachtBis: '2026-07-11T14:59:00.000Z', zuletztAktiv: '2026-07-11T14:54:00.000Z' };
pruefe('abwesenheit: Nacht abgelaufen → frischer Tag', wendeAbwesenheitAn(nachtVorbei, konfig, jetzt).nachtBis === null);
const nachtLaeuft = { tagSekunden: 1200, nachtBis: '2026-07-11T15:03:00.000Z', zuletztAktiv: '2026-07-11T14:50:00.000Z' };
pruefe('abwesenheit: Nacht läuft → identisch (auch bei langer Abwesenheit)', wendeAbwesenheitAn(nachtLaeuft, konfig, jetzt) === nachtLaeuft);
pruefe('abwesenheit: kein timer → frischer Tag', wendeAbwesenheitAn(null, konfig, jetzt).tagSekunden === 0);

// Ticken
const t1 = ticke({ tagSekunden: 100, nachtBis: null, zuletztAktiv: null }, konfig, jetzt);
pruefe('ticke: +1 und zuletztAktiv', t1.timer.tagSekunden === 101 && t1.nachtBegonnen === false && t1.timer.zuletztAktiv === jetzt.toISOString());
const t2 = ticke({ tagSekunden: 1199, nachtBis: null, zuletztAktiv: null }, konfig, jetzt);
pruefe('ticke: Übergang bei 20 Min → Nacht beginnt', t2.nachtBegonnen === true
  && t2.timer.nachtBis === new Date(jetzt.getTime() + 5 * 60000).toISOString());
const nachts = { tagSekunden: 1200, nachtBis: '2026-07-11T15:05:00.000Z', zuletztAktiv: null };
pruefe('ticke: nachts unverändert', ticke(nachts, konfig, jetzt).timer === nachts);

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle timer-logik-Checks grün.');
