// Geschichten-Dorf: Quest-UI für Textaufgaben — ein Modal, 4 Phasen nacheinander:
// 1. Lesen (Vorlese-Pflicht)  2. Zahlen markieren  3. Frage antippen  4. Rechnen.
// In JEDER interaktiven Phase (2/3/4) gilt die 2-Fehlversuche-Regel: nach 2 Fehlversuchen
// wird die Lösung für diese Phase gezeigt (verraten) und es geht automatisch weiter.
// Die Quest zählt am Ende nur dann als "richtig" (Tracking + Reward), wenn KEINE
// Phase verraten wurde UND die Rechnen-Antwort im ersten oder zweiten Versuch stimmt.

import { oeffneModal } from './modal.js';
import { loadTextaufgaben } from './data.js';
import { generiereTextaufgabe } from './aufgaben/text.js';
import { aktuelleStufe, rapportiereErgebnis } from './adaptiv.js';
import { gebeReward } from './inventar.js';
import { getCurrentProfile } from './state.js';
import { escapeHtml, sprich } from './utils.js';

const MAX_FEHLVERSUCHE = 2;   // Nach 2 Fehlversuchen wird die Phase "verraten".
const MAX_STUFE = 2;          // Textaufgaben haben 2 Stufen (siehe adaptiv.js).

function tokenKey(si, ti) { return `${si}:${ti}`; }

// Alle Positionen (Satz-Index:Token-Index), die als Zahl markiert werden MÜSSEN.
function relevanteZahlenSet(aufgabe) {
  const set = new Set();
  aufgabe.saetze.forEach((satz, si) => {
    satz.tokens.forEach((t, ti) => {
      if (t.istZahl && t.relevant) set.add(tokenKey(si, ti));
    });
  });
  return set;
}

