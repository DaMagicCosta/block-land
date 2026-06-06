// Pure Logik: zerlegt eine Plus-/Minus-Aufgabe in eine geführte Schrittfolge.
// KEINE DOM-Abhängigkeit (in Node testbar). Der Renderer (stellenwert.js) macht daraus HTML.
//
// Schritt = { phase, titel, erklaerung (HTML), visual: { typ, ...Zahlen } }
// Farbcodierung in erklaerung: <b class="sw-e">…</b> = Einer, <b class="sw-z">…</b> = Zehner.

function ziffern(n) { return { z: Math.floor(n / 10), e: n % 10 }; }

export function berechneSchritte(aufgabe) {
  return aufgabe.aufgabentyp === 'minus' ? schritteMinus(aufgabe) : schrittePlus(aufgabe);
}

function schrittePlus(aufgabe) {
  const A = ziffern(aufgabe.a), B = ziffern(aufgabe.b);
  const einerSumme = A.e + B.e;
  const uebergang = einerSumme >= 10;
  const einerRest = einerSumme % 10;
  const uebertrag = uebergang ? 1 : 0;
  const zehnerSumme = A.z + B.z + uebertrag;
  const schritte = [];

  schritte.push({
    phase: 'ueberblick', titel: 'Schau dir die Zahlen an',
    erklaerung: `Wir rechnen <b>${aufgabe.a} + ${aufgabe.b}</b>. Jede Zahl hat <b class="sw-z">Zehner</b> und <b class="sw-e">Einer</b>.`,
    visual: { typ: 'zahlen', zahlen: [{ z: A.z, e: A.e }, { z: B.z, e: B.e }] },
  });
  schritte.push({
    phase: 'einer', titel: 'Erst die Einer',
    erklaerung: `Zähle die <b class="sw-e">Einer</b>: ${A.e} + ${B.e} = <b class="sw-e">${einerSumme}</b>.`,
    visual: { typ: 'einer-summe', einerSumme },
  });
  if (uebergang) {
    schritte.push({
      phase: 'buendeln', titel: 'Zehner bündeln',
      erklaerung: `<b class="sw-e">${einerSumme}</b> ist mehr als 10! 10 Einer werden <b class="sw-z">1 Zehner</b> ↑ — <b class="sw-e">${einerRest} Einer</b> bleiben.`,
      visual: { typ: 'buendeln', einerRest },
    });
  }
  schritte.push({
    phase: 'zehner', titel: 'Jetzt die Zehner',
    erklaerung: uebergang
      ? `Die <b class="sw-z">Zehner</b>: ${A.z} + ${B.z} + 1 (Übertrag) = <b class="sw-z">${zehnerSumme}</b> Zehner = ${zehnerSumme * 10}.`
      : `Die <b class="sw-z">Zehner</b>: ${A.z} + ${B.z} = <b class="sw-z">${zehnerSumme}</b> Zehner = ${zehnerSumme * 10}.`,
    visual: { typ: 'zehner-summe', zehnerSumme },
  });
  schritte.push({
    phase: 'ergebnis', titel: 'Zusammen',
    erklaerung: `<b class="sw-z">${zehnerSumme} Zehner</b> und <b class="sw-e">${einerRest} Einer</b> = <b>${aufgabe.ergebnis}</b>.`,
    visual: { typ: 'ergebnis', zehner: zehnerSumme, einer: einerRest, ergebnis: aufgabe.ergebnis },
  });
  return schritte;
}

function schritteMinus(aufgabe) {
  const A = ziffern(aufgabe.a), B = ziffern(aufgabe.b);
  const borgen = A.e < B.e;
  const schritte = [];

  schritte.push({
    phase: 'ueberblick', titel: 'Schau dir die Zahlen an',
    erklaerung: `Wir rechnen <b>${aufgabe.a} − ${aufgabe.b}</b>. Wir nehmen von <b class="sw-z">Zehnern</b> und <b class="sw-e">Einern</b> weg.`,
    visual: { typ: 'zahlen', zahlen: [{ z: A.z, e: A.e }, { z: B.z, e: B.e }] },
  });

  if (borgen) {
    const einerNeu = A.e + 10;
    const zehnerNeu = A.z - 1;
    const einerErgebnis = einerNeu - B.e;
    const zehnerErgebnis = zehnerNeu - B.z;
    schritte.push({
      phase: 'einer-pruefen', titel: 'Reichen die Einer?',
      erklaerung: `${A.e} − ${B.e}? Die <b class="sw-e">${A.e} Einer</b> reichen nicht für ${B.e}!`,
      visual: { typ: 'einer-pruefen', einer: A.e },
    });
    schritte.push({
      phase: 'entbuendeln', titel: 'Zehner öffnen',
      erklaerung: `Wir öffnen <b class="sw-z">1 Zehner</b> → 10 Einer. Jetzt <b class="sw-e">${einerNeu} Einer</b>, noch <b class="sw-z">${zehnerNeu} Zehner</b>.`,
      visual: { typ: 'entbuendeln', einer: einerNeu, zehner: zehnerNeu },
    });
    schritte.push({
      phase: 'einer-rechnen', titel: 'Jetzt die Einer',
      erklaerung: `<b class="sw-e">${einerNeu} − ${B.e} = ${einerErgebnis}</b>.`,
      visual: { typ: 'einer-summe', einerSumme: einerErgebnis },
    });
    schritte.push({
      phase: 'zehner', titel: 'Die Zehner',
      erklaerung: `<b class="sw-z">${zehnerNeu} − ${B.z} = ${zehnerErgebnis}</b> Zehner = ${zehnerErgebnis * 10}.`,
      visual: { typ: 'zehner-summe', zehnerSumme: zehnerErgebnis },
    });
    schritte.push({
      phase: 'ergebnis', titel: 'Zusammen',
      erklaerung: `<b class="sw-z">${zehnerErgebnis} Zehner</b> und <b class="sw-e">${einerErgebnis} Einer</b> = <b>${aufgabe.ergebnis}</b>.`,
      visual: { typ: 'ergebnis', zehner: zehnerErgebnis, einer: einerErgebnis, ergebnis: aufgabe.ergebnis },
    });
  } else {
    const einerErgebnis = A.e - B.e;
    const zehnerErgebnis = A.z - B.z;
    schritte.push({
      phase: 'einer-rechnen', titel: 'Erst die Einer',
      erklaerung: `Die <b class="sw-e">Einer</b>: ${A.e} − ${B.e} = <b class="sw-e">${einerErgebnis}</b>.`,
      visual: { typ: 'einer-summe', einerSumme: einerErgebnis },
    });
    schritte.push({
      phase: 'zehner', titel: 'Jetzt die Zehner',
      erklaerung: `Die <b class="sw-z">Zehner</b>: ${A.z} − ${B.z} = <b class="sw-z">${zehnerErgebnis}</b> Zehner = ${zehnerErgebnis * 10}.`,
      visual: { typ: 'zehner-summe', zehnerSumme: zehnerErgebnis },
    });
    schritte.push({
      phase: 'ergebnis', titel: 'Zusammen',
      erklaerung: `<b class="sw-z">${zehnerErgebnis} Zehner</b> und <b class="sw-e">${einerErgebnis} Einer</b> = <b>${aufgabe.ergebnis}</b>.`,
      visual: { typ: 'ergebnis', zehner: zehnerErgebnis, einer: einerErgebnis, ergebnis: aufgabe.ergebnis },
    });
  }
  return schritte;
}
