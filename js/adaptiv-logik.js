// Pure Logik des adaptiven Verlaufs: Serien zählen, Mechanik wählen, Stufe anpassen.
// KEINE DOM-/State-Abhängigkeit (in Node testbar). adaptiv.js hält den Verlauf je Profil und
// Aufgabentyp und schreibt die Stufe in den State.

export const REAKTIONSZEIT_SCHWELLE_MS = 12000;  // > 12 Sek = "langsam"
export const FEHLER_SERIE_FUER_B_WECHSEL = 3;
export const FEHLER_FUER_TIEFER = 2;
export const ERFOLG_SERIE_FUER_HOEHER = 4;

// fehler_serie         Fehler in Folge, endet nur mit einer richtigen Antwort (steuert das Legen)
// fehler_seit_abstieg  Fehler in Folge seit dem letzten Stufenabstieg (steuert den Abstieg)
// Zwei Zähler, weil der Abstieg nach zwei Fehlern sonst die Serie löschte, bevor der dritte
// Fehler das Legen auslösen konnte — das Legen griff dadurch nur auf der untersten Stufe.
export function neuerVerlauf() {
  return { letzte_5: [], fehler_serie: 0, fehler_seit_abstieg: 0, erfolg_serie: 0 };
}

export function verbuche(v, war_richtig, zeit_ms) {
  v.letzte_5.push({ war_richtig, zeit_ms });
  if (v.letzte_5.length > 5) v.letzte_5.shift();
  if (war_richtig) {
    v.fehler_serie = 0;
    v.fehler_seit_abstieg = 0;
    v.erfolg_serie += 1;
  } else {
    v.fehler_serie += 1;
    v.fehler_seit_abstieg += 1;
    v.erfolg_serie = 0;
  }
}

export function mechanikFuer(v) {
  // Default: A. Bei laufender Fehler-Serie → B.
  if (v.fehler_serie >= FEHLER_SERIE_FUER_B_WECHSEL) return 'B';
  // Wenn von den letzten 3 Aufgaben mindestens 2 über der Schwelle lagen, auch B
  const langsam = v.letzte_5.slice(-3).filter(e => e.zeit_ms > REAKTIONSZEIT_SCHWELLE_MS).length;
  if (langsam >= 2) return 'B';
  return 'A';
}

// Gibt die neue Stufe zurück (oder die alte) und setzt den verbrauchten Zähler zurück.
export function passeStufeAn(v, aktuell, maxStufe) {
  if (v.erfolg_serie >= ERFOLG_SERIE_FUER_HOEHER && aktuell < maxStufe) {
    v.erfolg_serie = 0;
    return aktuell + 1;
  }
  if (v.fehler_seit_abstieg >= FEHLER_FUER_TIEFER && aktuell > 1) {
    v.fehler_seit_abstieg = 0;
    return aktuell - 1;
  }
  return aktuell;
}
