import { oeffneModal, schliesseAlleModals } from './modal.js';
import { rendereZehnerhaus, rendereLegehaus } from './wuerfelhaus.js';
import { generierePlusAufgabe } from './aufgaben/plus.js';
import { generiereMalAufgabe } from './aufgaben/mal.js';
import { generiereMengenAufgabe } from './aufgaben/mengen.js';
import { verteileBelohnung } from './belohnung.js';
import { loadAufgabenPool } from './data.js';
import { waehleMechanik, aktuelleStufe, rapportiereErgebnis } from './adaptiv.js';
import { getCurrentProfile } from './state.js';
import { escapeHtml } from './utils.js';

const MAX_FEHLVERSUCHE = 2;  // Nach 2 Fehlversuchen Lösung zeigen.

function sprich(text) {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch (e) { /* keine Sprachausgabe verfügbar — egal */ }
}

export async function oeffneAufgabe(reward) {
  const profile = getCurrentProfile();
  if (!profile) return;

  let pool;
  try {
    pool = await loadAufgabenPool();
  } catch (err) {
    console.error('[aufgabe-ui] Pool-Load fehlgeschlagen', err);
    return;
  }

  const typ = waehleAufgabentyp(profile);
  const stufe_nr = aktuelleStufe(profile.id, typ);
  const stufenConfig = pool[typ].stufen.find(s => s.nr === stufe_nr) ?? pool[typ].stufen[0];
  const maxStufe = pool[typ].stufen.length;

  let aufgabe;
  if (typ === 'mal') aufgabe = generiereMalAufgabe(stufenConfig, pool.mal.distraktoren);
  else if (typ === 'mengen') aufgabe = generiereMengenAufgabe(stufenConfig, pool.mengen.distraktoren);
  else aufgabe = generierePlusAufgabe(stufenConfig, pool.plus.distraktoren);

  // Mengen & große Zahlen immer als A-Mechanik (kein riesiges Punkte-/Legebild).
  const grosseZahl = aufgabe.a > 20 || aufgabe.b > 20;
  const mechanik = (typ === 'mengen' || grosseZahl) ? 'A' : waehleMechanik(profile.id, typ);

  zeigeAufgabenModal(aufgabe, mechanik, reward, profile, maxStufe);
}

// Welcher Aufgabentyp in der Welt erscheint — abhängig vom Alter des Profils.
// Klasse 2/3: gemischt Plus und Mal. Sonst nur Plus (Mengen für Kindergarten ist Future-Work).
function waehleAufgabentyp(profile) {
  if (profile.alter === 'kindergarten') return 'mengen';
  const kannMal = profile.alter === 'klasse-2' || profile.alter === 'klasse-3';
  if (kannMal && Math.random() < 0.5) return 'mal';
  return 'plus';
}

function zeigeAufgabenModal(aufgabe, mechanik, reward, profile, maxStufe) {
  // Kindergarten + 1. Klasse: App trägt vor, kein Gelesen-Knopf (lernen erst lesen).
  const istKlein = profile.alter === 'kindergarten' || profile.alter === 'klasse-1';
  const modal = oeffneModal({
    klassen: 'modal-backdrop--aufgabe',
    inhaltHtml: `
      <div class="modal modal--aufgabe">
        <div class="aufgabe__vorlesen"${istKlein ? ' hidden' : ''}>
          <div class="aufgabe__mikro">🎤</div>
          <div class="aufgabe__vorlesen-text">
            <div class="aufgabe__vorlesen-label">Lies laut vor:</div>
            <div class="aufgabe__vorlesen-aufgabe">${escapeHtml(aufgabe.vorlese_text)}</div>
          </div>
          <button class="aufgabe__gelesen">✓ Gelesen</button>
        </div>
        <div class="aufgabe__inhalt"${istKlein ? '' : ' hidden'}></div>
      </div>
    `,
  });

  if (!modal) return;

  const inhalt = modal.inhalt.querySelector('.aufgabe__inhalt');

  function starteInhalt() {
    inhalt.innerHTML = baueAufgabeInhalt(aufgabe, mechanik);
    if (istKlein) {
      // Kleine Kinder können noch nicht lesen — Knopf zum erneuten Vortragen.
      const hoeren = document.createElement('button');
      hoeren.className = 'aufgabe__hoeren';
      hoeren.textContent = '🔊 Nochmal hören';
      hoeren.addEventListener('click', () => sprich(aufgabe.vorlese_text));
      inhalt.prepend(hoeren);
    }
    starteAufgabe(aufgabe, mechanik, reward, profile, modal, inhalt, maxStufe);
  }

  if (istKlein) {
    // Kindergarten: nicht selbst lesen lassen — App trägt vor und springt direkt zur Aufgabe.
    sprich(aufgabe.vorlese_text);
    starteInhalt();
    return;
  }

  modal.inhalt.querySelector('.aufgabe__gelesen').addEventListener('click', () => {
    modal.inhalt.querySelector('.aufgabe__vorlesen').hidden = true;
    inhalt.hidden = false;
    starteInhalt();
  });
}

