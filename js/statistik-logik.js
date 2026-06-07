// Pure Logik für die Eltern-Statistik: Tracking-Update, Aggregation, Verlaufsreihen.
// KEINE DOM-/State-Abhängigkeit (node-testbar). `heute` wird übergeben, damit kein
// Date.now() in den Funktionen steckt.

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// 'YYYY-MM-DD' aus einem Date (lokale Datumsteile, mit führenden Nullen).
export function tagesSchluessel(date) {
  const j = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const t = String(date.getDate()).padStart(2, '0');
  return `${j}-${m}-${t}`;
}

// Schreibt eine Aufgabe in den Tages-Verlauf (pro Tag pro Rechenart) und kappt
// Schlüssel, die älter als `maxTage` Tage sind (inkl. heute). Gibt ein NEUES Objekt
// zurück (Eingabe bleibt unverändert).
export function aktualisiereVerlauf(verlauf = {}, typ, warRichtig, heute, maxTage = 60) {
  const tag = tagesSchluessel(heute);
  const next = structuredClone(verlauf);
  const tagObj = next[tag] ?? {};
  const typObj = tagObj[typ] ?? { gesamt: 0, richtig: 0 };
  typObj.gesamt += 1;
  if (warRichtig) typObj.richtig += 1;
  tagObj[typ] = typObj;
  next[tag] = tagObj;

  const grenze = new Date(heute);
  grenze.setDate(grenze.getDate() - (maxTage - 1));
  const grenzeKey = tagesSchluessel(grenze);
  for (const key of Object.keys(next)) {
    if (key < grenzeKey) delete next[key];   // YYYY-MM-DD: lexikografisch = chronologisch
  }
  return next;
}

// Aggregiert die Summen-Statistik (statistik[typ] = {gesamt, richtig, zeit_summe_ms}).
export function summen(statistik = {}) {
  const proTyp = Object.entries(statistik).map(([typ, s]) => {
    const gesamt = s.gesamt ?? 0;
    const richtig = s.richtig ?? 0;
    const zeitSumme = s.zeit_summe_ms ?? 0;
    return {
      typ,
      gesamt,
      richtig,
      zeitSumme,
      quote: gesamt ? richtig / gesamt : 0,
      zeitSchnittMs: gesamt ? zeitSumme / gesamt : 0,
    };
  });
  const { gesamt, richtig, zeitSumme } = proTyp.reduce(
    (a, t) => ({
      gesamt:    a.gesamt    + t.gesamt,
      richtig:   a.richtig   + t.richtig,
      zeitSumme: a.zeitSumme + t.zeitSumme,
    }),
    { gesamt: 0, richtig: 0, zeitSumme: 0 },
  );
  return {
    proTyp,
    gesamt,
    richtig,
    quote: gesamt ? richtig / gesamt : 0,
    zeitSchnittMs: gesamt ? zeitSumme / gesamt : 0,
  };
}

// Farbstufe einer Quote für die Balkenfarbe. `leer` bei 0 Aufgaben (neutral statt rot).
export function quoteFarbe(quote, gesamt) {
  if (!gesamt) return 'leer';
  if (quote >= 0.8) return 'gut';
  if (quote >= 0.5) return 'mittel';
  return 'schwach';
}
