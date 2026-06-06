// Pure Logik für Gutschein-Stapel: gruppieren + mengenweise entfernen.
// KEINE State-/DOM-Abhängigkeit (node-testbar). Persistenz liegt in state.js.

// Offene Gutscheine (!eingeloest) nach rezeptId gruppieren.
// Reihenfolge: nach erstem Vorkommen. Wert/Einheit aus dem ersten Eintrag der Sorte.
export function gruppiereGutscheine(gutscheine = []) {
  const stapel = [];
  const index = new Map();
  for (const g of gutscheine) {
    if (g.eingeloest) continue;
    if (!index.has(g.rezeptId)) {
      index.set(g.rezeptId, stapel.length);
      stapel.push({
        rezeptId: g.rezeptId,
        name: g.name,
        emoji: g.emoji,
        wert: g.wert,
        einheit: g.einheit,
        anzahl: 0,
      });
    }
    stapel[index.get(g.rezeptId)].anzahl += 1;
  }
  return stapel;
}

// Bis zu `anzahl` OFFENE Gutscheine der Sorte entfernen. Gibt ein NEUES Array zurück
// (Original unverändert). Eingelöste Einträge bleiben unberührt.
export function entferneAusStapel(gutscheine = [], rezeptId, anzahl) {
  let uebrig = anzahl;
  const ergebnis = [];
  for (const g of gutscheine) {
    if (uebrig > 0 && !g.eingeloest && g.rezeptId === rezeptId) {
      uebrig -= 1;
      continue; // diesen entfernen
    }
    ergebnis.push(g);
  }
  return ergebnis;
}
