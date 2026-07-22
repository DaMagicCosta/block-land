// Geteilt-Aufgaben-Generator: Division als Umkehrung des Einmaleins, OHNE Rest.
// b = Teiler-Reihe (aus den je Stufe erlaubten), ergebnis = Quotient 1..quotient_max,
// a = b * ergebnis (Dividend). Spiegelt das Schema von mal.js (gleiche Feldnamen).

// `erlaubteReihen` (optional): siehe mal.js — Reihen-Freischaltung durchgereicht aus dem Biom.
// Durch 1 zu teilen ist keine sinnvolle Übung, deshalb wird die 1er hier immer ausgefiltert
// (anders als bei mal.js, wo die 1er auf Stufe 1 bewusst mitläuft).
export function generiereGeteiltAufgabe(stufenConfig, distraktorConfig, erlaubteReihen = null) {
  const reihen = (erlaubteReihen && erlaubteReihen.length)
    ? erlaubteReihen.filter(r => r > 1)      // durch 1 teilen ist keine sinnvolle Übung
    : (stufenConfig.reihen ?? [2, 5, 10]);
  const b = reihen.length ? reihen[Math.floor(Math.random() * reihen.length)] : 2;
  const ergebnis = zufallsZahl(1, stufenConfig.quotient_max ?? 10);
  const a = b * ergebnis;

  const optionen = baueAntwortOptionen(ergebnis, distraktorConfig);

  return {
    aufgabentyp: 'geteilt',
    stufe: stufenConfig.nr,
    a,
    b,
    ergebnis,
    text: `${a} : ${b} = ?`,
    vorlese_text: `${a} geteilt durch ${b}`,
    antwort_optionen: optionen,
  };
}

function baueAntwortOptionen(richtig, config) {
  const anzahl = config && config.anzahl ? config.anzahl + 1 : 5; // inkl. richtiger Antwort
  const optionen = new Set([richtig]);

  // Plausible Distraktoren: knapp daneben (typische Quotienten-Verwechslung).
  const kandidaten = [richtig + 1, richtig - 1, richtig + 2, richtig - 2, richtig + 3];
  for (const k of kandidaten) {
    if (optionen.size >= anzahl) break;
    if (k > 0 && k !== richtig) optionen.add(k);
  }
  // Auffüllen, falls noch zu wenige verschiedene Werte (kleiner Quotient).
  let zusatz = 4;
  while (optionen.size < anzahl) {
    const k = richtig + zusatz;
    if (k > 0 && k !== richtig) optionen.add(k);
    zusatz++;
    if (zusatz > 20) break;
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
