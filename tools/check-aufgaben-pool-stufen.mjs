// Check der Stufen-Konfiguration in data/aufgaben-pool.json (Nachtrag B zur
// Reihen-Freischaltung). Aufruf: node tools/check-aufgaben-pool-stufen.mjs
//
// Hintergrund: Seit die Reihen-Freischaltung den Reihen-Faktor (b bei Mal, b bei Geteilt)
// vorgibt, ist er als adaptive Stellschraube entwertet — die alten Stufen-Bereiche für b
// greifen im Biom gar nicht mehr, weil erlaubteReihen sie überschreibt. Dieser Check nagelt
// zwei Reparaturen fest:
//   1. Geteilt: quotient_max staffelt jetzt über die Stufen (5 / 8 / 10) — eine zweite,
//      von der Freischaltung unabhängige Stellschraube.
//   2. Mal: a_max in Stufe 4 ist auf 10 gedeckelt (vorher 12) — "Mal bleibt im kleinen 1x1".
// Plus eine allgemeine Struktur-Prüfung, dass jede Stufe die Felder trägt, die ihr Erzeuger
// tatsächlich liest.
//
// Probenzahlen: Alle Stichproben-Prüfungen unten ziehen mindestens 300 Proben. Bei einem
// zufällig gezogenen Quotienten aus 1..q ist die Wahrscheinlichkeit, dass der Maximalwert q
// bei N Proben NIE gezogen wird, ((q-1)/q)^N. Für das ungünstigste q hier (10) ergibt das bei
// N=300 (0,9)^300 ≈ 1,9·10⁻¹⁴ — die Prüfung, dass die Obergrenze tatsächlich erreicht wird,
// ist damit praktisch beweiskräftig und nicht bloß ein Zufallstreffer.

import { readFileSync } from 'node:fs';
import { generiereMalAufgabe } from '../js/aufgaben/mal.js';
import { generiereGeteiltAufgabe } from '../js/aufgaben/geteilt.js';

const pool = JSON.parse(readFileSync(new URL('../data/aufgaben-pool.json', import.meta.url), 'utf8'));

let fehler = 0;
function pruefe(name, bedingung) {
  if (bedingung) { console.log(`  ok   ${name}`); }
  else { console.error(`  FEHL ${name}`); fehler++; }
}

function proben(n, fn) {
  return Array.from({ length: n }, fn);
}

// ---------------------------------------------------------------------------------------
console.log('Struktur: jede Stufe trägt die Felder, die ihr Erzeuger liest');

for (const typ of ['plus', 'minus']) {
  for (const s of pool[typ].stufen) {
    pruefe(`${typ} Stufe ${s.nr} hat a_min/a_max/b_min/b_max`,
      Number.isFinite(s.a_min) && Number.isFinite(s.a_max) &&
      Number.isFinite(s.b_min) && Number.isFinite(s.b_max));
  }
}

for (const s of pool.mal.stufen) {
  pruefe(`mal Stufe ${s.nr} hat a_min/a_max/b_min/b_max`,
    Number.isFinite(s.a_min) && Number.isFinite(s.a_max) &&
    Number.isFinite(s.b_min) && Number.isFinite(s.b_max));
}

for (const s of pool.geteilt.stufen) {
  pruefe(`geteilt Stufe ${s.nr} hat eine nicht-leere reihen-Liste`,
    Array.isArray(s.reihen) && s.reihen.length > 0);
  pruefe(`geteilt Stufe ${s.nr} hat quotient_max`, Number.isFinite(s.quotient_max));
}

for (const s of pool.mengen.stufen) {
  pruefe(`mengen Stufe ${s.nr} hat ziel_min/ziel_max`,
    Number.isFinite(s.ziel_min) && Number.isFinite(s.ziel_max));
}

// rechnen10.js liest je nach stufenConfig.nr unterschiedliche Felder (siehe rechnen10.js):
// nr 1 (zerlegung) -> ganze_min/ganze_max, nr 2 (verliebte) -> teil_min/teil_max, nr 3 (rechnen)
// braucht keine Zusatzfelder (feste Bereiche im Code).
const r10 = Object.fromEntries(pool.rechnen10.stufen.map(s => [s.nr, s]));
pruefe('rechnen10 Stufe 1 hat ganze_min/ganze_max',
  Number.isFinite(r10[1]?.ganze_min) && Number.isFinite(r10[1]?.ganze_max));
pruefe('rechnen10 Stufe 2 hat teil_min/teil_max',
  Number.isFinite(r10[2]?.teil_min) && Number.isFinite(r10[2]?.teil_max));
pruefe('rechnen10 Stufe 3 existiert (braucht keine Zusatzfelder)', r10[3]?.nr === 3);

// ---------------------------------------------------------------------------------------
console.log('\nGeteilt: quotient_max staffelt über die Stufen (Nachtrag B, Teil 1)');

pruefe('Konfiguration: drei unterschiedliche quotient_max-Werte',
  new Set(pool.geteilt.stufen.map(s => s.quotient_max)).size === 3);
pruefe('Konfiguration: quotient_max wächst mit der Stufe',
  pool.geteilt.stufen[0].quotient_max < pool.geteilt.stufen[1].quotient_max &&
  pool.geteilt.stufen[1].quotient_max < pool.geteilt.stufen[2].quotient_max);

