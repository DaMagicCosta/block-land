// Pure Logik fürs Aufsage-Protokoll: Idle-Cap, Zeit-Format, Stufen-Label, Eintrag bauen + kappen.
// KEINE DOM-/State-Abhängigkeit (node-testbar). Schwelle INAKTIV_MS gilt für Idle-Cap UND
// Inaktivitäts-Stopp (eine gemeinsame Zahl).

export const INAKTIV_MS = 60000; // 1 Minute

// Eine Pause zwischen zwei Aktionen auf [0, maxMs] klemmen (Weglauf-Schutz).
export function kappeLuecke(lueckeMs, maxMs = INAKTIV_MS) {
  if (!Number.isFinite(lueckeMs) || lueckeMs < 0) return 0;
  return Math.min(lueckeMs, maxMs);
}

// Millisekunden -> "m:ss" (z. B. 80000 -> "1:20").
export function formatDauer(ms) {
  const sek = Math.max(0, Math.round((ms || 0) / 1000));
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function stufeLabel(stufe) {
  if (stufe === 'mitsprechen') return '① Mitsprechen';
  if (stufe === 'auswendig') return '② Auswendig';
  return stufe ?? '—';
}

// Normalisierter Protokoll-Eintrag (negative/fehlende Werte -> 0).
export function neuerEintrag({ datum, reihe, stufe, durchgaenge, zeit_ms }) {
  return {
    datum: datum ?? '',
    reihe: Number(reihe) || 0,
    stufe: stufe === 'auswendig' ? 'auswendig' : 'mitsprechen',
    durchgaenge: Math.max(0, Math.floor(Number(durchgaenge) || 0)),
    zeit_ms: Math.max(0, Math.round(Number(zeit_ms) || 0)),
  };
}

// Eintrag vorne anfügen, auf maxEintraege kappen. NEUES Array (Eingabe unverändert).
export function fuegeEintragHinzu(log, eintrag, maxEintraege = 50) {
  const next = [eintrag, ...(Array.isArray(log) ? log : [])];
  return next.slice(0, maxEintraege);
}
