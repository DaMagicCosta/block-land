// Mengen-/Zähl-Generator für die Vorschule (Ilian). Aufgabe: "Wie viele Punkte?".
// Schema bleibt kompatibel zu plus/mal (a/b/ergebnis vorhanden), zusätzlich 'ziel'.

export function generiereMengenAufgabe(stufenConfig, distraktorConfig) {
  const ziel = zufallsZahl(stufenConfig.ziel_min, stufenConfig.ziel_max);
  const optionen = baueAntwortOptionen(ziel, stufenConfig, distraktorConfig);

  return {
    aufgabentyp: 'mengen',
    stufe: stufenConfig.nr,
    a: ziel,
    b: 0,
    ziel,
    ergebnis: ziel,
    text: 'Wie viele?',
    vorlese_text: 'Wie viele Punkte siehst du?',
    antwort_optionen: optionen,
  };
}

function baueAntwortOptionen(richtig, stufenConfig, config) {
  const anzahl = config && config.anzahl ? config.anzahl + 1 : 5; // inkl. richtiger Antwort
  const obergrenze = stufenConfig.ziel_max + 2;
  const optionen = new Set([richtig]);

  let abstand = 1;
  while (optionen.size < anzahl && abstand <= obergrenze) {
    for (const k of [richtig - abstand, richtig + abstand]) {
      if (optionen.size < anzahl && k >= 1 && k <= obergrenze) optionen.add(k);
    }
    abstand++;
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
