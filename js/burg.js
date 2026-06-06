// Wachsende Burg: SVG je Stufe + eigener Screen mit Fortschritt.
import { getCurrentProfile, getGesamtErfolge } from './state.js';
import { aktuelleStufe, fortschritt } from './burg-logik.js';
import { escapeHtml } from './utils.js';
import { schliesseAlleModals } from './modal.js';

// Bau-Teile je Stufe (kumulativ): Index i wird gezeigt, sobald stufeIdx >= i.
const BURG_TEILE = [
  // 0 Lagerplatz: Holzscheite + Feuer
  '<rect x="14" y="74" width="14" height="4" rx="1" fill="#5a3a22"/><polygon points="21,74 18,67 24,67" fill="#f4a259"/>',
  // 1 Zelt
  '<polygon points="30,78 40,58 50,78" fill="#c25b3a"/><polygon points="38,78 40,58 42,78" fill="#9c4630"/>',
  // 2 Holzhütte
  '<rect x="34" y="60" width="20" height="18" fill="#8a5a30"/><polygon points="32,60 44,50 56,60" fill="#5a3a22"/><rect x="41" y="68" width="6" height="10" fill="#3a2414"/>',
  // 3 Steinturm
  '<rect x="60" y="44" width="16" height="34" fill="#8c8c95"/><rect x="60" y="40" width="4" height="6" fill="#8c8c95"/><rect x="68" y="40" width="4" height="6" fill="#8c8c95"/><rect x="64" y="54" width="8" height="8" fill="#3a2414"/>',
  // 4 Mauern
  '<rect x="20" y="70" width="60" height="8" fill="#9a9aa3"/><rect x="20" y="66" width="4" height="4" fill="#9a9aa3"/><rect x="28" y="66" width="4" height="4" fill="#9a9aa3"/><rect x="36" y="66" width="4" height="4" fill="#9a9aa3"/>',
  // 5 Doppelturm (links)
  '<rect x="22" y="50" width="14" height="28" fill="#8c8c95"/><rect x="22" y="46" width="4" height="6" fill="#8c8c95"/><rect x="30" y="46" width="4" height="6" fill="#8c8c95"/>',
  // 6 Fahne auf dem Steinturm
  '<rect x="67" y="30" width="2" height="14" fill="#caa56a"/><polygon points="69,30 82,34 69,38" fill="#e05a5a"/>',
];

// SVG der Burg für die gegebene Stufe (von Karte und Screen genutzt).
export function rendereBurgSvg(stufeIdx) {
  const teile = BURG_TEILE.filter((_, i) => i <= stufeIdx).join('');
  return `<svg class="burg-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="0" y="78" width="100" height="22" fill="#46733a"/>
    ${teile}
  </svg>`;
}

export function renderBurg(container) {
  schliesseAlleModals();
  const profile = getCurrentProfile();
  if (!profile) { location.hash = 'auswahl'; return; }

  const erfolge = getGesamtErfolge(profile.id);
  const f = fortschritt(erfolge);
  const fortschrittHtml = f.naechsterName
    ? `<div class="burg__balken"><div class="burg__balken-fuell" style="width:${f.prozent}%"></div></div>
       <div class="burg__hinweis">Noch <b>${f.bisNaechste}</b> ${f.bisNaechste === 1 ? 'Erfolg' : 'Erfolge'} bis <b>${escapeHtml(f.naechsterName)}</b></div>`
    : `<div class="burg__hinweis">🎉 Höchste Stufe erreicht!</div>`;

  container.innerHTML = `
    <div class="burg">
      <div class="burg__kopf">
        <button class="burg__back" id="burg-back">← Zurück</button>
        <div class="burg__titel">🏰 ${escapeHtml(profile.name)}s Burg</div>
      </div>
      <div class="burg__buehne">${rendereBurgSvg(f.stufeIdx)}</div>
      <div class="burg__stufe">${escapeHtml(f.name)}</div>
      ${fortschrittHtml}
      <div class="burg__gesamt">Gesamt-Erfolge: <b>${erfolge}</b></div>
    </div>
  `;

  container.querySelector('#burg-back').addEventListener('click', () => { location.hash = 'karte'; });
}
