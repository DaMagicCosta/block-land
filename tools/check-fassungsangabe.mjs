// Ad-hoc-Checks für die Fassungsangabe (kein Test-Runner im Projekt).
// Lauf: node tools/check-fassungsangabe.mjs  (aus dem Block-Land-Root)
//
// Zwei Dinge, die still auseinanderlaufen können:
// 1. CACHE_VERSION in sw.js muss von dem Muster erkannt werden, mit dem
//    js/app-version.js die Fassung ausliest - sonst zeigt der Eltern-Bereich keine
//    Fassung an, und genau die ist die Gegenprobe beim Debuggen ("stimmt sie nicht mit
//    CACHE_VERSION überein, testest du alten Code").
// 2. Die Gegenprobe-Zeile in CLAUDE.md nennt die laufende Fassung. Sie altert lautlos:
//    Am 20.09.2026 stand dort v96 am Hauptrechner und v89 am Surface, während v99 lief.
//    Wer danach debuggt, vergleicht gegen eine Zahl, die seit Wochen nicht stimmt.
//
// Geprüft wird die Aussage, nicht die Schreibweise: Das Muster wird aus app-version.js
// herausgelöst und auf den echten Cache-Namen angewandt. Eine Prüfung auf eine
// Zeichenfolge bliebe grün, wenn sich der Wert ändert.
//
// CLAUDE.md liegt bewusst NICHT im Repo (öffentlich, nennt Namen und Lernstand der
// Kinder). Fehlt sie, wird Teil 2 übersprungen statt rot - in einem frischen Klon ist
// das der Normalfall, kein Fehler.
import { readFileSync, existsSync } from 'node:fs';

let fehler = 0;
function pruefe(name, bedingung) {
  if (bedingung) { console.log(`  OK  ${name}`); }
  else { console.error(`FEHLT ${name}`); fehler += 1; }
}

// --- 1) CACHE_VERSION gegen das Muster, das die Anzeige benutzt --------------------
const sw = readFileSync('sw.js', 'utf8');
const swTreffer = sw.match(/const CACHE_VERSION = "([^"]+)"/);
pruefe('sw.js: CACHE_VERSION gefunden', Boolean(swTreffer));
const cacheName = swTreffer ? swTreffer[1] : '';

const appVersion = readFileSync('js/app-version.js', 'utf8');
const musterZeile = appVersion.split(/\r?\n/).find((l) => l.includes('.match(/^block-land'));
pruefe('app-version.js: Muster zum Auslesen der Fassung gefunden', Boolean(musterZeile));

let muster = null;
if (musterZeile) {
  const roh = musterZeile.match(/\.match\((\/.+?\/)\)/);
  if (roh) { try { muster = new RegExp(roh[1].slice(1, -1)); } catch { muster = null; } }
}
pruefe('app-version.js: Muster ist lesbar', Boolean(muster));
pruefe(`app-version.js erkennt den Cache-Namen "${cacheName}"`,
       Boolean(muster && muster.test(cacheName)));

const fassung = muster ? (cacheName.match(muster) || [])[1] : undefined;
pruefe('daraus ergibt sich eine Fassungsnummer', Boolean(fassung));

// --- 2) Gegenprobe-Zeile in der Projektanleitung ----------------------------------
if (!existsSync('CLAUDE.md')) {
  console.log('  --  CLAUDE.md liegt nicht im Repo, Gegenprobe-Zeile übersprungen');
} else {
  const anleitung = readFileSync('CLAUDE.md', 'utf8');
  const zeile = anleitung.split(/\r?\n/).find((l) => l.includes('Die laufende Fassung steht'));
  pruefe('CLAUDE.md: Gegenprobe-Zeile vorhanden', Boolean(zeile));
  if (zeile) {
    const genannt = (zeile.match(/`v(\d+)`/) || [])[1];
    pruefe('CLAUDE.md: Gegenprobe nennt eine Fassung', Boolean(genannt));
    pruefe(`CLAUDE.md nennt v${genannt}, sw.js führt v${fassung}`, genannt === fassung);
  }
}

if (fehler) {
  console.error(`\n${fehler} Check(s) fehlgeschlagen.`);
  process.exit(1);
}
console.log('\nAlle Fassungsangabe-Checks grün.');
