// Würfel-Visualisierung von Mengen als echte Würfel (Augen-Muster 1–6).
// Zahlen > 6 werden als mehrere Würfel dargestellt (volle Sechser zuerst, dann Rest).
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
  6: [0, 2, 3, 5, 6, 8],
};

export function rendereZehnerhaus(zahl, options = {}) {
  const { farbe = 'success', anzahl_anzeigen = true } = options;
  const farbVar = farbe === 'success' ? 'var(--color-success)'
               : farbe === 'action'  ? 'var(--color-action)'
               : 'var(--color-text)';

  // Zahl in Würfel mit höchstens 6 Augen aufteilen (volle Sechser zuerst).
  const werte = [];
  let rest = zahl;
  while (rest > 0) {
    const w = Math.min(6, rest);
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
// Gibt eine Funktion zurück, die den aktuellen Stand abfragt.
export function rendereLegehaus(soll_zahl, container, onChange) {
  const vollHaeuser = Math.floor(soll_zahl / 10);
  const rest = soll_zahl % 10;
  const gesamt_punkte = vollHaeuser * 10 + rest;

  let aktuell = 0;

  function aktualisiereAnzeige() {
    container.querySelectorAll('.wuerfelhaus__punkt').forEach((el, idx) => {
      const istGefuellt = idx < aktuell;
      el.style.background = istGefuellt ? 'var(--color-action)' : 'transparent';
      el.style.border = istGefuellt ? 'none' : '1px dashed var(--color-border)';
    });
    if (onChange) onChange(aktuell, gesamt_punkte);
  }

  // Aufbau: gesamt_punkte leere Plätze
  const punkte = [];
  for (let i = 0; i < gesamt_punkte; i++) {
    punkte.push(`<div class="wuerfelhaus__punkt" data-punkt-idx="${i}" style="background:transparent;border:1px dashed var(--color-border)"></div>`);
  }
  // In 10er-Häuser gruppieren
  const haus_html = [];
  for (let h = 0; h < Math.ceil(gesamt_punkte / 10); h++) {
    const start = h * 10;
    const end = Math.min(start + 10, gesamt_punkte);
    haus_html.push(`<div class="wuerfelhaus__haus">${punkte.slice(start, end).join('')}</div>`);
  }
  container.innerHTML = `
    <div class="wuerfelhaus wuerfelhaus--lege">
      <div class="wuerfelhaus__zahl"><span class="wuerfelhaus__counter">0</span> / ${soll_zahl}</div>
      <div class="wuerfelhaus__haeuser">${haus_html.join('')}</div>
    </div>
  `;

  container.querySelectorAll('.wuerfelhaus__punkt').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.punktIdx, 10);
      // Klick auf nächsten leeren Punkt: füllt bis dorthin auf. Klick auf gefüllten: zieht zurück.
      aktuell = idx < aktuell ? idx : idx + 1;
      aktualisiereAnzeige();
      const counter = container.querySelector('.wuerfelhaus__counter');
      if (counter) counter.textContent = String(aktuell);
    });
  });

  return {
    getStand: () => aktuell,
    istKomplett: () => aktuell === gesamt_punkte,
  };
}
