import { getCurrentProfile, setCurrentProfile, getAktivesBiom, getAktiveReihe, getOffeneReihen, getTagesauftrag, markiereTagesauftragBelohnt, getDropChancen, getTimer, getGutscheinAnfragen, quittiereGutscheinAnfrage } from './state.js';
import { wirksameKonfig, istNacht, istAbend, sonnenAnzeigeProzent, nachtRestMin } from './timer-logik.js';
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

// Schatztruhen-Modal beim Erfüllen des Tagesauftrags. Öffnet ZUERST das Modal (Singleton-
// Guard in modal.js kann null liefern, z.B. wenn bereits ein anderes Modal offen ist) —
// erst wenn das Modal wirklich zustande kam, wird gezogen, belohnt und der Auftrag als
// belohnt markiert. Ohne Modal keine Vergabe/Markierung: der nächste Welt-Render versucht
// es erneut (statt Materialien "ins Leere" zu vergeben, die das Kind nie zu sehen bekommt).
function zeigeTruhenModal(profileId, container) {
  const modal = oeffneModal({
    inhaltHtml: `
      <div class="modal modal--erfolg">
        <div class="modal__emoji feier__huepf">🎁</div>
        <div class="feier__konfetti">✨🎊⭐🎉✨</div>
        <div class="modal__titel">Tagesauftrag geschafft!</div>
        <p class="modal__text">Die Schatztruhe öffnet sich...</p>
        <div class="modal__emoji modal__truhen-inhalt"></div>
        <p class="modal__text modal__truhen-text"></p>
        <button class="modal__close">Super!</button>
      </div>
    `,
    onClose: () => renderWelt(container),
  });
  if (!modal) return;

  const materialien = truhenZiehung(getDropChancen(), Math.random, 3);
  materialien.forEach(item => gebeReward(item, 1));
  markiereTagesauftragBelohnt(profileId);

  const items = materialien.map(it => TRUHEN_ITEM_INFO[it] ?? { e: '❔', l: it });
  const emojis = items.map(i => `<span class="feier__item">${i.e}</span>`).join('');
  const labels = items.map(i => i.l).join(' + ');
  modal.inhalt.querySelector('.modal__truhen-inhalt').innerHTML = emojis;
  modal.inhalt.querySelector('.modal__truhen-text').innerHTML = `Du hast <strong>${escapeHtml(labels)}</strong> gefunden!`;

  modal.inhalt.querySelector('.modal__close').addEventListener('click', () => modal.schliessen());
}

