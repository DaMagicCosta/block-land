// Plus-Aufgaben-Generator. Bekommt Stufen-Konfiguration aus aufgaben-pool.json.

export function generierePlusAufgabe(stufenConfig, distraktorConfig) {
  let a, b, ergebnis;
  let versuche = 0;

  // Generiere Zahlen, bis sie zur Stufe passen (insb. Zehnerübergang-Constraint)
  do {
    a = zufallsZahl(stufenConfig.a_min, stufenConfig.a_max);
    b = zufallsZahl(stufenConfig.b_min, stufenConfig.b_max);
    ergebnis = a + b;
    versuche++;
    if (versuche > 50) break; // Safety, sollte nie passieren
  } while (
    !passtZurStufe(a, b, ergebnis, stufenConfig)
  );

  const optionen = baueAntwortOptionen(ergebnis, distraktorConfig);

  return {
    aufgabentyp: 'plus',
    stufe: stufenConfig.nr,
    a,
    b,
    ergebnis,
    text: `${a} + ${b} = ?`,
    vorlese_text: `${a} plus ${b}`,
    antwort_optionen: optionen,
  };
}

function passtZurStufe(a, b, ergebnis, config) {
  if (ergebnis > 100) return false; // ZR 100 hart-Cap
  if (ergebnis < 1) return false;
  if (config.kein_zehneruebergang) {
    // Zehnerübergang: (a % 10) + b > 10 → es gibt einen ZÜ
    return (a % 10) + (b % 10) <= 10 && (a % 10) + b <= (Math.floor(a / 10) + 1) * 10;
  }
  // mit ZÜ: erzwinge dass es einen gibt
  return (a % 10) + (b % 10) > 10;
}

function baueAntwortOptionen(richtig, config) {
  const optionen = new Set([richtig]);
  for (const abstand of config.abstaende) {
    const opt = richtig + abstand;
    if (opt > 0 && opt <= 100) optionen.add(opt);
  }
  // Falls weniger als 5 Optionen: weitere Distraktoren mit größerem Abstand
  let zusatz = 2;
  while (optionen.size < 5) {
    const kandidaten = [richtig + zusatz, richtig - zusatz];
    for (const k of kandidaten) {
      if (k > 0 && k <= 100 && optionen.size < 5) optionen.add(k);
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
