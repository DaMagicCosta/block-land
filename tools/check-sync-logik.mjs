// Ad-hoc-Checks für js/sync-logik.js (kein Test-Runner im Projekt).
// Lauf: node tools/check-sync-logik.mjs  (aus dem Block-Land-Root)
import { ereignisAufgabe, ereignisEintragen, ereignisAufsagen, fuegeInQueue, QUEUE_MAX } from '../js/sync-logik.js';

let fehler = 0;
function pruefe(name, bedingung) {
  if (bedingung) { console.log(`  OK  ${name}`); }
  else { console.error(`FEHLT ${name}`); fehler += 1; }
}

const ts = '2026-07-09T16:00:00.000Z';

const a = ereignisAufgabe({ kind: 'Arthur', alter: 'klasse-2', aufgabentyp: 'mal', warRichtig: true, zeitMs: 4200, ts });
pruefe('aufgabe: Grundfelder', a.kind === 'Arthur' && a.alter === 'klasse-2' && a.ts === ts && a.art === 'aufgabe');
pruefe('aufgabe: typ/richtig/gesamt/zeit', a.typ === 'mal' && a.richtig === 1 && a.gesamt === 1 && a.zeit_ms === 4200);
pruefe('aufgabe: falsch → richtig=0', ereignisAufgabe({ kind: 'A', alter: 'klasse-2', aufgabentyp: 'plus', warRichtig: false, zeitMs: 0, ts }).richtig === 0);
pruefe('aufgabe: kaputte zeit → 0', ereignisAufgabe({ kind: 'A', alter: 'klasse-2', aufgabentyp: 'plus', warRichtig: true, zeitMs: NaN, ts }).zeit_ms === 0);

const e = ereignisEintragen({ kind: 'Arthur', alter: 'klasse-2', richtig: 8, fehler: 1, verraten: 1, ts });
pruefe('eintragen: gesamt = richtig+fehler+verraten', e.art === 'eintragen' && e.typ === 'mal' && e.richtig === 8 && e.gesamt === 10 && e.zeit_ms === 0);

const s = ereignisAufsagen({ kind: 'Arthur', alter: 'klasse-2', zeitMs: 80000, ts });
pruefe('aufsagen: zeit zählt, kein richtig/gesamt', s.art === 'aufsagen' && s.richtig === 0 && s.gesamt === 0 && s.zeit_ms === 80000);

const q1 = fuegeInQueue([], a);
pruefe('queue: anfügen, neues Array', q1.length === 1 && q1[0] === a);
const voll = Array.from({ length: QUEUE_MAX }, (_, i) => ({ nr: i }));
const q2 = fuegeInQueue(voll, a);
pruefe('queue: Cap hält, ältestes fliegt', q2.length === QUEUE_MAX && q2[0].nr === 1 && q2[QUEUE_MAX - 1] === a);
pruefe('queue: Eingabe unverändert', voll.length === QUEUE_MAX && voll[0].nr === 0);
pruefe('queue: kaputte Eingabe → frisches Array', fuegeInQueue(null, a).length === 1);

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle sync-logik-Checks grün.');
