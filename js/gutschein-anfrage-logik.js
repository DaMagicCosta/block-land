// Pure Logik für Gutschein-Anfragen (Kind fragt Einlösung an, Eltern entscheiden per Telegram).
// KEINE State-/DOM-Abhängigkeit (node-testbar, siehe tools/check-gutschein-anfrage-logik.mjs).
// Pending-Eintrag: { anfrageId, rezeptId, name, emoji, anzahl, wert, einheit, ts, status }
// status: 'offen' | 'freigegeben' | 'abgelehnt' — Endzustände sind einmalige UI-Zustände.

// Wunsch-Anzahl auf 1..vorhanden klemmen. Nichts vorhanden oder kaputter Wunsch → 0
// (Aufrufer bricht ab — eine Anfrage über 0 Gutscheine ist sinnlos).
export function klemmeAnzahl(wunsch, vorhanden) {
  const n = Number(wunsch);
  const max = Number(vorhanden);
  if (!Number.isFinite(n) || !Number.isFinite(max) || max < 1) return 0;
  return Math.min(max, Math.max(1, Math.round(n)));
}

// Pro-Sorte-Guard: genau eine OFFENE Anfrage je Gutschein-Sorte (Spec, Beschluss 3).
export function hatOffeneAnfrage(anfragen, rezeptId) {
  return (anfragen ?? []).some(a => a.status === 'offen' && a.rezeptId === rezeptId);
}

// Neues Array; idempotent per anfrageId (doppelter Pull/Redelivery ändert nichts).
export function fuegeAnfrageHinzu(anfragen, eintrag) {
  const basis = anfragen ?? [];
  if (basis.some(a => a.anfrageId === eintrag.anfrageId)) return [...basis];
  return [...basis, eintrag];
}

// Neues Array; nur der Eintrag mit der Id bekommt den Status, unbekannte Id → Kopie.
export function setzeAnfrageStatus(anfragen, anfrageId, status) {
  return (anfragen ?? []).map(a => (a.anfrageId === anfrageId ? { ...a, status } : a));
}

export function entferneAnfrage(anfragen, anfrageId) {
  return (anfragen ?? []).filter(a => a.anfrageId !== anfrageId);
}

export function entferneNachStatus(anfragen, status) {
  return (anfragen ?? []).filter(a => a.status !== status);
}
