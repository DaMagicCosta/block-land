// Ad-hoc-Checks für js/tagesauftrag-logik.js (kein Test-Runner im Projekt).
// Lauf: node tools/check-tagesauftrag-logik.mjs  (aus dem Block-Land-Root)
import { zielFuer, neuerAuftrag, aktualisiereTagesauftrag, truhenZiehung } from '../js/tagesauftrag-logik.js';

let fehler = 0;
function pruefe(name, bedingung) {
  if (bedingung) { console.log(`  OK  ${name}`); }
  else { console.error(`FEHLT ${name}`); fehler += 1; }
}

// --- zielFuer: Umfang je Alter ---
pruefe('kindergarten -> Ziel 3', zielFuer('kindergarten') === 3);
pruefe('klasse-1 -> Ziel 3', zielFuer('klasse-1') === 3);
pruefe('klasse-2 -> Ziel 5', zielFuer('klasse-2') === 5);
pruefe('klasse-3 -> Ziel 5', zielFuer('klasse-3') === 5);
pruefe('unbekanntes Alter -> Ziel 3 (Fallback)', zielFuer('irgendwas') === 3);

// --- neuerAuftrag: frisches Objekt ---
const frisch = neuerAuftrag('2026-07-10');
pruefe('neuerAuftrag: datum gesetzt', frisch.datum === '2026-07-10');
pruefe('neuerAuftrag: fortschritt 0', frisch.fortschritt === 0);
pruefe('neuerAuftrag: nicht belohnt', frisch.belohnt === false);

// --- aktualisiereTagesauftrag: Increment am selben Tag ---
const tag1 = aktualisiereTagesauftrag(neuerAuftrag('2026-07-10'), '2026-07-10');
pruefe('Increment: fortschritt 1', tag1.fortschritt === 1);
const tag2 = aktualisiereTagesauftrag(tag1, '2026-07-10');
pruefe('Increment: fortschritt 2', tag2.fortschritt === 2);
pruefe('Increment: belohnt bleibt false', tag2.belohnt === false);

// Neues Objekt (Eingabe unverändert)
pruefe('Eingabe bleibt unverändert (kein Mutations-Vektor)', tag1.fortschritt === 1);

// --- Tages-Reset bei neuem Datum ---
const altBelohnt = { datum: '2026-07-09', fortschritt: 5, belohnt: true };
const neuerTag = aktualisiereTagesauftrag(altBelohnt, '2026-07-10');
pruefe('Reset bei neuem Datum: datum aktualisiert', neuerTag.datum === '2026-07-10');
pruefe('Reset bei neuem Datum: fortschritt startet bei 1 (Reset + Increment)', neuerTag.fortschritt === 1);
pruefe('Reset bei neuem Datum: belohnt zurückgesetzt', neuerTag.belohnt === false);
pruefe('altes Objekt unverändert', altBelohnt.fortschritt === 5 && altBelohnt.belohnt === true);

// --- Fehlendes/leeres Auftrags-Objekt (Altprofile ohne Feld) ---
const vonNull = aktualisiereTagesauftrag(undefined, '2026-07-10');
pruefe('undefined -> frischer Auftrag + Increment', vonNull.datum === '2026-07-10' && vonNull.fortschritt === 1);
const vonNullObj = aktualisiereTagesauftrag(null, '2026-07-10');
pruefe('null -> frischer Auftrag + Increment', vonNullObj.fortschritt === 1);

// --- truhenZiehung: Ziehung deterministisch mit injiziertem rnd ---
const DEFAULT_DROP = { holz: 0.9, stein: 0.85, blume: 0.85, eisen: 0.4, diamant: 0.07 };

// rnd() liefert immer 0 -> trifft das erste (seltenste) Item in der Verteilung: diamant.
const nurDiamant = truhenZiehung(DEFAULT_DROP, () => 0, 3);
pruefe('anzahl beachtet (3 Items)', nurDiamant.length === 3);
pruefe('rnd()=0 -> immer das seltenste Item (diamant)', nurDiamant.every(i => i === 'diamant'));

// rnd() liefert immer 0.999999 -> trifft das letzte Item in der Verteilung: holz.
const nurHolz = truhenZiehung(DEFAULT_DROP, () => 0.999999, 3);
pruefe('rnd()~1 -> letztes Item (holz)', nurHolz.every(i => i === 'holz'));

// Reproduzierbarkeit: gleiche rnd-Sequenz -> gleiches Ergebnis
const seq = [0.1, 0.5, 0.9];
let i1 = 0, i2 = 0;
const ziehung1 = truhenZiehung(DEFAULT_DROP, () => seq[i1++], 3);
const ziehung2 = truhenZiehung(DEFAULT_DROP, () => seq[i2++], 3);
pruefe('deterministisch: gleiche Sequenz -> gleiches Ergebnis', JSON.stringify(ziehung1) === JSON.stringify(ziehung2));

// --- Truhe nie leer ---
pruefe('leere dropChancen -> trotzdem holz (nie leer)', truhenZiehung({}, () => 0.5, 3).every(i => i === 'holz'));
pruefe('alle Chancen 0 -> trotzdem holz (nie leer)',
  truhenZiehung({ holz: 0, stein: 0, blume: 0, eisen: 0, diamant: 0 }, () => 0.5, 3).every(i => i === 'holz'));
pruefe('Standard-Anzahl ist 3', truhenZiehung(DEFAULT_DROP, () => 0.5).length === 3);
pruefe('anzahl=5 wird respektiert', truhenZiehung(DEFAULT_DROP, () => 0.5, 5).length === 5);

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle tagesauftrag-logik-Checks grün.');
