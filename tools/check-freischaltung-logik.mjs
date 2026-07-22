// Check der puren Freischaltungs-Logik. Aufruf: node tools/check-freischaltung-logik.mjs
import {
  SEQUENZ, ANFANGSSTAND, pruefReihe, offeneReihen, istOffen, notierePruefung,
  sitzt, klemmt, sollAufsteigen, steigeAuf, mischeQuizReihen, bestanden, verschmelzeStaende,
  ohneEinserreihe,
} from '../js/freischaltung-logik.js';
import { baueQuizFakten } from '../js/aufsagen-logik.js';
import { generiereMalAufgabe } from '../js/aufgaben/mal.js';
import { generiereGeteiltAufgabe } from '../js/aufgaben/geteilt.js';

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

console.log('Verschmelzung zweier Stände (Befund A: Geräte-Abgleich darf nie zurückdrehen)');
// Der Kern-Fall aus dem Befund: Tablet lange offline, steht noch auf Stufe 1 und legt dort
// (offline) eine Prüfung ab; Handy ist inzwischen auf Stufe 4. Das Tablet-Ereignis trifft NACH
// den Handy-Ereignissen ein. Mit last-write-wins würde das die Stufe von 4 auf 1 zurückwerfen.
const handyStand = { stufe: 4, pruefungen: { '2': ['2026-07-10', '2026-07-11'], '10': ['2026-07-12'] }, fehlversuche: {} };
const tabletStand = { stufe: 1, pruefungen: { '2': ['2026-07-20'] }, fehlversuche: { '5': ['2026-07-19'] } };
const nachTablet = verschmelzeStaende(handyStand, tabletStand);
pruefe('die höhere Stufe bleibt erhalten (kein Zurückdrehen)', nachTablet.stufe === 4);
pruefe('Prüfungstage der 2er sind vereinigt', JSON.stringify(nachTablet.pruefungen['2']) ===
  JSON.stringify(['2026-07-10', '2026-07-11', '2026-07-20']));
pruefe('Prüfungstage der 10er bleiben erhalten', JSON.stringify(nachTablet.pruefungen['10']) === '["2026-07-12"]');
pruefe('Fehlversuche der 5er kommen dazu', JSON.stringify(nachTablet.fehlversuche['5']) === '["2026-07-19"]');

console.log('Verschmelzung ist kommutativ (reihenfolgeunabhängig)');
const andereReihenfolge = verschmelzeStaende(tabletStand, handyStand);
pruefe('a,b liefert dasselbe Ergebnis wie b,a', JSON.stringify(nachTablet) === JSON.stringify(andereReihenfolge));

console.log('Verschmelzung senkt einen höheren Stand nie');
const hoch = { stufe: 5, pruefungen: {}, fehlversuche: {} };
const niedrig = { stufe: 2, pruefungen: {}, fehlversuche: {} };
pruefe('höherer Stand bleibt bei Verschmelzung mit niedrigerem oben', verschmelzeStaende(hoch, niedrig).stufe === 5);
pruefe('...unabhängig von der Reihenfolge', verschmelzeStaende(niedrig, hoch).stufe === 5);

console.log('Verschmelzung erzeugt keine Dubletten in Tageslisten');
const mitUeberschneidung1 = { stufe: 1, pruefungen: { '2': ['2026-07-10', '2026-07-11'] }, fehlversuche: {} };
const mitUeberschneidung2 = { stufe: 1, pruefungen: { '2': ['2026-07-11', '2026-07-12'] }, fehlversuche: {} };
const verschmolzen = verschmelzeStaende(mitUeberschneidung1, mitUeberschneidung2);
pruefe('keine Dubletten, sortiert', JSON.stringify(verschmolzen.pruefungen['2']) ===
  JSON.stringify(['2026-07-10', '2026-07-11', '2026-07-12']));

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

