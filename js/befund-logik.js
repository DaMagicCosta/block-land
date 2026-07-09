// Pure Logik für den Förder-Kompass: Klartext-Befunde aus aggregierten Übungsdaten.
// KEINE DOM-/State-Abhängigkeit (node-testbar, siehe tools/check-befund-logik.mjs).
// Eingabe ist proTyp im Serverformat: [{ typ, gesamt, richtig, zeit_ms }].

const MIN_AUFGABEN = 5;      // unterhalb: keine Aussage über die Rechenart
const QUOTE_ROT = 0.7;       // darunter: gemeinsames Üben empfohlen
const QUOTE_GRUEN = 0.85;    // ab hier: sicher
const LANGSAM_FAKTOR = 1.5;  // ⌀ Zeit der Rechenart vs. Gesamtschnitt des Kindes
const LANGSAM_MINDEST_MS = 8000; // "langsam" erst ab dieser absoluten ⌀-Zeit

// Liefert sortierte Befunde (rot vor gelb vor grün): { farbe, typ, text }.
// typNamen mappt typ-Schlüssel auf Anzeigenamen (z.B. mal -> "Mal-Reihen").
export function erzeugeBefunde(proTyp = [], typNamen = {}) {
  const bewertbar = (Array.isArray(proTyp) ? proTyp : [])
    .map(t => ({
      typ: t.typ,
      gesamt: Number(t.gesamt) || 0,
      richtig: Number(t.richtig) || 0,
      zeit_ms: Number(t.zeit_ms) || 0,
    }))
    .filter(t => t.gesamt >= MIN_AUFGABEN);

  if (!bewertbar.length) {
    return [{ farbe: 'neutral', typ: null, text: 'Noch zu wenig Daten für Befunde — einfach weiter üben.' }];
  }

  const gesamtAlle = bewertbar.reduce((s, t) => s + t.gesamt, 0);
  const zeitAlle = bewertbar.reduce((s, t) => s + t.zeit_ms, 0);
  const schnittAlle = gesamtAlle ? zeitAlle / gesamtAlle : 0;

  const befunde = bewertbar.map(t => {
    const quote = t.richtig / t.gesamt;
    const schnitt = t.gesamt ? t.zeit_ms / t.gesamt : 0;
    const name = typNamen[t.typ] ?? t.typ;
    const sek = `${(schnitt / 1000).toFixed(0)} s`;
    if (quote < QUOTE_ROT) {
      return { farbe: 'rot', typ: t.typ, text: `${name}: nur ${Math.round(quote * 100)} % richtig — hier lohnt gemeinsames Üben.` };
    }
    if (schnittAlle && schnitt > schnittAlle * LANGSAM_FAKTOR && schnitt > LANGSAM_MINDEST_MS) {
      return { farbe: 'gelb', typ: t.typ, text: `${name}: meist richtig, aber langsam (⌀ ${sek}) — noch unsicher, dranbleiben.` };
    }
    if (quote >= QUOTE_GRUEN) {
      return { farbe: 'gruen', typ: t.typ, text: `${name}: sicher (${Math.round(quote * 100)} %${schnitt ? `, ⌀ ${sek}` : ''}) — darf schwerer werden.` };
    }
    return { farbe: 'gelb', typ: t.typ, text: `${name}: auf gutem Weg (${Math.round(quote * 100)} %) — weiter üben festigt.` };
  });

  const rang = { rot: 0, gelb: 1, gruen: 2, neutral: 3 };
  return befunde.sort((a, b) => rang[a.farbe] - rang[b.farbe]);
}
