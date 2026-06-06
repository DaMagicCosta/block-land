// Übersichts-Karte: zeigt die Biome als Stationen, Auswahl setzt das aktive Biom.
// Phase 2: illustrierte SVG-Szene (Wiese/Wald/Höhle/Berg + Pfad) mit Marker-Overlay.
import { getCurrentProfile, getAktivesBiom, setAktivesBiom, getBiomFreigabe } from './state.js';
import { loadBiomManifest } from './data.js';
import { istFrei } from './biome-logik.js';
import { escapeHtml } from './utils.js';
import { oeffneModal, schliesseAlleModals } from './modal.js';

// Stilisierte Landkarte (Pixel-/Minecraft-Anmutung). viewBox 160×100, per CSS auf
// das Feld gestreckt (preserveAspectRatio="none") — die Biom-Marker (in %) liegen
// dadurch genau auf den Regionen: Wiese ~(19,70), Wald ~(58,45), Höhle ~(99,62), Berg ~(134,30).
function kartenSzene() {
  return `
    <svg class="karte__svg" viewBox="0 0 160 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="sw-himmel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#1b2a3a"/><stop offset="0.55" stop-color="#22343f"/><stop offset="1" stop-color="#1c2a22"/>
        </linearGradient>
      </defs>
      <rect width="160" height="100" fill="url(#sw-himmel)"/>
      <!-- Boden-Regionen -->
      <ellipse cx="22" cy="78" rx="34" ry="22" fill="#3f6e34"/>
      <ellipse cx="58" cy="52" rx="30" ry="20" fill="#2c4f2a"/>
      <ellipse cx="99" cy="68" rx="30" ry="19" fill="#33333d"/>
      <ellipse cx="135" cy="42" rx="30" ry="22" fill="#5b4d3e"/>
      <!-- Pfad zwischen den Ländern -->
      <path d="M 22 76 C 35 84, 48 60, 58 52 C 70 42, 88 74, 99 66 C 116 58, 126 48, 135 40"
            fill="none" stroke="#d9c89a" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1.5 4" opacity="0.85"/>
      <!-- Wiese: Blumen -->
      <circle cx="13" cy="83" r="2" fill="#ffd166"/><circle cx="31" cy="86" r="2" fill="#ef89b4"/><circle cx="24" cy="73" r="1.6" fill="#ffd166"/>
      <!-- Wald: blockige Bäume -->
      <g fill="#1f3a1f"><polygon points="49,56 54,45 59,56"/><polygon points="61,54 66,44 71,54"/></g>
      <rect x="53" y="56" width="2" height="4" fill="#5a3a22"/><rect x="65" y="54" width="2" height="4" fill="#5a3a22"/>
      <!-- Höhle: Eingang + Felsen -->
      <path d="M 94 74 a 6 7 0 0 1 12 0 z" fill="#15151b"/>
      <rect x="107" y="68" width="6" height="6" rx="1" fill="#44444f"/><rect x="87" y="70" width="5" height="5" rx="1" fill="#44444f"/>
      <!-- Berg mit Schneekappe -->
      <polygon points="135,18 151,48 119,48" fill="#6b5a48"/>
      <polygon points="135,18 142,31 128,31" fill="#e8eef2"/>
      <!-- Wolken -->
      <g fill="#ffffff" opacity="0.16"><ellipse cx="40" cy="13" rx="10" ry="4"/><ellipse cx="112" cy="10" rx="12" ry="4.5"/></g>
    </svg>`;
}

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
    const klassen = ['karte__biom', `karte__biom--${id}`, frei ? '' : 'karte__biom--gesperrt', istAktiv ? 'karte__biom--aktiv' : ''].filter(Boolean).join(' ');
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
      <div class="karte__feld">${kartenSzene()}${marker}</div>
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
