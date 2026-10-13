import { getSchwierigkeit, setSchwierigkeit, trackeAufgabe } from './state.js';
import { meldeAufgabe } from './sync.js';
import { neuerVerlauf, verbuche, mechanikFuer, passeStufeAn } from './adaptiv-logik.js';

// In-Memory pro Profil + Aufgabentyp: laufender Verlauf der letzten Aufgaben.
// Wird nicht persistiert — startet bei jeder Welt-Session frisch.
const verlauf = new Map();

function key(profileId, aufgabentyp) {
  return `${profileId}:${aufgabentyp}`;
}

function getVerlauf(profileId, aufgabentyp) {
  const k = key(profileId, aufgabentyp);
  if (!verlauf.has(k)) verlauf.set(k, neuerVerlauf());
  return verlauf.get(k);
}

export function waehleMechanik(profileId, aufgabentyp) {
  return mechanikFuer(getVerlauf(profileId, aufgabentyp));
}

export function aktuelleStufe(profileId, aufgabentyp) {
  return getSchwierigkeit(profileId, aufgabentyp);
}

// Wird nach jeder beantworteten Aufgabe aufgerufen.
// war_richtig: boolean
// zeit_ms: number — vom Anzeige der Aufgabe bis zur Antwort
export function rapportiereErgebnis(profileId, aufgabentyp, war_richtig, zeit_ms, { maxStufe = 4, adaptStufe = true, detail = null } = {}) {
  trackeAufgabe(profileId, aufgabentyp, war_richtig, zeit_ms);
  // detail beschreibt die Übungssituation fürs Familien-Sheet; Standard ist die aktuelle Stufe.
  meldeAufgabe(profileId, aufgabentyp, war_richtig, zeit_ms, detail ?? `stufe ${getSchwierigkeit(profileId, aufgabentyp)}`);

  const v = getVerlauf(profileId, aufgabentyp);
  verbuche(v, war_richtig, zeit_ms);

  if (!adaptStufe) return;   // Gezieltes Üben: Stufe (Art) bleibt fix.

  // Stufe anpassen (Obergrenze = echte Stufenzahl der Rechenart).
  const aktuell = getSchwierigkeit(profileId, aufgabentyp);
  const neu = passeStufeAn(v, aktuell, maxStufe);
  if (neu !== aktuell) setSchwierigkeit(profileId, aufgabentyp, neu);
}

export function reset(profileId, aufgabentyp) {
  verlauf.delete(key(profileId, aufgabentyp));
}
