// Grenzen gespeicherter Aufgaben gegen den HEUTIGEN Aufgaben-Pool — pure Logik, kein State, kein DOM.
// Check: node tools/check-konserven-grenzen.mjs
//
// Warum es das gibt (Befund 15.09.2026, erste Meldung der Fehler-Raupe): Eine seit Juli offene
// Mal-Reihe trug 12 · 11 aus der alten Stufe „großes 1x1". Die höchste Mal-Stufe geht seit dem
// 22.07.2026 nur noch bis 10 · 12 — der Erzeuger kann so eine Aufgabe nicht mehr bauen, die
// Konserve aber hat die Änderung überlebt. normalisiereAufgabe() prüft nur, ob eine Konserve
// technisch lesbar ist, nicht ob sie noch zum Stoff passt. Das hier ist die zweite Prüfung.
//
// Maßstab ist die Vereinigung ALLER heutigen Stufen eines Typs, nicht die eigene Stufe der
// Konserve: Trainer-Konserven tragen bewusst stufe 0 (siehe trainer.js), und eine Aufgabe, die
// zu irgendeiner heutigen Stufe passt, ist Stoff, den die App heute noch übt.

const RECHNUNG = {
  plus: (a, b) => a + b,
  minus: (a, b) => a - b,
  mal: (a, b) => a * b,
};

function grenze(stufen, feld, fn) {
  const werte = stufen.map(s => s?.[feld]).filter(Number.isFinite);
  return werte.length ? fn(...werte) : null;
}

// true = Konserve darf weiterverwendet werden. Typen ohne a/b-Grenzen im Pool (Uhr, Mengen,
// Würfel-Teich, Geteilt) und ein fehlender Pool gelten als passend — hier wird nie auf Verdacht
// verworfen, nur bei belegbarem Widerspruch.
export function passtZumPool(aufgabe, pool) {
  const rechne = RECHNUNG[aufgabe?.aufgabentyp];
  if (!rechne) return true;
  const stufen = pool?.[aufgabe.aufgabentyp]?.stufen;
  if (!Array.isArray(stufen) || !stufen.length) return true;
  const { a, b, ergebnis } = aufgabe;
  if (![a, b, ergebnis].every(Number.isFinite)) return false;
  if (rechne(a, b) !== ergebnis) return false;
  const aMin = grenze(stufen, 'a_min', Math.min), aMax = grenze(stufen, 'a_max', Math.max);
  const bMin = grenze(stufen, 'b_min', Math.min), bMax = grenze(stufen, 'b_max', Math.max);
  if (aMin !== null && a < aMin) return false;
  if (aMax !== null && a > aMax) return false;
  if (bMin !== null && b < bMin) return false;
  if (bMax !== null && b > bMax) return false;
  return true;
}