function baueAufgabeInhalt(aufgabe, mechanik) {
  if (aufgabe.aufgabentyp === 'mengen') {
    const wuerfel = rendereZehnerhaus(aufgabe.ziel, { farbe: 'success' });
    const knoepfe = aufgabe.antwort_optionen.map(opt =>
      `<button class="aufgabe__option" data-wert="${opt}">${opt}</button>`
    ).join('');
    return `
      <div class="aufgabe__text">Wie viele?</div>
      <div class="aufgabe__visualisierung">${wuerfel}</div>
      <div class="aufgabe__optionen">${knoepfe}</div>
      <div class="aufgabe__feedback" hidden></div>
    `;
  }
  const operator = aufgabe.aufgabentyp === 'mal' ? '·' : '+';
  const aufgabenText = `<div class="aufgabe__text">${aufgabe.text}</div>`;
  // Punkte-Bild nur bei kleinen Zahlen — bei großen würde es den Rahmen sprengen.
  const zeigeBild = aufgabe.a <= 20 && aufgabe.b <= 20;

  if (mechanik === 'A') {
    const knoepfe = aufgabe.antwort_optionen.map(opt =>
      `<button class="aufgabe__option" data-wert="${opt}">${opt}</button>`
    ).join('');
    const visualisierung = zeigeBild
      ? `<div class="aufgabe__visualisierung">${rendereZehnerhaus(aufgabe.a, { farbe: 'success' })}<div class="aufgabe__plus">${operator}</div>${rendereZehnerhaus(aufgabe.b, { farbe: 'action' })}</div>`
      : '';
    return `
      ${aufgabenText}
      ${visualisierung}
      <div class="aufgabe__optionen">${knoepfe}</div>
      <div class="aufgabe__feedback" hidden></div>
    `;
  }
  // B-Mechanik: Lege-Bereich + Antwort kommt nach Komplettierung
  return `
    ${aufgabenText}
    <div class="aufgabe__legebereich" data-soll="${aufgabe.ergebnis}"></div>
    <div class="aufgabe__optionen" hidden></div>
    <div class="aufgabe__feedback" hidden></div>
  `;
}

