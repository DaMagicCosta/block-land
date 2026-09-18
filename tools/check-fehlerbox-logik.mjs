// Check der puren Fehlerbox-Logik. Aufruf: node tools/check-fehlerbox-logik.mjs
import {
  aufgabeSchluessel, neuerEintrag, planeWieder, istFaellig, verschiebeAufMorgen,
  faellige, naechsteFaellige, hilfeStufeFuer, boxStatistik, MAX_FACH,
  MAX_AKTIV, VERFALL_TAGE, tageUnberuehrt, verfallene, verdraengungsKandidat, ueberzaehlige, istGesperrt,
} from '../js/fehlerbox-logik.js';

let fehler = 0;
function pruefe(name, bedingung) {
  if (bedingung) { console.log(`  ok   ${name}`); }
  else { console.error(`  FEHL ${name}`); fehler++; }
}

const mal78 = { aufgabentyp: 'mal', a: 7, b: 8, ergebnis: 56, text: '7 · 8 = ?', stufe: 3 };
const mal87 = { aufgabentyp: 'mal', a: 8, b: 7, ergebnis: 56, text: '8 · 7 = ?', stufe: 3 };
const plus  = { aufgabentyp: 'plus', a: 24, b: 17, ergebnis: 41, text: '24 + 17 = ?', stufe: 2 };

console.log('Schlüssel');
pruefe('Schlüssel ist stabil', aufgabeSchluessel(mal78) === aufgabeSchluessel({ ...mal78 }));
pruefe('7·8 und 8·7 sind verschiedene Einträge', aufgabeSchluessel(mal78) !== aufgabeSchluessel(mal87));
pruefe('Aufgabe ohne a/b fällt auf text zurück',
  aufgabeSchluessel({ aufgabentyp: 'mengen', ergebnis: 6, text: 'Wie viele?' }) === 'mengen|Wie viele?');
pruefe('Müll ergibt keinen Schlüssel', aufgabeSchluessel({}) === null && aufgabeSchluessel(null) === null);

console.log('Neuer Eintrag');
const e0 = neuerEintrag(mal78, '2026-07-13');
pruefe('startet in Fach 1', e0.fach === 1);
pruefe('ist morgen fällig', e0.faelligAm === '2026-07-14');
pruefe('trägt die ganze Aufgabe mit', e0.aufgabe.ergebnis === 56);
pruefe('zählt den Fehler', e0.fehler === 1);

console.log('Aufstieg bei richtig');
const e1 = planeWieder(e0, true, '2026-07-14');
pruefe('Fach 1 → 2', e1.fach === 2);
pruefe('nach 3 Tagen wieder fällig', e1.faelligAm === '2026-07-17');
const e2 = planeWieder(e1, true, '2026-07-17');
pruefe('Fach 2 → 3', e2.fach === 3);
pruefe('nach 7 Tagen wieder fällig', e2.faelligAm === '2026-07-24');
pruefe('Fach 3 richtig → verlässt die Box', planeWieder(e2, true, '2026-07-24') === null);

console.log('Rückfall bei falsch');
const r = planeWieder(e2, false, '2026-07-24');
pruefe('Fach 3 falsch → zurück auf Fach 1', r.fach === 1);
pruefe('morgen wieder fällig', r.faelligAm === '2026-07-25');
pruefe('Fehlerzähler steigt', r.fehler === 2);
pruefe('Rückfall wirft NICHT aus der Box', r !== null);

console.log('Im zweiten Anlauf richtig — weder Aufstieg noch Rückfall');
const z = verschiebeAufMorgen(e2, '2026-07-24');
pruefe('Fach bleibt', z.fach === e2.fach);
pruefe('morgen nochmal', z.faelligAm === '2026-07-25');
pruefe('kein Fehler angerechnet', z.fehler === e2.fehler);
pruefe('verschiebeAufMorgen(null) → null', verschiebeAufMorgen(null) === null);

console.log('Hilfe wird ausgeschlichen');
pruefe('Fach 1 → volle Lösung', hilfeStufeFuer({ fach: 1 }) === 'voll');
pruefe('Fach 2 → nur Anstoß', hilfeStufeFuer({ fach: 2 }) === 'anstoss');
pruefe('Fach 3 → keine Hilfe', hilfeStufeFuer({ fach: 3 }) === 'keine');

console.log('Fälligkeit');
pruefe('morgen ist heute nicht fällig', istFaellig({ faelligAm: '2026-07-14' }, '2026-07-13') === false);
pruefe('heute fällig ist fällig', istFaellig({ faelligAm: '2026-07-13' }, '2026-07-13') === true);
pruefe('überfällig ist fällig', istFaellig({ faelligAm: '2026-07-01' }, '2026-07-13') === true);

