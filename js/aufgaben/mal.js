// Mal-Aufgaben-Generator (Einmaleins). Bekommt Stufen-Konfiguration aus aufgaben-pool.json.
// Spiegelt das Schema von plus.js, nutzt aber Malpunkt-Anzeige und multiplikative Distraktoren.

export function generiereMalAufgabe(stufenConfig, distraktorConfig) {
  const a = zufallsZahl(stufenConfig.a_min, stufenConfig.a_max);
  const b = zufallsZahl(stufenConfig.b_min, stufenConfig.b_max);
  const ergebnis = a * b;

  const optionen = baueAntwortOptionen(a, b, distraktorConfig);

  return {
    aufgabentyp: 'mal',
    stufe: stufenConfig.nr,
    a,
    b,
    ergebnis,
    text: `${a} · ${b} = ?`,
    vorlese_text: `${a} mal ${b}`,
    antwort_optionen: optionen,
  };
}

function baueAntwortOptionen(a, b, config) {
  const richtig = a * b;
  const anzahl = config && config.anzahl ? config.anzahl + 1 : 5; // inkl. richtiger Antwort

  const optionen = new Set([richtig]);

  // Plausible Distraktoren: eine Reihe daneben / ein Faktor daneben / knapp daneben
  const kandidaten = [
    a * (b + 1), a * (b - 1),
    (a + 1) * b, (a - 1) * b,
    richtig + 1, richtig - 1,
    richtig + 2, richtig - 2,
  ];
  for (const k of kandidaten) {
    if (optionen.size >= anzahl) break;
    if (k > 0 && k !== richtig) optionen.add(k);
  }

  // Auffüllen, falls noch zu wenige verschiedene Werte
  let zusatz = 3;
  while (optionen.size < anzahl) {
    const k = richtig + zusatz;
    if (k > 0 && k !== richtig) optionen.add(k);
    zusatz++;
    if (zusatz > 40) break;
  }

  return mische(Array.from(optionen).slice(0, anzahl));
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
