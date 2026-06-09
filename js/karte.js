// Übersichts-Karte: zeigt die Biome als Stationen, Auswahl setzt das aktive Biom.
// Phase 2: illustrierte SVG-Szene (Wiese/Wald/Höhle/Berg + Pfad) mit Marker-Overlay.
import { getCurrentProfile, getAktivesBiom, setAktivesBiom, getBiomFreigabe, getGesamtErfolge, getOffeneReihen } from './state.js';
import { loadBiomManifest, loadAvatare, loadAufgabenPool } from './data.js';
import { istFrei, naechstesBiom } from './biome-logik.js';
import { escapeHtml } from './utils.js';
import { oeffneModal, schliesseAlleModals } from './modal.js';
import { aktuelleStufe as burgStufeAus } from './burg-logik.js';
import { aktuelleStufe as aufgabenStufe } from './adaptiv.js';
import { rendereBurgSvg } from './burg.js';
import { oeffneTrainer } from './trainer.js';

// Belohnung fürs Trainer-Quiz, wenn der Trainer von der Karte (ohne Biom-Tile) gestartet wird.
const TRAINER_REWARD = { item: 'holz', emoji: '🪵', label: 'Holz' };

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
      <!-- Pfad: Reise von unten nach oben (Klasse für die Figur-Wegfindung) -->
      <path class="karte__pfad" d="M 28 132 C 40 126, 44 118, 50 112 C 57 106, 64 102, 70 98 C 77 84, 36 78, 30 64 C 23 50, 60 40, 68 30"
            fill="none" stroke="#d9c89a" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="2 5" opacity="0.8"/>
      <!-- Boden-Regionen -->
      <ellipse cx="28" cy="130" rx="26" ry="17" fill="#3f6e34"/>
      <!-- Würfel-Teich: Wasser + Seerosen -->
      <ellipse cx="50" cy="111" rx="20" ry="11" fill="#23566a"/>
      <ellipse cx="50" cy="109" rx="15" ry="7" fill="#2f6e86" opacity="0.75"/>
      <circle cx="43" cy="111" r="3" fill="#3f7a4a"/><circle cx="57" cy="113" r="2.5" fill="#3f7a4a"/><circle cx="52" cy="106" r="2" fill="#3f7a4a"/>
      <circle cx="43" cy="110" r="1" fill="#ef89b4"/>
      <path d="M 41 107 q 4 -2 8 0 M 49 114 q 4 -2 8 0" stroke="#bfe3ef" stroke-width="0.6" fill="none" opacity="0.55"/>
      <ellipse cx="70" cy="98" rx="24" ry="16" fill="#2c4f2a"/>
      <ellipse cx="30" cy="64" rx="24" ry="15" fill="#33333d"/>
      <ellipse cx="68" cy="32" rx="26" ry="17" fill="#5b4d3e"/>
      <!-- Wiese: Blumen -->
      <circle cx="47" cy="134" r="2" fill="#ffd166"/><circle cx="37" cy="138" r="2" fill="#ef89b4"/><circle cx="28" cy="124" r="1.6" fill="#ffd166"/>
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

  let manifest, avatare, pool;
  try {
    [manifest, avatare, pool] = await Promise.all([loadBiomManifest(), loadAvatare(), loadAufgabenPool()]);
  } catch (err) {
    container.innerHTML = `<p style="padding:var(--space-xl);color:var(--color-danger)">Karte konnte nicht geladen werden.<br>${escapeHtml(err.message)}</p>`;
    return;
  }

  const freigabe = getBiomFreigabe(profile.id);
  const aktiv = getAktivesBiom(profile.id);
  const offene = getOffeneReihen(profile.id);
  const avatarEmoji = (avatare.find(a => a.id === profile.avatar) || {}).emoji || '🧑';
  const aktivPos = manifest[aktiv]?.kartenposition || { x: 50, y: 50 };
  const burgStufe = burgStufeAus(getGesamtErfolge(profile.id));

  // Fortschritt zum nächsten Land: nur sinnvoll, wenn direkt danach ein gesperrtes Biom liegt
  // (das schaltet frei, sobald das Kind die höchste Stufe des aktuellen Landes meistert).
  const naechstes = naechstesBiom(aktiv);
  const naechstesGesperrt = naechstes && !istFrei(naechstes, freigabe);
  let fortschrittHtml = '';
  if (naechstesGesperrt) {
    const typ = manifest[aktiv]?.aufgabentyp ?? 'plus';
    const maxStufe = pool[typ]?.stufen.length ?? 4;
    const stufe = Math.min(aufgabenStufe(profile.id, typ), maxStufe);
    const proz = Math.round((stufe / maxStufe) * 100);
    const offen = maxStufe - stufe;
    const nm = manifest[naechstes] || {};
    const ziel = `${nm.icon ?? '🔒'} ${escapeHtml(nm.name ?? naechstes)}`;
    const text = offen > 0
      ? `Noch ${offen} ${offen === 1 ? 'Stufe' : 'Stufen'} bis ${ziel}`
      : `Fast geschafft — eine schwere Aufgabe noch, dann öffnet sich ${ziel}!`;
    fortschrittHtml = `
      <div class="karte__fortschritt">
        <div class="karte__fortschritt-text">${text}</div>
        <div class="karte__fortschritt-balken"><div class="karte__fortschritt-fuell" style="width:${proz}%"></div></div>
      </div>`;
  }

  const marker = Object.entries(manifest).map(([id, b]) => {
    const frei = istFrei(id, freigabe);
    const istAktiv = id === aktiv;
    const offenHier = frei && offene.includes(id);
    const klassen = ['karte__biom', `karte__biom--${id}`, frei ? '' : 'karte__biom--gesperrt', istAktiv ? 'karte__biom--aktiv' : '', offenHier ? 'karte__biom--offen' : ''].filter(Boolean).join(' ');
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
      ${fortschrittHtml}
      <div class="karte__feld">
        <div class="karte__szene">
          ${kartenSzene()}
          ${marker}
          <button class="karte__burg" id="karte-burg" style="left:83%;top:84%">
            ${rendereBurgSvg(burgStufe)}
            <span class="karte__burg-label">Meine Burg</span>
          </button>
          <button class="karte__trainer" id="karte-trainer" style="left:15%;top:90%">
            <span class="karte__trainer-icon">🧮</span>
            <span class="karte__trainer-label">Rechen-Trainer</span>
          </button>
          <div class="karte__figur" id="karte-figur" style="left:${aktivPos.x}%;top:${aktivPos.y}%"><span class="karte__figur-emoji">${avatarEmoji}</span></div>
        </div>
      </div>
      <div class="karte__fade" id="karte-fade"></div>
    </div>
  `;

  container.querySelector('#karte-back').addEventListener('click', () => { location.hash = 'welt'; });
  container.querySelector('#karte-burg').addEventListener('click', () => { location.hash = 'burg'; });
  container.querySelector('#karte-trainer').addEventListener('click', () => oeffneTrainer(TRAINER_REWARD));

  const figur = container.querySelector('#karte-figur');
  const fade = container.querySelector('#karte-fade');
  const pfad = container.querySelector('.karte__pfad');
  let unterwegs = false;

  // Pfad-Länge, deren Punkt einem Biom-Punkt am nächsten liegt (viewBox-Koordinaten).
  function laengeFuerPunkt(vbx, vby) {
    const total = pfad.getTotalLength();
    let best = 0, bestD = Infinity;
    for (let l = 0; l <= total; l += total / 240) {
      const p = pfad.getPointAtLength(l);
      const d = (p.x - vbx) ** 2 + (p.y - vby) ** 2;
      if (d < bestD) { bestD = d; best = l; }
    }
    return best;
  }
  // Biom-Position als Pfad-Länge merken (kartenposition in %; viewBox 100×150 → vby = y·1,5).
  const biomLaenge = {};
  if (pfad) {
    for (const [bid, b] of Object.entries(manifest)) {
      biomLaenge[bid] = laengeFuerPunkt(b.kartenposition.x, b.kartenposition.y * 1.5);
    }
  }

  // Figur exakt am Pfad entlang bewegen (JS-gesteuert, Punkt für Punkt), dann onDone().
  function laufeEntlangPfad(vonLen, zuLen, onDone) {
    if (!pfad) { onDone(); return; }
    const dauer = 1100;
    let start = null;
    figur.classList.add('karte__figur--gehen');
    figur.style.transition = 'none'; // Position kommt aus JS, keine CSS-Glättung
    function schritt(ts) {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / dauer);
      const p = pfad.getPointAtLength(vonLen + (zuLen - vonLen) * t);
      figur.style.left = p.x + '%';
      figur.style.top = (p.y / 1.5) + '%';
      if (t < 1) requestAnimationFrame(schritt);
      else onDone();
    }
    requestAnimationFrame(schritt);
  }

  // Figur folgt dem Pfad zum Zielbiom; danach ins Zentrum rücken + knapp versetzt abdunkeln → Welt.
  function wandereUndOeffne(id) {
    if (unterwegs) return;
    unterwegs = true;
    laufeEntlangPfad(biomLaenge[aktiv] ?? 0, biomLaenge[id] ?? 0, () => {
      figur.classList.remove('karte__figur--gehen');
      figur.style.transition = ''; // CSS-Transition aus --final wieder aktiv
      figur.classList.add('karte__figur--final');
      // Figur bleibt auf der Zielinsel stehen (nicht ins Zentrum) und wird dort hervorgehoben.
      const ziel = manifest[id].kartenposition;
      requestAnimationFrame(() => { figur.style.left = ziel.x + '%'; figur.style.top = ziel.y + '%'; });
      setTimeout(() => fade.classList.add('karte__fade--an'), 150);   // knapp versetzt abdunkeln
      setTimeout(() => { setAktivesBiom(profile.id, id); location.hash = 'welt'; }, 800);
    });
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
