// Normalisierung von Aufgaben-KONSERVEN — pure Logik, kein State, kein DOM.
// Check: node tools/check-aufgabe-normalisierung.mjs
//
// Warum es das gibt (Live-Befund 2026-07-16): Aufgaben, die frisch aus einem Generator
// kommen, sind numerisch sauber. Aufgaben aus KONSERVEN (Fehlerbox-Wiedervorlage,
// persistierte Reihen, Sync-Einspielungen von anderen Geräten) haben die Werkbank
// längst verlassen — steht dort ergebnis als String ("10" statt 10), sieht JEDE
// Anzeige korrekt aus (Templates und parseInt kaschieren den Typ), aber der strikte
// Vergleich in antwortPruefen lehnt die richtige Antwort ab. Für das Kind heißt das:
// Es rechnet richtig, tippt richtig — und die App sagt „Versuch es nochmal!".
//
// Regel: Jede Konserve wird beim WIEDEREINSPIELEN durch diese Funktion geschickt.
// Reparierbar (String-Zahlen) → koerziert. Nicht reparierbar (ergebnis fehlt/NaN,
// Optionen kaputt) → null, der Aufrufer verwirft die Konserve und erzeugt frisch.
// Niemals eine kaputte Konserve durchreichen: Eine Aufgabe, bei der keine Antwort
// richtig sein KANN, ist ein garantierter Frust-Loop.

// Zahlenfelder einer Aufgabe. ergebnis ist Pflicht, der Rest nur wenn vorhanden.
const ZAHL_FELDER_OPTIONAL = ['a', 'b', 'stufe', 'ziel', 'ganze', 'teil_a'];

function alsZahl(wert) {
  if (typeof wert === 'number') return Number.isFinite(wert) ? wert : null;
  if (typeof wert === 'string' && wert.trim() !== '') {
    const n = Number(wert);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Liefert eine numerisch saubere Kopie der Aufgabe — oder null, wenn sie nicht
// reparierbar ist. Die Eingabe wird nie mutiert.
export function normalisiereAufgabe(aufgabe) {
  if (!aufgabe || typeof aufgabe !== 'object') return null;

  const ergebnis = alsZahl(aufgabe.ergebnis);
  if (ergebnis === null) return null;

  if (!Array.isArray(aufgabe.antwort_optionen) || !aufgabe.antwort_optionen.length) return null;
  const antwort_optionen = aufgabe.antwort_optionen.map(alsZahl);
  if (antwort_optionen.some(o => o === null)) return null;

  const sauber = { ...aufgabe, ergebnis, antwort_optionen };
  for (const feld of ZAHL_FELDER_OPTIONAL) {
    if (aufgabe[feld] === undefined) continue;
    const n = alsZahl(aufgabe[feld]);
    if (n === null) return null;   // vorhandenes Zahlenfeld, aber kein Zahlwert → Konserve kaputt
    sauber[feld] = n;
  }
  return sauber;
}
