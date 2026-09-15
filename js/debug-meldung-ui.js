// Fehler-Raupe: Knopf und Meldefenster.
// Spec: docs/superpowers/specs/2026-09-15-fehler-raupe-design.md
// Bewusst NICHT über modal.js: Dort darf nur ein Fenster offen sein (Mehrfach-Guard), das
// Meldefenster muss aber über einer laufenden Aufgabe liegen. Und renderWelt räumt mit
// schliesseAlleModals() jedes .modal-backdrop weg — das Meldefenster hat deshalb eine eigene
// Klasse und Ebene und überlebt ein Neuzeichnen darunter.
import { getCurrentProfile } from './state.js';
import { escapeHtml, istKleinkind, sprich } from './utils.js';
import { GRUENDE, darfMelden, baueKurztext, kappeMeldung } from './debug-protokoll-logik.js';
import { istDebugAktiv, momentaufnahme } from './debug-protokoll.js';
import { meldeFehler, geraetId } from './sync.js';
import { holeAppVersion } from './app-version.js';

let raupe = null;
let offen = null;             // das offene Meldefenster (Element) oder null
let letzteMeldungMs = null;   // Sperre gegen Dauertippen (nur im Speicher, reicht)

function sollSichtbar() {
  const route = location.hash.replace('#', '');
  return istDebugAktiv() && route !== '' && route !== 'auswahl' && !document.querySelector('.modal--eltern');
}

export function aktualisiereRaupe() {
  if (raupe) raupe.hidden = !!offen || !sollSichtbar();
}

export function starteRaupe() {
  raupe = document.createElement('button');
  raupe.type = 'button';
  raupe.className = 'debug-raupe';
  raupe.setAttribute('aria-label', 'Fehler melden');
  raupe.textContent = '🐛';
  raupe.hidden = true;
  raupe.addEventListener('click', aufRaupe);
  document.body.appendChild(raupe);
  ['hashchange', 'blockland:zustandEingespielt', 'blockland:fensterAuf', 'blockland:fensterZu']
    .forEach(ereignis => window.addEventListener(ereignis, aktualisiereRaupe));
  // Profilwahl und Eltern-Schalter ändern den Zustand ohne eigenes Ereignis — günstig nachziehen.
  setInterval(aktualisiereRaupe, 2000);
  aktualisiereRaupe();
}

function escAbfangen(e) {
  if (e.key !== 'Escape') return;
  // Sonst schlösse modal.js zugleich die Aufgabe unter dem Meldefenster.
  e.stopImmediatePropagation();
  e.preventDefault();
  schliesseFenster();
}

function schliesseFenster() {
  if (!offen) return;
  offen.remove();
  offen = null;
  window.removeEventListener('keydown', escAbfangen, true);
  aktualisiereRaupe();
}

function zeigeFenster(html) {
  schliesseFenster();
  const el = document.createElement('div');
  el.className = 'debug-meldung';
  el.innerHTML = `<div class="debug-meldung__karte">${html}</div>`;
  el.addEventListener('click', (e) => { if (e.target.closest('[data-zu]')) schliesseFenster(); });
  document.body.appendChild(el);
  offen = el;
  window.addEventListener('keydown', escAbfangen, true);
  aktualisiereRaupe();
  return el;
}

function aufRaupe() {
  if (offen) return;
  const profile = getCurrentProfile();
  if (!profile) return;
  const klein = istKleinkind(profile);

  if (!darfMelden(letzteMeldungMs, Date.now())) {
    zeigeFenster(`
      <div class="debug-meldung__titel">📨 Deine Meldung ist schon unterwegs!</div>
      <button class="debug-meldung__weiter" data-zu>Weiter</button>`);
    if (klein) sprich('Deine Meldung ist schon unterwegs!');
    return;
  }

  const aufnahme = momentaufnahme();   // SOFORT — bevor das Fenster den Bildschirm verdeckt
  const knoepfe = GRUENDE.map(g => `
    <button class="debug-meldung__grund" data-grund="${g.id}">
      <span class="debug-meldung__emoji">${g.emoji}</span><span>${escapeHtml(g.text)}</span>
    </button>`).join('');
  const el = zeigeFenster(`
    <div class="debug-meldung__titel">🐛 Was ist dir aufgefallen?</div>
    <div class="debug-meldung__gruende">${knoepfe}</div>
    <button class="debug-meldung__abbrechen" data-zu>Doch nicht</button>`);
  if (klein) sprich('Was ist dir aufgefallen?');

  // Kinder, die nicht lesen: erstes Tippen liest vor, erneutes Tippen auf DENSELBEN Knopf wählt.
  let zuletztGehoert = null;
  el.querySelectorAll('[data-grund]').forEach(btn => btn.addEventListener('click', () => {
    const grund = GRUENDE.find(g => g.id === btn.dataset.grund);
    if (!grund) return;
    if (klein && zuletztGehoert !== grund.id) {
      zuletztGehoert = grund.id;
      el.querySelectorAll('[data-grund]').forEach(b => b.classList.toggle('debug-meldung__grund--gehoert', b === btn));
      sprich(`${grund.text}. Tippe nochmal, wenn du das meinst.`);
      return;
    }
    sende(aufnahme, grund, klein);
  }));
}

function zeigeDank(klein) {
  const karte = offen?.querySelector('.debug-meldung__karte');
  if (!karte) return;
  // Nur Dank, kein Material, keine Fundzählung (Entscheidung 15.09.2026): Melden darf keine
  // Leistung werden, und es soll sich nicht lohnen, ohne Fund zu tippen.
  karte.innerHTML = `
    <div class="debug-meldung__feier">🎉</div>
    <div class="debug-meldung__titel">Danke, Fehlerjäger!</div>
    <p class="debug-meldung__text">Mama und Papa schauen es sich an.</p>
    <button class="debug-meldung__weiter" data-zu>Weiter</button>`;
  if (klein) sprich('Danke, Fehlerjäger! Mama und Papa schauen es sich an.');
}

async function sende(aufnahme, grund, klein) {
  letzteMeldungMs = Date.now();
  zeigeDank(klein);
  try {
    const jetzt = new Date();
    const fassung = await holeAppVersion().catch(() => null);
    const meldung = kappeMeldung({
      id: `m_${jetzt.getTime()}_${Math.random().toString(36).slice(2, 7)}`,
      ts: jetzt.toISOString(),
      grund: grund.id,
      geraet: geraetId(),
      fassung: fassung ?? '?',
      ...aufnahme,
    });
    meldung.kurztext = baueKurztext(meldung, jetzt);
    meldeFehler(meldung);
  } catch (err) {
    console.warn('[raupe] Meldung konnte nicht gebaut werden.', err);
  }
}
