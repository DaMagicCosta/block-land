// Pure Logik für den Tagesauftrag: Ziel je Alter, Tages-Reset/Increment, Truhen-Ziehung.
// KEINE DOM-/State-Abhängigkeit (node-testbar). `heuteKey` wird übergeben (kein Date.now()
// in den Funktionen), `rnd` ist injizierbar (Standard Math.random) für deterministische Tests.

const ZIEL_KLEIN = 3;   // kindergarten / klasse-1
const ZIEL_GROSS = 5;   // klasse-2 / klasse-3

// Tagesziel (Anzahl final beantworteter Aufgaben) je Profil-Alter.
export function zielFuer(alter) {
  return (alter === 'klasse-2' || alter === 'klasse-3') ? ZIEL_GROSS : ZIEL_KLEIN;
}

// Frisches Auftrags-Objekt für einen neuen Tag (unbelohnt, Fortschritt 0).
export function neuerAuftrag(heuteKey) {
  return { datum: heuteKey, fortschritt: 0, belohnt: false };
}

// Wird bei jeder final beantworteten Aufgabe aufgerufen (trackeAufgabe-Hook in state.js):
// Reset bei Tageswechsel (oder fehlendem Auftrag), danach Fortschritt+1. Gibt IMMER ein
// neues Objekt zurück — Eingabe bleibt unverändert (kein Mutations-Vektor).
export function aktualisiereTagesauftrag(auftrag, heuteKey) {
  const basis = (!auftrag || auftrag.datum !== heuteKey) ? neuerAuftrag(heuteKey) : auftrag;
  return { ...basis, fortschritt: basis.fortschritt + 1 };
}

// Reihenfolge von selten -> häufig; bestimmt, in welcher Reihenfolge die unabhängigen
// Material-Chancen pro Slot geprüft werden (seltenes Material hat Vorrang, falls mehrere
// Würfe im selben Slot treffen). 'holz' steht bewusst am Ende UND ist der Fallback, falls
// kein Material trifft — die Truhe ist dadurch nie leer.
const REIHENFOLGE = ['diamant', 'eisen', 'blume', 'stein', 'holz'];

// Zieht `anzahl` Materialien. WICHTIG: dropChancen sind KEINE normierte kategoriale
// Verteilung (das würde die Eltern-Regler gegenseitig koppeln — Blume hoch => Diamant-Chance
// sinkt rechnerisch). Stattdessen die gleiche Semantik wie in js/belohnung.js
// (verteileBelohnung): pro Material eine UNABHÄNGIGE Wahrscheinlichkeit, geprüft per
// `rnd() < chance[material]`. Pro Truhen-Slot wird REIHENFOLGE von selten nach häufig
// durchgegangen; das erste Material, dessen eigener Wurf trifft, gewinnt den Slot (ein
// rnd()-Aufruf je geprüftem Material, deterministisch testbar). Trifft kein Material ->
// Fallback 'holz' (Truhe nie leer). So wirkt jeder Eltern-Regler nur auf sein eigenes
// Material, unabhängig von den anderen.
export function truhenZiehung(dropChancen = {}, rnd = Math.random, anzahl = 3) {
  const ergebnis = [];
  for (let i = 0; i < anzahl; i++) {
    let gewaehlt = 'holz';
    for (const material of REIHENFOLGE) {
      const chance = dropChancen[material] ?? 0;
      if (chance > 0 && rnd() < chance) { gewaehlt = material; break; }
    }
    ergebnis.push(gewaehlt);
  }
  return ergebnis;
}
