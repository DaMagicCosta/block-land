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

// Prüfe den tatsächlich gespeicherten Wert im Speicher (nicht nur dass das Wort 'freischaltung' vorkommt)
const rohGespeichert = speicher.get('block-land-state-v1');
const zustand = rohGespeichert ? JSON.parse(rohGespeichert) : {};
const gespeicherterStand = zustand.profiles?.[id]?.freischaltung?.mal;
pruefe('speichert Stufe und Prüfungsverlauf korrekt im localStorage',
  gespeicherterStand?.stufe === standMal.stufe
  && JSON.stringify(gespeicherterStand?.pruefungen) === JSON.stringify(standMal.pruefungen)
);

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

console.log('Verschmelzung statt Zurückdrehen (Befund A: Geräte-Abgleich)');
// Nachgebauter Kernfall: Handy ist auf Stufe 4, Tablet war offline und steht noch auf Stufe 1.
// Das Tablet-Ereignis trifft NACH dem aktuellen (hohen) Stand ein. Mit last-write-wins hätte
// das den Stand auf Stufe 1 zurückgeworfen — mit Verschmelzung darf das nicht passieren.
const dritt = addProfile({ name: 'Drittgerät', weltName: 'D', avatar: '📟', alter: 'klasse-2' });
const standHandy = { stufe: 4, pruefungen: { '2': ['2026-07-10', '2026-07-11'], '10': ['2026-07-12'] }, fehlversuche: {} };
setzeFreischaltung(dritt, 'mal', standHandy);
pruefe('Ausgangsstand ist Stufe 4', getFreischaltung(dritt, 'mal').stufe === 4);
const standTabletAlt = { stufe: 1, pruefungen: { '2': ['2026-07-20'] }, fehlversuche: {} };
const angewendet = wendeZustandsEreignisAn({ op: 'reiheFreigeschaltet', args: { profilId: dritt, rechenart: 'mal', stand: standTabletAlt } });
pruefe('das nachträgliche Ereignis wird angewendet (nicht abgelehnt)', angewendet === true);
pruefe('die Stufe bleibt bei 4 (wurde NICHT auf 1 zurückgedreht)', getFreischaltung(dritt, 'mal').stufe === 4);
pruefe('die neuen Prüfungstage der 2er sind trotzdem übernommen (ergänzt, nicht verworfen)',
  JSON.stringify(getFreischaltung(dritt, 'mal').pruefungen['2']) ===
  JSON.stringify(['2026-07-10', '2026-07-11', '2026-07-20']));
pruefe('Prüfungstage der 10er bleiben unangetastet',
  JSON.stringify(getFreischaltung(dritt, 'mal').pruefungen['10']) === '["2026-07-12"]');

console.log('Verschmelzung gilt auch für das lokale setzeFreischaltung (nicht nur den Sync-Zweig)');
const viert = addProfile({ name: 'Viertgerät', weltName: 'V', avatar: '💻', alter: 'klasse-2' });
setzeFreischaltung(viert, 'mal', { stufe: 3, pruefungen: { '5': ['2026-07-15'] }, fehlversuche: {} });
setzeFreischaltung(viert, 'mal', { stufe: 1, pruefungen: { '2': ['2026-07-01'] }, fehlversuche: {} });
pruefe('ein niedrigerer lokaler Aufruf senkt die Stufe nicht', getFreischaltung(viert, 'mal').stufe === 3);
pruefe('Tage aus dem niedrigeren Aufruf werden trotzdem ergänzt',
  JSON.stringify(getFreischaltung(viert, 'mal').pruefungen['2']) === '["2026-07-01"]');

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
