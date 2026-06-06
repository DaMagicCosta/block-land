// Pure Logik der wachsenden Burg: Stufen + Fortschritt aus Gesamt-Erfolgen.
// KEINE DOM-/State-Abhängigkeit (node-testbar).

export const BURG_STUFEN = [
  { schwelle: 0,   name: 'Lagerplatz' },
  { schwelle: 10,  name: 'Zelt' },
  { schwelle: 25,  name: 'Holzhütte' },
  { schwelle: 50,  name: 'Steinturm' },
  { schwelle: 90,  name: 'Mauern' },
  { schwelle: 150, name: 'Doppelturm' },
  { schwelle: 250, name: 'Große Burg' },
];

export function aktuelleStufe(erfolge) {
  let idx = 0;
  for (let i = 0; i < BURG_STUFEN.length; i++) {
    if (erfolge >= BURG_STUFEN[i].schwelle) idx = i;
  }
  return idx;
}

// Fortschritt zur nächsten Stufe.
export function fortschritt(erfolge) {
  const e = Math.max(0, Math.floor(erfolge || 0));
  const stufeIdx = aktuelleStufe(e);
  const aktuell = BURG_STUFEN[stufeIdx];
  const naechste = BURG_STUFEN[stufeIdx + 1] || null;
  if (!naechste) {
    return { stufeIdx, name: aktuell.name, naechsterName: null, schwelleAktuell: aktuell.schwelle, schwelleNaechste: null, bisNaechste: 0, prozent: 100 };
  }
  const spanne = naechste.schwelle - aktuell.schwelle;
  const drin = e - aktuell.schwelle;
  const prozent = Math.max(0, Math.min(100, Math.round((drin / spanne) * 100)));
  return { stufeIdx, name: aktuell.name, naechsterName: naechste.name, schwelleAktuell: aktuell.schwelle, schwelleNaechste: naechste.schwelle, bisNaechste: naechste.schwelle - e, prozent };
}