// Telegram-Freigabe angekommen → Feier beim nächsten Welt-Render (Muster Truhen-Modal:
// erst Modal öffnen, nur bei Erfolg quittieren — sonst versucht es der nächste Render erneut).
function zeigeAnfrageFeierModal(profileId, anfrage, container) {
  const summe = (typeof anfrage.wert === 'number' && anfrage.wert > 0)
    ? ` (= ${anfrage.anzahl * anfrage.wert} ${escapeHtml(anfrage.einheit ?? '')})` : '';
  const modal = oeffneModal({
    inhaltHtml: `
      <div class="modal modal--erfolg">
        <div class="modal__emoji feier__huepf">${anfrage.emoji ?? '🎟️'}</div>
        <div class="feier__konfetti">✨🎊⭐🎉✨</div>
        <div class="modal__titel">Freigegeben!</div>
        <p class="modal__text">${anfrage.emoji ?? ''} <strong>${escapeHtml(anfrage.name ?? 'Gutschein')} ×${anfrage.anzahl}</strong>${summe}<br>Viel Spaß!</p>
        <button class="modal__close">Juhu!</button>
      </div>
    `,
    onClose: () => renderWelt(container),
  });
  if (!modal) return;
  quittiereGutscheinAnfrage(profileId, anfrage.anfrageId);
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

  const timer = getTimer(profile.id);
  const timerKonfig = wirksameKonfig(profile.alter, profile.timerKonfig);
  const nachtAktiv = timerKonfig.aktiv && istNacht(timer);
  const abendAktiv = timerKonfig.aktiv && istAbend(timer, timerKonfig);

  // Nacht-Gate: sperrt nur den START von Aufgaben (laufende Aufgaben enden normal).
  // Gibt true zurück, wenn die Nacht den Klick abgefangen hat.
  const nachtGate = () => {
    try {
      const t = getTimer(profile.id);
      if (!(timerKonfig.aktiv && istNacht(t))) return false;
      const modal = oeffneModal({
        inhaltHtml: `
          <div class="welt__schlaf">
            <div class="welt__schlaf-emoji">🌙</div>
            <h2>Block-Land schläft</h2>
            <p>Dein Kopf baut gerade das Gelernte ein — starke Arbeit!</p>
            <p>☀️ In <b>${nachtRestMin(t)} Min</b> geht die Sonne wieder auf.</p>
            <button class="modal__close">Alles klar!</button>
          </div>`,
      });
      modal?.inhalt.querySelector('.modal__close')?.addEventListener('click', () => modal.schliessen());
      return true;
    } catch (err) {
      console.warn('[welt] Nacht-Gate übersprungen.', err);
      return false;   // im Zweifel offen — Timer darf den Kind-Flow nie blockieren
    }
  };

  container.innerHTML = `
    <div class="welt welt--${escapeHtml(aktivId)}${nachtAktiv ? ' welt--nacht' : (abendAktiv ? ' welt--abend' : '')}">
      <div class="welt__header">
        <div>
          <div class="welt__welt-name">${escapeHtml(profile.weltName)}</div>
          <div class="welt__profil-name">${escapeHtml(profile.name)} · ${escapeHtml(biom.name)}</div>
          ${hatReihe ? `<button class="welt__weiter" id="welt-weiter">▶ Weitermachen — Frage ${reihe.position}/${reihe.laenge}</button>` : ''}
        </div>
        ${rendereInventarHeader()}
        <button class="welt__auftrag${auftragErfuellt ? ' welt__auftrag--erfuellt' : ''}" id="welt-auftrag" title="Tagesauftrag">📜 ${auftrag.fortschritt}/${auftrag.ziel}</button>
        <button class="welt__karte-btn${hatHinweis ? ' welt__karte-btn--hinweis' : ''}" id="welt-karte" title="Land wechseln">🗺️</button>
        <button class="welt__rezeptbuch" id="welt-rezeptbuch" title="Werkstatt / Rezeptbuch">📖</button>
        <button class="welt__eltern" id="welt-eltern" title="Eltern-Bereich">⚙️</button>
        <button class="welt__back" id="welt-back">Profil wechseln</button>
      </div>
      ${timerKonfig.aktiv ? `
      <div class="welt__himmel" aria-hidden="true">
        ${nachtAktiv
          ? `<span class="welt__mond">🌙</span><span class="welt__sterne">✦ ✧ ✦ ✧ ✦</span>`
          : `<span class="welt__sonne" style="left:${sonnenAnzeigeProzent(timer, timerKonfig)}%">☀️</span>`}
      </div>` : ''}
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

  // Tafel antippen → kindgerechte Erklärung, was der Tagesauftrag ist (er startet nirgends —
  // jede gelöste Aufgabe zählt; das war ohne Erklärung nicht erkennbar).
  container.querySelector('#welt-auftrag').addEventListener('click', () => {
    const a = getTagesauftrag(profile.id);
    const fertig = a.fortschritt >= a.ziel;
    const modal = oeffneModal({ inhaltHtml: '<div class="modal modal--aufgabe"></div>' });
    if (!modal) return;
    modal.inhalt.innerHTML = `
      <div class="modal__emoji">📜</div>
      <div class="modal__titel">Dein Tagesauftrag</div>
      <p class="welt__auftrag-erklaerung">
        ${fertig
          ? (a.belohnt
              ? 'Heute schon geschafft — super! 🎉<br>Morgen wartet ein neuer Auftrag mit neuer Truhe.'
              : 'Geschafft! Deine Schatztruhe wartet gleich auf Dich! 🎁')
          : `Löse heute <b>${a.ziel} Aufgaben</b> — egal in welchem Land!<br>
             Schon geschafft: <b>${a.fortschritt} von ${a.ziel}</b>.<br>
             Als Belohnung wartet eine Schatztruhe! 🎁`}
      </p>
      <button class="modal__close">Los geht's!</button>
    `;
    modal.inhalt.querySelector('.modal__close').addEventListener('click', () => modal.schliessen());
  });
  // onClose-Callback wie in auswahl.js: Eltern-Korrekturen (z.B. „Sonne jetzt aufgehen lassen")
  // sollen die offene Welt sofort neu rendern, sonst greifen sie in der laufenden Session nicht.
  container.querySelector('#welt-eltern').addEventListener('click', () => oeffneElternBereich(() => renderWelt(container)));
  container.querySelector('#welt-karte').addEventListener('click', () => { location.hash = 'karte'; });

  const weiterBtn = container.querySelector('#welt-weiter');
  if (weiterBtn) {
    weiterBtn.addEventListener('click', () => {
      if (nachtGate()) return;
      oeffneAufgabe(null, { onClose: () => renderWelt(container) });
    });
  }

  container.querySelectorAll('.welt__tile.is-interaktiv').forEach(el => {
    el.addEventListener('click', () => {
      if (nachtGate()) return;
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

  // Freigegebene Gutschein-Anfrage? Feier zeigen (eine pro Render; onClose re-rendert → nächste).
  const freigegeben = getGutscheinAnfragen(profile.id).find(a => a.status === 'freigegeben');
  if (freigegeben) {
    zeigeAnfrageFeierModal(profile.id, freigegeben, container);
    return;
  }

  // Würfel-Teich: beim Betreten zuerst die Arten-Auswahl (einmal pro Besuch, kein Loop;
  // bei offener Reihe übernimmt der „▶ Weitermachen"-Knopf das Fortsetzen).
  if (aktivId === 'rechnen10') {
    const ersterBesuch = teichAuswahlGezeigtFuer !== 'rechnen10';
    if (ersterBesuch && !hatReihe) {
      // Nachts KEIN Auto-Start (still übersprungen, kein Schlaf-Modal — das Kind hat nichts
      // geklickt, die Karte ist bewusst offen und die Welt sichtbar dunkel). Flag bleibt
      // UNGESETZT, damit die Auswahl beim nächsten Betreten nach Nachtende noch kommt.
      if (!nachtAktiv) {
        teichAuswahlGezeigtFuer = 'rechnen10';
        const teichReward = Object.values(biom.tile_typen).find(t => t.reward)?.reward
          ?? { item: 'blume', emoji: '🌸', label: 'Blume' };
        oeffneRechnen10Auswahl(teichReward, { onClose: () => renderWelt(container) });
      }
    } else {
      teichAuswahlGezeigtFuer = 'rechnen10';
    }
  } else {
    teichAuswahlGezeigtFuer = null;
  }

  // Sonne alle 30 s nachführen — Positions-Update direkt am Element, kein Re-Render.
  clearInterval(container.__sonnenIntervall);
  container.__sonnenIntervall = setInterval(() => {
    const sonne = container.querySelector('.welt__sonne');
    if (!sonne) return;
    sonne.style.left = `${sonnenAnzeigeProzent(getTimer(profile.id), timerKonfig)}%`;
  }, 30000);
}
