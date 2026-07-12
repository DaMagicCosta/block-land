// Pure Sitzungs-Cluster-Logik für die Familien-Statistik (Anzeige: js/statistik.js).
// KEINE State-/DOM-Abhängigkeit (node-testbar, siehe tools/check-sitzungs-logik.mjs).
// Schwellen (Spec 2026-07-12): Block-Lücke ≤ 5 Min; ☕ Pause > 5 und ≤ 30 Min;
// > 30 Min = neue Sitzung (zählt nicht als Pause/Wiederaufnahme).

const BLOCK_LUECKE_MIN = 5;
const PAUSE_MAX_MIN = 30;

// 'HH:mm' → Minuten seit 0:00 (kaputte Eingabe → NaN, Aufrufer filtert).
export function minutenVon(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

// Uhrzeiten eines Tages → Blöcke (aktives Üben) + Lücken dazwischen.
// luecken[i] liegt zwischen bloecke[i] und bloecke[i+1]; pause = (5 < minuten ≤ 30).
// Nur echte 'HH:mm' (00-23:00-59) — filtert kaputte Formate wie '10:00:x' aus, BEVOR
// sie unescaped in title-Attribut/Caption landen (js/statistik.js:sitzungenHtml).
const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function clustereTag(zeitenListe) {
  const zeiten = (zeitenListe ?? [])
    .filter(z => HHMM_REGEX.test(z))
    .slice()
    .sort((a, b) => minutenVon(a) - minutenVon(b));
  const bloecke = [];
  const luecken = [];
  for (const z of zeiten) {
    const letzter = bloecke[bloecke.length - 1];
    if (letzter && minutenVon(z) - minutenVon(letzter.ende) <= BLOCK_LUECKE_MIN) {
      letzter.ende = z;
      letzter.anzahl += 1;
    } else {
      if (letzter) {
        const minuten = minutenVon(z) - minutenVon(letzter.ende);
        luecken.push({ minuten, pause: minuten <= PAUSE_MAX_MIN });
      }
      bloecke.push({ start: z, ende: z, anzahl: 1 });
    }
  }
  return { bloecke, luecken };
}

// Kennzahlen über mehrere Tage: ⌀ erste Uhrzeit aktiver Tage, ⌀ Pausen-Länge.
export function sitzungsKennzahlen(zeitenProTag) {
  const tage = Object.values(zeitenProTag ?? {}).map(clustereTag).filter(t => t.bloecke.length);
  if (!tage.length) return { ersterStartMin: null, wiederaufnahmeMin: null };
  const starts = tage.map(t => minutenVon(t.bloecke[0].start));
  const pausen = tage.flatMap(t => t.luecken.filter(l => l.pause).map(l => l.minuten));
  return {
    ersterStartMin: Math.round(starts.reduce((a, b) => a + b, 0) / starts.length),
    wiederaufnahmeMin: pausen.length ? Math.round(pausen.reduce((a, b) => a + b, 0) / pausen.length) : null,
  };
}