console.log('Quiz-Fakten über mehrere Reihen');
const fakten = baueQuizFakten(5, 'mal', [1, 2, 10]);
pruefe('zehn Fakten', fakten.length === 10);
pruefe('sechs aus der 5er-Reihe', fakten.filter(f => f.b === 5).length === 6);
pruefe('vier aus den alten Reihen', fakten.filter(f => [1, 2, 10].includes(f.b)).length === 4);
pruefe('Ergebnis stimmt bei allen', fakten.every(f => f.richtig === f.a * f.b));
const nurNeu = baueQuizFakten(2, 'mal', []);
pruefe('ohne alte Reihen alle zehn aus der neuen', nurNeu.filter(f => f.b === 2).length === 10);
const geteilt = baueQuizFakten(5, 'geteilt', [2]);
pruefe('geteilt fragt den Quotienten', geteilt.every(f => f.richtig === f.a / f.b));
pruefe('geteilt bleibt bei zehn', geteilt.length === 10);
const alt = baueQuizFakten(3, 'mal');
pruefe('ohne dritten Parameter wie bisher: alle aus der einen Reihe',
  alt.length === 10 && alt.every(f => f.b === 3));

console.log('Gemischt (🎲): immer zehn Fragen, auch bei wenig offenen Reihen (Befund C)');
// Kernfall des Befunds: nur EINE offene Reihe (z.B. Stufe 1, 1er läuft trivial mit, 2er ist
// die einzige "echte" offene) -> Paar-Bildung liefert nur neun Kombinationen (1 Reihe × 9
// Faktoren 2..10). Ohne Auffüllung: neun statt zehn Fragen, Abschluss meldet "8 von 9".
const gemischtEineReihe = baueQuizFakten('gemischt', 'mal', [2]);
pruefe('eine offene Reihe -> trotzdem zehn Fragen', gemischtEineReihe.length === 10);
pruefe('alle Fragen stammen aus der einzigen offenen Reihe', gemischtEineReihe.every(f => f.b === 2));
pruefe('Ergebnis stimmt bei allen', gemischtEineReihe.every(f => f.richtig === f.a * f.b));

const gemischtZweiReihen = baueQuizFakten('gemischt', 'mal', [2, 5]);
pruefe('zwei offene Reihen -> zehn Fragen', gemischtZweiReihen.length === 10);
pruefe('nur aus den zwei offenen Reihen', gemischtZweiReihen.every(f => [2, 5].includes(f.b)));

const gemischtOhneOffene = baueQuizFakten('gemischt', 'mal', []);
pruefe('ohne offene Reihen (Fallback voller Bereich) -> zehn Fragen', gemischtOhneOffene.length === 10);

const gemischtGeteiltEineReihe = baueQuizFakten('gemischt', 'geteilt', [2]);
pruefe('gilt auch für geteilt', gemischtGeteiltEineReihe.length === 10);
pruefe('geteilt-Fakten bleiben stimmig', gemischtGeteiltEineReihe.every(f => f.richtig === f.a / f.b));

console.log('Ohne-Einserreihe (Nachtrag A: gemeinsame Filterhilfe Trainer + Biom-Erzeuger)');
pruefe('entfernt die 1 aus einer Liste', JSON.stringify(ohneEinserreihe([1, 2, 10])) === '[2,10]');
pruefe('lässt Listen ohne 1 unverändert', JSON.stringify(ohneEinserreihe([2, 5])) === '[2,5]');
pruefe('leere Eingabe bleibt leer', JSON.stringify(ohneEinserreihe([])) === '[]');
pruefe('undefined liefert leeres Array (kein Wurf)', JSON.stringify(ohneEinserreihe(undefined)) === '[]');
pruefe('auf Stufe 1 bleibt genau die 2er übrig — kein leerer Reihen-Vorrat',
  JSON.stringify(ohneEinserreihe(offeneReihen(ANFANGSSTAND))) === '[2]');
pruefe('ab Stufe 2 bleibt die Liste vollständig ohne die 1 (nichts geht verloren)',
  JSON.stringify(ohneEinserreihe(offeneReihen({ ...ANFANGSSTAND, stufe: 3 })).sort((a, b) => a - b)) === '[2,5,10]');

