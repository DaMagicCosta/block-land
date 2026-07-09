// Ad-hoc-Checks für js/befund-logik.js (kein Test-Runner im Projekt).
// Lauf: node tools/check-befund-logik.mjs  (aus dem Block-Land-Root)
import { erzeugeBefunde } from '../js/befund-logik.js';

let fehler = 0;
function pruefe(name, bedingung) {
  if (bedingung) { console.log(`  OK  ${name}`); }
  else { console.error(`FEHLT ${name}`); fehler += 1; }
}

const NAMEN = { mal: 'Mal-Reihen', plus: 'Plus', mengen: 'Mengen bis 10' };

// Zu wenig Daten -> neutraler Hinweis
const wenig = erzeugeBefunde([{ typ: 'mal', gesamt: 3, richtig: 3, zeit_ms: 9000 }], NAMEN);
pruefe('wenig Daten -> neutral', wenig.length === 1 && wenig[0].farbe === 'neutral');

// Quote < 70% -> rot, mit Anzeigename und Prozent
const rot = erzeugeBefunde([{ typ: 'plus', gesamt: 9, richtig: 5, zeit_ms: 40000 }], NAMEN);
pruefe('56% -> rot', rot[0].farbe === 'rot' && rot[0].typ === 'plus');
pruefe('rot-Text nennt Name + Prozent', rot[0].text.includes('Plus') && rot[0].text.includes('56 %'));

// Richtig aber langsam (>1.5x Kind-Schnitt UND >8s) -> gelb
const langsam = erzeugeBefunde([
  { typ: 'mengen', gesamt: 20, richtig: 19, zeit_ms: 20 * 3000 },   // 3s Schnitt, sicher
  { typ: 'mal',    gesamt: 10, richtig: 9,  zeit_ms: 10 * 12000 },  // 12s -> langsam
], NAMEN);
const malBefund = langsam.find(b => b.typ === 'mal');
pruefe('90% aber 12s -> gelb (unsicher)', malBefund.farbe === 'gelb' && malBefund.text.includes('langsam'));

// Sicher und flott -> gruen
const gruen = erzeugeBefunde([{ typ: 'mengen', gesamt: 39, richtig: 39, zeit_ms: 39 * 4000 }], NAMEN);
pruefe('100% flott -> gruen', gruen[0].farbe === 'gruen' && gruen[0].text.includes('schwerer'));

// Mittelfeld (70-84%) -> gelb "auf gutem Weg"
const weg = erzeugeBefunde([{ typ: 'mal', gesamt: 13, richtig: 10, zeit_ms: 13 * 5000 }], NAMEN);
pruefe('77% -> gelb (guter Weg)', weg[0].farbe === 'gelb' && weg[0].text.includes('gutem Weg'));

// Sortierung: rot vor gelb vor gruen
const mix = erzeugeBefunde([
  { typ: 'mengen', gesamt: 39, richtig: 39, zeit_ms: 39 * 4000 },
  { typ: 'plus',   gesamt: 9,  richtig: 5,  zeit_ms: 9 * 4000 },
  { typ: 'mal',    gesamt: 13, richtig: 10, zeit_ms: 13 * 5000 },
], NAMEN);
pruefe('Sortierung rot > gelb > gruen', mix[0].farbe === 'rot' && mix[2].farbe === 'gruen');

// Robustheit: Strings/fehlende Felder crashen nicht
const robust = erzeugeBefunde([{ typ: 'mal', gesamt: '10', richtig: '9' }], {});
pruefe('String-Zahlen + fehlende zeit_ms ok', robust.length === 1 && robust[0].text.includes('mal'));

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle befund-logik-Checks grün.');
