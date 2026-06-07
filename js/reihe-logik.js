// Pure Logik der Übungsreihe: Länge nach Alter, Fertig-Check, Fortschrittspunkte.
// KEINE DOM-/State-Abhängigkeit (node-testbar).

// Reihenlänge nach Schulstufe: Kleine kürzer, Große länger.
export function reihenLaenge(alter) {
  if (alter === 'klasse-2' || alter === 'klasse-3') return 6;
  return 4;   // kindergarten, klasse-1, Default
}

// Reihe ist fertig, sobald die aktuelle Position die Länge erreicht/überschritten hat.
export function istReiheFertig(reihe) {
  return reihe.position >= reihe.laenge;
}

// Zustand jeder Fortschritts-Marke: erledigte Fragen 'voll', aktuelle 'aktuell', Rest 'leer'.
export function fortschrittPunkte(position, laenge) {
  const punkte = [];
  for (let nr = 1; nr <= laenge; nr++) {
    if (nr < position) punkte.push('voll');
    else if (nr === position) punkte.push('aktuell');
    else punkte.push('leer');
  }
  return punkte;
}
