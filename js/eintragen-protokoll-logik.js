// Pure Logik fürs Eintragen-Protokoll (Mal-Trainer): Richtungshinweis + normalisierter Eintrag.
// KEINE DOM-/State-Abhängigkeit (node-testbar). Anhängen/Kappen via fuegeEintragHinzu
// (js/aufsage-protokoll-logik.js, generisch).

export function richtungsHinweis(wert, soll) {
  if (!Number.isFinite(wert) || wert === soll) return '';
  return wert > soll ? 'zu hoch' : 'zu tief';
}

export function neuerEintrag({ datum, reihe, richtig, fehler, verraten }) {
  const z = (n) => Math.max(0, Math.floor(Number(n) || 0));
  return {
    datum: datum ?? '',
    reihe: Number(reihe) || 0,
    richtig: z(richtig),
    fehler: z(fehler),
    verraten: z(verraten),
  };
}
