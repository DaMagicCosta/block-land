// Würfelhaus: Visualisierung von Mengen als Zehnerhäuser (2 Reihen × 5 Felder).
// Zahlen >= 11 werden als mehrere volle 10er-Häuser + 1 Rest-Haus dargestellt.

export function rendereZehnerhaus(zahl, options = {}) {
  const { farbe = 'success', interaktiv = false, anzahl_anzeigen = true } = options;
  const farbVar = farbe === 'success' ? 'var(--color-success)'
               : farbe === 'action'  ? 'var(--color-action)'
               : 'var(--color-text)';

  const vollHaeuser = Math.floor(zahl / 10);
  const rest = zahl % 10;

  const haeuser = [];
  for (let i = 0; i < vollHaeuser; i++) {
    haeuser.push(rendereEinzelhaus(10, farbVar, interaktiv));
  }
  if (rest > 0 || vollHaeuser === 0) {
    haeuser.push(rendereEinzelhaus(rest, farbVar, interaktiv));
  }

  return `
    <div class="wuerfelhaus" data-zahl="${zahl}">
      ${anzahl_anzeigen ? `<div class="wuerfelhaus__zahl">${zahl}</div>` : ''}
      <div class="wuerfelhaus__haeuser">${haeuser.join('')}</div>
    </div>
  `;
}

function rendereEinzelhaus(gefuellt, farbVar, interaktiv) {
  const punkte = [];
  for (let i = 0; i < 10; i++) {
    const istGefuellt = i < gefuellt;
    const stil = istGefuellt
      ? `background:${farbVar}`
      : `background:transparent;border:1px dashed var(--color-border)`;
    const interaktivAttr = interaktiv ? ` data-punkt-idx="${i}"` : '';
    punkte.push(`<div class="wuerfelhaus__punkt"${interaktivAttr} style="${stil}"></div>`);
  }
  return `<div class="wuerfelhaus__haus">${punkte.join('')}</div>`;
}

// B-Mechanik: leeres Zehnerhaus, Punkte werden durch Klick gefüllt.
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
