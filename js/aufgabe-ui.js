import { oeffneModal, schliesseAlleModals } from './modal.js';
import { rendereZehnerhaus, rendereLegehaus } from './wuerfelhaus.js';
import { generierePlusAufgabe } from './aufgaben/plus.js';
import { generiereMalAufgabe } from './aufgaben/mal.js';
import { generiereMengenAufgabe } from './aufgaben/mengen.js';
import { generiereMinusAufgabe } from './aufgaben/minus.js';
import { rendereStellenwert } from './stellenwert.js';
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

let letzteAufgabeKey = null;
function aufgabeKey(a) { return `${a.aufgabentyp}:${a.a}:${a.b}`; }
function istKleinkind(profile) {
  return profile.alter === 'kindergarten' || profile.alter === 'klasse-1';
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

  function generiere() {
    if (typ === 'mal') return generiereMalAufgabe(stufenConfig, pool.mal.distraktoren);
    if (typ === 'mengen') return generiereMengenAufgabe(stufenConfig, pool.mengen.distraktoren);
    if (typ === 'minus') return generiereMinusAufgabe(stufenConfig, pool.minus.distraktoren);
    return generierePlusAufgabe(stufenConfig, pool.plus.distraktoren);
  }
  let aufgabe = generiere();
  // Nicht zweimal hintereinander dieselbe Aufgabe (wirkt sonst monoton).
  for (let v = 0; v < 6 && aufgabeKey(aufgabe) === letzteAufgabeKey; v++) {
    aufgabe = generiere();
  }
  letzteAufgabeKey = aufgabeKey(aufgabe);

  // Mengen & große Zahlen immer als A-Mechanik (kein riesiges Punkte-/Legebild).
  const grosseZahl = aufgabe.a > 20 || aufgabe.b > 20;
  const mechanik = (typ === 'mengen' || grosseZahl) ? 'A' : waehleMechanik(profile.id, typ);

  zeigeAufgabenModal(aufgabe, mechanik, reward, profile, maxStufe);
}

// Welcher Aufgabentyp in der Welt erscheint — abhängig vom Alter des Profils.
// Kindergarten: Mengen. 1. Klasse: Plus/Minus. Klasse 2/3: Plus/Minus/Mal.
function waehleAufgabentyp(profile) {
  if (profile.alter === 'kindergarten') return 'mengen';
  const kannMal = profile.alter === 'klasse-2' || profile.alter === 'klasse-3';
  const r = Math.random();
  if (kannMal) {
    // Gewichtung: mal 40%, plus 30%, minus 30%
    if (r < 0.4) return 'mal';
    return r < 0.7 ? 'plus' : 'minus';
  }
  return r < 0.5 ? 'plus' : 'minus';
}

