// Integrations-Check: Fehler-Box gegen das echte state.js (localStorage gemockt).
// Prüft die Persistenz-Schicht, nicht die UI. Aufruf: node tools/check-fehlerbox-state.mjs
const speicher = new Map();
globalThis.localStorage = {
  getItem: k => speicher.get(k) ?? null,
  setItem: (k, v) => speicher.set(k, String(v)),
  removeItem: k => speicher.delete(k),
};
globalThis.window = globalThis;   // state.js hängt am Ende __blockLandState an window

const { addProfile, getFehlerbox, setzeFehlerboxEintrag, getProfile, getState, wendeZustandsEreignisAn } = await import('../js/state.js');
const { neuerEintrag, planeWieder, naechsteFaellige } = await import('../js/fehlerbox-logik.js');

let fehler = 0;
const pruefe = (name, b) => b ? console.log(`  ok   ${name}`) : (console.error(`  FEHL ${name}`), fehler++);

const id = addProfile({ name: 'Testkind', weltName: 'Testland', avatar: '🧪', alter: 'klasse-2' });
const mal78 = { aufgabentyp: 'mal', a: 7, b: 8, ergebnis: 56, text: '7 · 8 = ?', stufe: 3 };

console.log('Profil');
pruefe('neues Profil hat leere Fehlerbox', Object.keys(getProfile(id).fehlerbox).length === 0);

console.log('Eintragen');
const e = neuerEintrag(mal78, '2026-07-13');
setzeFehlerboxEintrag(id, e.schluessel, e);
pruefe('Eintrag ist persistiert', Object.keys(getFehlerbox(id)).length === 1);
pruefe('Aufgabe ist vollständig mitgespeichert', getFehlerbox(id)[e.schluessel].aufgabe.ergebnis === 56);
pruefe('landet wirklich im localStorage', speicher.size > 0 && JSON.stringify([...speicher.values()]).includes('fehlerbox'));

console.log('Wiedervorlage');
pruefe('heute noch nicht fällig', naechsteFaellige(getFehlerbox(id), 'mal', '2026-07-13') === null);
pruefe('morgen fällig', naechsteFaellige(getFehlerbox(id), 'mal', '2026-07-14')?.schluessel === e.schluessel);
pruefe('falscher Typ zieht nicht', naechsteFaellige(getFehlerbox(id), 'plus', '2026-07-14') === null);

console.log('Aufstieg bis raus');
let akt = getFehlerbox(id)[e.schluessel];
for (const tag of ['2026-07-14', '2026-07-17', '2026-07-24']) {
  akt = planeWieder(akt, true, tag);
  setzeFehlerboxEintrag(id, e.schluessel, akt);
}
pruefe('nach 3x richtig verlässt die Aufgabe die Box', Object.keys(getFehlerbox(id)).length === 0);

console.log('getFehlerbox gibt Kopien (keine Mutations-Vektoren)');
setzeFehlerboxEintrag(id, e.schluessel, neuerEintrag(mal78, '2026-07-13'));
const kopie = getFehlerbox(id);
kopie[e.schluessel].fach = 99;
pruefe('Mutation der Kopie ändert den State nicht', getFehlerbox(id)[e.schluessel].fach === 1);

console.log('Sync-Ereignis');
const zweit = addProfile({ name: 'Zweitgerät', weltName: 'L', avatar: '📱', alter: 'klasse-2' });
const eig = neuerEintrag({ aufgabentyp: 'plus', a: 24, b: 17, ergebnis: 41, text: '24 + 17 = ?' }, '2026-07-13');
pruefe('fehlerboxGesetzt wird angewendet',
  wendeZustandsEreignisAn({ op: 'fehlerboxGesetzt', args: { profilId: zweit, schluessel: eig.schluessel, eintrag: eig } }) === true
  && Object.keys(getFehlerbox(zweit)).length === 1);
pruefe('fehlerboxGesetzt mit eintrag=null entfernt',
  wendeZustandsEreignisAn({ op: 'fehlerboxGesetzt', args: { profilId: zweit, schluessel: eig.schluessel, eintrag: null } }) === true
  && Object.keys(getFehlerbox(zweit)).length === 0);
pruefe('unbekanntes Profil wird abgelehnt',
  wendeZustandsEreignisAn({ op: 'fehlerboxGesetzt', args: { profilId: 'gibts_nicht', schluessel: 'x', eintrag: eig } }) === false);

console.log('Altprofil ohne Feld (Forward-Compat)');
// Schlussdurchsicht 21.07.2026: getProfile() liefert einen structuredClone — ein delete darauf
// träfe nie den echten State, das fehlerbox-Feld bliebe intern weiter vorhanden. Nur getState()
// liefert die Live-Referenz, mit der sich ein Profil aus der Zeit vor diesem Feature (fehlendes
// fehlerbox-Feld) tatsächlich nachbilden lässt (gleiches Muster wie check-freischaltung-state.mjs).
// Die alte Fassung testete hier außerdem nur `.length >= 0` — eine Array-Länge ist nie negativ,
// das kann bei KEINEM Bug fehlschlagen. Jetzt wird echt geprüft: kein Wurf UND leeres Objekt.
delete getState().profiles[id].fehlerbox;
let warfOhneFeld = false;
let leerOhneFeld = null;
try { leerOhneFeld = getFehlerbox(id); } catch { warfOhneFeld = true; }
pruefe('getFehlerbox verträgt fehlendes Feld (kein Wurf, leeres Objekt)',
  !warfOhneFeld && leerOhneFeld !== null && Object.keys(leerOhneFeld).length === 0);
setzeFehlerboxEintrag(id, 'neu|1|1|2', neuerEintrag({ aufgabentyp: 'plus', a: 1, b: 1, ergebnis: 2 }, '2026-07-13'));
pruefe('setzeFehlerboxEintrag legt das Feld nach', !!getFehlerbox(id)['neu|1|1|2']);

console.log(fehler === 0 ? '\n✅ Fehlerbox-State: alle Checks bestanden' : `\n❌ ${fehler} Check(s) fehlgeschlagen`);
process.exit(fehler === 0 ? 0 : 1);
