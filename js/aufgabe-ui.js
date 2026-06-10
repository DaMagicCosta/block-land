import { oeffneModal, schliesseAlleModals } from './modal.js';
import { rendereZehnerhaus, rendereLegehaus, rendereStatischesFeld } from './wuerfelhaus.js';
import { generierePlusAufgabe } from './aufgaben/plus.js';
import { generiereMalAufgabe } from './aufgaben/mal.js';
import { generiereMengenAufgabe } from './aufgaben/mengen.js';
import { generiereMinusAufgabe } from './aufgaben/minus.js';
import { generiereRechnen10Aufgabe } from './aufgaben/rechnen10.js';
import { rendereStellenwert } from './stellenwert.js';
import { verteileBelohnung } from './belohnung.js';
import { loadAufgabenPool, loadBiomManifest } from './data.js';
import { waehleMechanik, aktuelleStufe, rapportiereErgebnis } from './adaptiv.js';
import { getCurrentProfile, getAktivesBiom, schalteNaechstesBiomFrei, getAktiveReihe, setzeAktiveReihe } from './state.js';
import { reihenLaenge, istReiheFertig, fortschrittPunkte } from './reihe-logik.js';
import { BIOME_REIHENFOLGE, baselineMaxIndex } from './biome-logik.js';
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

// Würfel-Teich: Auswahl beim Betreten — Querbeet (adaptiv) oder gezielt eine Art.
// Läuft schon eine Reihe im Teich, wird sie direkt fortgesetzt (gleiche Art, keine Auswahl).
const RECHNEN10_ARTEN = [
  { label: '🎲 Querbeet', festeStufe: null },
  { label: '① Zerlegen', festeStufe: 1 },
  { label: '② Verliebte Zahlen', festeStufe: 2 },
  { label: '③ Plus & Minus', festeStufe: 3 },
];

export function oeffneRechnen10Auswahl(reward, { onClose } = {}) {
  const profile = getCurrentProfile();
  if (!profile) return;
  if (getAktiveReihe(profile.id, 'rechnen10')) { oeffneAufgabe(reward, { onClose }); return; }

  const knoepfe = RECHNEN10_ARTEN.map((a, i) =>
    `<button class="rechnen10-auswahl__knopf" data-idx="${i}">${a.label}</button>`).join('');
  let gewaehlt = false;
  const modal = oeffneModal({
    klassen: 'modal-backdrop--aufgabe',
    inhaltHtml: `<div class="modal modal--aufgabe"><div class="rechnen10-auswahl">
      <div class="aufgabe__text">Was möchtest du üben?</div>
      <div class="rechnen10-auswahl__knoepfe">${knoepfe}</div>
    </div></div>`,
    onClose: () => { if (!gewaehlt && onClose) onClose(); },
  });
  if (!modal) return;
  modal.inhalt.querySelectorAll('[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const wahl = RECHNEN10_ARTEN[parseInt(btn.dataset.idx, 10)];
      gewaehlt = true;
      modal.schliessen();
      oeffneAufgabe(reward, { onClose, festeStufe: wahl.festeStufe });
    });
  });
}

