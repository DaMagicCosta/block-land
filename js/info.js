// ℹ️ Info-Bereich: drei statische Seiten (Über / Eltern-Anleitung / Nachbau).
// Inhalte liegen als pure Daten in js/info-inhalte.js — hier nur Darstellung:
// Seiten-Tabs, <details>-Akkordeons, Querverweise (data-info-ziel), Zurück-Knopf.
import { INFO_SEITEN } from './info-inhalte.js';
import { schliesseAlleModals } from './modal.js';

export function renderInfo(container, seiteId = 'ueber') {
  schliesseAlleModals();
  const seite = INFO_SEITEN.find(s => s.id === seiteId) ?? INFO_SEITEN[0];

  container.innerHTML = `
    <div class="info">
      <div class="info__kopf">
        <button class="info__zurueck">← Zurück</button>
        <h1 class="info__titel">ℹ️ Block-Land</h1>
      </div>
      <div class="info__tabs">
        ${INFO_SEITEN.map(s => `
          <button data-seite="${s.id}" class="${s.id === seite.id ? 'aktiv' : ''}">
            ${s.icon} ${s.tabLabel}
          </button>`).join('')}
      </div>
      <p class="info__intro">${seite.intro}</p>
      ${seite.kapitel.map(k => `
        <details class="info__kapitel"${k.offen ? ' open' : ''}>
          <summary class="info__kapitel-titel">${k.emoji} ${k.titel}</summary>
          <div class="info__kapitel-inhalt">${k.inhaltHtml}</div>
        </details>`).join('')}
    </div>
  `;

  container.querySelectorAll('[data-seite]').forEach(btn =>
    btn.addEventListener('click', () => renderInfo(container, btn.dataset.seite)));

  // Querverweise im Inhalt (z.B. Nachbau → Anleitung) wechseln die Seite in-place.
  container.querySelectorAll('[data-info-ziel]').forEach(link =>
    link.addEventListener('click', (e) => { e.preventDefault(); renderInfo(container, link.dataset.infoZiel); }));

  // „Link kopieren" (Weitergeben-Kapitel): Clipboard-API, kurzes Erfolgs-Feedback am Knopf.
  container.querySelectorAll('[data-kopieren]').forEach(btn =>
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.kopieren);
        btn.textContent = '✓ Kopiert!';
      } catch {
        btn.textContent = 'Kopieren nicht möglich — Link oben markieren';
      }
      setTimeout(() => { btn.textContent = '📋 Link kopieren'; }, 2000);
    }));

  container.querySelector('.info__zurueck').addEventListener('click', () => {
    if (history.length > 1) history.back();
    else location.hash = 'auswahl';
  });
}
