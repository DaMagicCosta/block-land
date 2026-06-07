// Pure Logik für den Mal-Reihen-Aufsage-Modus: baut die 10 Schritte einer Reihe.
// KEINE DOM-/State-Abhängigkeit (node-testbar).

// Schritte 1..10 der `reihe`er-Reihe. `text` = Anzeige (· als Mal-Zeichen, projektweit),
// `vorlese` = gesprochener Satz für die Sprachausgabe.
export function baueReihe(reihe) {
  const schritte = [];
  for (let i = 1; i <= 10; i++) {
    const ergebnis = i * reihe;
    schritte.push({
      i,
      ergebnis,
      text: `${i} · ${reihe} = ${ergebnis}`,
      vorlese: `${i} mal ${reihe} gleich ${ergebnis}`,
    });
  }
  return schritte;
}