// Wirkung, nicht nur Konfiguration: für jede Stufe tatsächlich Aufgaben erzeugen und die
// AUFGETRETENEN Quotienten (= p.ergebnis) auswerten — nicht nur den Konfigurationswert lesen.
// erlaubteReihen wird bewusst auf [2, 10] FESTGENAGELT (in allen drei Stufen enthalten) — so
// ist der Reihen-Faktor b für alle drei Stufen identisch, und ein Unterschied im beobachteten
// Wertebereich kann NUR noch von quotient_max stammen, nicht von unterschiedlichen Reihen.
// Das schließt aus, dass ein Check grün wird, der in Wahrheit nur die (ohnehin verschiedenen)
// reihen-Listen misst statt der neuen Stellschraube.
const N_GETEILT = 400;
const geteiltProbenProStufe = pool.geteilt.stufen.map(s =>
  proben(N_GETEILT, () => generiereGeteiltAufgabe(s, { anzahl: 4 }, [2, 10])));

geteiltProbenProStufe.forEach((ps, i) => {
  const s = pool.geteilt.stufen[i];
  pruefe(`Stufe ${s.nr}: kein Quotient über quotient_max (${s.quotient_max})`,
    ps.every(p => p.ergebnis <= s.quotient_max));
  pruefe(`Stufe ${s.nr}: die Obergrenze quotient_max wird bei ${N_GETEILT} Proben tatsächlich erreicht`,
    ps.some(p => p.ergebnis === s.quotient_max));
  pruefe(`Stufe ${s.nr}: Aufgabe bleibt stimmig (a = b · ergebnis)`,
    ps.every(p => p.a === p.b * p.ergebnis));
});

const maxJeStufe = geteiltProbenProStufe.map(ps => Math.max(...ps.map(p => p.ergebnis)));
pruefe('Wirkung Stufe 1 < Wirkung Stufe 2: beobachteter Höchst-Quotient wächst tatsächlich',
  maxJeStufe[0] < maxJeStufe[1]);
pruefe('Wirkung Stufe 2 < Wirkung Stufe 3: beobachteter Höchst-Quotient wächst weiter',
  maxJeStufe[1] < maxJeStufe[2]);
pruefe('Stufe 1 erzeugt bei gleichem Teiler-Pool NIE einen Quotienten, den Stufe 3 sehr wohl erzeugt',
  geteiltProbenProStufe[0].every(p => p.ergebnis <= pool.geteilt.stufen[0].quotient_max) &&
  geteiltProbenProStufe[2].some(p => p.ergebnis > pool.geteilt.stufen[0].quotient_max));

// ---------------------------------------------------------------------------------------
console.log('\nMal: keine Faktoren über 10 (Nachtrag B, Teil 2 — kleines 1x1)');

pruefe('Konfiguration: a_max in Stufe 4 ist auf 10 gedeckelt (vorher 12)',
  pool.mal.stufen.find(s => s.nr === 4).a_max === 10);

// Realistische Produktions-Bedingung: aufgabe-ui.js übergibt für Mal IMMER erlaubteReihen aus
// der Freischaltung (nie null) — der Rückfall auf b_min/b_max ist im echten Biom-Pfad tot.
// Die Prüfung bildet den echten Aufruf nach: volle Freischaltung (alle Reihen 2..10 offen,
// die 1er ist bereits vom Aufrufer gefiltert, siehe js/aufgabe-ui.js + ohneEinserreihe).
const alleReihenOffen = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const N_MAL = 300;
for (const s of pool.mal.stufen) {
  const ps = proben(N_MAL, () => generiereMalAufgabe(s, { anzahl: 4 }, alleReihenOffen));
  pruefe(`mal Stufe ${s.nr}: a bleibt bei allen Proben <= 10`, ps.every(p => p.a <= 10));
  pruefe(`mal Stufe ${s.nr}: b bleibt bei allen Proben <= 10`, ps.every(p => p.b <= 10));
  pruefe(`mal Stufe ${s.nr}: Ergebnis bleibt stimmig`, ps.every(p => p.ergebnis === p.a * p.b));
}

// Gezielt Stufe 4 mit einer großen a-Stichprobe: vor dem Fix hätte a_max=12 zuverlässig auch
// Werte von 11 und 12 gezogen. Nach dem Fix darf das NIE mehr vorkommen.
const stufe4 = pool.mal.stufen.find(s => s.nr === 4);
const stufe4Proben = proben(500, () => generiereMalAufgabe(stufe4, { anzahl: 4 }, alleReihenOffen));
pruefe('mal Stufe 4: a erreicht bei 500 Proben die neue Obergrenze 10 (Stichprobe ist aussagekräftig)',
  stufe4Proben.some(p => p.a === 10));
pruefe('mal Stufe 4: a übersteigt bei 500 Proben nie 10 (alter Bereich 11/12 taucht nicht mehr auf)',
  stufe4Proben.every(p => p.a <= 10));

console.log(fehler === 0 ? '\nAlles grün.' : `\n${fehler} Fehler.`);
process.exit(fehler === 0 ? 0 : 1);
