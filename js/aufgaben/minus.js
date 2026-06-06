// Minus-Aufgaben-Generator. Spiegelt plus.js. Bekommt Stufen-Config aus aufgaben-pool.json.
// a >= b (kein negatives Ergebnis), ZR 100. Stufen-Flag kein_entbuendeln steuert das Borgen.

export function generiereMinusAufgabe(stufenConfig, distraktorConfig) {
  let a, b, ergebnis;
  let versuche = 0;

  do {
    a = zufallsZahl(stufenConfig.a_min, stufenConfig.a_max);
    b = zufallsZahl(stufenConfig.b_min, stufenConfig.b_max);
    ergebnis = a - b;
    versuche++;
    if (versuche > 50) break; // Safety
  } while (!passtZurStufe(a, b, ergebnis, stufenConfig));

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
