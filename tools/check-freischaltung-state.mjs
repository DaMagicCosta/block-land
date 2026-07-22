// Check der Freischaltungs-Persistenz (Form des gespeicherten Standes, ohne Browser).
// Aufruf: node tools/check-freischaltung-state.mjs
import { ANFANGSSTAND, SEQUENZ, notierePruefung, sollAufsteigen, steigeAuf, offeneReihen, sitzt }
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

const { addProfile, getState, getFreischaltung, setzeFreischaltung, wendeZustandsEreignisAn,
        erzwingeFreischaltungsstufe } = await import('../js/state.js');

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
// Schlussdurchsicht 21.07.2026: die alte Fassung prüfte `typeof x === 'string'` auf
// Object.keys(...) — das liefert in JavaScript IMMER Zeichenketten, unabhängig vom geprüften
// Code (Sprachgarantie, kein Verhalten von notierePruefung/JSON). Stattdessen wird jetzt der
// tatsächliche Inhalt geprüft: genau die geprüfte Reihe (hier die 2er) steht als Schlüssel da.
pruefe('Schlüssel sind genau die geprüften Reihen', JSON.stringify(Object.keys(roh.pruefungen).sort()) === '["2"]');

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

console.log('Eltern-Override (Nachtrag A): erzwingeFreischaltungsstufe setzt statt verschmilzt');
// Kernfall aus dem Nachtrag: Arthur hat bereits Trainer-Übung, soll aber nicht bei Stufe 1
// anfangen. setzeFreischaltung() (Kind-Pfad) würde ein Herabsetzen wegverschmelzen (Max-Regel)
// — der Eltern-Pfad muss das können.
const arthur = addProfile({ name: 'Arthur', weltName: 'Arthurland', avatar: '⚔️', alter: 'klasse-2' });
// Realistischer Verlauf bis Stufe 6: jede durchlaufene Stufe hat ihre Prüf-Reihe mit zwei guten
// Tagen stehen (2er/Stufe1, 10er/Stufe2, 5er/Stufe3 — genau die Reihe, an der später wieder
// geprüft wird, wenn auf Stufe 3 zurückgestuft wird — sowie 6er/Stufe6, die aktuelle).
setzeFreischaltung(arthur, 'mal', {
  stufe: 6,
  pruefungen: {
    '2': ['2026-06-01', '2026-06-02'], '10': ['2026-06-03', '2026-06-04'],
    '5': ['2026-06-05', '2026-06-06'], '6': ['2026-07-10', '2026-07-11'],
  },
  fehlversuche: {},
});
pruefe('Ausgangsstufe ist 6', getFreischaltung(arthur, 'mal').stufe === 6);

erzwingeFreischaltungsstufe(arthur, 'mal', 8);
pruefe('Heraufsetzen wirkt', getFreischaltung(arthur, 'mal').stufe === 8);

erzwingeFreischaltungsstufe(arthur, 'mal', 3);
pruefe('Herabsetzen wirkt — die Verschmelzung steht nicht im Weg', getFreischaltung(arthur, 'mal').stufe === 3);
pruefe('Reihen STRIKT UNTERHALB der neuen Stufe behalten ihre Historie (2er, Stufe 1)',
  JSON.stringify(getFreischaltung(arthur, 'mal').pruefungen['2']) === '["2026-06-01","2026-06-02"]');
pruefe('...auch die 10er (Stufe 2)',
  JSON.stringify(getFreischaltung(arthur, 'mal').pruefungen['10']) === '["2026-06-03","2026-06-04"]');
// Fund Schlussdurchsicht 21.07.2026 („Eltern-Herabstufung wird wieder aufgerollt"): die Reihe,
// die GENAU an der neuen Stufe geprüft wird (5er, Stufe 3), muss ihre alte Historie verlieren —
// sonst gilt sie dank der beiden alten Tage sofort wieder als „sitzt" und die nächste Prüfung
// hebt die Rückstufung augenblicklich wieder auf, egal wie sie ausgeht.
pruefe('Die Reihe AN der neuen Stufe (5er, Stufe 3) verliert ihre alte Historie',
  getFreischaltung(arthur, 'mal').pruefungen['5'] === undefined);
pruefe('Reihen OBERHALB der neuen Stufe verlieren ihre Historie (6er, Stufe 6)',
  getFreischaltung(arthur, 'mal').pruefungen['6'] === undefined);
pruefe('Die Rückstufung ist dadurch wirksam: die 5er gilt nicht mehr sofort als „sitzt"',
  sitzt(getFreischaltung(arthur, 'mal'), 5) === false);

