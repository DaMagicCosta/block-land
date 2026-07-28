// Ad-hoc-Checks für js/aufgaben/uhr.js. Lauf: node tools/check-uhr-logik.mjs
import { readFileSync } from 'node:fs';
import { generiereUhrAufgabe, formatiereZeit, formatiereDigital, RASTUNG, sonnenPositionAmTag, andereSprechweise, wuerfleAngezeigteSprechweise } from '../js/aufgaben/uhr.js';

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

// --- Dämmerung (Nachbesserung 28.07.2026: fest an Uhrzeiten gehängt, nicht an die
// Sonnenhöhe — sonst wird der Zustand nie erreicht, siehe Kommentar in uhr.js) ---
// Grenzen: Morgendämmerung 6:00–7:30 (360–450), Abenddämmerung 19:30–21:00 (1170–1260).
pruefe('Morgendämmerung mitten drin (7:00) ist Dämmerung, nicht Nacht/Tag',
  sonnenPositionAmTag(420).istDaemmerung === true
  && sonnenPositionAmTag(420).istNacht === false);
pruefe('Abenddämmerung mitten drin (20:00) ist Dämmerung, nicht Nacht/Tag',
  sonnenPositionAmTag(1200).istDaemmerung === true
  && sonnenPositionAmTag(1200).istNacht === false);
pruefe('Mitten am Tag (12:00) ist weder Dämmerung noch Nacht',
  sonnenPositionAmTag(720).istDaemmerung === false
  && sonnenPositionAmTag(720).istNacht === false);
pruefe('Mitten in der Nacht (2:00) ist weder Dämmerung noch Tag',
  sonnenPositionAmTag(120).istDaemmerung === false
  && sonnenPositionAmTag(120).istNacht === true);
pruefe('Grenze 6:00 (360): Nacht endet, Morgendämmerung beginnt',
  sonnenPositionAmTag(359).istNacht === true && sonnenPositionAmTag(359).istDaemmerung === false
  && sonnenPositionAmTag(360).istNacht === false && sonnenPositionAmTag(360).istDaemmerung === true);
pruefe('Grenze 7:30 (450): Morgendämmerung endet, Tag beginnt',
  sonnenPositionAmTag(449).istDaemmerung === true
  && sonnenPositionAmTag(450).istDaemmerung === false && sonnenPositionAmTag(450).istNacht === false);
pruefe('Grenze 19:30 (1170): Tag endet, Abenddämmerung beginnt',
  sonnenPositionAmTag(1169).istDaemmerung === false && sonnenPositionAmTag(1169).istNacht === false
  && sonnenPositionAmTag(1170).istDaemmerung === true);
pruefe('Grenze 21:00 (1260): Abenddämmerung endet, Nacht beginnt',
  sonnenPositionAmTag(1259).istDaemmerung === true
  && sonnenPositionAmTag(1260).istDaemmerung === false && sonnenPositionAmTag(1260).istNacht === true);

// Die Prüfung, die den ursprünglichen Fehler gefunden hätte: über alle 1440 Minuten des
// Tages hat jede Minute GENAU einen der drei Zustände (Tag/Dämmerung/Nacht), und die
// Übergänge liegen exakt an den vier erwarteten Grenzen — kein doppelter, kein fehlender
// Zustand irgendwo dazwischen.
{
  let genauEinZustand = true;
  const uebergaenge = [];
  let vorherZustand = null;
  for (let m = 0; m < 1440; m++) {
    const { istNacht, istDaemmerung } = sonnenPositionAmTag(m);
    const istTag = !istNacht && !istDaemmerung;
    const anzahl = (istNacht ? 1 : 0) + (istDaemmerung ? 1 : 0) + (istTag ? 1 : 0);
    if (anzahl !== 1) genauEinZustand = false;
    const zustand = istNacht ? 'nacht' : (istDaemmerung ? 'daemmerung' : 'tag');
    if (zustand !== vorherZustand) {
      uebergaenge.push(m);
      vorherZustand = zustand;
    }
  }
  pruefe('Jede der 1440 Minuten hat genau einen Zustand (Tag/Dämmerung/Nacht)', genauEinZustand);
  pruefe('Genau vier Übergänge über den Tag (0 zählt als erster nicht mit)',
    uebergaenge.length === 5 && uebergaenge[0] === 0);
  pruefe('Übergänge liegen exakt bei 6:00/7:30/19:30/21:00 (360/450/1170/1260)',
    uebergaenge.slice(1).join(',') === '360,450,1170,1260');
}

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

