// Schwierigkeits-Ökonomie: bestimmt die Belohnung pro richtiger Antwort.
// Je Material wird mit der im Eltern-Bereich eingestellten Häufigkeit gewürfelt.
// Eisen/Diamant nur auf hohem eigenen Niveau. Leeres Ergebnis => Gratulation (keine Belohnung).
import { gebeReward } from './inventar.js';
import { getDropChancen } from './state.js';

// biomFaktor: skaliert die Basis-Drop-Häufigkeit (untere Biome geben weniger, 0..1).
// premiumErlaubt: in Biomen unter dem Kind-Niveau fällt KEIN Eisen/Diamant.
export function verteileBelohnung(aufgabeStufe, maxStufe, basisItem, biomFaktor = 1, premiumErlaubt = true) {
  const chancen = getDropChancen();
  const gegeben = [];

  // Basis-Material (vom Tile / Trainer) — Häufigkeit zusätzlich mit dem Biom-Faktor abgestuft.
  if (Math.random() < (chancen[basisItem] ?? 1) * biomFaktor) {
    gebeReward(basisItem, 1);
    gegeben.push(basisItem);
  }

  // Premium nur auf hohem eigenen Niveau — und nur, wenn nicht in einem unteren Biom.
  if (premiumErlaubt) {
    if (maxStufe >= 1 && aufgabeStufe >= maxStufe) {
      if (Math.random() < (chancen.diamant ?? 0)) { gebeReward('diamant', 1); gegeben.push('diamant'); }
      if (Math.random() < (chancen.eisen ?? 0)) { gebeReward('eisen', 1); gegeben.push('eisen'); }
    } else if (maxStufe >= 2 && aufgabeStufe >= maxStufe - 1) {
      if (Math.random() < (chancen.eisen ?? 0)) { gebeReward('eisen', 1); gegeben.push('eisen'); }
    }
  }

  return gegeben;
}