console.log('Mal-Generator mit Reihen-Begrenzung');
const stufe = { nr: 2, a_min: 1, a_max: 10, b_min: 1, b_max: 10 };
const proben = Array.from({ length: 200 }, () => generiereMalAufgabe(stufe, { anzahl: 4 }, [1, 2, 10]));
pruefe('zieht nur aus erlaubten Reihen', proben.every(p => [1, 2, 10].includes(p.b)));
pruefe('Ergebnis stimmt', proben.every(p => p.ergebnis === p.a * p.b));
pruefe('fünf Antwort-Optionen', proben.every(p => p.antwort_optionen.length === 5));
pruefe('richtige Antwort ist dabei', proben.every(p => p.antwort_optionen.includes(p.ergebnis)));

console.log('Mal-Generator auf Stufe 1 nach dem Einser-Ausschluss (Nachtrag A, Problem 1)');
// Bildet nach, was aufgabe-ui.js für den Biom-Erzeuger tatsächlich übergibt: die auf Stufe 1
// offenen Reihen [1,2], bereinigt um die 1er. Vorher wäre hier [1,2] durchgereicht worden —
// rund die Hälfte aller Aufgaben hätte b=1 gelautet.
const stufe1Erlaubt = ohneEinserreihe(offeneReihen(ANFANGSSTAND));
pruefe('kein leerer Reihen-Vorrat auf Stufe 1', stufe1Erlaubt.length > 0);
const stufe1Proben = Array.from({ length: 100 }, () => generiereMalAufgabe(stufe, { anzahl: 4 }, stufe1Erlaubt));
pruefe('auf Stufe 1 kommt nach dem Ausschluss nie b=1 vor', stufe1Proben.every(p => p.b !== 1));
pruefe('stattdessen ausschließlich b=2', stufe1Proben.every(p => p.b === 2));
pruefe('Ergebnis bleibt stimmig', stufe1Proben.every(p => p.ergebnis === p.a * p.b));

console.log('Mal-Generator: Rückfall ohne dritten Parameter (geschärft)');
// Schwachstelle der alten Fassung: sie zog EINE Probe und prüfte sie gegen den Bereich 1..10 —
// dieser Bereich enthält die eingeschränkte Liste [1,2,10] vollständig, ein kaputter Rückfall,
// der insgeheim weiter [1,2,10] benutzt, wäre also nie aufgefallen.
// Stattdessen: viele Proben ziehen und prüfen, dass tatsächlich alle zehn Werte des vollen
// Stufenbereichs (b_min=1..b_max=10) auftauchen — nicht nur die drei der Liste. Bei 300 Proben
// ist die Wahrscheinlichkeit, dass ein bestimmter der zehn Werte nie gezogen wird, (9/10)^300
// ≈ 1,9·10⁻¹⁴ (und für "alle zehn treten auf" entsprechend noch kleiner) — ein insgeheim auf
// [1,2,10] beschränkter Rückfall würde diese Prüfung mit an Sicherheit grenzender
// Wahrscheinlichkeit NICHT bestehen, ein echter voller Bereich so gut wie sicher schon.
const ohneProben = Array.from({ length: 300 }, () => generiereMalAufgabe(stufe, { anzahl: 4 }));
const ohneWerte = new Set(ohneProben.map(p => p.b));
pruefe('ohne Begrenzung: alle zehn Werte des Stufenbereichs kommen vor (nicht nur [1,2,10])',
  Array.from({ length: 10 }, (_, i) => i + 1).every(v => ohneWerte.has(v)));
pruefe('ohne Begrenzung: Werte außerhalb der eingeschränkten Liste [1,2,10] treten auf',
  ohneProben.some(p => ![1, 2, 10].includes(p.b)));
pruefe('ohne Begrenzung: Ergebnis bleibt stimmig', ohneProben.every(p => p.ergebnis === p.a * p.b));

console.log('Geteilt-Generator mit Reihen-Begrenzung');
// "Alle Reihen" (Stufe 3 im echten Pool, data/aufgaben-pool.json) — bewusst die volle Liste
// 2..10 als stufenConfig.reihen, damit sich der Rückfall (unten) klar von der 2-elementigen
// Beschränkung [2,10] dieses Blocks unterscheiden lässt.
const stufeGeteilt = { nr: 3, reihen: [2, 3, 4, 5, 6, 7, 8, 9, 10], quotient_max: 10 };
const gProben = Array.from({ length: 300 },
  () => generiereGeteiltAufgabe(stufeGeteilt, { anzahl: 4 }, [2, 10]));
