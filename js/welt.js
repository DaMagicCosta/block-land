import { getCurrentProfile, setCurrentProfile, getAktivesBiom, getAktiveReihe, getOffeneReihen, getTagesauftrag, markiereTagesauftragBelohnt, getDropChancen } from './state.js';
import { loadAvatare, loadBiom } from './data.js';
import { escapeHtml } from './utils.js';
import { oeffneModal, schliesseAlleModals } from './modal.js';
import { oeffneAufgabe, oeffneRechnen10Auswahl } from './aufgabe-ui.js';
import { oeffneTextaufgabe } from './textaufgabe-ui.js';
import { rendereInventarHeader, gebeReward } from './inventar.js';
import { oeffneTrainer } from './trainer.js';
import { oeffneRezeptbuch } from './werkstatt.js';
import { oeffneElternBereich } from './eltern.js';
import { truhenZiehung } from './tagesauftrag-logik.js';

const TRUHEN_ITEM_INFO = {
  holz: { e: '🪵', l: 'Holz' },
  stein: { e: '🪨', l: 'Stein' },
  blume: { e: '🌸', l: 'Blume' },
  eisen: { e: '⛏️', l: 'Eisen' },
  diamant: { e: '💎', l: 'Diamant' },
};

// Schatztruhen-Modal beim Erfüllen des Tagesauftrags. Zieht + vergibt die Materialien SOFORT
// (nicht erst beim Schließen) und markiert den Auftrag als belohnt, damit ein Re-Render
// (z.B. durchs onClose) keine zweite Truhe öffnet.
function zeigeTruhenModal(profileId, container) {
  const materialien = truhenZiehung(getDropChancen(), Math.random, 3);
  materialien.forEach(item => gebeReward(item, 1));
  markiereTagesauftragBelohnt(profileId);

  const items = materialien.map(it => TRUHEN_ITEM_INFO[it] ?? { e: '❔', l: it });
  const emojis = items.map(i => `<span class="feier__item">${i.e}</span>`).join('');
  const labels = items.map(i => i.l).join(' + ');

  const modal = oeffneModal({
    inhaltHtml: `
      <div class="modal modal--erfolg">
        <div class="modal__emoji feier__huepf">🎁</div>
        <div class="feier__konfetti">✨🎊⭐🎉✨</div>
        <div class="modal__titel">Tagesauftrag geschafft!</div>
        <p class="modal__text">Die Schatztruhe öffnet sich...</p>
        <div class="modal__emoji">${emojis}</div>
        <p class="modal__text">Du hast <strong>${escapeHtml(labels)}</strong> gefunden!</p>
        <button class="modal__close">Super!</button>
      </div>
    `,
    onClose: () => renderWelt(container),
  });
  if (!modal) return;
  modal.inhalt.querySelector('.modal__close').addEventListener('click', () => modal.schliessen());
}

// Würfel-Teich: Arten-Auswahl einmal pro Besuch beim Betreten zeigen (Reset beim Biom-Wechsel).
let teichAuswahlGezeigtFuer = null;

export async function renderWelt(container) {
  schliesseAlleModals();

  const profile = getCurrentProfile();

  if (!profile) {
    location.hash = 'auswahl';
    return;
  }

  const aktivId = getAktivesBiom(profile.id);
  const reihe = getAktiveReihe(profile.id, aktivId);
  const hatReihe = !!reihe;
  const offeneAndere = getOffeneReihen(profile.id).filter(b => b !== aktivId);
  const hatHinweis = offeneAndere.length > 0;
  const auftrag = getTagesauftrag(profile.id);
  const auftragErfuellt = auftrag.fortschritt >= auftrag.ziel && !auftrag.belohnt;
  let biom, avatare;
  try {
    [biom, avatare] = await Promise.all([loadBiom(aktivId), loadAvatare()]);
  } catch (err) {
    container.innerHTML = `
      <div style="padding:var(--space-xl);text-align:center;color:var(--color-danger)">
        <p>Fehler beim Laden der Welt.</p>
        <p style="color:var(--color-text-dim);font-size:var(--font-size-sm);margin-top:var(--space-md)">${escapeHtml(err.message)}</p>
      </div>
    `;
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
    <div class="welt welt--${escapeHtml(aktivId)}">
      <div class="welt__header">
        <div>
          <div class="welt__welt-name">${escapeHtml(profile.weltName)}</div>
          <div class="welt__profil-name">${escapeHtml(profile.name)} · ${escapeHtml(biom.name)}</div>
          ${hatReihe ? `<button class="welt__weiter" id="welt-weiter">▶ Weitermachen — Frage ${reihe.position}/${reihe.laenge}</button>` : ''}
        </div>
        ${rendereInventarHeader()}
        <div class="welt__auftrag${auftragErfuellt ? ' welt__auftrag--erfuellt' : ''}" title="Tagesauftrag">📜 ${auftrag.fortschritt}/${auftrag.ziel}</div>
        <button class="welt__karte-btn${hatHinweis ? ' welt__karte-btn--hinweis' : ''}" id="welt-karte" title="Land wechseln">🗺️</button>
        <button class="welt__rezeptbuch" id="welt-rezeptbuch" title="Werkstatt / Rezeptbuch">📖</button>
        <button class="welt__eltern" id="welt-eltern" title="Eltern-Bereich">⚙️</button>
        <button class="welt__back" id="welt-back">Profil wechseln</button>
      </div>
      <div class="welt__karte" style="grid-template-columns:repeat(${biom.spalten}, var(--track, 1fr))">
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
  container.querySelector('#welt-karte').addEventListener('click', () => { location.hash = 'karte'; });

  const weiterBtn = container.querySelector('#welt-weiter');
  if (weiterBtn) {
    weiterBtn.addEventListener('click', () => oeffneAufgabe(null, { onClose: () => renderWelt(container) }));
  }

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
      if (aktivId === 'rechnen10') oeffneRechnen10Auswahl(typ.reward, { onClose: () => renderWelt(container) });
      else if (aktivId === 'text') oeffneTextaufgabe(typ.reward, { onClose: () => renderWelt(container) });
      else oeffneAufgabe(typ.reward, { onClose: () => renderWelt(container) });
    });
  });

  // Spielfigur ins Sichtfeld scrollen (am Handy ist die Karte breiter als der Screen)
  const figur = container.querySelector('.welt__spielfigur');
  if (figur && figur.scrollIntoView) {
    figur.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  // Tagesauftrag geschafft (und noch nicht abgeholt): Schatztruhe beim Rückkehren in die Welt —
  // NICHT mitten in einer Aufgabe (dieser Punkt läuft nur beim (Re-)Rendern der Welt selbst).
  if (auftragErfuellt) {
    zeigeTruhenModal(profile.id, container);
    return;
  }

  // Würfel-Teich: beim Betreten zuerst die Arten-Auswahl (einmal pro Besuch, kein Loop;
  // bei offener Reihe übernimmt der „▶ Weitermachen"-Knopf das Fortsetzen).
  if (aktivId === 'rechnen10') {
    const ersterBesuch = teichAuswahlGezeigtFuer !== 'rechnen10';
    teichAuswahlGezeigtFuer = 'rechnen10';
    if (ersterBesuch && !hatReihe) {
      const teichReward = Object.values(biom.tile_typen).find(t => t.reward)?.reward
        ?? { item: 'blume', emoji: '🌸', label: 'Blume' };
      oeffneRechnen10Auswahl(teichReward, { onClose: () => renderWelt(container) });
    }
  } else {
    teichAuswahlGezeigtFuer = null;
  }
}
