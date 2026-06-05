import { getSchwierigkeit, setSchwierigkeit, trackeAufgabe } from './state.js';

const REAKTIONSZEIT_SCHWELLE_MS = 12000;  // > 12 Sek = "langsam"
const FEHLER_SERIE_FUER_B_WECHSEL = 3;
const ERFOLG_SERIE_FUER_HOEHER = 4;

// In-Memory pro Profil + Aufgabentyp: laufender Verlauf der letzten Aufgaben.
// Wird nicht persistiert — startet bei jeder Welt-Session frisch.
const verlauf = new Map();

function key(profileId, aufgabentyp) {
  return `${profileId}:${aufgabentyp}`;
}

function getVerlauf(profileId, aufgabentyp) {
  const k = key(profileId, aufgabentyp);
  if (!verlauf.has(k)) {
    verlauf.set(k, { letzte_5: [], fehler_serie: 0, erfolg_serie: 0 });
  }
  return verlauf.get(k);
}

export function waehleMechanik(profileId, aufgabentyp) {
  // Default: A. Bei laufender Fehler-Serie → B.
  const v = getVerlauf(profileId, aufgabentyp);
  if (v.fehler_serie >= FEHLER_SERIE_FUER_B_WECHSEL) return 'B';
  // Wenn die letzten 3 Aufgaben durchschnittlich > schwelle waren, auch B
  const langsam = v.letzte_5.slice(-3).filter(e => e.zeit_ms > REAKTIONSZEIT_SCHWELLE_MS).length;
  if (langsam >= 2) return 'B';
  return 'A';
}

export function aktuelleStufe(profileId, aufgabentyp) {
  return getSchwierigkeit(profileId, aufgabentyp);
}

// Wird nach jeder beantworteten Aufgabe aufgerufen.
// war_richtig: boolean
// zeit_ms: number — vom Anzeige der Aufgabe bis zur Antwort
export function rapportiereErgebnis(profileId, aufgabentyp, war_richtig, zeit_ms) {
  trackeAufgabe(profileId, aufgabentyp, war_richtig, zeit_ms);

  const v = getVerlauf(profileId, aufgabentyp);
  v.letzte_5.push({ war_richtig, zeit_ms });
  if (v.letzte_5.length > 5) v.letzte_5.shift();

  if (war_richtig) {
    v.fehler_serie = 0;
    v.erfolg_serie += 1;
  } else {
    v.fehler_serie += 1;
    v.erfolg_serie = 0;
  }

  // Stufe anpassen
  const aktuell = getSchwierigkeit(profileId, aufgabentyp);
  if (v.erfolg_serie >= ERFOLG_SERIE_FUER_HOEHER && aktuell < 4) {
    setSchwierigkeit(profileId, aufgabentyp, aktuell + 1);
    v.erfolg_serie = 0;
  } else if (v.fehler_serie >= 2 && aktuell > 1) {
    setSchwierigkeit(profileId, aufgabentyp, aktuell - 1);
    v.fehler_serie = 0;
  }
}

export function reset(profileId, aufgabentyp) {
  verlauf.delete(key(profileId, aufgabentyp));
}
