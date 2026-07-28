// Uhrzeit-Aufgaben-Generator. Eine Uhrzeit ist IMMER eine Zahl: Minuten seit Mitternacht
// (0–1439). Grund: normalisiereAufgabe() verwirft jede Konserve, deren ergebnis oder
// antwort_optionen keine Zahlen sind — mit Text-Antworten wäre die Fehler-Box-Wiedervorlage
// lautlos tot. Die Beschriftung entsteht erst beim Zeichnen aus dem Zahlenwert.
//
// Nebeneffekt, der die Sprechweisen-Frage löst: „dreiviertel vier" und „viertel vor vier"
// sind zwei Beschriftungen DESSELBEN Wertes — es kann nie zwei richtige Knöpfe geben.

export const RASTUNG = { 1: 60, 2: 30, 3: 15, 4: 5 };

const STUNDENWORT = ['zwölf', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs',
                     'sieben', 'acht', 'neun', 'zehn', 'elf'];

// Gesprochen wird IMMER in 12-Stunden-Namen — auch um 15 Uhr sagt man „drei". Die
// 24-Stunden-Zählung lebt allein in der geschriebenen Form. Genau dieser Unterschied
// ist der Lernstoff.
function stundenwort(stunde24) {
  return STUNDENWORT[stunde24 % 12];
}