console.log('Auswahl');
const box = {
  a: { schluessel: 'a', typ: 'mal',  fach: 1, faelligAm: '2026-07-10', fehler: 1, aufgabe: mal78 },
  b: { schluessel: 'b', typ: 'mal',  fach: 2, faelligAm: '2026-07-10', fehler: 4, aufgabe: mal87 },
  c: { schluessel: 'c', typ: 'mal',  fach: 1, faelligAm: '2026-07-30', fehler: 1, aufgabe: mal78 },
  d: { schluessel: 'd', typ: 'plus', fach: 1, faelligAm: '2026-07-01', fehler: 2, aufgabe: plus },
};
const f = faellige(box, 'mal', '2026-07-13');
pruefe('nur fällige des richtigen Typs', f.length === 2);
pruefe('bei gleichem Datum zuerst die mit mehr Fehlern', f[0].schluessel === 'b');
pruefe('nicht fällige bleiben draußen', !f.some(e => e.schluessel === 'c'));
pruefe('anderer Typ bleibt draußen', !f.some(e => e.schluessel === 'd'));
pruefe('naechsteFaellige liefert die dringendste', naechsteFaellige(box, 'mal', '2026-07-13').schluessel === 'b');
pruefe('nicht zweimal dieselbe hintereinander', naechsteFaellige(box, 'mal', '2026-07-13', 'b').schluessel === 'a');
pruefe('leere Box → null', naechsteFaellige({}, 'mal', '2026-07-13') === null);
pruefe('nichts fällig → null', naechsteFaellige(box, 'geteilt', '2026-07-13') === null);
pruefe('einziger Kandidat wird trotz `ausser` geliefert (kein Leerlauf)',
  naechsteFaellige({ d: box.d }, 'plus', '2026-07-13', 'd')?.schluessel === 'd');

console.log('Statistik');
const s = boxStatistik(box, '2026-07-13');
pruefe('gesamt stimmt', s.gesamt === 4);
pruefe('fällig stimmt', s.faellig === 3);
pruefe('proTyp stimmt', s.proTyp.mal === 3 && s.proTyp.plus === 1);

console.log('Sperre gegen den Zufallsgenerator');
{
  const heute = '2026-07-20';
  const drin = neuerEintrag(mal78, '2026-07-19');            // fällig erst am 20.07.
  const box2 = { [drin.schluessel]: drin };
  pruefe('frisch eingetragene Aufgabe ist am selben Tag gesperrt',
    istGesperrt(box2, mal78, '2026-07-19') === true);
  pruefe('sobald sie fällig ist, greift die Sperre nicht mehr',
    istGesperrt(box2, mal78, heute) === false);
  pruefe('Aufgabe ausserhalb der Box ist nie gesperrt', istGesperrt(box2, plus, '2026-07-19') === false);
  pruefe('leere Box sperrt nichts', istGesperrt({}, mal78, heute) === false);
  pruefe('Muell sperrt nichts', istGesperrt(box2, {}, heute) === false);
  // Gegenprobe: Wäre die Sperre an den Fachstand statt an die Fälligkeit geknüpft, bliebe
  // ein Eintrag in Fach 3 dauerhaft gesperrt — auch wenn er längst wieder drankommen soll.
  const fach3 = { ...drin, fach: 3, faelligAm: '2026-07-20' };
  pruefe('Fach 3, aber fällig → nicht gesperrt',
    istGesperrt({ [fach3.schluessel]: fach3 }, mal78, heute) === false);
}

console.log('Verfall');
{
  const alt  = { ...neuerEintrag(mal78, '2026-06-01'), zuletzt: '2026-06-01' };
  const jung = { ...neuerEintrag(plus,  '2026-07-10'), zuletzt: '2026-07-10' };
  const box2 = { [alt.schluessel]: alt, [jung.schluessel]: jung };
  pruefe('Alter zählt ab der letzten Berührung',
    tageUnberuehrt(alt, '2026-07-13') === 42 && tageUnberuehrt(jung, '2026-07-13') === 3);
  const raus = verfallene(box2, '2026-07-13');
  pruefe('was VERFALL_TAGE unberührt lag, verfällt', raus.length === 1 && raus[0] === alt.schluessel);
  pruefe('einen Tag früher verfällt noch nichts', verfallene(box2, '2026-07-12').length === 0);
  pruefe('leere Box verfällt nicht', verfallene({}, '2026-07-13').length === 0);
}

