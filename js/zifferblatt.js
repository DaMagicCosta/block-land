// Darstellung der Uhr im Zeitenland. Analog zu wuerfelhaus.js: eine statische Ansicht für
// Mechanik A (Ablesen) und eine interaktive für Mechanik B (Stellen, siehe Task 3).
// aufgabe-ui.js bekommt dadurch nur Verzweigungspunkte, keine Darstellungslogik.
import { sonnenPositionAmTag } from './aufgaben/uhr.js';

// Winkel in Grad, 12 Uhr = 0, im Uhrzeigersinn.
export function stundenWinkel(minuten) { return ((minuten % 720) / 720) * 360; }
export function minutenWinkel(minuten) { return ((minuten % 60) / 60) * 360; }

function zeigerLinie(winkelGrad, laenge, klasse) {
  const rad = (winkelGrad - 90) * (Math.PI / 180);
  const x = 100 + Math.cos(rad) * laenge;
  const y = 100 + Math.sin(rad) * laenge;
  return `<line class="zifferblatt__zeiger--${klasse}" x1="100" y1="100" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" />`;
}

// Der Himmel ist die eigentliche Lektion: Sonne steigt = erste Runde, Sonne sinkt = zweite.
export function rendereHimmel(minuten) {
  const { x, hoehe, istNacht, istDaemmerung } = sonnenPositionAmTag(minuten);
  const gestirn = istNacht ? '🌙' : '☀️';
  const klasse = istNacht ? ' uhr-himmel--nacht' : (istDaemmerung ? ' uhr-himmel--rand' : '');
  const bottom = 10 + hoehe * 46;
  return `
    <div class="uhr-himmel${klasse}" aria-hidden="true">
      <span class="uhr-himmel__gestirn" style="left:${(x * 100).toFixed(1)}%;bottom:${bottom.toFixed(1)}px">${gestirn}</span>
      <div class="uhr-himmel__boden"></div>
    </div>
  `;
}

export function rendereUhr(minuten, options = {}) {
  const { minutenBeschriftung = true, zeigeHimmel = true } = options;
  const teile = [];

  for (let i = 0; i < 60; i++) {
    const winkel = (i / 60) * 360 - 90;
    const rad = winkel * (Math.PI / 180);
    const voll = i % 5 === 0;
    const r1 = voll ? 78 : 83, r2 = 88;
    teile.push(`<line class="zifferblatt__strich${voll ? ' zifferblatt__strich--voll' : ''}"
      x1="${(100 + Math.cos(rad) * r1).toFixed(1)}" y1="${(100 + Math.sin(rad) * r1).toFixed(1)}"
      x2="${(100 + Math.cos(rad) * r2).toFixed(1)}" y2="${(100 + Math.sin(rad) * r2).toFixed(1)}" />`);
  }

  for (let s = 1; s <= 12; s++) {
    const rad = ((s / 12) * 360 - 90) * (Math.PI / 180);
    teile.push(`<text class="zifferblatt__stundenzahl"
      x="${(100 + Math.cos(rad) * 64).toFixed(1)}" y="${(100 + Math.sin(rad) * 64).toFixed(1)}">${s}</text>`);
  }

  // Die Minuten-Beschriftung ist die HILFE, die das Fehler-Box-Fach ausschleicht
  // (siehe schleifeHilfeAus in aufgabe-ui.js). Zeiger und Himmel sind KEINE Hilfe,
  // sondern die Aufgabe selbst — die bleiben immer.
  if (minutenBeschriftung) {
    for (let s = 1; s <= 12; s++) {
      const rad = ((s / 12) * 360 - 90) * (Math.PI / 180);
      teile.push(`<text class="zifferblatt__minutenzahl"
        x="${(100 + Math.cos(rad) * 95).toFixed(1)}" y="${(100 + Math.sin(rad) * 95).toFixed(1)}">${s * 5}</text>`);
    }
  }

  const svg = `
    <svg class="zifferblatt__svg" viewBox="0 0 200 200" role="img" aria-label="Uhr">
      <circle class="zifferblatt__ring" cx="100" cy="100" r="88" />
      ${teile.join('')}
      ${zeigerLinie(stundenWinkel(minuten), 45, 'stunde')}
      ${zeigerLinie(minutenWinkel(minuten), 70, 'minute')}
      <circle class="zifferblatt__mitte" cx="100" cy="100" r="5" />
    </svg>
  `;

  return `<div class="zifferblatt">${zeigeHimmel ? rendereHimmel(minuten) : ''}${svg}</div>`;
}
