// Ad-hoc-Checks für js/zustand-sync-logik.js (kein Test-Runner im Projekt).
// Lauf: node tools/check-zustand-sync-logik.mjs  (aus dem Block-Land-Root)
import {
  baueZustandsEreignis, fremdeEreignisse, klemmeInventar,
  serialisiereAnzahl, deserialisiereAnzahl, ZUSTAND_QUEUE_MAX,
} from '../js/zustand-sync-logik.js';
import { fuegeInQueue } from '../js/sync-logik.js';

let fehler = 0;
function pruefe(name, bedingung) {
  if (bedingung) { console.log(`  OK  ${name}`); }
  else { console.error(`FEHLT ${name}`); fehler += 1; }
}

const jetzt = new Date('2026-07-11T14:32:01.000Z');
const ev = baueZustandsEreignis('d_1_abc', 'inventarPlus', { profilId: 'p_1', item: 'holz', anzahl: 1 }, jetzt);
pruefe('ereignis: Grundfelder', ev.geraet === 'd_1_abc' && ev.op === 'inventarPlus' && ev.ts === '2026-07-11T14:32:01.000Z');
pruefe('ereignis: args durchgereicht', ev.args.item === 'holz' && ev.args.anzahl === 1);
pruefe('ereignis: id-Format', /^z_\d+_[a-z0-9]{5}$/.test(ev.id));
pruefe('ereignis: kaputte args → {}', JSON.stringify(baueZustandsEreignis('d', 'op', null, jetzt).args) === '{}');

const evs = [
  { id: 'z1', geraet: 'd_A', op: 'inventarPlus', args: {} },
  { id: 'z2', geraet: 'd_B', op: 'inventarPlus', args: {} },
  null,
  { id: 'z3', geraet: 'd_B', op: '', args: {} },
];
const fremd = fremdeEreignisse(evs, 'd_A');
pruefe('fremd: eigene + kaputte raus', fremd.length === 1 && fremd[0].id === 'z2');
pruefe('fremd: kaputte Eingabe → []', fremdeEreignisse(null, 'd_A').length === 0);

pruefe('klemme: negatives raus, positives bleibt',
  JSON.stringify(klemmeInventar({ holz: -3, stein: 2, blume: 0 })) === JSON.stringify({ stein: 2 }));
pruefe('klemme: kaputte Eingabe → {}', JSON.stringify(klemmeInventar(null)) === '{}');

pruefe('anzahl: Infinity ↔ -1', serialisiereAnzahl(Infinity) === -1 && deserialisiereAnzahl(-1) === Infinity);
pruefe('anzahl: Zahl bleibt Zahl', serialisiereAnzahl(3) === 3 && deserialisiereAnzahl(3) === 3);
pruefe('anzahl: kaputt → 0', serialisiereAnzahl(NaN) === 0 && deserialisiereAnzahl(undefined) === 0);

pruefe('cap: 2000', ZUSTAND_QUEUE_MAX === 2000);
const voll = Array.from({ length: ZUSTAND_QUEUE_MAX }, (_, i) => ({ nr: i }));
const q = fuegeInQueue(voll, ev, ZUSTAND_QUEUE_MAX);
pruefe('cap: hält, ältestes fliegt', q.length === ZUSTAND_QUEUE_MAX && q[0].nr === 1 && q[q.length - 1] === ev);

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle zustand-sync-logik-Checks grün.');