export async function oeffneAufgabe(reward, { onClose, festeStufe = null } = {}) {
  const profile = getCurrentProfile();
  if (!profile) return;

  let pool, manifest;
  try {
    [pool, manifest] = await Promise.all([loadAufgabenPool(), loadBiomManifest()]);
  } catch (err) {
    console.error('[aufgabe-ui] Laden fehlgeschlagen', err);
    return;
  }

  const aktivBiom = getAktivesBiom(profile.id);
  const typ = manifest[aktivBiom]?.aufgabentyp ?? 'plus';
  const maxStufe = pool[typ].stufen.length;
  let aktiveFesteStufe = festeStufe;

  function einmalGenerieren() {
    const stufe_nr = aktiveFesteStufe ?? aktuelleStufe(profile.id, typ);
    const stufenConfig = pool[typ].stufen.find(s => s.nr === stufe_nr) ?? pool[typ].stufen[0];
    if (typ === 'mal') return generiereMalAufgabe(stufenConfig, pool.mal.distraktoren);
    if (typ === 'mengen') return generiereMengenAufgabe(stufenConfig, pool.mengen.distraktoren);
    if (typ === 'minus') return generiereMinusAufgabe(stufenConfig, pool.minus.distraktoren);
    if (typ === 'rechnen10') return generiereRechnen10Aufgabe(stufenConfig, pool.rechnen10.distraktoren);
    return generierePlusAufgabe(stufenConfig, pool.plus.distraktoren);
  }
  function generiere() {
    let a = einmalGenerieren();
    // Nicht zweimal hintereinander dieselbe Aufgabe (wirkt sonst monoton).
    for (let v = 0; v < 6 && aufgabeKey(a) === letzteAufgabeKey; v++) a = einmalGenerieren();
    letzteAufgabeKey = aufgabeKey(a);
    return a;
  }

  // Laufende Reihe DIESES Bioms fortsetzen, sonst neue starten.
  let reihe = getAktiveReihe(profile.id, aktivBiom);
  if (!reihe) {
    reihe = {
      biom: aktivBiom,
      reward,
      laenge: reihenLaenge(profile.alter),
      position: 1,
      aufgabe: generiere(),
      fehlversuche: 0,
      festeStufe: aktiveFesteStufe,
    };
    setzeAktiveReihe(profile.id, reihe.biom, reihe);
  } else {
    aktiveFesteStufe = reihe.festeStufe ?? null;
  }

  const modal = oeffneModal({
    klassen: 'modal-backdrop--aufgabe',
    inhaltHtml: '<div class="modal modal--aufgabe"></div>',
    onClose,
  });
  if (!modal) return;

  function naechsteFrage() {
    if (istReiheFertig(reihe)) {
      setzeAktiveReihe(profile.id, reihe.biom, null);
      zeigeReiheGeschafft(modal, istKleinkind(profile));
      return;
    }
    reihe.position += 1;
    reihe.aufgabe = generiere();
    reihe.fehlversuche = 0;
    setzeAktiveReihe(profile.id, reihe.biom, reihe);
    rendereFrageInModal(modal, reihe, profile, maxStufe, naechsteFrage);
  }

  rendereFrageInModal(modal, reihe, profile, maxStufe, naechsteFrage);
}

// Baut die Fortschrittspunkte (●●○○) für den Modal-Kopf.
function fortschrittHtml(position, laenge) {
  const punkte = fortschrittPunkte(position, laenge)
    .map(z => `<span class="aufgabe__fortschritt-punkt aufgabe__fortschritt-punkt--${z}"></span>`)
    .join('');
  return `<div class="aufgabe__fortschritt">${punkte}</div>`;
}