console.log('Bestandsgrenze je Typ');
{
  // Genau MAX_AKTIV Einträge: der nächste Fehler muss einen verdrängen, vorher keinen.
  const voll = {};
  for (let i = 0; i < MAX_AKTIV; i++) {
    const a = { aufgabentyp: 'mal', a: 2, b: i, ergebnis: 2 * i, text: `2 · ${i}` };
    const e = neuerEintrag(a, '2026-07-01');
    e.zuletzt = i === 0 ? '2026-06-20' : '2026-07-01';   // der erste ist der kälteste
    voll[e.schluessel] = e;
  }
  const kandidat = verdraengungsKandidat(voll, 'mal', '2026-07-13');
  pruefe('bei voller Box weicht der am längsten unberührte', kandidat === 'mal|2|0|0');
  const eineWeniger = { ...voll };
  delete eineWeniger[kandidat];
  pruefe('solange Platz ist, weicht niemand',
    verdraengungsKandidat(eineWeniger, 'mal', '2026-07-13') === null);
  pruefe('ein anderer Typ zählt nicht mit',
    verdraengungsKandidat(voll, 'plus', '2026-07-13') === null);
  // Gegenprobe zum Gleichstand: Bei gleichem Alter muss das niedrigere Fach weichen,
  // nicht irgendeins — sonst verlöre man den, der schon zweimal geliefert hat.
  const gleichAlt = {};
  for (let i = 0; i < MAX_AKTIV; i++) {
    const e = neuerEintrag({ aufgabentyp: 'uhr', a: i, b: 0, ergebnis: i * 60 }, '2026-07-01');
    e.zuletzt = '2026-07-01';
    e.fach = i === 7 ? 1 : 3;
    gleichAlt[e.schluessel] = e;
  }
  pruefe('bei gleichem Alter weicht das niedrigere Fach',
    verdraengungsKandidat(gleichAlt, 'uhr', '2026-07-13') === 'uhr|7|0|420');
}

console.log('Bestandsschnitt (Altbestand)');
{
  // 25 Mal-Einträge, unterschiedlich kalt; 5 müssen weichen, und zwar die kältesten.
  const voll = {};
  for (let i = 0; i < 25; i++) {
    const e = neuerEintrag({ aufgabentyp: 'mal', a: 3, b: i, ergebnis: 3 * i }, '2026-07-01');
    e.zuletzt = `2026-07-${String(1 + i).padStart(2, '0')}`;   // i=0 ist am längsten her
    voll[e.schluessel] = e;
  }
  const raus = ueberzaehlige(voll, '2026-08-01');
  pruefe('schneidet genau auf MAX_AKTIV', raus.length === 25 - MAX_AKTIV);
  pruefe('die kältesten weichen', raus.includes('mal|3|0|0') && raus.includes('mal|3|4|12'));
  pruefe('die jüngsten bleiben', !raus.includes('mal|3|24|72') && !raus.includes('mal|3|20|60'));
  // Gegenprobe: unter der Grenze darf nichts weichen, auch nicht ein sehr kalter Eintrag.
  const knapp = {};
  for (let i = 0; i < MAX_AKTIV; i++) {
    const e = neuerEintrag({ aufgabentyp: 'plus', a: 1, b: i, ergebnis: 1 + i }, '2026-06-01');
    e.zuletzt = '2026-06-01';
    knapp[e.schluessel] = e;
  }
  pruefe('genau MAX_AKTIV → niemand weicht', ueberzaehlige(knapp, '2026-08-01').length === 0);
  pruefe('Typen werden getrennt gezählt',
    ueberzaehlige({ ...voll, ...knapp }, '2026-08-01').every(k => k.startsWith('mal|')));
  pruefe('leere Box → nichts zu schneiden', ueberzaehlige({}, '2026-08-01').length === 0);
}

console.log('Grenzwerte');
pruefe('MAX_AKTIV ist 20', MAX_AKTIV === 20);
pruefe('VERFALL_TAGE ist 42', VERFALL_TAGE === 42);

console.log('Robustheit');
pruefe('planeWieder(null) → null', planeWieder(null, true) === null);
pruefe('faellige(undefined) → []', faellige(undefined, 'mal').length === 0);
pruefe('MAX_FACH ist 3', MAX_FACH === 3);

console.log(fehler === 0 ? '\n✅ Fehlerbox-Logik: alle Checks bestanden' : `\n❌ ${fehler} Check(s) fehlgeschlagen`);
process.exit(fehler === 0 ? 0 : 1);
