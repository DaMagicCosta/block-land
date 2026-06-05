// Schwierigkeits-Ökonomie: bestimmt die Belohnung pro richtiger Antwort.
// Je Material wird mit der im Eltern-Bereich eingestellten Häufigkeit gewürfelt.
// Eisen/Diamant nur auf hohem eigenen Niveau. Leeres Ergebnis => Gratulation (keine Belohnung).
import { gebeReward } from './inventar.js';
import { getDropChancen } from './state.js';

export function verteileBelohnung(aufgabeStufe, maxStufe, basisItem) {
  const chancen = getDropChancen();
  const gegeben = [];

  // Basis-Material (vom Tile / Trainer) — fällt mit seiner eingestellten Häufigkeit.
  if (Math.random() < (chancen[basisItem] ?? 1)) {
    gebeReward(basisItem, 1);
    gegeben.push(basisItem);
  }

  // Premium nur auf hohem eigenen Niveau (an Schwierigkeit gekoppelt).
  if (maxStufe >= 1 && aufgabeStufe >= maxStufe) {
    if (Math.random() < (chancen.diamant ?? 0)) { gebeReward('diamant', 1); gegeben.push('diamant'); }
    if (Math.random() < (chancen.eisen ?? 0)) { gebeReward('eisen', 1); gegeben.push('eisen'); }
  } else if (maxStufe >= 2 && aufgabeStufe >= maxStufe - 1) {
    if (Math.random() < (chancen.eisen ?? 0)) { gebeReward('eisen', 1); gegeben.push('eisen'); }
  }

  return gegeben;
}
