// Werkstatt / Rezeptbuch: Rohstoffe in Belohnungen "bauen" -> Gutscheine.
import { oeffneModal } from './modal.js';
import { getCurrentProfile, getRezepte, getGutscheine, getInventar, kannBauen, baueGutschein } from './state.js';
import { aktualisiereInventarHeader } from './inventar.js';
import { escapeHtml } from './utils.js';

const ITEM_EMOJI = { holz: '🪵', stein: '🪨', blume: '🌸', eisen: '⛏️', diamant: '💎' };

export function oeffneRezeptbuch() {
  const profile = getCurrentProfile();
  if (!profile) return;
  const modal = oeffneModal({
    klassen: 'modal-backdrop--werkstatt',
    inhaltHtml: '<div class="modal modal--werkstatt"></div>',
  });
  if (!modal) return;

  let tab = 'bauen';

  function render() {
    const inv = getInventar(profile.id);
    modal.inhalt.innerHTML = `
      <div class="werkstatt__kopf">🛠️ Werkstatt</div>
      <div class="werkstatt__vorrat">${rendereVorrat(inv)}</div>
      <div class="werkstatt__tabs">
        <button data-tab="bauen" class="${tab === 'bauen' ? 'aktiv' : ''}">📖 Rezepte</button>
        <button data-tab="gutscheine" class="${tab === 'gutscheine' ? 'aktiv' : ''}">🎟️ Gutscheine</button>
      </div>
      <div class="werkstatt__inhalt"></div>
      <button class="werkstatt__schliessen">Fertig</button>
    `;
    const inhalt = modal.inhalt.querySelector('.werkstatt__inhalt');
    if (tab === 'bauen') rendereRezepte(inhalt, profile, render);
    else rendereGutscheine(inhalt, profile);

    modal.inhalt.querySelectorAll('.werkstatt__tabs button').forEach(b => {
      b.addEventListener('click', () => { tab = b.dataset.tab; render(); });
    });
    modal.inhalt.querySelector('.werkstatt__schliessen')
      .addEventListener('click', () => modal.schliessen());
  }

  render();
}

function rendereVorrat(inv) {
  const eintraege = Object.entries(inv).filter(([, n]) => n > 0);
  if (!eintraege.length) {
    return '<span class="werkstatt__leer">Noch keine Rohstoffe — übe in der Welt!</span>';
  }
  return eintraege
    .map(([item, n]) => `<span class="werkstatt__roh">${ITEM_EMOJI[item] ?? '❔'} ${n}</span>`)
    .join('');
}

function kostenText(kosten) {
  return Object.entries(kosten)
    .map(([it, n]) => `${ITEM_EMOJI[it] ?? '❔'}${n}`)
    .join(' ');
}

function rendereRezepte(container, profile, neuRendern) {
  const rezepte = getRezepte().filter(r => r.aktiv);
  const kategorien = [...new Set(rezepte.map(r => r.kategorie))];
  container.innerHTML = kategorien.map(kat => `
    <div class="werkstatt__kategorie">${escapeHtml(kat)}</div>
    <div class="werkstatt__rezepte">
      ${rezepte.filter(r => r.kategorie === kat).map(r => {
        const machbar = kannBauen(profile.id, r.kosten);
        return `
          <div class="werkstatt__rezept${machbar ? '' : ' werkstatt__rezept--gesperrt'}">
            <div class="werkstatt__rezept-name">${r.emoji} ${escapeHtml(r.name)}</div>
            <div class="werkstatt__rezept-kosten">${kostenText(r.kosten)}</div>
            <button class="werkstatt__bauen" data-id="${escapeHtml(r.id)}"${machbar ? '' : ' disabled'}>Bauen</button>
          </div>
        `;
      }).join('')}
    </div>
  `).join('');

  container.querySelectorAll('.werkstatt__bauen').forEach(btn => {
    btn.addEventListener('click', () => {
      const rezept = getRezepte().find(r => r.id === btn.dataset.id);
      if (!rezept) return;
      const gutschein = baueGutschein(profile.id, rezept);
      if (!gutschein) return;
      aktualisiereInventarHeader(true);
      const hinweis = document.createElement('div');
      hinweis.className = 'werkstatt__gebaut';
      hinweis.textContent = `🎉 Gebaut: ${rezept.emoji} ${rezept.name}! Gutschein liegt bereit.`;
      container.prepend(hinweis);
      setTimeout(neuRendern, 1400);
    });
  });
}

function rendereGutscheine(container, profile) {
  const liste = getGutscheine(profile.id);
  if (!liste.length) {
    container.innerHTML = '<div class="werkstatt__leer">Noch keine Gutscheine gebaut.</div>';
    return;
  }
  container.innerHTML = `
    <div class="werkstatt__gutscheine">
      ${liste.slice().reverse().map(g => `
        <div class="werkstatt__gutschein${g.eingeloest ? ' werkstatt__gutschein--weg' : ''}">
          <span>${g.emoji} ${escapeHtml(g.name)}</span>
          <span class="werkstatt__gutschein-status">${g.eingeloest ? 'eingelöst' : 'offen'}</span>
        </div>
      `).join('')}
    </div>
  `;
}
