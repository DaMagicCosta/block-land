// Pure Logik für den Übungs-Timer „Wandernde Sonne": Standards, Phasen, Übergänge.
// KEINE DOM-/State-/fetch-Abhängigkeit (node-testbar, siehe tools/check-timer-logik.mjs).
// Zustand (Profil-Feld `timer`):  { tagSekunden, nachtBis: ISO|null, zuletztAktiv: ISO|null }
// Konfig (Profil-Feld `timerKonfig`): null = Studien-Standard nach Altersstufe.
// Studienbasis (Spec §2): Aufmerksamkeit ≈ Alter × 2–3 Min; 5–7 J. ~15 Min, 7–10 J. ~20 Min;
// deutsche Hausaufgaben-Richtwerte 1./2. Klasse max. 20–30 Min am Stück, ~5 Min Entspannung.

const STANDARDS = {
  'kindergarten': { uebenMin: 10, pauseMin: 5 },
  'klasse-1':     { uebenMin: 15, pauseMin: 5 },
  'klasse-2':     { uebenMin: 20, pauseMin: 5 },
  'klasse-3':     { uebenMin: 25, pauseMin: 5 },
};

export const GRENZEN = { ueben: [5, 45], pause: [3, 15] };

export function standardFuer(alter) {
  const s = STANDARDS[alter] ?? STANDARDS['kindergarten'];
  return { ...s, aktiv: true };
}

function klemme(wert, [min, max], fallback) {
  const n = Number(wert);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

// Wirksame Konfiguration: Eltern-Override (an die Grenzen geklemmt) oder Studien-Standard.
export function wirksameKonfig(alter, timerKonfig) {
  const std = standardFuer(alter);
  if (!timerKonfig) return std;
  return {
    uebenMin: klemme(timerKonfig.uebenMin, GRENZEN.ueben, std.uebenMin),
    pauseMin: klemme(timerKonfig.pauseMin, GRENZEN.pause, std.pauseMin),
    aktiv: timerKonfig.aktiv !== false,
  };
}

export function frischerTag(jetzt = new Date()) {
  return { tagSekunden: 0, nachtBis: null, zuletztAktiv: jetzt.toISOString() };
}

export function istNacht(timer, jetzt = new Date()) {
  return !!(timer?.nachtBis && jetzt < new Date(timer.nachtBis));
}

// 0..1 — Anteil des Tages, den die Sonne gewandert ist.
export function sonnenPosition(timer, konfig) {
  return Math.min(1, (timer?.tagSekunden ?? 0) / (konfig.uebenMin * 60));
}

// Letztes Fünftel des Tages: Abendrot als sanfte Vorwarnung (Spec §5).
export function istAbend(timer, konfig, jetzt = new Date()) {
  return !istNacht(timer, jetzt) && sonnenPosition(timer, konfig) >= 0.8;
}

export function nachtRestMin(timer, jetzt = new Date()) {
  if (!istNacht(timer, jetzt)) return 0;
  return Math.max(1, Math.ceil((new Date(timer.nachtBis) - jetzt) / 60000));
}

// Wieder-Sichtbarwerden / Profil-Öffnen: abgelaufene Nacht ODER Abwesenheit ≥ Pausendauer
// gilt als gemachte Pause → frischer Tag. Sonst REFERENZ-IDENTISCH derselbe timer
// (Aufrufer erkennt „nichts passiert" am ===-Vergleich).
export function wendeAbwesenheitAn(timer, konfig, jetzt = new Date()) {
  if (!timer) return frischerTag(jetzt);
  if (timer.nachtBis && jetzt >= new Date(timer.nachtBis)) return frischerTag(jetzt);
  if (!istNacht(timer, jetzt) && timer.zuletztAktiv
      && (jetzt - new Date(timer.zuletztAktiv)) >= konfig.pauseMin * 60000) {
    return frischerTag(jetzt);
  }
  return timer;
}

// Eine aktive Sekunde (oder deltaSek) Tag-Zeit. Nachts wird nicht getickt.
// nachtBis wird VOR dem Melden fertig bestimmt (Determinismus-Regel des Sync).
export function ticke(timer, konfig, jetzt = new Date(), deltaSek = 1) {
  if (istNacht(timer, jetzt)) return { timer, nachtBegonnen: false };
  const tagSekunden = (timer?.tagSekunden ?? 0) + deltaSek;
  const neu = { tagSekunden, nachtBis: null, zuletztAktiv: jetzt.toISOString() };
  if (tagSekunden >= konfig.uebenMin * 60) {
    neu.nachtBis = new Date(jetzt.getTime() + konfig.pauseMin * 60000).toISOString();
    return { timer: neu, nachtBegonnen: true };
  }
  return { timer: neu, nachtBegonnen: false };
}