function gleicheSets(a, b) {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

function tokenSpanHtml(t, markiert) {
  return `<span class="text-token${markiert ? ' text-token--zahl-markiert' : ''}">${escapeHtml(t.text)}</span>`;
}

// Phase 2: jedes Token ein eigener Button (antippbar, toggelt Markierung).
function saetzeTokenButtonsHtml(aufgabe) {
  return aufgabe.saetze.map((satz, si) => {
    const tokensHtml = satz.tokens.map((t, ti) =>
      `<button type="button" class="text-token" data-satz="${si}" data-idx="${ti}">${escapeHtml(t.text)}</button>`
    ).join(' ');
    return `<div class="text-satz" data-satz="${si}">${tokensHtml}</div>`;
  }).join('');
}

// Phase 3: ganze Sätze antippbar (Zahlen-Markierung aus Phase 2 bleibt sichtbar).
function saetzeKlickbarHtml(aufgabe, markierteKeys) {
  return aufgabe.saetze.map((satz, si) => {
    const tokensHtml = satz.tokens.map((t, ti) => tokenSpanHtml(t, markierteKeys.has(tokenKey(si, ti)))).join(' ');
    return `<button type="button" class="text-satz text-satz--klickbar" data-satz="${si}">${tokensHtml}</button>`;
  }).join('');
}

// Phase 4: nur noch Lesetext mit beiden Markierungen (Zahlen + Frage), nicht mehr antippbar.
function saetzeReadonlyHtml(aufgabe, markierteKeys, frageIndex) {
  return aufgabe.saetze.map((satz, si) => {
    const tokensHtml = satz.tokens.map((t, ti) => tokenSpanHtml(t, markierteKeys.has(tokenKey(si, ti)))).join(' ');
    const frageKlasse = frageIndex === si ? ' text-satz--frage-markiert' : '';
    return `<div class="text-satz${frageKlasse}" data-satz="${si}">${tokensHtml}</div>`;
  }).join('');
}

function npcKopfHtml(aufgabe, prompt) {
  return `
    <div class="text-npc-kopf"><span class="text-npc-emoji">${escapeHtml(aufgabe.npc)}</span></div>
    <div class="text-schritt-prompt">${prompt}</div>
  `;
}

function wackeln(modal) {
  modal.inhalt.classList.add('aufgabe--puls-fehler');
  setTimeout(() => modal.inhalt.classList.remove('aufgabe--puls-fehler'), 600);
}

export async function oeffneTextaufgabe(reward, { onClose } = {}) {
  const profile = getCurrentProfile();
  if (!profile) return;

  const modal = oeffneModal({
    klassen: 'modal-backdrop--aufgabe',
    inhaltHtml: '<div class="modal modal--aufgabe modal--textaufgabe"></div>',
    onClose,
  });
  if (!modal) return;

  let vorlagen;
  try {
    vorlagen = await loadTextaufgaben();
  } catch (err) {
    console.error('[textaufgabe-ui] Laden fehlgeschlagen', err);
    modal.inhalt.innerHTML = `
      <div style="padding:var(--space-xl);text-align:center;color:var(--color-danger)">
        <p>Fehler beim Laden der Geschichte.</p>
        <p style="color:var(--color-text-dim);font-size:var(--font-size-sm);margin-top:var(--space-md)">${escapeHtml(err.message)}</p>
      </div>
    `;
    return;
  }

  const stufe = aktuelleStufe(profile.id, 'text');
  const aufgabe = generiereTextaufgabe(vorlagen, stufe);
  const questStart = performance.now();
  const ctx = { verraten: false };   // wird true, sobald irgendeine Phase verraten wurde

  rendereLesenPhase(modal, aufgabe, profile, questStart, ctx, reward);
}

// --- Phase 1: Lesen (Vorlese-Pflicht) ---
function rendereLesenPhase(modal, aufgabe, profile, questStart, ctx, reward) {
  modal.inhalt.innerHTML = `
    ${npcKopfHtml(aufgabe, '📖 Höre gut zu!')}
    <div class="aufgabe__vorlesen">
      <div class="aufgabe__mikro">🎤</div>
      <div class="aufgabe__vorlesen-text">
        <div class="aufgabe__vorlesen-label">Lies laut vor:</div>
        <div class="aufgabe__vorlesen-aufgabe">${escapeHtml(aufgabe.vorlese_text)}</div>
      </div>
      <button class="aufgabe__hoeren" title="Vorlesen">🔊</button>
    </div>
    <button class="aufgabe__gelesen">✓ Gelesen</button>
  `;
  modal.inhalt.querySelector('.aufgabe__hoeren').addEventListener('click', () => sprich(aufgabe.vorlese_text));
  modal.inhalt.querySelector('.aufgabe__gelesen').addEventListener('click', () => {
    rendereZahlenPhase(modal, aufgabe, profile, questStart, ctx, reward);
  });
}

// --- Phase 2: Zahlen markieren ---
function rendereZahlenPhase(modal, aufgabe, profile, questStart, ctx, reward) {
  let fehlversuche = 0;
  const erwartet = relevanteZahlenSet(aufgabe);

  function render() {
    modal.inhalt.innerHTML = `
      ${npcKopfHtml(aufgabe, '🔢 Tippe auf die wichtigen Zahlen!')}
      <div class="text-saetze">${saetzeTokenButtonsHtml(aufgabe)}</div>
      <button class="text-weiter">Weiter</button>
      <div class="aufgabe__feedback" hidden></div>
    `;
    modal.inhalt.querySelectorAll('.text-token').forEach(btn => {
      btn.addEventListener('click', () => btn.classList.toggle('text-token--zahl-markiert'));
    });
    modal.inhalt.querySelector('.text-weiter').addEventListener('click', pruefen);
  }

  function markierteAusDom() {
    const set = new Set();
    modal.inhalt.querySelectorAll('.text-token--zahl-markiert').forEach(btn => {
      set.add(tokenKey(btn.dataset.satz, btn.dataset.idx));
    });
    return set;
  }

  function pruefen() {
    const markiert = markierteAusDom();
    if (gleicheSets(markiert, erwartet)) {
      rendereFragePhase(modal, aufgabe, profile, questStart, ctx, erwartet, reward);
      return;
    }
    fehlversuche++;
    if (fehlversuche >= MAX_FEHLVERSUCHE) {
      ctx.verraten = true;
      // Lösung zeigen: die korrekten Zahlen bekommen die Markierung automatisch.
      rendereFragePhase(modal, aufgabe, profile, questStart, ctx, erwartet, reward);
      return;
    }
    const fb = modal.inhalt.querySelector('.aufgabe__feedback');
    fb.hidden = false;
    fb.className = 'aufgabe__feedback aufgabe__feedback--fehler';
    fb.textContent = 'Versuch es nochmal!';
    wackeln(modal);
  }

  render();
}

// --- Phase 3: Frage antippen ---
function rendereFragePhase(modal, aufgabe, profile, questStart, ctx, markierteZahlen, reward) {
  let fehlversuche = 0;

  function render() {
    modal.inhalt.innerHTML = `
      ${npcKopfHtml(aufgabe, '❓ Wo steht die Frage?')}
      <div class="text-saetze">${saetzeKlickbarHtml(aufgabe, markierteZahlen)}</div>
      <div class="aufgabe__feedback" hidden></div>
    `;
    modal.inhalt.querySelectorAll('.text-satz--klickbar').forEach(btn => {
      btn.addEventListener('click', () => waehle(parseInt(btn.dataset.satz, 10)));
    });
  }

  function waehle(si) {
    if (si === aufgabe.frageIndex) {
      rendereRechnenPhase(modal, aufgabe, profile, questStart, ctx, markierteZahlen, reward);
      return;
    }
    fehlversuche++;
    if (fehlversuche >= MAX_FEHLVERSUCHE) {
      ctx.verraten = true;
      rendereRechnenPhase(modal, aufgabe, profile, questStart, ctx, markierteZahlen, reward);
      return;
    }
    const fb = modal.inhalt.querySelector('.aufgabe__feedback');
    fb.hidden = false;
    fb.className = 'aufgabe__feedback aufgabe__feedback--fehler';
    fb.textContent = 'Schau nochmal genau hin!';
    wackeln(modal);
  }

  render();
}

// --- Phase 4: Rechnen ---
function rendereRechnenPhase(modal, aufgabe, profile, questStart, ctx, markierteZahlen, reward) {
  let fehlversuche = 0;

  function render() {
    const knoepfe = aufgabe.antwort_optionen.map(opt =>
      `<button class="aufgabe__option" data-wert="${opt}">${opt}</button>`).join('');
    modal.inhalt.innerHTML = `
      ${npcKopfHtml(aufgabe, '🧮 Jetzt rechne aus!')}
      <div class="text-saetze text-saetze--kompakt">${saetzeReadonlyHtml(aufgabe, markierteZahlen, aufgabe.frageIndex)}</div>
      <div class="aufgabe__optionen">${knoepfe}</div>
      <div class="aufgabe__feedback" hidden></div>
    `;
    modal.inhalt.querySelectorAll('.aufgabe__option').forEach(btn => {
      btn.addEventListener('click', () => pruefen(parseInt(btn.dataset.wert, 10)));
    });
  }

  function pruefen(wert) {
    if (wert === aufgabe.ergebnis) {
      abschliessen(true);
      return;
    }
    fehlversuche++;
    if (fehlversuche >= MAX_FEHLVERSUCHE) {
      ctx.verraten = true;
      abschliessen(false);
      return;
    }
    const fb = modal.inhalt.querySelector('.aufgabe__feedback');
    fb.hidden = false;
    fb.className = 'aufgabe__feedback aufgabe__feedback--fehler';
    fb.textContent = 'Versuch es nochmal!';
    wackeln(modal);
  }

  function abschliessen(antwortRichtig) {
    const warRichtig = !ctx.verraten && antwortRichtig;
    const zeitMs = performance.now() - questStart;
    rapportiereErgebnis(profile.id, 'text', warRichtig, zeitMs, { maxStufe: MAX_STUFE, detail: aufgabe.detail });
    if (warRichtig) {
      gebeReward(reward.item, 1);
      zeigeErfolg(modal, reward);
    } else {
      zeigeLoesung(modal, aufgabe);
    }
  }

  render();
}

function zeigeErfolg(modal, reward) {
  modal.inhalt.innerHTML = `
    <div class="modal modal--erfolg">
      <div class="modal__emoji feier__huepf">${reward.emoji ?? '❔'}</div>
      <div class="feier__konfetti">✨🎊⭐🎉✨</div>
      <div class="modal__titel">RICHTIG!</div>
      <p class="modal__text">Du hast <strong>${escapeHtml(reward.label ?? reward.item)}</strong> gefunden!</p>
      <button class="modal__close">Weiter</button>
    </div>
  `;
  modal.inhalt.querySelector('.modal__close').addEventListener('click', () => modal.schliessen());
}

function zeigeLoesung(modal, aufgabe) {
  modal.inhalt.innerHTML = `
    <div class="aufgabe__loesung">
      <div class="text-npc-emoji">${escapeHtml(aufgabe.npc)}</div>
      <div class="aufgabe__loesung-text">Die Lösung ist <strong>${aufgabe.ergebnis}</strong>.</div>
      <p class="aufgabe__loesung-hinweis">Macht nichts — beim nächsten Mal klappt es!</p>
      <button class="modal__close">Weiter</button>
    </div>
  `;
  modal.inhalt.querySelector('.modal__close').addEventListener('click', () => modal.schliessen());
}
