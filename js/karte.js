// Übersichts-Karte: zeigt die Biome als Stationen, Auswahl setzt das aktive Biom.
// Phase 1: funktional + themed (positionierte Marker auf einem stilisierten Hintergrund).
import { getCurrentProfile, getAktivesBiom, setAktivesBiom, getBiomFreigabe } from './state.js';
import { loadBiomManifest } from './data.js';
import { istFrei } from './biome-logik.js';
import { escapeHtml } from './utils.js';
import { oeffneModal, schliesseAlleModals } from './modal.js';

export async function renderKarte(container) {
  schliesseAlleModals();
  const profile = getCurrentProfile();
  if (!profile) { location.hash = 'auswahl'; return; }

  let manifest;
  try {
    manifest = await loadBiomManifest();
  } catch (err) {
    container.innerHTML = `<p style="padding:var(--space-xl);color:var(--color-danger)">Karte konnte nicht geladen werden.<br>${escapeHtml(err.message)}</p>`;
    return;
  }

  const freigabe = getBiomFreigabe(profile.id);
  const aktiv = getAktivesBiom(profile.id);

  const marker = Object.entries(manifest).map(([id, b]) => {
    const frei = istFrei(id, freigabe);
    const istAktiv = id === aktiv;
    const klassen = ['karte__biom', frei ? '' : 'karte__biom--gesperrt', istAktiv ? 'karte__biom--aktiv' : ''].filter(Boolean).join(' ');
    return `
      <button class="${klassen}" data-biom="${escapeHtml(id)}" style="left:${b.kartenposition.x}%;top:${b.kartenposition.y}%"
              data-frei="${frei ? '1' : '0'}">
        <span class="karte__icon">${frei ? b.icon : '🔒'}</span>
        <span class="karte__name">${escapeHtml(b.name)}</span>
      </button>`;
  }).join('');

  container.innerHTML = `
    <div class="karte">
      <div class="karte__kopf">
        <button class="karte__back" id="karte-back">← Zurück</button>
        <div class="karte__titel">🗺️ Wähle dein Land</div>
      </div>
      <div class="karte__feld">${marker}</div>
    </div>
  `;

  container.querySelector('#karte-back').addEventListener('click', () => { location.hash = 'welt'; });

  container.querySelectorAll('.karte__biom').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.biom;
      if (btn.dataset.frei === '1') {
        setAktivesBiom(profile.id, id);
        location.hash = 'welt';
      } else {
        oeffneModal({
          inhaltHtml: `
            <div class="modal">
              <div class="modal__emoji">🔒</div>
              <div class="modal__titel">NOCH VERSCHLOSSEN</div>
              <p class="modal__text">Werde im vorigen Land erst richtig gut — dann öffnet sich dieses Land!</p>
              <button class="modal__close">Okay</button>
            </div>`,
        });
        document.querySelector('.modal-backdrop .modal__close')?.addEventListener('click', () => schliesseAlleModals());
      }
    });
  });
}