function starteAufgabe(aufgabe, mechanik, reward, profile, modal, inhalt, maxStufe) {
  const startZeit = performance.now();
  let fehlversuche = 0;

  function feedbackZeigen(text, klasse) {
    const fb = inhalt.querySelector('.aufgabe__feedback');
    fb.hidden = false;
    fb.className = `aufgabe__feedback aufgabe__feedback--${klasse}`;
    fb.textContent = text;
  }

  function antwortPruefen(wert) {
    const richtig = wert === aufgabe.ergebnis;
    if (richtig) {
      const zeit_ms = performance.now() - startZeit;
      rapportiereErgebnis(profile.id, aufgabe.aufgabentyp, true, zeit_ms);
      const gegeben = verteileBelohnung(aufgabe.stufe, maxStufe, reward.item);
      zeigeErfolg(modal, gegeben);
      return;
    }
    fehlversuche++;
    if (fehlversuche >= MAX_FEHLVERSUCHE) {
      const zeit_ms = performance.now() - startZeit;
      rapportiereErgebnis(profile.id, aufgabe.aufgabentyp, false, zeit_ms);
      zeigeLoesung(aufgabe, modal);
      return;
    }
    feedbackZeigen('Versuch es nochmal!', 'fehler');
    inhalt.classList.add('aufgabe--puls-fehler');
    setTimeout(() => inhalt.classList.remove('aufgabe--puls-fehler'), 600);
  }

  if (mechanik === 'A') {
    inhalt.querySelectorAll('.aufgabe__option').forEach(btn => {
      btn.addEventListener('click', () => antwortPruefen(parseInt(btn.dataset.wert, 10)));
    });
  } else {
    const legeBereich = inhalt.querySelector('.aufgabe__legebereich');
    const sollZahl = parseInt(legeBereich.dataset.soll, 10);
    const stand = rendereLegehaus(sollZahl, legeBereich, (aktuell, gesamt) => {
      if (aktuell === gesamt) {
        const optionen = inhalt.querySelector('.aufgabe__optionen');
        if (optionen.hidden) {
          optionen.hidden = false;
          optionen.innerHTML = aufgabe.antwort_optionen.map(opt =>
            `<button class="aufgabe__option" data-wert="${opt}">${opt}</button>`
          ).join('');
          optionen.querySelectorAll('.aufgabe__option').forEach(btn => {
            btn.addEventListener('click', () => antwortPruefen(parseInt(btn.dataset.wert, 10)));
          });
        }
      }
    });
  }
}

const ITEM_INFO = {
  holz: { e: '🪵', l: 'Holz' },
  stein: { e: '🪨', l: 'Stein' },
  blume: { e: '🌸', l: 'Blume' },
  eisen: { e: '⛏️', l: 'Eisen' },
  diamant: { e: '💎', l: 'Diamant' },
};

function zeigeErfolg(modal, gegeben = []) {
  let inner;
  if (!gegeben.length) {
    // Nichts gefallen -> gefeierte Gratulation (mit Animation).
    inner = `
      <div class="modal modal--erfolg">
        <div class="modal__emoji feier__huepf">🎉</div>
        <div class="feier__konfetti">✨🎊⭐🎉✨</div>
        <div class="modal__titel">RICHTIG!</div>
        <p class="modal__text">Super gemacht!</p>
        <button class="modal__close">Weiter</button>
      </div>
    `;
  } else {
    const items = gegeben.map(it => ITEM_INFO[it] ?? { e: '❔', l: it });
    const emojis = items.map(i => `<span class="feier__item">${i.e}</span>`).join('');
    const labels = items.map(i => i.l).join(' + ');
    inner = `
      <div class="modal modal--erfolg">
        <div class="modal__emoji">${emojis}</div>
        <div class="modal__titel">RICHTIG!</div>
        <p class="modal__text">Du hast <strong>${escapeHtml(labels)}</strong> gefunden!</p>
        <button class="modal__close">Weiter</button>
      </div>
    `;
  }
  modal.inhalt.innerHTML = inner;
  modal.inhalt.querySelector('.modal__close').addEventListener('click', () => modal.schliessen());
}

function zeigeLoesung(aufgabe, modal) {
  modal.inhalt.querySelector('.aufgabe__inhalt').innerHTML = `
    <div class="aufgabe__loesung">
      <div class="aufgabe__text">${aufgabe.text}</div>
      <div class="aufgabe__loesung-text">Die Lösung ist <strong>${aufgabe.ergebnis}</strong>.</div>
      <p class="aufgabe__loesung-hinweis">Macht nichts — beim nächsten Mal klappt es!</p>
      <button class="modal__close">Weiter</button>
    </div>
  `;
  modal.inhalt.querySelector('.modal__close').addEventListener('click', () => modal.schliessen());
}
