// Würfel-Visualisierung von Mengen als echte Würfel (Augen-Muster 1–5).
// Würfelhaus-Methode / "Kraft der Fünf": Augen gehen nur bis 5; größere Zahlen
// werden als mehrere Würfel dargestellt (volle Fünfer zuerst, dann Rest).
// Das interaktive Lege-Feld (B-Mechanik) bleibt ein Zähl-Raster.

// Augen-Positionen im 3×3-Raster (Index 0..8):
//   0 1 2
//   3 4 5
//   6 7 8
const WUERFEL_AUGEN = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
};

export function rendereZehnerhaus(zahl, options = {}) {
  const { farbe = 'success', anzahl_anzeigen = true } = options;
  const farbVar = farbe === 'success' ? 'var(--color-success)'
               : farbe === 'action'  ? 'var(--color-action)'
               : farbe === 'einer'   ? 'var(--color-einer)'
               : farbe === 'zehner'  ? 'var(--color-zehner)'
               : 'var(--color-text)';

  // Zahl in Würfel mit höchstens 5 Augen aufteilen (volle Fünfer zuerst).
  const werte = [];
  let rest = zahl;
  while (rest > 0) {
    const w = Math.min(5, rest);
    werte.push(w);
    rest -= w;
  }
  if (werte.length === 0) werte.push(0); // 0 -> leerer Würfel

  const wuerfel = werte.map(w => rendereWuerfel(w, farbVar)).join('');

  return `
    <div class="wuerfelhaus" data-zahl="${zahl}">
      ${anzahl_anzeigen ? `<div class="wuerfelhaus__zahl">${zahl}</div>` : ''}
      <div class="wuerfelhaus__haeuser">${wuerfel}</div>
    </div>
  `;
}

function rendereWuerfel(augen, farbVar) {
  const positionen = WUERFEL_AUGEN[augen] ?? [];
  const felder = [];
  for (let i = 0; i < 9; i++) {
    const an = positionen.includes(i);
    const stil = an ? ` style="background:${farbVar}"` : '';
    felder.push(`<div class="wuerfel__auge${an ? ' wuerfel__auge--an' : ''}"${stil}></div>`);
  }
  return `<div class="wuerfel">${felder.join('')}</div>`;
}

// B-Mechanik: leeres Zähl-Raster, Punkte werden durch Klick gefüllt.
// `startGefuellt` = bereits gesetzte (bekannte) Punkte, die nicht zurückgenommen werden können.
export function rendereLegehaus(soll_zahl, container, onChange, { startGefuellt = 0 } = {}) {
  const gesamt_punkte = soll_zahl;
  let aktuell = startGefuellt;

  function aktualisiereAnzeige() {
    container.querySelectorAll('.wuerfelhaus__punkt').forEach((el, idx) => {
      const istBekannt = idx < startGefuellt;
      const istGefuellt = idx < aktuell;
      if (istBekannt) {
        el.style.background = 'var(--color-success)';
        el.style.border = 'none';
      } else if (istGefuellt) {
        el.style.background = 'var(--color-action)';
        el.style.border = 'none';
      } else {
        el.style.background = 'transparent';
        el.style.border = '1px dashed var(--color-border)';
      }
    });
    if (onChange) onChange(aktuell, gesamt_punkte);
  }

  const punkte = [];
  for (let i = 0; i < gesamt_punkte; i++) {
    punkte.push(`<div class="wuerfelhaus__punkt" data-punkt-idx="${i}" style="background:transparent;border:1px dashed var(--color-border)"></div>`);
  }
  const haus_html = [];
  for (let h = 0; h < Math.ceil(gesamt_punkte / 10); h++) {
    const start = h * 10;
    const end = Math.min(start + 10, gesamt_punkte);
    haus_html.push(`<div class="wuerfelhaus__haus">${punkte.slice(start, end).join('')}</div>`);
  }
  container.innerHTML = `
    <div class="wuerfelhaus wuerfelhaus--lege">
      <div class="wuerfelhaus__zahl"><span class="wuerfelhaus__counter">${aktuell}</span> / ${soll_zahl}</div>
      <div class="wuerfelhaus__haeuser">${haus_html.join('')}</div>
    </div>
  `;

  container.querySelectorAll('.wuerfelhaus__punkt').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.punktIdx, 10);
      const neu = idx < aktuell ? idx : idx + 1;
      aktuell = Math.max(startGefuellt, neu);
      aktualisiereAnzeige();
      const counter = container.querySelector('.wuerfelhaus__counter');
      if (counter) counter.textContent = String(aktuell);
    });
  });

  aktualisiereAnzeige();
  return {
    getStand: () => aktuell,
    istKomplett: () => aktuell === gesamt_punkte,
  };
}

// Statisches Punktefeld (in 10er-Häuser gruppiert): erste `gefuellt` Punkte farbig,
// Rest blass/gestrichelt. Für die A-Mechanik der Zerlegungs-/Verliebte-Formen.
export function rendereStatischesFeld(gesamt, gefuellt, options = {}) {
  const { farbe = 'success' } = options;
  const farbVar = farbe === 'action' ? 'var(--color-action)' : 'var(--color-success)';
  const punkte = [];
  for (let i = 0; i < gesamt; i++) {
    const an = i < gefuellt;
    const stil = an
      ? `background:${farbVar}`
      : 'background:transparent;border:1px dashed var(--color-border)';
    punkte.push(`<div class="wuerfelhaus__punkt" style="${stil}"></div>`);
  }
  const haeuser = [];
  for (let h = 0; h < Math.ceil(gesamt / 10); h++) {
    haeuser.push(`<div class="wuerfelhaus__haus">${punkte.slice(h * 10, h * 10 + 10).join('')}</div>`);
  }
  return `<div class="wuerfelhaus wuerfelhaus--statisch"><div class="wuerfelhaus__haeuser">${haeuser.join('')}</div></div>`;
}
