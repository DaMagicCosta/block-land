// Check der puren Fehlerbox-Logik. Aufruf: node tools/check-fehlerbox-logik.mjs
import {
  aufgabeSchluessel, neuerEintrag, planeWieder, istFaellig, verschiebeAufMorgen,
  faellige, naechsteFaellige, hilfeStufeFuer, boxStatistik, MAX_FACH,
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

console.log('Robustheit');
pruefe('planeWieder(null) → null', planeWieder(null, true) === null);
pruefe('faellige(undefined) → []', faellige(undefined, 'mal').length === 0);
pruefe('MAX_FACH ist 3', MAX_FACH === 3);

console.log(fehler === 0 ? '\n✅ Fehlerbox-Logik: alle Checks bestanden' : `\n❌ ${fehler} Check(s) fehlgeschlagen`);
process.exit(fehler === 0 ? 0 : 1);
