// Übersichts-Karte: zeigt die Biome als Stationen, Auswahl setzt das aktive Biom.
// Phase 2: illustrierte SVG-Szene (Wiese/Wald/Höhle/Berg + Pfad) mit Marker-Overlay.
import { getCurrentProfile, getAktivesBiom, setAktivesBiom, getBiomFreigabe } from './state.js';
import { loadBiomManifest, loadAvatare } from './data.js';
import { istFrei } from './biome-logik.js';
import { escapeHtml } from './utils.js';
import { oeffneModal, schliesseAlleModals } from './modal.js';

// Stilisierte Landkarte im Hochformat (Pixel-/Minecraft-Anmutung). viewBox 100×150,
// per CSS aufs Feld gestreckt (preserveAspectRatio="none"). Reise von unten (Wiese) nach
// oben (Berg), Länder im Zickzack verteilt. Die Biom-Marker (in %) liegen genau auf den
// Regionen: Wiese ~(28,85), Wald ~(70,65), Höhle ~(30,43), Berg ~(68,19) in %.
function kartenSzene() {
  return `
    <svg class="karte__svg" viewBox="0 0 100 150" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="sw-himmel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#21384c"/><stop offset="0.5" stop-color="#243640"/><stop offset="1" stop-color="#1d3320"/>
        </linearGradient>
      </defs>
      <rect width="100" height="150" fill="url(#sw-himmel)"/>
      <!-- Pfad: Reise von unten nach oben -->
      <path d="M 28 132 C 46 122, 64 110, 70 98 C 77 84, 36 78, 30 64 C 23 50, 60 40, 68 30"
            fill="none" stroke="#d9c89a" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="2 5" opacity="0.8"/>
      <!-- Boden-Regionen -->
      <ellipse cx="28" cy="130" rx="26" ry="17" fill="#3f6e34"/>
      <ellipse cx="70" cy="98" rx="24" ry="16" fill="#2c4f2a"/>
      <ellipse cx="30" cy="64" rx="24" ry="15" fill="#33333d"/>
      <ellipse cx="68" cy="32" rx="26" ry="17" fill="#5b4d3e"/>
      <!-- Wiese: Blumen -->
      <circle cx="17" cy="136" r="2" fill="#ffd166"/><circle cx="37" cy="138" r="2" fill="#ef89b4"/><circle cx="28" cy="124" r="1.6" fill="#ffd166"/>
      <!-- Wald: blockige Bäume -->
      <g fill="#1f3a1f"><polygon points="60,100 64,90 68,100"/><polygon points="74,98 78,88 82,98"/></g>
      <rect x="63" y="100" width="2" height="4" fill="#5a3a22"/><rect x="77" y="98" width="2" height="4" fill="#5a3a22"/>
      <!-- Höhle: Eingang + Felsen -->
      <path d="M 24 70 a 6 7 0 0 1 12 0 z" fill="#15151b"/>
      <rect x="38" y="64" width="6" height="6" rx="1" fill="#44444f"/><rect x="17" y="66" width="5" height="5" rx="1" fill="#44444f"/>
      <!-- Berg mit Schneekappe -->
      <polygon points="68,10 85,38 51,38" fill="#6b5a48"/>
      <polygon points="68,10 75,22 61,22" fill="#e8eef2"/>
      <!-- Wolken -->
      <g fill="#ffffff" opacity="0.15"><ellipse cx="30" cy="16" rx="9" ry="3.5"/><ellipse cx="78" cy="12" rx="10" ry="4"/></g>
    </svg>`;
}

