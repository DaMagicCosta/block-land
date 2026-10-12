// Minus-Aufgaben-Generator. Spiegelt plus.js. Bekommt Stufen-Config aus aufgaben-pool.json.
// a >= b (kein negatives Ergebnis), ZR 100. Stufen-Flag kein_entbuendeln steuert das Borgen.
//
// Stufen mit form "zehnerstopp" üben die zwei Teilschritte der Zehnerunterschreitung einzeln,
// bevor sie in einer Aufgabe zusammenkommen:
//   zum Zehner  85 − 5 = 80   (die Einer gehen genau weg)
//   vom Zehner  80 − 2 = 78   (dieselbe kleine Aufgabe wie 10 − 2)
// Wer beides abrufen kann, muss bei 85 − 7 nur noch die 7 zerlegen. Wer es herleiten muss,
// hat für die eigentliche Aufgabe keinen Kopf mehr frei.

export function generiereMinusAufgabe(stufenConfig, distraktorConfig) {
  let a, b, ergebnis;
  let versuche = 0;

  if (stufenConfig.form === 'zehnerstopp') {
    ({ a, b } = zehnerstopp(stufenConfig));
    ergebnis = a - b;
  } else {
    do {
      a = zufallsZahl(stufenConfig.a_min, stufenConfig.a_max);
      b = zufallsZahl(stufenConfig.b_min, stufenConfig.b_max);
      ergebnis = a - b;
      versuche++;
      if (versuche > 50) break; // Safety
    } while (!passtZurStufe(a, b, ergebnis, stufenConfig));
  }

  const optionen = baueAntwortOptionen(ergebnis, distraktorConfig);

  return {
    aufgabentyp: 'minus',
    stufe: stufenConfig.nr,
    a,
    b,
    ergebnis,
    text: `${a} − ${b} = ?`,
    vorlese_text: `${a} minus ${b}`,
    antwort_optionen: optionen,
  };
}

// Beide Formen gleich oft. Die Zehner kommen aus a_min..a_max, die Einer aus b_min..b_max.
function zehnerstopp(config) {
  const zMin = Math.ceil(config.a_min / 10), zMax = Math.floor(config.a_max / 10);
  const z = zufallsZahl(zMin, zMax);
  const e = zufallsZahl(config.b_min, Math.min(config.b_max, 9));
  if (Math.random() < 0.5) return { a: z * 10 + e, b: e };   // zum Zehner
  return { a: z * 10, b: e };                                 // vom Zehner
}

function passtZurStufe(a, b, ergebnis, config) {
  if (a < b) return false;                 // kein negatives Ergebnis
  if (ergebnis < 0 || ergebnis > 100) return false;
  const borgen = (a % 10) < (b % 10);
  if (config.kein_entbuendeln) return !borgen;
  return borgen;                           // sonst Borgen erzwingen (wie Plus den Übergang)
}

function baueAntwortOptionen(richtig, config) {
  const optionen = new Set([richtig]);
  for (const abstand of config.abstaende) {
    const opt = richtig + abstand;
    if (opt >= 0 && opt <= 100) optionen.add(opt);
  }
  let zusatz = 2;
  while (optionen.size < 5) {
    const kandidaten = [richtig + zusatz, richtig - zusatz];
    for (const k of kandidaten) {
      if (k >= 0 && k <= 100 && optionen.size < 5) optionen.add(k);
    }
    zusatz++;
    if (zusatz > 30) break;
  }
  return mische(Array.from(optionen).slice(0, 5));
}

function zufallsZahl(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function mische(arr) {
  const kopie = [...arr];
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie;
}
