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
// zurück (Eingabe bleibt unverändert). zeit_ms summiert die Antwortzeiten des Tages
// (ältere Einträge ohne das Feld zählen als 0 — ⌀-Zeit erscheint dann als „—").
export function aktualisiereVerlauf(verlauf = {}, typ, warRichtig, heute, maxTage = 60, zeitMs = 0) {
  const tag = tagesSchluessel(heute);
  const next = structuredClone(verlauf);
  const tagObj = next[tag] ?? {};
  const typObj = tagObj[typ] ?? { gesamt: 0, richtig: 0, zeit_ms: 0 };
  typObj.gesamt += 1;
  if (warRichtig) typObj.richtig += 1;
  typObj.zeit_ms = (typObj.zeit_ms ?? 0) + (Number(zeitMs) > 0 ? Math.round(zeitMs) : 0);
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

// Summiert einen Tag (verlauf[key]) über die gewählte Rechenart ('alle' = alle).
function summiereTag(tagObj, typFilter) {
  let gesamt = 0, richtig = 0, zeitMs = 0;
  for (const [typ, s] of Object.entries(tagObj ?? {})) {
    if (typFilter !== 'alle' && typ !== typFilter) continue;
    gesamt += s.gesamt ?? 0;
    richtig += s.richtig ?? 0;
    zeitMs += s.zeit_ms ?? 0;
  }
  return { gesamt, richtig, zeitMs };
}

// Letzte `anzahlTage` Tage, lückenlos, Reihenfolge alt -> neu.
// zeitSchnittMs = ⌀ Antwortzeit pro Aufgabe (0, wenn keine Zeiten erfasst).
export function verlaufTage(verlauf = {}, typFilter = 'alle', anzahlTage = 7, heute) {
  const reihe = [];
  for (let i = anzahlTage - 1; i >= 0; i--) {
    const d = new Date(heute);
    d.setDate(d.getDate() - i);
    const { gesamt, richtig, zeitMs } = summiereTag(verlauf[tagesSchluessel(d)], typFilter);
    reihe.push({
      datum: tagesSchluessel(d),
      label: WOCHENTAG[d.getDay()],
      gesamt,
      richtig,
      quote: gesamt ? richtig / gesamt : 0,
      zeitSchnittMs: gesamt ? zeitMs / gesamt : 0,
    });
  }
  return reihe;
}

// Montag der Woche eines Datums (Mo=Wochenstart).
function montagVon(date) {
  const d = new Date(date);
  const tag = d.getDay();                 // 0=So .. 6=Sa
  const diff = tag === 0 ? 6 : tag - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Letzte `anzahlWochen` Kalenderwochen (Mo-So), Reihenfolge alt -> neu.
export function verlaufWochen(verlauf = {}, typFilter = 'alle', anzahlWochen = 5, heute) {
  const montagDieserWoche = montagVon(heute);
  const reihe = [];
  for (let w = anzahlWochen - 1; w >= 0; w--) {
    const start = new Date(montagDieserWoche);
    start.setDate(start.getDate() - w * 7);
    let gesamt = 0, richtig = 0, zeitMs = 0;
    for (let d = 0; d < 7; d++) {
      const tag = new Date(start);
      tag.setDate(tag.getDate() + d);
      const t = summiereTag(verlauf[tagesSchluessel(tag)], typFilter);
      gesamt += t.gesamt;
      richtig += t.richtig;
      zeitMs += t.zeitMs;
    }
    reihe.push({
      start: tagesSchluessel(start),
      label: `${start.getDate()}.${start.getMonth() + 1}.`,
      gesamt,
      richtig,
      quote: gesamt ? richtig / gesamt : 0,
      zeitSchnittMs: gesamt ? zeitMs / gesamt : 0,
    });
  }
  return reihe;
}