// Szenario A: 15:45 (945 Minuten). rnd konstant 0.70 trifft exakt diesen Quotienten
// ((945 − 360) / 5 = 117, floor(0.70 × 168) = 117 → 360 + 117×5 = 945). Der Nenner ist die
// Zahl der Schritte im Tagesfenster 6:00–20:00 ((1200 − 360) / 5 = 168).
{
  const rndA = () => 0.70;
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

// Szenario B: 15:30 (930 Minuten). rnd konstant 0.68 trifft exakt diesen Quotienten
// ((930 − 360) / 5 = 114, floor(0.68 × 168) = 114 → 360 + 114×5 = 930).
{
  const rndB = () => 0.68;
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

// --- Tagesfenster 6:00–20:00 (Nachbesserung 29.07.2026) ---
// Vorher war nur die Untergrenze gesetzt: Stufe 3/4 fragte bis 23:45 bzw. 23:55, also
// bei Mondschein statt bei Sonne — ausgerechnet die Sonne trägt aber die Kernlektion.
// Und die Auffüller-Distraktoren durften nachts liegen (4:00 als falsche Antwort zu 6:00).
// Hier wird über viele Läufe abgesichert, dass auf JEDER Stufe weder die gestellte Zeit
// noch IRGENDEIN Distraktor aus dem Fenster fällt.
{
  const FENSTER_VON = 6 * 60, FENSTER_BIS = 20 * 60;
  let alleImFenster = true, hoechsteZeit = 0, tiefsteZeit = 1439;
  let hoechsterDistraktor = 0, tiefsterDistraktor = 1439;
  const stufenAusserhalb = new Set();
  for (const stufe of pool.uhr.stufen) {
    for (let i = 0; i < 500; i++) {
      const a = generiereUhrAufgabe(stufe);   // echter Math.random(), nicht seed-fest
      const werte = [a.ergebnis, ...a.antwort_optionen];
      for (const w of werte) {
        if (w < FENSTER_VON || w > FENSTER_BIS) { alleImFenster = false; stufenAusserhalb.add(`${stufe.nr}:${w}`); }
      }
      hoechsteZeit = Math.max(hoechsteZeit, a.ergebnis);
      tiefsteZeit = Math.min(tiefsteZeit, a.ergebnis);
      for (const o of a.antwort_optionen) {
        hoechsterDistraktor = Math.max(hoechsterDistraktor, o);
        tiefsterDistraktor = Math.min(tiefsterDistraktor, o);
      }
    }
  }
  if (stufenAusserhalb.size) console.error('      Ausreisser:', [...stufenAusserhalb].join(' '));
  pruefe('Gestellte Zeit UND jeder Distraktor liegen auf allen 4 Stufen im Fenster 6:00–20:00',
    alleImFenster);
  pruefe(`Keine Frage vor 6:00 (tiefste gesehen: ${formatiereDigital(tiefsteZeit)})`,
    tiefsteZeit >= FENSTER_VON);
  pruefe(`Keine Frage nach 20:00 (hoechste gesehen: ${formatiereDigital(hoechsteZeit)})`,
    hoechsteZeit <= FENSTER_BIS);
  pruefe(`Kein Distraktor vor 6:00 (tiefster gesehen: ${formatiereDigital(tiefsterDistraktor)})`,
    tiefsterDistraktor >= FENSTER_VON);
  pruefe(`Kein Distraktor nach 20:00 (hoechster gesehen: ${formatiereDigital(hoechsterDistraktor)})`,
    hoechsterDistraktor <= FENSTER_BIS);
  // Gegenprobe zum Sinn der Obergrenze: im ganzen Fenster steht die Sonne, nie der Mond.
  let immerSonne = true;
  for (let m = FENSTER_VON; m <= FENSTER_BIS; m++) {
    if (sonnenPositionAmTag(m).istNacht) immerSonne = false;
  }
  pruefe('Im gesamten Tagesfenster steht die Sonne am Himmel, nie der Mond', immerSonne);
}

// --- Sprechform: nie eine Ziffer auf einem Knopf (Nachbesserung 29.07.2026) ---
// Die Zahlwort-Tabelle kannte nur 5, 10 und 20. Der wichtigste Distraktor — der als Ziffer
// gelesene Minutenzeiger — erzeugt aber Minutenwerte von 1 bis 12 und wurde dadurch zu
// „9 nach drei". So spricht niemand: Das Kind konnte den Distraktor an der Schreibweise
// erkennen, ohne die Uhr zu lesen. Hier wird über alle Stufen, alle Antwortknöpfe und
// BEIDE Sprechweisen abgesichert, dass keine Beschriftung eine Ziffer enthält.
{
  let ohneZiffer = true;
  const gesehen = new Set();
  const beispiele = new Set();
  for (const stufe of pool.uhr.stufen) {
    for (let i = 0; i < 500; i++) {
      const a = generiereUhrAufgabe(stufe);
      for (const o of a.antwort_optionen) {
        gesehen.add(o % 60);
        for (const form of ['sued', 'nord']) {
          const text = formatiereZeit(o, form);
          if (/[0-9]/.test(text)) { ohneZiffer = false; beispiele.add(`${formatiereDigital(o)} → "${text}"`); }
        }
      }
    }
  }
  if (beispiele.size) console.error('      Ziffern-Beschriftungen:', [...beispiele].slice(0, 8).join(' · '));
  pruefe(`Keine Knopfbeschriftung der Sprechform enthält eine Ziffer (${gesehen.size} verschiedene Minutenwerte gesehen)`,
    ohneZiffer);
  // Der Fall aus dem Befund, fest verdrahtet: 15:45 → Minutenzeiger als Ziffer = 15:09.
  pruefe('15:09 heißt „neun nach drei", nicht „9 nach drei"',
    formatiereZeit(909, 'sued') === 'neun nach drei');
  // Und die Gegenprobe über den gesamten möglichen Wertebereich der Minutenangabe.
  let alleMinutenHabenWort = true;
  for (let m = 0; m < 60; m++) {
    if (/[0-9]/.test(formatiereZeit(600 + m, 'sued')) || /[0-9]/.test(formatiereZeit(600 + m, 'nord'))) {
      alleMinutenHabenWort = false;
    }
  }
  pruefe('Alle 60 Minutenwerte einer Stunde haben ein Zahlwort', alleMinutenHabenWort);
}

// --- Sprechweise pro Frage (Nachbesserung 29.07.2026: der Eltern-Hinweis behauptete eine
// Toleranz, die es nicht gab — die andere Form kam nie vor. Jetzt entscheidet
// wuerfleAngezeigteSprechweise() pro Frage, welche der beiden Formen erscheint.) ---
pruefe('andereSprechweise kippt in beide Richtungen',
  andereSprechweise('sued') === 'nord' && andereSprechweise('nord') === 'sued');

{
  // Deterministische rnd-Folgen (Muster wie bei generiereUhrAufgabe oben): erst bei rnd() < 0.5
  // wird gewechselt, alles darüber bleibt bei der eingestellten Form.
  const rndWechselt = () => 0.1;   // < 0.5 → Wechsel, falls Stufe es zulässt
  const rndBleibt = () => 0.9;     // >= 0.5 → bleibt in jedem Fall bei der eingestellten Form

  pruefe('Stufe 1: bleibt bei "sued", auch wenn der Zufall wechseln würde',
    wuerfleAngezeigteSprechweise(1, 'sued', rndWechselt) === 'sued');
  pruefe('Stufe 2: bleibt bei "nord", auch wenn der Zufall wechseln würde',
    wuerfleAngezeigteSprechweise(2, 'nord', rndWechselt) === 'nord');
  pruefe('Stufe 3: rnd < 0.5 → wechselt auf die andere Form',
    wuerfleAngezeigteSprechweise(3, 'sued', rndWechselt) === 'nord');
  pruefe('Stufe 3: rnd >= 0.5 → bleibt bei der eingestellten Form',
    wuerfleAngezeigteSprechweise(3, 'sued', rndBleibt) === 'sued');
  pruefe('Stufe 4: rnd < 0.5 → wechselt auf die andere Form',
    wuerfleAngezeigteSprechweise(4, 'nord', rndWechselt) === 'sued');
  pruefe('Stufe 4: rnd >= 0.5 → bleibt bei der eingestellten Form',
    wuerfleAngezeigteSprechweise(4, 'nord', rndBleibt) === 'nord');
}

{
  // Über viele Läufe (echter Math.random(), nicht seed-fest): Stufe 1+2 zeigen NIE die andere
  // Form, Stufe 3+4 zeigen BEIDE Formen — mit ausreichend Läufen ist ein Ausbleiben der
  // zweiten Form durch Zufall praktisch ausgeschlossen (2^-500 bei echtem 50/50).
  const LAEUFE = 500;
  const eingestellt = 'sued';
  let stufe1NieAbweichung = true, stufe2NieAbweichung = true;
  let stufe3SahBeide = new Set(), stufe4SahBeide = new Set();
  for (let i = 0; i < LAEUFE; i++) {
    if (wuerfleAngezeigteSprechweise(1, eingestellt) !== eingestellt) stufe1NieAbweichung = false;
    if (wuerfleAngezeigteSprechweise(2, eingestellt) !== eingestellt) stufe2NieAbweichung = false;
    stufe3SahBeide.add(wuerfleAngezeigteSprechweise(3, eingestellt));
    stufe4SahBeide.add(wuerfleAngezeigteSprechweise(4, eingestellt));
  }
  pruefe(`Stufe 1 zeigt über ${LAEUFE} Läufe ausschließlich die eingestellte Form`, stufe1NieAbweichung);
  pruefe(`Stufe 2 zeigt über ${LAEUFE} Läufe ausschließlich die eingestellte Form`, stufe2NieAbweichung);
  pruefe(`Stufe 3 zeigt über ${LAEUFE} Läufe beide Formen`, stufe3SahBeide.size === 2);
  pruefe(`Stufe 4 zeigt über ${LAEUFE} Läufe beide Formen`, stufe4SahBeide.size === 2);
}

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle uhr-logik-Checks grün.');
