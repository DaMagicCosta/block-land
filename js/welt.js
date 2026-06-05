import { getCurrentProfile, setCurrentProfile } from './state.js';
import { loadAvatare, loadBiom } from './data.js';
import { escapeHtml } from './utils.js';
import { oeffneModal, schliesseAlleModals } from './modal.js';
import { oeffneAufgabe } from './aufgabe-ui.js';
import { rendereInventarHeader } from './inventar.js';
import { oeffneTrainer } from './trainer.js';
import { oeffneRezeptbuch } from './werkstatt.js';
import { oeffneElternBereich } from './eltern.js';

export async function renderWelt(container) {
  schliesseAlleModals();

  const profile = getCurrentProfile();

  if (!profile) {
    location.hash = 'auswahl';
    return;
  }

  let biom, avatare;
  try {
    [biom, avatare] = await Promise.all([loadBiom('wald'), loadAvatare()]);
  } catch (err) {
    container.innerHTML = `
      <div style="padding:var(--space-xl);text-align:center;color:var(--color-danger)">
        <p>Fehler beim Laden der Welt.</p>
        <p style="color:var(--color-text-dim);font-size:var(--font-size-sm);margin-top:var(--space-md)">${escapeHtml(err.message)}</p>
      </div>
    `;
    return;
  }

  if (!biom) {
    container.innerHTML = `<p style="padding:var(--space-xl);color:var(--color-danger)">Wald-Biom nicht gefunden.</p>`;
    return;
  }

  const avatarMap = Object.fromEntries(avatare.map(a => [a.id, a.emoji]));
  const spielfigurEmoji = avatarMap[profile.avatar] ?? '❔';

  // spielfigur_start in biome.json ist 1-basiert (Spalte 1 = erste Spalte)
  const startSpalte = biom.spielfigur_start.spalte;
  const startZeile = biom.spielfigur_start.zeile;

  // Tile-Grid bauen
  const tilesHtml = biom.layout.map((zeile, zeilenIdx) => {
    return [...zeile].map((zeichen, spaltenIdx) => {
      const istSpielfigur = (spaltenIdx === startSpalte - 1) && (zeilenIdx === startZeile - 1);
      if (istSpielfigur) {
        return `<div class="welt__tile welt__spielfigur" data-pos="${spaltenIdx},${zeilenIdx}">${spielfigurEmoji}</div>`;
      }
      const typ = biom.tile_typen[zeichen];
      if (!typ) {
        return `<div class="welt__tile" data-pos="${spaltenIdx},${zeilenIdx}">?</div>`;
      }
      const interaktivKlasse = typ.interaktiv ? ' is-interaktiv' : '';
      const interaktivData = typ.interaktiv ? ` data-tile-typ="${escapeHtml(zeichen)}"` : '';
      return `<div class="welt__tile ${escapeHtml(typ.klasse)}${interaktivKlasse}" data-pos="${spaltenIdx},${zeilenIdx}"${interaktivData}>${typ.emoji}</div>`;
    }).join('');
  }).join('');

  container.innerHTML = `
    <div class="welt">
      <div class="welt__header">
        <div>
          <div class="welt__welt-name">${escapeHtml(profile.weltName)}</div>
          <div class="welt__profil-name">${escapeHtml(profile.name)}</div>
        </div>
        ${rendereInventarHeader()}
        <button class="welt__rezeptbuch" id="welt-rezeptbuch" title="Werkstatt / Rezeptbuch">📖</button>
        <button class="welt__eltern" id="welt-eltern" title="Eltern-Bereich">⚙️</button>
        <button class="welt__back" id="welt-back">Profil wechseln</button>
      </div>
      <div class="welt__karte" style="grid-template-columns:repeat(${biom.spalten}, 1fr)">
        ${tilesHtml}
      </div>
    </div>
  `;

  container.querySelector('#welt-back').addEventListener('click', () => {
    setCurrentProfile(null);
    location.hash = 'auswahl';
  });

  container.querySelector('#welt-rezeptbuch').addEventListener('click', () => oeffneRezeptbuch());
  container.querySelector('#welt-eltern').addEventListener('click', () => oeffneElternBereich());

  container.querySelectorAll('.welt__tile.is-interaktiv').forEach(el => {
    el.addEventListener('click', () => {
      const typZeichen = el.dataset.tileTyp;
      const typ = biom.tile_typen[typZeichen];
      if (!typ) return;
      const istVerschlossen = typ.zustand === 'verschlossen';
      if (istVerschlossen) {
        oeffneModal({
          inhaltHtml: `
            <div class="modal">
              <div class="modal__emoji">${typ.emoji}</div>
              <div class="modal__titel">NOCH VERSCHLOSSEN</div>
              <p class="modal__text">Die Höhle ist noch dunkel — hier kannst Du erst rein, wenn Du im Wald genug geübt hast.</p>
              <button class="modal__close">Weiter im Wald</button>
            </div>
          `,
        });
        document.querySelector('.modal-backdrop .modal__close')
          ?.addEventListener('click', () => schliesseAlleModals());
        return;
      }
      if (typ.aktion === 'trainer') {
        oeffneTrainer(typ.reward);
        return;
      }
      if (!typ.reward) return;  // Sicherheitsnetz: interaktive Tiles ohne Reward ignorieren
      oeffneAufgabe(typ.reward);
    });
  });
}
