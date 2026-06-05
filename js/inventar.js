import { addInventar, getInventar, getCurrentProfile } from './state.js';

const ITEM_DEFS = {
  holz:    { emoji: '🪵', label: 'Holz' },
  stein:   { emoji: '🪨', label: 'Stein' },
  blume:   { emoji: '🌸', label: 'Blume' },
  eisen:   { emoji: '⛏️', label: 'Eisen' },
  diamant: { emoji: '💎', label: 'Diamant' },
};

export function gebeReward(item, anzahl = 1) {
  const profile = getCurrentProfile();
  if (!profile) return;
  addInventar(profile.id, item, anzahl);
  aktualisiereInventarHeader(true);
}

export function rendereInventarHeader() {
  const profile = getCurrentProfile();
  if (!profile) return '';
  const inv = getInventar(profile.id);
  const items = Object.entries(inv).filter(([_, n]) => n > 0);
  if (items.length === 0) return '<div class="inventar inventar--leer">Inventar leer</div>';
  return `
    <div class="inventar">
      ${items.map(([item, n]) => {
        const def = ITEM_DEFS[item] ?? { emoji: '❔', label: item };
        return `<span class="inventar__item" data-item="${item}"><span class="inventar__emoji">${def.emoji}</span><span class="inventar__zahl">${n}</span></span>`;
      }).join('')}
    </div>
  `;
}

export function aktualisiereInventarHeader(wackeln = false) {
  // DOM mit aktuellem Inventar-Stand aktualisieren, optional Wackel-Animation
  const alt = document.querySelector('.inventar');
  if (!alt) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = rendereInventarHeader().trim();
  const neu = tmp.firstElementChild;
  if (!neu) return;
  alt.replaceWith(neu);
  if (wackeln) {
    void neu.offsetWidth; // reflow trick für Re-Animation
    neu.classList.add('inventar--wackelt');
    setTimeout(() => neu.classList.remove('inventar--wackelt'), 700);
  }
}
