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

// Reihenfolge von selten -> häufig; bestimmt, welches Material eine Ziehung trifft.
// 'holz' steht bewusst am Ende der Verteilung (häufigstes/letztes Segment) UND ist der
// Fallback, falls dropChancen leer/0 ist — die Truhe ist dadurch nie leer.
const REIHENFOLGE = ['diamant', 'eisen', 'blume', 'stein', 'holz'];

// Zieht `anzahl` Materialien gewichtet über die Eltern-Drop-Regler (dropChancen-Werte als
// relative Gewichte, kumulative Verteilung). Ein rnd()-Aufruf pro Ziehung (deterministisch
// testbar). Chance auf Eisen/Diamant ist inklusive. Fällt nie leer aus: fehlen/summen sich
// alle Gewichte zu 0, wird 'holz' gezogen.
export function truhenZiehung(dropChancen = {}, rnd = Math.random, anzahl = 3) {
  const items = REIHENFOLGE.filter(item => (dropChancen[item] ?? 0) > 0);
  const gewichte = items.map(item => dropChancen[item]);
  const summe = gewichte.reduce((a, b) => a + b, 0);

  const ergebnis = [];
  for (let i = 0; i < anzahl; i++) {
    if (!items.length || summe <= 0) { ergebnis.push('holz'); continue; }
    let ziel = rnd() * summe;
    let gewaehlt = items[items.length - 1];
    for (let j = 0; j < items.length; j++) {
      if (ziel < gewichte[j]) { gewaehlt = items[j]; break; }
      ziel -= gewichte[j];
    }
    ergebnis.push(gewaehlt);
  }
  return ergebnis;
}
