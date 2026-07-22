// Check der Freischaltungs-Persistenz (Form des gespeicherten Standes, ohne Browser).
// Aufruf: node tools/check-freischaltung-state.mjs
import { ANFANGSSTAND, notierePruefung, sollAufsteigen, steigeAuf, offeneReihen }
  from '../js/freischaltung-logik.js';

// localStorage-Attrappe für den zweiten Abschnitt — prüft die echten state.js-Funktionen
// (getFreischaltung/setzeFreischaltung/wendeZustandsEreignisAn), nicht nur die pure Logik.
// Vorbild: tools/check-fehlerbox-state.mjs.
const speicher = new Map();
globalThis.localStorage = {
  getItem: k => speicher.get(k) ?? null,
  setItem: (k, v) => speicher.set(k, String(v)),
  removeItem: k => speicher.delete(k),
};
globalThis.window = globalThis;   // state.js hängt am Ende __blockLandState an window

const { addProfile, getState, getFreischaltung, setzeFreischaltung, wendeZustandsEreignisAn } =
  await import('../js/state.js');

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

console.log('\nPersistenz gegen das echte state.js (localStorage gemockt)');

const id = addProfile({ name: 'Testkind', weltName: 'Testland', avatar: '🧪', alter: 'klasse-2' });
const standMal = nachPruefung(nachPruefung(ANFANGSSTAND, 2, '2026-07-22', true), 2, '2026-07-23', true);

console.log('Hin- und Rückweg');
setzeFreischaltung(id, 'mal', standMal);
pruefe('getFreischaltung liefert den gesetzten Stand zurück', getFreischaltung(id, 'mal').stufe === standMal.stufe);
pruefe('landet wirklich im localStorage', speicher.size > 0 && JSON.stringify([...speicher.values()]).includes('freischaltung'));

console.log('Kopie statt Referenz');
const gelesen = getFreischaltung(id, 'mal');
gelesen.stufe = 999;
gelesen.pruefungen['2'] = ['manipuliert'];
pruefe('Mutation der gelesenen Kopie ändert den State nicht', getFreischaltung(id, 'mal').stufe === standMal.stufe);
pruefe('auch verschachtelte Mutation bleibt folgenlos',
  JSON.stringify(getFreischaltung(id, 'mal').pruefungen['2']) === JSON.stringify(standMal.pruefungen['2']));

console.log('Trennung der Rechenarten');
pruefe('geteilt ist beim Anfangsstand', getFreischaltung(id, 'geteilt').stufe === 1);
const standGeteilt = nachPruefung(ANFANGSSTAND, 2, '2026-07-22', true);
setzeFreischaltung(id, 'geteilt', standGeteilt);
pruefe('geteilt trägt jetzt seinen eigenen Stand', getFreischaltung(id, 'geteilt').stufe === standGeteilt.stufe);
pruefe('mal bleibt von geteilt unberührt', getFreischaltung(id, 'mal').stufe === standMal.stufe);

console.log('Altprofil ohne Feld (Forward-Compat)');
// getProfile() liefert einen structuredClone — ein delete darauf würde den echten State nicht
// treffen. getState() liefert die Live-Referenz, nur damit lässt sich das Fehlen des Felds
// im echten internen State simulieren (wie es bei einem Profil aus der Zeit vor diesem
// Feature tatsächlich der Fall wäre).
delete getState().profiles[id].freischaltung;
pruefe('getFreischaltung verträgt fehlendes Feld und liefert Anfangsstand',
  getFreischaltung(id, 'mal').stufe === 1 && Object.keys(getFreischaltung(id, 'mal').pruefungen).length === 0);

console.log('Sync-Wiedereinspielung');
const zweit = addProfile({ name: 'Zweitgerät', weltName: 'L', avatar: '📱', alter: 'klasse-2' });
pruefe('reiheFreigeschaltet wird angewendet',
  wendeZustandsEreignisAn({ op: 'reiheFreigeschaltet', args: { profilId: zweit, rechenart: 'mal', stand: standMal } }) === true
  && getFreischaltung(zweit, 'mal').stufe === standMal.stufe);
pruefe('unbekanntes Profil wird abgelehnt, nicht geworfen',
  wendeZustandsEreignisAn({ op: 'reiheFreigeschaltet', args: { profilId: 'gibts_nicht', rechenart: 'mal', stand: standMal } }) === false);

console.log('Schutzklauseln');
// Bewusst am Profil "zweit" geprüft, nicht an "id" — dessen freischaltung-Feld wurde im
// vorigen Abschnitt absichtlich gelöscht (Altprofil-Simulation), das würde hier nur die
// eigene Testkontamination prüfen statt die Schutzklauseln.
let warf = false;
try { setzeFreischaltung(undefined, 'mal', standMal); } catch { warf = true; }
pruefe('setzeFreischaltung ohne Profil wirft nicht', !warf);
warf = false;
try { setzeFreischaltung(zweit, undefined, standMal); } catch { warf = true; }
pruefe('setzeFreischaltung ohne Rechenart wirft nicht', !warf);
warf = false;
try { setzeFreischaltung(zweit, 'mal', null); } catch { warf = true; }
pruefe('setzeFreischaltung mit stand=null wirft nicht', !warf);
pruefe('nach den Schutzklauseln steht der echte Stand weiter unverändert', getFreischaltung(zweit, 'mal').stufe === standMal.stufe);

console.log(fehler === 0 ? '\nAlles grün.' : `\n${fehler} Fehler.`);
process.exit(fehler === 0 ? 0 : 1);
