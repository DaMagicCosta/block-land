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

// --- Gezielte Zusicherungen je benannter Ablesefehler (Nachbesserung 28.07.2026) ---
// Zwei fest verdrahtete, von Hand nachgerechnete Szenarien auf Stufe 4 (Nachmittag,
// pool.uhr.stufen[3] = rastung 5, nachmittag true) — bewusst am Nachmittag, weil genau
// dort der Unterschied zwischen 12- und 24-Stunden-Zählung zum Tragen kommt. Eine Formel,
// die versehentlich mit der rohen 24-Stunden-Stunde statt Stunde % 12 rechnet, würde hier
// NICHT auffallen, wenn nur am Vormittag geprüft würde (dort ist Stunde % 12 == Stunde).

// Szenario A: 15:45 (945 Minuten). rnd konstant 0.5439 trifft exakt diesen Quotienten
// ((945 − 360) / 5 = 117, floor(0.5439 × 216) = 117 → 360 + 117×5 = 945).
{
  const rndA = () => 0.5439;
  const a = generiereUhrAufgabe(pool.uhr.stufen[3], rndA);
  pruefe('Szenario A trifft 15:45 (Vorbedingung)', a.ergebnis === 945 && a.a === 15 && a.b === 45);
  pruefe('Kandidat 1 „Minutenzeiger als Ziffer": 15:45 → 15:09 (909)',
    a.antwort_optionen.includes(909));
  pruefe('Kandidat 2 „Stunde aufgerundet": 15:45 → 16:45 (1005)',
    a.antwort_optionen.includes(1005));
  pruefe('Kandidat 3 „viertel/dreiviertel vertauscht": 15:45 → 15:15 (915)',
    a.antwort_optionen.includes(915));
  pruefe('Kandidat 4 „Zeiger vertauscht" nachmittags (Befund 28.07.2026): 15:45 → 9:15 (555), NICHT 10:15 (615)',
    a.antwort_optionen.includes(555) && !a.antwort_optionen.includes(615));
}

// Szenario B: 15:30 (930 Minuten). rnd konstant 0.53 trifft exakt diesen Quotienten
// ((930 − 360) / 5 = 114, floor(0.53 × 216) = 114 → 360 + 114×5 = 930).
{
  const rndB = () => 0.53;
  const a = generiereUhrAufgabe(pool.uhr.stufen[3], rndB);
  pruefe('Szenario B trifft 15:30 (Vorbedingung)', a.ergebnis === 930 && a.a === 15 && a.b === 30);
  // Kandidat 5 „halb auf falsche Stunde bezogen" hat bei m = 30 dieselbe Formel wie
  // Kandidat 2 „Stunde aufgerundet" ((stunde+1)*60 + m mit m=30) — beide Fehlbilder fallen
  // hier zusammen, ein Wert deckt beide ab.
  pruefe('Kandidat 2/5 „Stunde aufgerundet" bzw. „halb falsche Stunde": 15:30 → 16:30 (990)',
    a.antwort_optionen.includes(990));
  pruefe('Kandidat 4 „Zeiger vertauscht" nachmittags (Befund 28.07.2026): 15:30 → 6:15 (375), NICHT 7:15 (435)',
    a.antwort_optionen.includes(375) && !a.antwort_optionen.includes(435));
}

pruefe('RASTUNG passt zum Pool',
  pool.uhr.stufen.every(s => RASTUNG[s.nr] === s.rastung));

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle uhr-logik-Checks grün.');
