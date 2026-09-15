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

// Freigabe-Feier nur für frische Anfragen (Befund 15.09.2026): Ein neu eingerichtetes Gerät spielt
// das Familien-Log von vorn ab und bekam jede Freigabe seit Juli noch einmal als Feier — elfmal
// hintereinander „Juhu!". Das Quittieren wird seither gemeldet, für die Altbestände OHNE
// Quittier-Ereignis greift diese Altersgrenze. Ohne lesbaren Zeitstempel wird gefeiert (im
// Zweifel für das Kind).
export const FEIER_MAX_TAGE = 7;
export function istFeierVeraltet(anfrage, jetzt = new Date(), maxTage = FEIER_MAX_TAGE) {
  const t = Date.parse(anfrage?.ts ?? '');
  if (!Number.isFinite(t)) return false;
  return jetzt.getTime() - t > maxTage * 86400000;
}

export function entferneNachStatus(anfragen, status) {
  return (anfragen ?? []).filter(a => a.status !== status);
}
