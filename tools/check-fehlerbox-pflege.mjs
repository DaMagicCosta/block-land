// Integrations-Check des Box-Aufräumens gegen das echte state.js (localStorage gemockt).
// Prüft Verfall, Bestandsschnitt und dass ein zweiter Lauf nichts mehr ändert.
// Aufruf: node tools/check-fehlerbox-pflege.mjs
const speicher = new Map();
globalThis.localStorage = {
  getItem: k => speicher.get(k) ?? null,
  setItem: (k, v) => speicher.set(k, String(v)),
  removeItem: k => speicher.delete(k),
};
globalThis.window = globalThis;

const { addProfile, getFehlerbox, setzeFehlerboxEintrag } = await import('../js/state.js');
const { neuerEintrag, MAX_AKTIV, VERFALL_TAGE } = await import('../js/fehlerbox-logik.js');
const { raeumeFehlerboxAuf } = await import('../js/fehlerbox-pflege.js');

let fehler = 0;
const pruefe = (name, b) => b ? console.log(`  ok   ${name}`) : (console.error(`  FEHL ${name}`), fehler++);

function tagVor(tage) {
  const d = new Date();
  d.setDate(d.getDate() - tage);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function lege(id, typ, nr, tageHer) {
  const e = neuerEintrag({ aufgabentyp: typ, a: nr, b: 1, ergebnis: nr }, tagVor(tageHer));
  e.zuletzt = tagVor(tageHer);
  setzeFehlerboxEintrag(id, e.schluessel, e);
  return e.schluessel;
}
const zaehle = (id, typ) => Object.values(getFehlerbox(id)).filter(e => e.typ === typ).length;

const id = addProfile({ name: 'Testkind', weltName: 'Testland', avatar: '🧪', alter: 'klasse-2' });

// Ausgangslage: 30 frische Mal-Einträge, 5 uralte Plus-Einträge, 3 frische Uhr-Einträge.
for (let i = 0; i < 30; i++) lege(id, 'mal', i, i < 5 ? 30 : 2);   // die ersten fünf sind älter
for (let i = 0; i < 5; i++) lege(id, 'plus', i, VERFALL_TAGE + 5);
for (let i = 0; i < 3; i++) lege(id, 'uhr', i, 1);
pruefe('Ausgangslage steht', zaehle(id, 'mal') === 30 && zaehle(id, 'plus') === 5 && zaehle(id, 'uhr') === 3);

console.log('Aufräumen');
const entfernt = raeumeFehlerboxAuf(id);
pruefe('Verfall räumt die uralten Plus-Einträge ab', zaehle(id, 'plus') === 0);
pruefe('Bestandsschnitt bringt Mal auf die Grenze', zaehle(id, 'mal') === MAX_AKTIV);
pruefe('was unter der Grenze liegt, bleibt unangetastet', zaehle(id, 'uhr') === 3);
pruefe('Rückgabe zählt die Abgänge', entfernt === 5 + (30 - MAX_AKTIV));
// Der Schnitt muss die kältesten treffen: die fünf 30 Tage alten Mal-Einträge sind weg.
const malSchluessel = Object.values(getFehlerbox(id)).filter(e => e.typ === 'mal').map(e => e.schluessel);
pruefe('die kältesten Mal-Einträge sind geschnitten',
  !malSchluessel.includes('mal|0|1|0') && !malSchluessel.includes('mal|4|1|4'));
pruefe('die frischen sind geblieben', malSchluessel.includes('mal|29|1|29'));

console.log('Zweiter Lauf');
pruefe('ist idempotent (nichts mehr zu tun)', raeumeFehlerboxAuf(id) === 0);
pruefe('Bestand bleibt gleich', zaehle(id, 'mal') === MAX_AKTIV && zaehle(id, 'uhr') === 3);

console.log('Robustheit');
pruefe('ohne Profil-Id passiert nichts', raeumeFehlerboxAuf(null) === 0);
pruefe('unbekanntes Profil wirft nicht', raeumeFehlerboxAuf('gibtsnicht') === 0);

console.log(fehler === 0 ? '\n✅ Fehlerbox-Pflege: alle Checks bestanden' : `\n❌ ${fehler} Check(s) fehlgeschlagen`);
process.exit(fehler === 0 ? 0 : 1);
