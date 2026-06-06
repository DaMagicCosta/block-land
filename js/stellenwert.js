// DOM-Renderer der geführten Stellenwert-Schritte.
// Nutzt die pure Logik (stellenwert-schritte.js) und die Würfel (wuerfelhaus.js).
// Würfel werden per CSS (stellenwert.css) gestapelt (Würfelhaus); Augen-Logik bleibt zentral.
import { berechneSchritte } from './stellenwert-schritte.js';
import { rendereZehnerhaus } from './wuerfelhaus.js';

// Eine Würfelmenge in der jeweiligen Stellenwert-Farbe (ohne Zahl-Label).
function dice(wert, farbe) {
  return `<div class="sw-dice">${rendereZehnerhaus(wert, { farbe, anzahl_anzeigen: false })}</div>`;
}

// Eine ganze Zahl als [Zehner | Einer]-Spaltenblock.
function zahlBlock(z, e) {
  return `<div class="sw-zahl">
    <div class="sw-spalte"><div class="sw-label sw-label--z">Zehner ×10</div>${dice(z, 'zehner')}</div>
    <div class="sw-spalte"><div class="sw-label sw-label--e">Einer</div>${dice(e, 'einer')}</div>
  </div>`;
}

function visualHtml(v) {
  switch (v.typ) {
    case 'zahlen':
      return `<div class="sw-zahlen">${v.zahlen.map(z => zahlBlock(z.z, z.e)).join('<div class="sw-op"></div>')}</div>`;
    case 'einer-summe':
      return `<div class="sw-reihe">${dice(v.einerSumme, 'einer')}</div>`;
    case 'zehner-summe':
      return `<div class="sw-reihe">${dice(v.zehnerSumme, 'zehner')}</div>`;
    case 'buendeln':
      return `<div class="sw-reihe">${dice(1, 'zehner')}<div class="sw-op">+</div>${dice(v.einerRest, 'einer')}</div>`;
    case 'einer-pruefen':
      return `<div class="sw-reihe">${dice(v.einer, 'einer')}</div>`;
    case 'entbuendeln':
      return `<div class="sw-reihe">${zahlBlock(v.zehner, v.einer)}</div>`;
    case 'ergebnis':
      return `<div class="sw-reihe">${dice(v.zehner, 'zehner')}${dice(v.einer, 'einer')}<span class="sw-ergebnis">${v.ergebnis}</span></div>`;
    default:
      return '';
  }
}

// Rendert die geführten Schritte in `container`. Ruft opts.onFertig beim letzten Schritt.
export function rendereStellenwert(aufgabe, container, { onFertig } = {}) {
  const schritte = berechneSchritte(aufgabe);
  let idx = 0;
  let fertigGemeldet = false;

  function fertig() {
    if (fertigGemeldet) return;
    fertigGemeldet = true;
    if (typeof onFertig === 'function') onFertig();
  }

  function render() {
    const s = schritte[idx];
    const letzter = idx === schritte.length - 1;
    container.innerHTML = `
      <div class="sw">
        <div class="sw-kopf">
          <span class="sw-schritt-nr">Schritt ${idx + 1}/${schritte.length}</span>
          <span class="sw-titel">${s.titel}</span>
        </div>
        <div class="sw-visual">${visualHtml(s.visual)}</div>
        <div class="sw-text">${s.erklaerung}</div>
        <div class="sw-aktionen">
          ${letzter
            ? '<button class="sw-weiter" data-fertig>Antworten ▶</button>'
            : '<button class="sw-weiter" data-weiter>Weiter ▶</button>'}
          ${!letzter ? '<button class="sw-skip" data-skip>Ich weiß die Antwort</button>' : ''}
        </div>
      </div>
    `;
    const weiter = container.querySelector('[data-weiter]');
    if (weiter) weiter.addEventListener('click', () => { idx++; render(); });
    const fertigBtn = container.querySelector('[data-fertig]');
    if (fertigBtn) fertigBtn.addEventListener('click', fertig);
    const skip = container.querySelector('[data-skip]');
    if (skip) skip.addEventListener('click', fertig);
  }

  render();
}
