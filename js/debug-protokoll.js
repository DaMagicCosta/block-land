// Fehler-Raupe: Aufzeichnung der letzten Schritte und Momentaufnahme beim Melden.
// Spec: docs/superpowers/specs/2026-09-15-fehler-raupe-design.md
// EINZIGER Ort, der mitschreibt. Aktiv nur, solange ein Profil mit debugMeldung gewählt ist
// (Eltern-Bereich → Kinder). Im Eltern-Bereich wird nichts mitgeschrieben (PIN, Schlüssel,
// Namen), und Eingabefelder nie mit Inhalt (siehe beschreibeZiel).
// Grundsatz: Das Protokoll darf den Kind-Flow nie stören — jeder Fehler hier wird verschluckt.
import { getCurrentProfile, getAktivesBiom, getAktiveReihe, getTimer } from './state.js';
import { wirksameKonfig, istNacht, istAbend } from './timer-logik.js';
import { fuegeEintrag, beschreibeZiel, kuerze, FENSTERTEXT_MAX } from './debug-protokoll-logik.js';

let eintraege = [];
const startMs = Date.now();

export function istDebugAktiv() {
  return getCurrentProfile()?.debugMeldung === true;
}

function imElternBereich() {
  return !!document.querySelector('.modal--eltern');
}

function istRaupenTeil(el) {
  return !!el?.closest?.('.debug-raupe, .debug-meldung');
}

export function notiere(art, text) {
  try {
    if (!istDebugAktiv() || imElternBereich()) return;
    eintraege = fuegeEintrag(eintraege, { t: Math.round((Date.now() - startMs) / 1000), art, text: kuerze(text, 160) });
  } catch { /* Protokoll darf nie stören */ }
}

export function starteDebugProtokoll() {
  // Capture-Phase: sieht den Tipp, bevor ein Handler das Element aus dem DOM nimmt.
  document.addEventListener('click', (e) => {
    if (istRaupenTeil(e.target)) return;
    const el = e.target?.closest?.('button, a, input, select, textarea, [data-wert], .welt__tile') ?? e.target;
    if (!el?.tagName) return;
    notiere('tipp', beschreibeZiel({
      tag: el.tagName, klassen: [...(el.classList ?? [])], text: el.textContent, wert: el.dataset?.wert,
    }));
  }, true);
  window.addEventListener('hashchange', () => notiere('wechsel', location.hash || '#auswahl'));
  window.addEventListener('blockland:fensterAuf', (e) => notiere('fenster', `auf: ${e.detail?.name ?? '?'}`));
  window.addEventListener('blockland:fensterZu', (e) => notiere('fenster', `zu: ${e.detail?.name ?? '?'}`));
  window.addEventListener('blockland:timerPhase', () => notiere('himmel', 'Phasenwechsel (Nacht/Sonnenaufgang)'));
  window.addEventListener('error', (e) => {
    const datei = String(e.filename ?? '').split('/').pop();
    notiere('fehler', `${e.message} (${datei}:${e.lineno ?? '?'})`);
  });
  window.addEventListener('unhandledrejection', (e) => notiere('fehler', `Promise: ${e.reason?.message ?? e.reason}`));
}

// Liegt das Element vollständig im sichtbaren Bildschirm? (Befund Mal-Würfel 14.09.2026:
// Knöpfe existierten, lagen aber unter dem Rand.)
function imBild(el) {
  if (!el.isConnected || el.closest('[hidden]')) return false;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  return r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth;
}

// Momentaufnahme — SYNCHRON, damit sie den Bildschirm zeigt, bevor das Meldefenster ihn verdeckt.
export function momentaufnahme() {
  const p = getCurrentProfile();
  let biom = null, reihe = null, timer = null, konfig = null;
  try {
    biom = p ? getAktivesBiom(p.id) : null;
    reihe = p && biom ? getAktiveReihe(p.id, biom) : null;
    timer = p ? getTimer(p.id) : null;
    konfig = p ? wirksameKonfig(p.alter, p.timerKonfig) : null;
  } catch { /* Teilaufnahme genügt */ }
  const fenster = document.querySelector('.modal-backdrop');
  const knoepfe = [...document.querySelectorAll('.modal-backdrop [data-wert]')].slice(0, 12).map(b => ({
    text: kuerze(b.textContent, 40), wert: b.dataset.wert, sichtbar: imBild(b), versteckt: !!b.closest('[hidden]'),
  }));
  let himmel = 'Timer aus';
  if (konfig?.aktiv) himmel = istNacht(timer) ? 'Nacht' : istAbend(timer, konfig) ? 'Abend' : 'Tag';
  return {
    kind: p?.name ?? '',
    alter: p?.alter ?? '',
    bildschirm: location.hash || '#auswahl',
    land: biom ?? '',
    aufgabeText: kuerze(fenster?.querySelector('.aufgabe__text')?.textContent ?? '', 200),
    knoepfe,
    reihe,
    fenster: fenster ? kuerze(fenster.innerText ?? fenster.textContent, FENSTERTEXT_MAX) : '',
    himmel,
    timer,
    bildschirmGroesse: `${window.innerWidth}x${window.innerHeight}`,
    browser: kuerze(navigator.userAgent, 160),
    protokoll: eintraege.map(e => ({ ...e })),
  };
}