export async function renderKarte(container) {
  schliesseAlleModals();
  const profile = getCurrentProfile();
  if (!profile) { location.hash = 'auswahl'; return; }

  let manifest, avatare;
  try {
    [manifest, avatare] = await Promise.all([loadBiomManifest(), loadAvatare()]);
  } catch (err) {
    container.innerHTML = `<p style="padding:var(--space-xl);color:var(--color-danger)">Karte konnte nicht geladen werden.<br>${escapeHtml(err.message)}</p>`;
    return;
  }

  const freigabe = getBiomFreigabe(profile.id);
  const aktiv = getAktivesBiom(profile.id);
  const avatarEmoji = (avatare.find(a => a.id === profile.avatar) || {}).emoji || '🧑';
  const aktivPos = manifest[aktiv]?.kartenposition || { x: 50, y: 50 };

  const marker = Object.entries(manifest).map(([id, b]) => {
    const frei = istFrei(id, freigabe);
    const istAktiv = id === aktiv;
    const klassen = ['karte__biom', `karte__biom--${id}`, frei ? '' : 'karte__biom--gesperrt', istAktiv ? 'karte__biom--aktiv' : ''].filter(Boolean).join(' ');
    return `
      <button class="${klassen}" data-biom="${escapeHtml(id)}" style="left:${b.kartenposition.x}%;top:${b.kartenposition.y}%"
              data-frei="${frei ? '1' : '0'}">
        <span class="karte__flagge"><span class="karte__mast"></span><span class="karte__fahne">${frei ? b.icon : '🔒'}</span></span>
        <span class="karte__name">${escapeHtml(b.name)}</span>
      </button>`;
  }).join('');

  container.innerHTML = `
    <div class="karte">
      <div class="karte__kopf">
        <button class="karte__back" id="karte-back">← Zurück</button>
        <div class="karte__titel">🗺️ Wähle dein Land</div>
      </div>
      <div class="karte__feld">
        ${kartenSzene()}
        ${marker}
        <div class="karte__figur" id="karte-figur" style="left:${aktivPos.x}%;top:${aktivPos.y}%"><span class="karte__figur-emoji">${avatarEmoji}</span></div>
      </div>
      <div class="karte__fade" id="karte-fade"></div>
    </div>
  `;

  container.querySelector('#karte-back').addEventListener('click', () => { location.hash = 'welt'; });

  const figur = container.querySelector('#karte-figur');
  const fade = container.querySelector('#karte-fade');
  let unterwegs = false;

  // Figur wandert zum Zielbiom; ERST wenn sie angekommen ist, rückt sie ins Zentrum
  // und der Bildschirm dunkelt (knapp versetzt) ab — dann öffnet die Welt.
  function wandereUndOeffne(id) {
    if (unterwegs) return;
    unterwegs = true;
    const ziel = manifest[id].kartenposition;
    figur.classList.add('karte__figur--gehen');
    requestAnimationFrame(() => {
      figur.style.left = ziel.x + '%';
      figur.style.top = ziel.y + '%';
    });

    let angekommen = false;
    const ankommen = () => {
      if (angekommen) return;
      angekommen = true;
      figur.removeEventListener('transitionend', onEnd);
      // Lauf stoppen, ins Zentrum rücken + hervorheben (über dem Schleier sichtbar).
      figur.classList.remove('karte__figur--gehen');
      figur.classList.add('karte__figur--final');
      requestAnimationFrame(() => { figur.style.left = '50%'; figur.style.top = '50%'; });
      setTimeout(() => fade.classList.add('karte__fade--an'), 150);       // knapp versetzt abdunkeln
      setTimeout(() => { setAktivesBiom(profile.id, id); location.hash = 'welt'; }, 950);
    };
    const onEnd = (e) => { if (e.propertyName === 'left' || e.propertyName === 'top') ankommen(); };
    figur.addEventListener('transitionend', onEnd);
    setTimeout(ankommen, 1300); // Fallback, falls transitionend ausbleibt
  }

  container.querySelectorAll('.karte__biom').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.biom;
      if (btn.dataset.frei !== '1') {
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
        return;
      }
      if (id === aktiv) {
        // Schon hier: kurz abdunkeln, dann direkt in die Welt (kein Wandern nötig).
        if (unterwegs) return;
        unterwegs = true;
        fade.classList.add('karte__fade--an');
        setTimeout(() => { location.hash = 'welt'; }, 350);
        return;
      }
      wandereUndOeffne(id);
    });
  });
}
