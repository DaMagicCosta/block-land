// Pure Logik der Übungsreihe: Länge nach Alter, Fertig-Check, Fortschrittspunkte.
// KEINE DOM-/State-Abhängigkeit (node-testbar).
import { zielFuer } from './tagesauftrag-logik.js';

// Reihenlänge = Tagesziel (Kleine 3, Große 5). Vorher 4 und 6: Der Tagesauftrag war dann eine
// Frage vor dem Ende der Reihe erfüllt — zwei verschiedene Enden für dieselbe Einheit
// (Befund 10.10.2026). Eine Reihe am frischen Tag ist jetzt genau der Tagesauftrag.
export function reihenLaenge(alter) {
  return zielFuer(alter);
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

// Biom-Ids, die eine offene Reihe haben (für Karten-/Welt-Marker).
// `aktiveReihen` ist die Map biom→reihe aus dem State; falsy-Einträge gelten als "nicht offen".
export function offeneBiome(aktiveReihen = {}) {
  return Object.keys(aktiveReihen).filter(biom => aktiveReihen[biom]);
}