export function formatiereDigital(minuten) {
  const s = Math.floor(minuten / 60) % 24;
  const m = minuten % 60;
  return `${String(s).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// sprechweise: 'sued' (viertel vier / dreiviertel vier) | 'nord' (viertel nach drei /
// viertel vor vier). Unterschieden wird NUR bei 15 und 45 — überall sonst sind beide
// Systeme deckungsgleich.
export function formatiereZeit(minuten, sprechweise = 'sued') {
  const stunde = Math.floor(minuten / 60) % 24;
  const m = minuten % 60;
  const diese = stundenwort(stunde);
  const naechste = stundenwort(stunde + 1);

  if (m === 0)  return `${diese} Uhr`;
  if (m === 30) return `halb ${naechste}`;
  if (m === 15) return sprechweise === 'nord' ? `viertel nach ${diese}` : `viertel ${naechste}`;
  if (m === 45) return sprechweise === 'nord' ? `viertel vor ${naechste}` : `dreiviertel ${naechste}`;
  if (m === 25) return `fünf vor halb ${naechste}`;
  if (m === 35) return `fünf nach halb ${naechste}`;
  if (m < 30)   return `${zahlwort(m)} nach ${diese}`;
  return `${zahlwort(60 - m)} vor ${naechste}`;
}

const ZAHLWORT = { 5: 'fünf', 10: 'zehn', 20: 'zwanzig' };
function zahlwort(n) { return ZAHLWORT[n] ?? String(n); }

// Sonnenstand für die Szene. Der Bogen ist die eigentliche Lektion: Die Sonne läuft EINMAL
// am Tag über den Himmel, der Stundenzeiger ZWEIMAL durchs Zifferblatt. Steigt die Sonne,
// ist es die erste Runde (1–12); sinkt sie, die zweite (13–24). Hell/dunkel taugt dafür
// nicht — der Nachmittag ist hell.
// x läuft streng monoton 0→1 über den ganzen Tag, hoehe ist der Scheitel um 12 Uhr.
const AUFGANG = 6 * 60;     // 6 Uhr
const UNTERGANG = 21 * 60;  // 21 Uhr — Sommerabend, bewusst großzügig
export function sonnenPositionAmTag(minuten) {
  const x = minuten / 1439;
  // Höhe: Scheitel um 12 Uhr, 0 an den Tagesrändern. Cosinus über den halben Tag.
  const hoehe = Math.max(0, Math.cos(((minuten - 720) / 720) * (Math.PI / 2)));
  return { x, hoehe, istNacht: minuten < AUFGANG || minuten >= UNTERGANG };
}

// Distraktoren sind hier KEINE Zahlenabstände, sondern benannte Ablesefehler. Zufällige
// Nachbarwerte wären verschenkt: Die typischen Fehler beim Uhrlesen sind bekannt, und genau
// die sollen danebenstehen, damit das Kind sie unterscheiden muss.
function baueDistraktoren(minuten, stufenConfig, rnd) {
  const stunde = Math.floor(minuten / 60);
  const m = minuten % 60;
  const grenze = stufenConfig.nachmittag ? 1440 : 720;
  const kandidaten = [];

  // 1. Minutenzeiger als Ziffer gelesen — der Klassiker (15:45 → „3:09")
  if (m !== 0) kandidaten.push(stunde * 60 + Math.round(m / 5));
  // 2. Stunde aufgerundet, weil der Zeiger schon fast bei der nächsten steht
  if (m >= 30) kandidaten.push((stunde + 1) * 60 + m);
  // 3. viertel und dreiviertel verwechselt (Zeiger gespiegelt)
  if (m === 15 || m === 45) kandidaten.push(stunde * 60 + (60 - m));
  // 4. Zeiger vertauscht: Minutenzeiger als Stunde gelesen und umgekehrt
  if (m % 5 === 0 && m !== 0) kandidaten.push((m / 5) * 60 + stunde * 5);
  // 5. halb auf die falsche Stunde bezogen (halb vier als 4:30)
  if (m === 30) kandidaten.push((stunde + 1) * 60 + 30);
  // 6. Auffüller: Nachbarn im Raster der Stufe
  const schritt = stufenConfig.rastung;
  kandidaten.push(minuten + schritt, minuten - schritt, minuten + 60, minuten - 60);

  const optionen = new Set([minuten]);
  for (const k of kandidaten) {
    if (optionen.size >= 5) break;
    if (!Number.isInteger(k)) continue;
    if (k < 0 || k >= grenze) continue;
    optionen.add(k);
  }
  // Hier bewusst KEIN 5-Minuten-Raster: Der wichtigste Distraktor überhaupt — der als Ziffer
  // gelesene Minutenzeiger (15:45 → „3:09") — liegt gerade NICHT im Raster. Ihn wegzufiltern
  // würde den häufigsten Ablesefehler unsichtbar machen. Die 5-Minuten-Regel gilt für die
  // Rastung der Zeiger beim Stellen, nicht für die Auswahl der falschen Antworten.
  // Nur die Auffüller unten bleiben im Raster, damit sie plausibel aussehen.
  let abstand = schritt;
  while (optionen.size < 5 && abstand < 720) {
    for (const k of [minuten + abstand, minuten - abstand]) {
      if (optionen.size < 5 && k >= 0 && k < grenze && k % 5 === 0) optionen.add(k);
    }
    abstand += schritt;
  }
  return mische(Array.from(optionen).slice(0, 5), rnd);
}

export function generiereUhrAufgabe(stufenConfig, rnd = Math.random) {
  const schritt = stufenConfig.rastung;
  // Stufen 1+2 bleiben am Vormittag: Die zweite Zeigerrunde ist ein eigener Lernschritt und
  // hat nichts in der vollen/halben Stunde verloren.
  const grenze = stufenConfig.nachmittag ? 1440 : 720;
  // Nachts wird nicht gefragt — 3 Uhr früh ist für ein Kind keine sinnvolle Uhrzeit.
  const frueheste = 6 * 60;
  const schritte = Math.floor((grenze - frueheste) / schritt);
  const minuten = frueheste + Math.floor(rnd() * schritte) * schritt;

  return {
    aufgabentyp: 'uhr',
    stufe: stufenConfig.nr,
    a: Math.floor(minuten / 60),
    b: minuten % 60,
    ergebnis: minuten,
    text: 'Wie spät ist es?',
    vorlese_text: 'Wie spät ist es?',
    antwort_optionen: baueDistraktoren(minuten, stufenConfig, rnd),
  };
}

function mische(arr, rnd) {
  const kopie = [...arr];
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie;
}
