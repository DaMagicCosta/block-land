// Ad-hoc-Checks für js/gutschein-anfrage-logik.js (kein Test-Runner im Projekt).
// Lauf: node tools/check-gutschein-anfrage-logik.mjs  (aus dem Block-Land-Root)
import {
  klemmeAnzahl, hatOffeneAnfrage, fuegeAnfrageHinzu,
  setzeAnfrageStatus, entferneAnfrage, entferneNachStatus,
} from '../js/gutschein-anfrage-logik.js';

let fehler = 0;
function pruefe(name, bedingung) {
  if (bedingung) { console.log(`  OK  ${name}`); }
  else { console.error(`FEHLT ${name}`); fehler += 1; }
}

// Anzahl-Klemmung
pruefe('klemme: mittig roh', klemmeAnzahl(3, 6) === 3);
pruefe('klemme: oben (9 von 4 → 4)', klemmeAnzahl(9, 4) === 4);
pruefe('klemme: unten (0 → 1)', klemmeAnzahl(0, 4) === 1);
pruefe('klemme: rundet (2.6 → 3)', klemmeAnzahl(2.6, 4) === 3);
pruefe('klemme: nichts vorhanden → 0', klemmeAnzahl(2, 0) === 0);
pruefe('klemme: kaputter Wunsch → 0', klemmeAnzahl('x', 4) === 0);

// Pro-Sorte-Guard
const a1 = { anfrageId: 'a_1', rezeptId: 'r_spiel15', name: '15 Min Spielen', emoji: '⏱️', anzahl: 2, ts: 't', status: 'offen' };
const a2 = { anfrageId: 'a_2', rezeptId: 'r_nasch', name: 'Nasch-Gutschein', emoji: '🍫', anzahl: 1, ts: 't', status: 'abgelehnt' };
pruefe('offen: findet nur status offen', hatOffeneAnfrage([a1, a2], 'r_spiel15') === true
  && hatOffeneAnfrage([a1, a2], 'r_nasch') === false
  && hatOffeneAnfrage([], 'r_spiel15') === false
  && hatOffeneAnfrage(undefined, 'r_spiel15') === false);

// Anlegen idempotent, neues Array
const nachAdd = fuegeAnfrageHinzu([a1], a2);
pruefe('add: fügt hinzu (neues Array)', nachAdd.length === 2 && nachAdd !== undefined);
pruefe('add: idempotent per anfrageId', fuegeAnfrageHinzu([a1], { ...a1, anzahl: 99 }).length === 1
  && fuegeAnfrageHinzu([a1], { ...a1, anzahl: 99 })[0].anzahl === 2);
pruefe('add: Original unverändert', (() => { const orig = [a1]; fuegeAnfrageHinzu(orig, a2); return orig.length === 1; })());
pruefe('add: undefined-Basis → 1 Eintrag', fuegeAnfrageHinzu(undefined, a1).length === 1);

// Status setzen
const nachStatus = setzeAnfrageStatus([a1, a2], 'a_1', 'freigegeben');
pruefe('status: setzt nur die eine', nachStatus[0].status === 'freigegeben' && nachStatus[1].status === 'abgelehnt');
pruefe('status: unbekannte Id → inhaltsgleich', JSON.stringify(setzeAnfrageStatus([a1], 'a_x', 'abgelehnt')) === JSON.stringify([a1]));
pruefe('status: Original unverändert', a1.status === 'offen');

// Entfernen
pruefe('entferne: per Id', entferneAnfrage([a1, a2], 'a_1').length === 1
  && entferneAnfrage([a1, a2], 'a_1')[0].anfrageId === 'a_2');
pruefe('entferne: unbekannte Id → alles bleibt', entferneAnfrage([a1], 'a_x').length === 1);
pruefe('entferne nach Status', entferneNachStatus([a1, a2], 'abgelehnt').length === 1
  && entferneNachStatus([a1, a2], 'abgelehnt')[0].anfrageId === 'a_1');

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle gutschein-anfrage-logik-Checks grün.');
