// Ad-hoc-Checks für js/aufgaben/uhr.js. Lauf: node tools/check-uhr-logik.mjs
import { readFileSync } from 'node:fs';
import { generiereUhrAufgabe, formatiereZeit, formatiereDigital, RASTUNG, sonnenPositionAmTag } from '../js/aufgaben/uhr.js';

const pool = JSON.parse(readFileSync(new URL('../data/aufgaben-pool.json', import.meta.url), 'utf8'));
let fehler = 0;
function pruefe(name, bedingung) {
  if (bedingung) console.log(`  OK  ${name}`);
  else { console.error(`FEHLT ${name}`); fehler += 1; }
}

// --- Stufen-Konfiguration ---
pruefe('Pool hat 4 Uhr-Stufen', pool.uhr?.stufen?.length === 4);
pruefe('Rastung 60/30/15/5', pool.uhr.stufen.map(s => s.rastung).join(',') === '60,30,15,5');
pruefe('Nachmittag erst ab Stufe 3',
  pool.uhr.stufen.filter(s => s.nachmittag).map(s => s.nr).join(',') === '3,4');

// --- Digitale Form ---
pruefe('digital 945 = 15:45', formatiereDigital(945) === '15:45');
pruefe('digital 0 = 00:00', formatiereDigital(0) === '00:00');
pruefe('digital 605 = 10:05', formatiereDigital(605) === '10:05');

// --- Gesprochene Form: immer 12-Stunden-Namen, auch nachmittags ---
pruefe('volle Stunde', formatiereZeit(900, 'sued') === 'drei Uhr');
pruefe('halb ist in beiden Systemen gleich',
  formatiereZeit(930, 'sued') === 'halb vier' && formatiereZeit(930, 'nord') === 'halb vier');
pruefe('viertel sued', formatiereZeit(915, 'sued') === 'viertel vier');
pruefe('viertel nord', formatiereZeit(915, 'nord') === 'viertel nach drei');
pruefe('dreiviertel sued', formatiereZeit(945, 'sued') === 'dreiviertel vier');
pruefe('dreiviertel nord', formatiereZeit(945, 'nord') === 'viertel vor vier');
pruefe('fuenf nach', formatiereZeit(905, 'sued') === 'fünf nach drei');
pruefe('fuenf vor halb', formatiereZeit(925, 'sued') === 'fünf vor halb vier');
pruefe('fuenf nach halb', formatiereZeit(935, 'sued') === 'fünf nach halb vier');
pruefe('zwanzig vor', formatiereZeit(940, 'sued') === 'zwanzig vor vier');
pruefe('zwoelf Uhr heisst zwoelf', formatiereZeit(720, 'sued') === 'zwölf Uhr');
pruefe('null Uhr heisst zwoelf (12h-Name)', formatiereZeit(0, 'sued') === 'zwölf Uhr');

// --- Sonnenbogen ---
const mittag = sonnenPositionAmTag(720);
const morgen = sonnenPositionAmTag(480);   // 8 Uhr
const abend  = sonnenPositionAmTag(1140);  // 19 Uhr
pruefe('Mittag ist der Scheitel', mittag.hoehe > 0.99 && Math.abs(mittag.x - 0.5) < 0.01);
pruefe('Vormittag im aufsteigenden Ast (links)', morgen.x < 0.5 && !morgen.istNacht);
pruefe('Abend im absteigenden Ast (rechts)', abend.x > 0.5);
pruefe('Nacht wird als Nacht erkannt', sonnenPositionAmTag(120).istNacht === true);
pruefe('x waechst streng ueber den Tag',
  [0, 300, 600, 900, 1200, 1439].every((m, i, arr) =>
    i === 0 || sonnenPositionAmTag(m).x > sonnenPositionAmTag(arr[i - 1]).x));

// --- Generierung, deterministisch über alle Stufen ---
let laeufe = 0, gueltig = 0, sahNachmittag = false;
for (const stufe of pool.uhr.stufen) {
  for (let i = 0; i < 200; i++) {
    let n = 0;
    const rnd = () => { n += 1; return ((i * 37 + n * 11 + stufe.nr * 7) % 100) / 100; };
    const a = generiereUhrAufgabe(stufe, rnd);
    laeufe++;
    const zahlen = Number.isInteger(a.ergebnis)
      && a.ergebnis >= 0 && a.ergebnis <= 1439
      && a.antwort_optionen.every(Number.isInteger);
    const optionen = a.antwort_optionen.length === 5
      && a.antwort_optionen.includes(a.ergebnis)
      && new Set(a.antwort_optionen).size === 5;
    const gerastet = a.ergebnis % stufe.rastung === 0
      && a.antwort_optionen.every(o => o >= 0 && o <= 1439);
    const felder = a.aufgabentyp === 'uhr' && a.a === Math.floor(a.ergebnis / 60) && a.b === a.ergebnis % 60;
    if (a.ergebnis >= 720) sahNachmittag = true;
    if (zahlen && optionen && gerastet && felder) gueltig++;
  }
}
pruefe(`alle Generierungen gültig (${gueltig}/${laeufe})`, gueltig === laeufe);
pruefe('Nachmittags-Zeiten kommen vor', sahNachmittag);

// Stufen 1+2 bleiben am Vormittag (die Sonne steigt) — sonst wäre die 24-Stunden-Frage da,
// bevor sie dran ist.
let nurVormittag = true;
for (const stufe of pool.uhr.stufen.filter(s => !s.nachmittag)) {
  for (let i = 0; i < 200; i++) {
    let n = 0;
    const rnd = () => { n += 1; return ((i * 41 + n * 13) % 100) / 100; };
    const a = generiereUhrAufgabe(stufe, rnd);
    if (a.ergebnis >= 720) nurVormittag = false;
    if (a.antwort_optionen.some(o => o >= 720)) nurVormittag = false;
  }
}
pruefe('Stufen 1+2 nur vormittags (auch die Distraktoren)', nurVormittag);

// Distraktoren: der Klassiker „Minutenzeiger als Ziffer" muss bei Viertel-/Fünf-Stufen auftauchen
let saheZifferFehler = false;
for (let i = 0; i < 300; i++) {
  let n = 0;
  const rnd = () => { n += 1; return ((i * 29 + n * 17) % 100) / 100; };
  const a = generiereUhrAufgabe(pool.uhr.stufen[3], rnd);
  const zifferFehler = a.a * 60 + Math.round(a.b / 5);
  if (a.b !== 0 && a.antwort_optionen.includes(zifferFehler)) saheZifferFehler = true;
}
pruefe('Distraktor „Minutenzeiger als Ziffer" kommt vor', saheZifferFehler);

pruefe('RASTUNG passt zum Pool',
  pool.uhr.stufen.every(s => RASTUNG[s.nr] === s.rastung));

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle uhr-logik-Checks grün.');
