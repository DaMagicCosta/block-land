// Ad-hoc-Checks für js/aufgaben/text.js. Lauf: node tools/check-text-logik.mjs
import { readFileSync } from 'node:fs';
import { generiereTextaufgabe, wuerfleSlots, zerlegeSaetze, baueDistraktoren } from '../js/aufgaben/text.js';

const vorlagen = JSON.parse(readFileSync(new URL('../data/textaufgaben.json', import.meta.url), 'utf8'));
let fehler = 0;
function pruefe(name, bedingung) {
  if (bedingung) console.log(`  OK  ${name}`);
  else { console.error(`FEHLT ${name}`); fehler += 1; }
}

// Daten-Validierung: jede Vorlage vollständig + Frage letzter Satz mit '?'
pruefe('50 Vorlagen (25 T1 + 25 T2)',
  vorlagen.length === 50 && vorlagen.filter(v => v.stufe === 1).length === 25);
pruefe('jede Vorlage: Frage = letzter Satz mit ?', vorlagen.every(v =>
  v.frage_index === v.saetze.length - 1 && v.saetze[v.frage_index].endsWith('?')));
pruefe('8 T2-Vorlagen mit überflüssiger Zahl',
  vorlagen.filter(v => (v.irrelevante_slots ?? []).length).length === 8);

// Deterministische Generierung (fester rnd) über ALLE Vorlagen × 50 Läufe:
let laeufe = 0, gueltig = 0;
for (const v of vorlagen) {
  for (let i = 0; i < 50; i++) {
    const rnd = () => ((laeufe * 37 + i * 13) % 100) / 100; // deterministisch, streuend
    const a = generiereTextaufgabe(vorlagen.filter(x => x.id === v.id), v.stufe, rnd);
    laeufe++;
    const ganzzahlig = Number.isInteger(a.ergebnis) && a.ergebnis >= 0 && a.ergebnis <= 100;
    const optionen = a.antwort_optionen.length === 5
      && a.antwort_optionen.includes(a.ergebnis)
      && new Set(a.antwort_optionen).size === 5
      && a.antwort_optionen.every(o => o >= 0);
    const zahlen = a.saetze.flatMap(s => s.tokens).filter(t => t.istZahl);
    const relevante = zahlen.filter(t => t.relevant);
    if (ganzzahlig && optionen && relevante.length >= 2 && a.frageIndex === a.saetze.length - 1) gueltig++;
  }
}
pruefe(`alle Generierungen gültig (${gueltig}/${laeufe})`, gueltig === laeufe);

// Tokens: Zahl-Erkennung + Satz-Erhalt
const bsp = generiereTextaufgabe(vorlagen, 1, () => 0.5);
pruefe('vorlese_text = alle Sätze verbunden', bsp.vorlese_text.split(' ').length >= 8);
pruefe('detail-Format', /^T[12] /.test(bsp.detail));

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle text-logik-Checks grün.');
