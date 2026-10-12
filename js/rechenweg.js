// DOM-Renderer des Rechenwegs: Sprünge auf dem Rechenstrich, Schritt für Schritt.
// Nutzt die pure Logik (rechenweg-schritte.js). Das Bild ist ein SVG, die Farben kommen aus
// den Tokens (rechenweg.css): Zehner blau, Einer orange — wie überall in der App.
import { berechneRechenweg, berechneSchritte } from './rechenweg-schritte.js';

const BREITE = 320, HOEHE = 112, RAND = 36;
const STRICH_Y = 62, ZAHL_Y = 92;

// Der Strich ist nicht maßstäblich (wie der leere Rechenstrich im Heft): Die Halte stehen in
// gleichem Abstand. Minus läuft von rechts nach links, Plus von links nach rechts.
function halteX(i, n, istMinus) {
  const x = RAND + (n === 0 ? 0 : i * (BREITE - 2 * RAND) / n);
  return istMinus ? BREITE - x : x;
}

function halt(x, zahl, { frage = false } = {}) {
  // Volle Zehner sind die Plattformen, auf denen man landet — sie bekommen den blauen Rahmen.
  const plattform = !frage && zahl % 10 === 0;
  const klasse = frage ? 'rw-halt rw-halt--frage' : plattform ? 'rw-halt rw-halt--zehner' : 'rw-halt';
  return `<g class="${klasse}">
    <line x1="${x}" y1="${STRICH_Y - 6}" x2="${x}" y2="${STRICH_Y + 6}" />
    <rect x="${x - 23}" y="${ZAHL_Y - 19}" width="46" height="26" rx="4" />
    <text x="${x}" y="${ZAHL_Y}" text-anchor="middle">${frage ? '?' : zahl}</text>
  </g>`;
}

function bogen(x1, x2, sprung, zeichen) {
  const mitte = (x1 + x2) / 2;
  const farbe = sprung.art === 'zehner' ? 'z' : 'e';
  return `<g class="rw-bogen rw-bogen--${farbe}">
    <path d="M ${x1} ${STRICH_Y} Q ${mitte} ${STRICH_Y - 84} ${x2} ${STRICH_Y}" />
    <text x="${mitte}" y="${STRICH_Y - 46}" text-anchor="middle">${zeichen} ${sprung.um}</text>
  </g>`;
}

// Zeichnet den Strich bis einschließlich Sprung `bis`. Dessen Landung ist das Fragezeichen,
// alle Landungen davor stehen als Zahl da.
function strichSvg(weg, bis) {
  const n = weg.spruenge.length;
  const teile = [`<line class="rw-strich" x1="8" y1="${STRICH_Y}" x2="${BREITE - 8}" y2="${STRICH_Y}" />`];
  teile.push(halt(halteX(0, n, weg.istMinus), weg.start));
  for (let i = 0; i <= bis && i < n; i++) {
    const s = weg.spruenge[i];
    const x1 = halteX(i, n, weg.istMinus), x2 = halteX(i + 1, n, weg.istMinus);
    teile.push(bogen(x1, x2, s, weg.zeichen));
    teile.push(halt(x2, s.ziel, { frage: i === bis }));
  }
  return `<svg class="rw-svg" viewBox="0 0 ${BREITE} ${HOEHE}" role="img" aria-label="Rechenstrich">${teile.join('')}</svg>`;
}

// Rendert den Rechenweg in `container`. Hilfe auf Wunsch (Befund 10.10.2026): Die
// Antwortknöpfe stehen die ganze Zeit darunter — hier gibt es nur vor und zurück.
export function rendereRechenweg(aufgabe, container) {
  const weg = berechneRechenweg(aufgabe);
  const schritte = berechneSchritte(aufgabe);
  let idx = 0;

  function render() {
    const s = schritte[idx];
    const letzter = idx === schritte.length - 1;
    container.innerHTML = `
      <div class="rw">
        <div class="rw-kopf">
          <span class="rw-schritt-nr">Sprung ${idx + 1}/${schritte.length}</span>
          <span class="rw-titel">${s.titel}</span>
        </div>
        ${s.sprungIdx >= 0 ? strichSvg(weg, s.sprungIdx) : ''}
        <div class="rw-text">${s.erklaerung}</div>
        <div class="rw-aktionen">
          ${idx > 0 ? '<button class="rw-zurueck" data-zurueck aria-label="Sprung zurück">◀</button>' : ''}
          ${letzter ? '' : '<button class="rw-weiter" data-weiter>Weiter ▶</button>'}
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
