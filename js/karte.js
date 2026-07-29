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
// Stilisierte Landkarte im Hochformat (Pixel-/Minecraft-Anmutung). viewBox 100×300 (doppelte
// Höhe für die vertikal scrollbare Lernreise), per CSS aufs Feld gestreckt (preserveAspectRatio="none").
// Reise von unten (Wiese) nach oben (Dorf), Länder im Zickzack + gleichmäßig verteilt (BIOME_REIHENFOLGE).
// Marker (in %, Region-cy = y%·3): Wiese (28,92), Teich (70,78), Wald (28,64), Höhle (70,50),
// Berg (28,36), Schlucht (70,22), Dorf (28,8).
function kartenSzene() {
  return `
    <svg class="karte__svg" viewBox="0 0 100 300" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="sw-himmel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#21384c"/><stop offset="0.5" stop-color="#243640"/><stop offset="1" stop-color="#1d3320"/>
        </linearGradient>
      </defs>
      <rect width="100" height="300" fill="url(#sw-himmel)"/>
      <!-- Pfad: Reise von unten (Wiese) nach oben (Dorf), durch alle Länder in BIOME_REIHENFOLGE,
           gleichmäßiger Zickzack (Tangenten an Start/Ziel-x je Segment für weiche S-Schwünge). -->
      <path class="karte__pfad" d="M 28 276 C 28 262, 70 248, 70 234 C 70 220, 28 206, 28 192 C 28 178, 70 164, 70 150 C 70 136, 28 122, 28 108 C 28 94, 70 80, 70 66 C 70 52, 28 38, 28 24"
            fill="none" stroke="#d9c89a" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="2 5" opacity="0.8"/>
      <!-- Mengen-Wiese (ganz unten links) -->
      <ellipse cx="28" cy="276" rx="26" ry="15" fill="#3f6e34"/>
      <circle cx="15" cy="280" r="2" fill="#ffd166"/><circle cx="41" cy="281" r="2" fill="#ef89b4"/><circle cx="22" cy="269" r="1.6" fill="#ffd166"/>
      <!-- Würfel-Teich: Wasser + Seerosen (rechts) -->
      <ellipse cx="70" cy="234" rx="20" ry="11" fill="#23566a"/>
      <ellipse cx="70" cy="232" rx="14" ry="6.5" fill="#2f6e86" opacity="0.75"/>
      <circle cx="63" cy="235" r="3" fill="#3f7a4a"/><circle cx="77" cy="236" r="2.5" fill="#3f7a4a"/><circle cx="72" cy="229" r="2" fill="#3f7a4a"/>
      <circle cx="63" cy="234" r="1" fill="#ef89b4"/>
      <path d="M 61 230 q 4 -2 8 0 M 69 237 q 4 -2 8 0" stroke="#bfe3ef" stroke-width="0.6" fill="none" opacity="0.55"/>
      <!-- Plus-Wald (links) -->
      <ellipse cx="28" cy="192" rx="22" ry="14" fill="#2c4f2a"/>
      <g fill="#1f3a1f"><polygon points="19,194 23,184 27,194"/><polygon points="32,192 36,182 40,192"/></g>
      <rect x="22" y="194" width="2" height="4" fill="#5a3a22"/><rect x="35" y="192" width="2" height="4" fill="#5a3a22"/>
      <!-- Minus-Höhle (rechts) -->
      <ellipse cx="70" cy="150" rx="23" ry="14" fill="#33333d"/>
      <path d="M 64 156 a 6 7 0 0 1 12 0 z" fill="#15151b"/>
      <rect x="78" y="150" width="6" height="6" rx="1" fill="#44444f"/><rect x="57" y="152" width="5" height="5" rx="1" fill="#44444f"/>
      <!-- Mal-Berg (links) -->
      <ellipse cx="28" cy="108" rx="26" ry="16" fill="#5b4d3e"/>
      <polygon points="28,89 45,115 11,115" fill="#6b5a48"/>
      <polygon points="28,89 35,101 21,101" fill="#e8eef2"/>
      <!-- Geteilt-Schlucht (rechts): Fels-Insel mit teilender Spalte + Bach (Division-Metapher) -->
      <ellipse cx="70" cy="66" rx="22" ry="12" fill="#3a2f2a"/>
      <polygon points="70,55 65,66 70,77 75,66" fill="#1a130f"/>
      <rect x="69" y="57" width="2" height="18" fill="#2f5b66" opacity="0.85"/>
      <rect x="58" y="64" width="4" height="4" rx="1" fill="#4a3f35"/><rect x="79" y="65" width="3.5" height="3.5" rx="1" fill="#4a3f35"/>
      <!-- Geschichten-Dorf (ganz oben links): warme Dorf-Insel mit Häusern + Brunnen -->
      <ellipse cx="28" cy="24" rx="18" ry="10" fill="#6b5033"/>
      <rect x="19" y="19" width="5" height="4" fill="#8a6a44"/><polygon points="19,19 21.5,14.5 24,19" fill="#a5432f"/>
      <rect x="33" y="21" width="5" height="4" fill="#8a6a44"/><polygon points="33,21 35.5,16.5 38,21" fill="#a5432f"/>
      <circle cx="28" cy="28" r="2" fill="#3a2f2a"/><circle cx="28" cy="28" r="1.2" fill="#5b8a9a"/>
      <!-- Zeitenland (ganz oben rechts, gleichrangig neben dem Dorf): sonnige Insel mit Sonnenuhr + Glockenturm.
           Der Abzweig ist reine Grafik (eigene Klasse) — die Figur läuft nur den Haupt-Pfad (.karte__pfad). -->
      <path class="karte__zweig" d="M 49 45 C 62 40, 70 34, 70 24"
            fill="none" stroke="#d9c89a" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="2 5" opacity="0.8"/>
      <ellipse cx="70" cy="24" rx="18" ry="10" fill="#57683b"/>
      <rect x="76.5" y="15" width="5" height="9" fill="#8a6a44"/><polygon points="76.5,15 79,10.5 81.5,15" fill="#a5432f"/>
      <circle cx="79" cy="17.5" r="1.1" fill="#ffd166"/>
      <ellipse cx="62" cy="26" rx="5.5" ry="3" fill="#cbb27a"/>
      <line x1="62" y1="26" x2="64.5" y2="22" stroke="#5a3a22" stroke-width="1"/>
      <circle cx="59.5" cy="16" r="2.2" fill="#ffd166"/>
      <!-- Wolken, über die ganze Reise verteilt -->
      <g fill="#ffffff" opacity="0.15">
        <ellipse cx="50" cy="255" rx="7" ry="2.6"/>
        <ellipse cx="48" cy="170" rx="7" ry="2.6"/>
        <ellipse cx="50" cy="128" rx="6" ry="2.3"/>
        <ellipse cx="50" cy="45" rx="7" ry="2.6"/>
      </g>
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
          <button class="karte__burg" id="karte-burg" style="left:85%;top:90%">
            ${rendereBurgSvg(burgStufe)}
            <span class="karte__burg-label">Meine Burg</span>
          </button>
          <div class="karte__figur" id="karte-figur" style="left:${aktivPos.x}%;top:${aktivPos.y}%"><span class="karte__figur-emoji">${avatarEmoji}</span></div>
        </div>
      </div>
      <div class="karte__fade" id="karte-fade"></div>
    </div>
  `;

  container.querySelector('#karte-back').addEventListener('click', () => { location.hash = 'welt'; });
  container.querySelector('#karte-burg').addEventListener('click', () => { location.hash = 'burg'; });

  const figur = container.querySelector('#karte-figur');

  // Auto-Scroll beim Öffnen: aktives Biom mittig ins Sichtfeld holen (Reise ist ~2× Viewport-Höhe).
  requestAnimationFrame(() => {
    figur.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
  });

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
  // Biom-Position als Pfad-Länge merken (kartenposition in %; viewBox 100×300 → vby = y·3).
  const biomLaenge = {};
  if (pfad) {
    for (const [bid, b] of Object.entries(manifest)) {
      biomLaenge[bid] = laengeFuerPunkt(b.kartenposition.x, b.kartenposition.y * 3);
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
      figur.style.top = (p.y / 3) + '%';
      if (t < 1) requestAnimationFrame(schritt);
      else onDone();
    }
    requestAnimationFrame(schritt);
  }

  // Figur folgt dem Pfad zum Zielbiom; danach ins Zentrum rücken + knapp versetzt abdunkeln → Welt.
  function wandereUndOeffne(id) {
    if (unterwegs) return;
    unterwegs = true;
    // Kamera folgt der Figur: Zielinsel ins Sichtfeld scrollen, falls sie außerhalb liegt.
    container.querySelector(`.karte__biom[data-biom="${id}"]`)
      ?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
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