// Rendert die aktuelle Frage der Reihe ins (eine) Modal und verdrahtet die Beantwortung.
function rendereFrageInModal(modal, reihe, profile, maxStufe, onWeiter) {
  const aufgabe = reihe.aufgabe;
  const istKlein = istKleinkind(profile);
  const grosseZahl = aufgabe.a > 20 || aufgabe.b > 20;
  const mechanik = (aufgabe.aufgabentyp === 'mengen' || grosseZahl)
    ? 'A'
    : waehleMechanik(profile.id, aufgabe.aufgabentyp);

  modal.inhalt.innerHTML = `
    ${fortschrittHtml(reihe.position, reihe.laenge)}
    <div class="aufgabe__vorlesen"${istKlein ? ' hidden' : ''}>
      <div class="aufgabe__mikro">🎤</div>
      <div class="aufgabe__vorlesen-text">
        <div class="aufgabe__vorlesen-label">Lies laut vor:</div>
        <div class="aufgabe__vorlesen-aufgabe">${escapeHtml(aufgabe.vorlese_text)}</div>
      </div>
      <button class="aufgabe__gelesen">✓ Gelesen</button>
    </div>
    <div class="aufgabe__inhalt"${istKlein ? '' : ' hidden'}></div>
  `;

  const inhalt = modal.inhalt.querySelector('.aufgabe__inhalt');

  function starteInhalt() {
    inhalt.innerHTML = baueAufgabeInhalt(aufgabe, mechanik);
    if (istKlein) {
      const hoeren = document.createElement('button');
      hoeren.className = 'aufgabe__hoeren';
      hoeren.textContent = '🔊 Nochmal hören';
      hoeren.addEventListener('click', () => sprich(aufgabe.vorlese_text));
      inhalt.prepend(hoeren);
    }
    starteAufgabe(reihe, mechanik, profile, modal, inhalt, maxStufe, onWeiter);
  }

  if (istKlein) {
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
  // Plus & Minus: zwei Würfelgruppen nebeneinander, Operator dazwischen (gleiches
  // Bild für beide Rechenarten). Zweistellige/Übergangs-Fälle laufen ohnehin über die
  // geführten Stellenwert-Schritte; hier greift das Bild nur bei kleinen Zahlen.
  if (aufgabe.aufgabentyp !== 'plus' && aufgabe.aufgabentyp !== 'minus') return '';
  if (aufgabe.a > 20 || aufgabe.b > 20) return '';
  const operator = aufgabe.aufgabentyp === 'minus' ? '−' : '+';
  return `<div class="aufgabe__visualisierung">${rendereZehnerhaus(aufgabe.a, { farbe: 'success' })}<div class="aufgabe__plus">${operator}</div>${rendereZehnerhaus(aufgabe.b, { farbe: 'action' })}</div>`;
}

// Render für die rechnen10-Formen zerlegung/verliebte/rechnen (subitizing läuft über den mengen-Zweig).
function baueRechnen10Inhalt(aufgabe, mechanik) {
  const aufgabenText = `<div class="aufgabe__text">${escapeHtml(aufgabe.text)}</div>`;
  const knoepfe = aufgabe.antwort_optionen.map(opt =>
    `<button class="aufgabe__option" data-wert="${opt}">${opt}</button>`).join('');

  // B-Mechanik: Legen. Zerlegung/Verliebte mit vorgefülltem teil_a; Rechnen wie plus/minus.
  if (mechanik === 'B' && (aufgabe.form === 'zerlegung' || aufgabe.form === 'verliebte')) {
    return `
      ${aufgabenText}
      <div class="aufgabe__legebereich" data-soll="${aufgabe.ganze}" data-start="${aufgabe.teil_a}"></div>
      <div class="aufgabe__optionen" hidden></div>
      <div class="aufgabe__feedback" hidden></div>
    `;
  }
  if (mechanik === 'B' && aufgabe.form === 'rechnen') {
    return `
      ${aufgabenText}
      <div class="aufgabe__legebereich" data-soll="${aufgabe.ergebnis}"></div>
      <div class="aufgabe__optionen" hidden></div>
      <div class="aufgabe__feedback" hidden></div>
    `;
  }

  // A-Mechanik: passende Anschauung je Form.
  return `
    ${aufgabenText}
    ${baueRechnen10Visualisierung(aufgabe)}
    <div class="aufgabe__optionen">${knoepfe}</div>
    <div class="aufgabe__feedback" hidden></div>
  `;
}

function baueRechnen10Visualisierung(aufgabe) {
  if (aufgabe.form === 'zerlegung') {
    return `<div class="aufgabe__visualisierung">${rendereStatischesFeld(aufgabe.ganze, aufgabe.teil_a)}</div>`;
  }
  if (aufgabe.form === 'verliebte') {
    return `<div class="aufgabe__visualisierung">${rendereStatischesFeld(10, aufgabe.teil_a)}</div>`;
  }
  if (aufgabe.form === 'rechnen') {
    return `<div class="aufgabe__visualisierung">${rendereZehnerhaus(aufgabe.a, { farbe: 'success' })}<div class="aufgabe__plus">${aufgabe.operator}</div>${rendereZehnerhaus(aufgabe.b, { farbe: 'action' })}</div>`;
  }
  return '';
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
  if (aufgabe.aufgabentyp === 'rechnen10') {
    return baueRechnen10Inhalt(aufgabe, mechanik);
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

function starteAufgabe(reihe, mechanik, profile, modal, inhalt, maxStufe, onWeiter) {
  const aufgabe = reihe.aufgabe;
  const startZeit = performance.now();

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
      rapportiereErgebnis(profile.id, aufgabe.aufgabentyp, true, zeit_ms, { maxStufe, adaptStufe: !reihe.festeStufe });
      // Niveau-Abstufung: in Biomen UNTER der Schulstufe weniger Basis-Drops + kein Premium.
      const biomId = getAktivesBiom(profile.id);
      const delta = baselineMaxIndex(profile.alter) - BIOME_REIHENFOLGE.indexOf(biomId);
      const unterNiveau = delta > 0;
      const biomFaktor = unterNiveau ? Math.max(0.2, 1 - 0.35 * delta) : 1;
      const gegeben = verteileBelohnung(aufgabe.stufe, maxStufe, reihe.reward.item, biomFaktor, !unterNiveau);
      let neuesBiom = null;
      if (aufgabe.stufe === maxStufe) {
        neuesBiom = schalteNaechstesBiomFrei(profile.id, biomId);
      }
      zeigeErfolg(modal, gegeben, istKleinkind(profile), neuesBiom, onWeiter);
      return;
    }
    reihe.fehlversuche++;
    setzeAktiveReihe(profile.id, reihe.biom, reihe);   // Versuchsstand persistieren (Mitten-drin-Verlassen)
    if (reihe.fehlversuche >= MAX_FEHLVERSUCHE) {
      const zeit_ms = performance.now() - startZeit;
      rapportiereErgebnis(profile.id, aufgabe.aufgabentyp, false, zeit_ms, { maxStufe, adaptStufe: !reihe.festeStufe });
      zeigeLoesung(aufgabe, modal, istKleinkind(profile), onWeiter);
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
    const startGefuellt = parseInt(legeBereich.dataset.start ?? '0', 10) || 0;
    rendereLegehaus(sollZahl, legeBereich, (aktuell, gesamt) => {
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
    }, { startGefuellt });
  }
}

const ITEM_INFO = {
  holz: { e: '🪵', l: 'Holz' },
  stein: { e: '🪨', l: 'Stein' },
  blume: { e: '🌸', l: 'Blume' },
  eisen: { e: '⛏️', l: 'Eisen' },
  diamant: { e: '💎', l: 'Diamant' },
};

function zeigeErfolg(modal, gegeben = [], istKlein = false, neuesBiom = null, onWeiter = null) {
  const unlockHtml = neuesBiom
    ? `<div class="feier__unlock">🗺️ Neues Land freigeschaltet! Schau auf der Karte (🗺️).</div>`
    : '';
  let inner;
  if (!gegeben.length) {
    inner = `
      <div class="modal modal--erfolg">
        <div class="modal__emoji feier__huepf">🎉</div>
        <div class="feier__konfetti">✨🎊⭐🎉✨</div>
        <div class="modal__titel">RICHTIG!</div>
        <p class="modal__text">Super gemacht!</p>
        ${unlockHtml}
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
        ${unlockHtml}
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
  weiter.addEventListener('click', onWeiter ?? (() => modal.schliessen()));
}

function zeigeLoesung(aufgabe, modal, istKlein = false, onWeiter = null) {
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
  weiter.addEventListener('click', onWeiter ?? (() => modal.schliessen()));
}

// Abschluss-Feier am Ende einer Reihe (kein Extra-Material — Belohnungs-Neutralität).
function zeigeReiheGeschafft(modal, istKlein = false) {
  modal.inhalt.innerHTML = `
    <div class="modal modal--erfolg">
      <div class="modal__emoji feier__huepf">🏆</div>
      <div class="feier__konfetti">✨🎊⭐🎉✨</div>
      <div class="modal__titel">REIHE GESCHAFFT!</div>
      <p class="modal__text">Super durchgehalten!</p>
      <button class="modal__close">Fertig</button>
    </div>
  `;
  const fertig = modal.inhalt.querySelector('.modal__close');
  if (istKlein) {
    sprich('Geschafft! Super gemacht!');
    fertig.classList.add('modal__close--puls');
  }
  fertig.addEventListener('click', () => modal.schliessen());
}