pruefe('zieht den Teiler nur aus erlaubten Reihen', gProben.every(p => [2, 10].includes(p.b)));
pruefe('a geteilt durch b ergibt ergebnis', gProben.every(p => p.a === p.b * p.ergebnis && p.a / p.b === p.ergebnis));
pruefe('fünf Antwort-Optionen', gProben.every(p => p.antwort_optionen.length === 5));
pruefe('richtige Antwort ist dabei', gProben.every(p => p.antwort_optionen.includes(p.ergebnis)));

console.log('Geteilt-Generator: Teiler 1 wird immer ausgefiltert');
const gMit1 = Array.from({ length: 300 },
  () => generiereGeteiltAufgabe(stufeGeteilt, { anzahl: 4 }, [1, 2, 10]));
pruefe('1 kommt trotz Angebot nie als Teiler vor', gMit1.every(p => p.b !== 1));
pruefe('stattdessen weiterhin nur aus dem Rest der Liste (2 oder 10)',
  gMit1.every(p => [2, 10].includes(p.b)));
pruefe('a geteilt durch b ergibt ergebnis (mit Filter)',
  gMit1.every(p => p.a === p.b * p.ergebnis && p.a / p.b === p.ergebnis));

console.log('Geteilt-Generator: nur [1] übergeben -> sicherer Rückfall');
// Nach dem Herausfiltern von 1 bleibt eine leere Liste — das darf weder NaN noch eine Division
// durch 0 noch eine Endlosschleife erzeugen. Dass die Schleife hier überhaupt terminiert
// (50 Proben ohne Hänger), ist bereits ein Beleg gegen eine Endlosschleife.
const gNur1 = Array.from({ length: 50 }, () => generiereGeteiltAufgabe(stufeGeteilt, { anzahl: 4 }, [1]));
pruefe('kein NaN in a/b/ergebnis',
  gNur1.every(p => !Number.isNaN(p.a) && !Number.isNaN(p.b) && !Number.isNaN(p.ergebnis)));
pruefe('kein Teiler 0 (keine Division durch null)', gNur1.every(p => p.b !== 0));
pruefe('fällt auf den festen Rückfallwert b=2 zurück', gNur1.every(p => p.b === 2));
pruefe('Aufgabe bleibt in sich stimmig', gNur1.every(p => p.a === p.b * p.ergebnis));

console.log('Geteilt-Generator: Rückfall ohne dritten Parameter (geschärft)');
// Gleiche Konstruktion wie beim Mal-Rückfall oben, nur dass der "volle Bereich" hier
// stufenConfig.reihen ist (bewusst alle neun Reihen 2..10 — die "Alle Reihen"-Stufe aus dem
// echten Pool), klar unterscheidbar von der 2-elementigen Beschränkung [2,10] weiter oben.
// Bei 300 Proben über 9 mögliche Werte ist die Wahrscheinlichkeit, dass ein bestimmter Wert nie
// gezogen wird, (8/9)^300 ≈ 4,6·10⁻¹⁶ — praktisch ausgeschlossen bei echtem vollen Bereich,
// aber sicher erkennbar, falls der Rückfall insgeheim bei [2,10] hängen bliebe.
const gOhne = Array.from({ length: 300 }, () => generiereGeteiltAufgabe(stufeGeteilt, { anzahl: 4 }));
const gOhneWerte = new Set(gOhne.map(p => p.b));
pruefe('ohne Begrenzung: alle Reihen aus stufenConfig.reihen kommen vor (nicht nur [2,10])',
  stufeGeteilt.reihen.every(r => gOhneWerte.has(r)));
pruefe('ohne Begrenzung: Werte außerhalb der eingeschränkten Liste [2,10] treten auf',
  gOhne.some(p => ![2, 10].includes(p.b)));
pruefe('ohne Begrenzung: Ergebnis bleibt stimmig', gOhne.every(p => p.ergebnis === p.a / p.b));

console.log(fehler === 0 ? '\nAlles grün.' : `\n${fehler} Fehler.`);
process.exit(fehler === 0 ? 0 : 1);