function zeigeAufgabenModal(aufgabe, mechanik, reward, profile, maxStufe) {
  // Kindergarten + 1. Klasse: App trägt vor, kein Gelesen-Knopf (lernen erst lesen).
  const istKlein = istKleinkind(profile);
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

// Visualisierung für die A-Mechanik (Würfelaugen).
// Plus: zwei Summanden nebeneinander (a + b).
// Mal: wiederholte Addition als Würfelgruppen — 9 · 7 zeigt 7 + 7 + … (9 Gruppen à 7),
//   wörtliche Lesart "a mal b" = a Gruppen mit je b Augen (kein Vertauschen, damit
//   es zur gesprochenen Aufgabe passt). Abwechselnde Farbe macht die Gruppen zählbar.
//   Wird immer gezeigt — auch große Reihen (bewusst, zum Live-Beurteilen).
// Stellenwert-Fall: geführte Schritte statt statischer Visualisierung.
// Greift bei Plus/Minus, wenn zweistellig ODER mit Zehnerübergang/Borgen.
function istStellenwertFall(aufgabe) {
  if (aufgabe.aufgabentyp !== 'plus' && aufgabe.aufgabentyp !== 'minus') return false;
  const zweistellig = aufgabe.a >= 10 || aufgabe.b >= 10;
  const einerA = aufgabe.a % 10, einerB = aufgabe.b % 10;
  const uebergang = aufgabe.aufgabentyp === 'plus' ? (einerA + einerB >= 10) : (einerA < einerB);
  return zweistellig || uebergang;
}

function baueVisualisierung(aufgabe) {
  if (aufgabe.aufgabentyp === 'mal') {
    if (aufgabe.a < 1) return '';
    const gruppen = [];
    for (let i = 0; i < aufgabe.a; i++) {
      gruppen.push(rendereZehnerhaus(aufgabe.b, { farbe: i % 2 === 0 ? 'success' : 'action' }));
    }
    return `<div class="aufgabe__visualisierung">${gruppen.join('<div class="aufgabe__plus">+</div>')}</div>`;
  }
  // Minus zeigt hier kein statisches Bild: zwei Würfelgruppen mit "+" würden eine
  // Addition suggerieren. Sinnvolle zweistellige Minus-Aufgaben laufen über die
  // geführten Stellenwert-Schritte; kleine einstellige brauchen kein Bild.
  if (aufgabe.aufgabentyp !== 'plus') return '';
  // Plus: Bild nur bei kleinen Zahlen — bei großen würde es den Rahmen sprengen.
  if (aufgabe.a > 20 || aufgabe.b > 20) return '';
  return `<div class="aufgabe__visualisierung">${rendereZehnerhaus(aufgabe.a, { farbe: 'success' })}<div class="aufgabe__plus">+</div>${rendereZehnerhaus(aufgabe.b, { farbe: 'action' })}</div>`;
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
  const aufgabenText = `<div class="aufgabe__text">${aufgabe.text}</div>`;

  if (mechanik === 'A') {
    const knoepfe = aufgabe.antwort_optionen.map(opt =>
      `<button class="aufgabe__option" data-wert="${opt}">${opt}</button>`
    ).join('');
    if (istStellenwertFall(aufgabe)) {
      // Optionen zunächst verborgen — werden nach den Schritten (oder per Skip) gezeigt.
      return `
        ${aufgabenText}
        <div class="aufgabe__stellenwert"></div>
        <div class="aufgabe__optionen" hidden>${knoepfe}</div>
        <div class="aufgabe__feedback" hidden></div>
      `;
    }
    const visualisierung = baueVisualisierung(aufgabe);
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
      zeigeErfolg(modal, gegeben, istKleinkind(profile));
      return;
    }
    fehlversuche++;
    if (fehlversuche >= MAX_FEHLVERSUCHE) {
      const zeit_ms = performance.now() - startZeit;
      rapportiereErgebnis(profile.id, aufgabe.aufgabentyp, false, zeit_ms);
      zeigeLoesung(aufgabe, modal, istKleinkind(profile));
      return;
    }
    feedbackZeigen('Versuch es nochmal!', 'fehler');
    if (istKleinkind(profile)) sprich('Versuch es nochmal!');
    inhalt.classList.add('aufgabe--puls-fehler');
    setTimeout(() => inhalt.classList.remove('aufgabe--puls-fehler'), 600);
  }

  if (mechanik === 'A') {
    const swContainer = inhalt.querySelector('.aufgabe__stellenwert');
    if (swContainer) {
      rendereStellenwert(aufgabe, swContainer, {
        onFertig: () => {
          const optionen = inhalt.querySelector('.aufgabe__optionen');
          if (optionen) optionen.hidden = false;
        },
      });
    }
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

function zeigeErfolg(modal, gegeben = [], istKlein = false) {
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
  const weiter = modal.inhalt.querySelector('.modal__close');
  if (istKlein) {
    sprich('Richtig! Super gemacht!');
    weiter.classList.add('modal__close--puls');
  }
  weiter.addEventListener('click', () => modal.schliessen());
}

function zeigeLoesung(aufgabe, modal, istKlein = false) {
  modal.inhalt.querySelector('.aufgabe__inhalt').innerHTML = `
    <div class="aufgabe__loesung">
      <div class="aufgabe__text">${aufgabe.text}</div>
      <div class="aufgabe__loesung-text">Die Lösung ist <strong>${aufgabe.ergebnis}</strong>.</div>
      <p class="aufgabe__loesung-hinweis">Macht nichts — beim nächsten Mal klappt es!</p>
      <button class="modal__close">Weiter</button>
    </div>
  `;
  const weiter = modal.inhalt.querySelector('.modal__close');
  if (istKlein) {
    sprich(`Die Lösung ist ${aufgabe.ergebnis}. Tippe auf Weiter.`);
    weiter.classList.add('modal__close--puls');
  }
  weiter.addEventListener('click', () => modal.schliessen());
}
