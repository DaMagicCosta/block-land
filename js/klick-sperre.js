// Klick-Entprellung für Antwort-Wertungen — pure Logik, kein DOM (node-testbar).
// Check: node tools/check-klick-sperre.mjs
//
// Live-Befund 16.07.2026 (Sync-Log): Ilian tippt rhythmisch schnell — ein Doppeltipp
// landete als ZWEI gewertete Fehlversuche in derselben Sekunde ("9 : 3" zweimal falsch
// in <1s) und verriet sofort die Lösung. Ein Wisch = Aufgabe weg ist unfair und
// unterläuft die 2-Fehlversuche-Leitplanke.
//
// Regel: Nach jeder GEWERTETEN Antwort (richtig oder falsch) und nach jedem
// Einblenden von Antwort-Knöpfen (Reveal) sind Wertungen für ein kurzes Fenster
// gesperrt. Das Fenster ist bewusst klein (300 ms): Es frisst nur das Nachzittern
// eines Doppeltipps, nie eine echte zweite Entscheidung.

export const KLICK_SPERRE_MS = 300;

export function neueKlickSperre(fensterMs = KLICK_SPERRE_MS) {
  let gesperrtBis = -Infinity;
  return {
    // Sperrfenster (neu) starten — nach Wertung oder Reveal aufrufen.
    verriegeln(jetzt) { gesperrtBis = jetzt + fensterMs; },
    // true, solange Wertungen verworfen werden sollen.
    istGesperrt(jetzt) { return jetzt < gesperrtBis; },
  };
}