erzwingeFreischaltungsstufe(arthur, 'mal', 0);
pruefe('Stufe wird nach unten auf 1 geklemmt', getFreischaltung(arthur, 'mal').stufe === 1);
erzwingeFreischaltungsstufe(arthur, 'mal', 99);
pruefe('Stufe wird nach oben auf die letzte Stufe geklemmt', getFreischaltung(arthur, 'mal').stufe === SEQUENZ.length);

const arthurGeteilt = getFreischaltung(arthur, 'geteilt').stufe;
pruefe('andere Rechenart bleibt unberührt', arthurGeteilt === 1);

erzwingeFreischaltungsstufe(arthur, 'mal', 5);
pruefe('ein anschließender Kind-Fortschritt (setzeFreischaltung, Stufe 6) verschmilzt normal weiter',
  (() => {
    setzeFreischaltung(arthur, 'mal', { stufe: 6, pruefungen: {}, fehlversuche: {} });
    return getFreischaltung(arthur, 'mal').stufe === 6;
  })());

console.log('Absicherung: erneutes Setzen auf dieselbe Stufe kürzt nicht');
// Kernfall: Stufe 3 mit guter Prüfungs-Geschichte. Ein erneuter Aufruf mit Stufe 3
// (z.B. durch einen UI-Bug oder einen zweiten Aufrufer, der die Prüfung in eltern.js
// umgeht) darf die gerade laufende Reihe (5er, die Prüf-Reihe von Stufe 3) nicht
// entkernen.
const fussfnote = addProfile({ name: 'Testfall-Absicherung', weltName: 'Fußnote', avatar: '🔐', alter: 'klasse-2' });
setzeFreischaltung(fussfnote, 'mal', {
  stufe: 3,
  pruefungen: { '5': ['2026-07-20'] },  // ein guter Tag für die Prüf-Reihe der Stufe 3
  fehlversuche: {},
});
const tageVorher = JSON.stringify(getFreischaltung(fussfnote, 'mal').pruefungen['5']);
erzwingeFreischaltungsstufe(fussfnote, 'mal', 3);  // dieselbe Stufe nochmal setzen
const tageNachher = JSON.stringify(getFreischaltung(fussfnote, 'mal').pruefungen['5']);
pruefe('die Tagesliste der laufenden Reihe (5er) bleibt unverändert (nicht gekürzt)',
  tageNachher === tageVorher && tageNachher === '["2026-07-20"]');
pruefe('die Stufe bleibt 3', getFreischaltung(fussfnote, 'mal').stufe === 3);

console.log('Eltern-Override kein Wurf bei fehlendem Profil/Rechenart');
let warfOverride = false;
try { erzwingeFreischaltungsstufe('gibts_nicht', 'mal', 3); } catch { warfOverride = true; }
pruefe('unbekanntes Profil wirft nicht', !warfOverride);
warfOverride = false;
try { erzwingeFreischaltungsstufe(arthur, undefined, 3); } catch { warfOverride = true; }
pruefe('fehlende Rechenart wirft nicht', !warfOverride);

console.log('Eltern-Override propagiert per Sync als Ersetzen (nicht als Verschmelzen)');
const zweitgeraet = addProfile({ name: 'Zweitgerät-Override', weltName: 'Z', avatar: '📱', alter: 'klasse-2' });
setzeFreischaltung(zweitgeraet, 'mal', { stufe: 7, pruefungen: {}, fehlversuche: {} });
pruefe('Ausgangsstufe 7 auf dem zweiten Gerät', getFreischaltung(zweitgeraet, 'mal').stufe === 7);
const ok = wendeZustandsEreignisAn({
  op: 'freischaltungErzwungen',
  args: { profilId: zweitgeraet, rechenart: 'mal', stand: { stufe: 2, pruefungen: {}, fehlversuche: {} } },
});
pruefe('Ereignis wird angewendet', ok === true);
pruefe('die Stufe wird auf 2 GESETZT, nicht mit der 7 verschmolzen (kein Max)',
  getFreischaltung(zweitgeraet, 'mal').stufe === 2);
pruefe('unbekanntes Profil wird abgelehnt, nicht geworfen',
  wendeZustandsEreignisAn({ op: 'freischaltungErzwungen', args: { profilId: 'gibts_nicht', rechenart: 'mal', stand: { stufe: 2, pruefungen: {}, fehlversuche: {} } } }) === false);

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
