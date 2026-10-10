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
      // Bewusst KEINE Ergebnis-Zahl (Arthur-Befund 18.07.2026: „wie cheaten") — die Würfel
      // zeigen Zehner und Einer, die Zahl muss das Kind selbst zusammensetzen.
      return `<div class="sw-reihe">${dice(v.zehner, 'zehner')}${dice(v.einer, 'einer')}<span class="sw-ergebnis">?</span></div>`;
    default:
      return '';
  }
}

// Rendert die geführten Schritte in `container`. Die Schritte sind Hilfe auf Wunsch
// (Befund 10.10.2026: vor JEDER Antwort gezeigt, kosteten sie fünf bis sechs Tipps je Aufgabe,
// und gerechnet hat die App). Die Antwortknöpfe stehen deshalb die ganze Zeit darunter —
// hier gibt es weder „Antworten" noch „Ich weiß die Antwort", nur vor und zurück.
export function rendereStellenwert(aufgabe, container) {
  const schritte = berechneSchritte(aufgabe);
  let idx = 0;

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
          ${idx > 0 ? '<button class="sw-zurueck" data-zurueck aria-label="Schritt zurück">◀</button>' : ''}
          ${letzter ? '' : '<button class="sw-weiter" data-weiter>Weiter ▶</button>'}
        </div>
      </div>
    `;
    const weiter = container.querySelector('[data-weiter]');
    if (weiter) weiter.addEventListener('click', () => { idx++; render(); });
    const zurueck = container.querySelector('[data-zurueck]');
    if (zurueck) zurueck.addEventListener('click', () => { idx--; render(); });
  }

  render();
}
