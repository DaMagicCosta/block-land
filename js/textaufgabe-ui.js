// Geschichten-Dorf: Quest-UI für Textaufgaben — ein Modal, zwei Bildschirme:
// 1. Lesen (Vorlese-Pflicht)  2. Arbeitsphase mit drei Schritten, die auf demselben
//    Bildschirm ineinander übergehen: Zahlen markieren → Frage antippen → Rechnen.
// In JEDEM Schritt der Arbeitsphase gilt die 2-Fehlversuche-Regel: nach 2 Fehlversuchen
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
import { neueKlickSperre } from './klick-sperre.js';

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

// Rapportiert das Quest-Ergebnis GENAU EINMAL, sobald es feststeht — nicht erst am Modal-Ende.
// "Feststehen" heißt: entweder wird in irgendeiner Phase die 2-Fehlversuche-Grenze erreicht
// (Ergebnis "falsch" steht ab diesem Moment fest, egal ob die Quest danach noch weiterläuft),
// oder Phase 4 wird beantwortet (richtig ohne vorheriges Verraten, oder falsch im 2. Versuch).
// Ein Abbruch (Modal schließen) BEVOR eines dieser Ereignisse eintritt zählt NICHT — dafür wird
// hier nie rapportiert, konsistent zu allen anderen Aufgaben der App (angefangene, nie
// beantwortete Aufgabe zählt nicht). `ctx.rapportiert` schützt vor Doppel-Rapport, z.B. wenn
// nach einem Verraten in Phase 2/3 die Rechnen-Phase trotzdem noch "richtig" beantwortet wird.
function rapportiereWennFaellig(profile, questStart, ctx, aufgabe, richtig) {
  if (ctx.rapportiert) return;
  ctx.rapportiert = true;
  const zeitMs = performance.now() - questStart;
  rapportiereErgebnis(profile.id, 'text', richtig, zeitMs, { maxStufe: MAX_STUFE, detail: aufgabe.detail });
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
  const ctx = { verraten: false, rapportiert: false };   // verraten: true sobald irgendeine Phase verraten wurde; rapportiert: Doppel-Rapport-Guard

  rendereLesenPhase(modal, aufgabe, profile, questStart, ctx, reward);
}

// --- Phase 1: Lesen (Vorlese-Pflicht) ---
function rendereLesenPhase(modal, aufgabe, profile, questStart, ctx, reward) {
  modal.inhalt.innerHTML = `
    ${npcKopfHtml(aufgabe, '📖 Lies die Geschichte laut vor!')}
    <div class="aufgabe__vorlesen">
      <div class="aufgabe__mikro">🎤</div>
      <div class="aufgabe__vorlesen-text">
        <div class="aufgabe__vorlesen-aufgabe">${escapeHtml(aufgabe.vorlese_text)}</div>
      </div>
      <button class="aufgabe__hoeren" title="Vorlesen">🔊</button>
    </div>
    <button class="aufgabe__gelesen">✓ Gelesen</button>
  `;
  modal.inhalt.querySelector('.aufgabe__hoeren').addEventListener('click', () => sprich(aufgabe.vorlese_text));
  modal.inhalt.querySelector('.aufgabe__gelesen').addEventListener('click', () => {
    rendereArbeitsPhase(modal, aufgabe, profile, questStart, ctx, reward);
  });
}

// --- Arbeitsphase: Zahlen markieren → Frage antippen → Rechnen, alles auf EINEM Bildschirm ---
// Bis v100 waren das drei Bildschirme mit je eigener Anweisung, dazu ein „Weiter"-Knopf nach
// dem Markieren (Befund 10.10.2026: acht Tipps und vier Anweisungen für eine Antwort). Jetzt
// bleibt die Geschichte stehen, und es geht von selbst weiter, sobald ein Schritt stimmt:
//   zahlen  — nur Zahlen sind antippbar. Wichtige Zahl → rot markiert. Unwichtige Zahl
//             (irrelevante_slots der Vorlage) → Fehlversuch. Alle wichtigen gefunden → weiter.
//   frage   — ganze Sätze sind antippbar. Richtiger Satz → blau markiert → weiter.
//   rechnen — Antwortknöpfe erscheinen unter der markierten Geschichte.
// Die Schritte laufen nacheinander und nicht gleichzeitig: Sonst würde ein Tipp knapp neben
// eine Zahl als falsche Wahl des Fragesatzes gewertet.
// Die 2-Fehlversuche-Regel gilt je Schritt wie bisher: Danach wird der Schritt verraten
// (Markierung erscheint von selbst), die Quest zählt als falsch und läuft weiter.
function rendereArbeitsPhase(modal, aufgabe, profile, questStart, ctx, reward) {
  const erwartet = relevanteZahlenSet(aufgabe);
  const sperre = neueKlickSperre();   // Doppeltipp-Schutz (siehe klick-sperre.js)
  const gefunden = new Set();
  let schritt = 'zahlen';             // 'zahlen' | 'frage' | 'rechnen'
  let fehlversuche = 0;               // je Schritt, wird beim Schrittwechsel zurückgesetzt

  const PROMPT = {
    zahlen: '🔢 Tippe auf die wichtigen Zahlen!',
    frage: '❓ Tippe auf die Frage!',
    rechnen: '🧮 Jetzt rechne aus!',
  };

  const saetzeHtml = aufgabe.saetze.map((satz, si) => {
    const tokensHtml = satz.tokens.map((t, ti) => t.istZahl
      ? `<button type="button" class="text-token" data-satz="${si}" data-idx="${ti}">${escapeHtml(t.text)}</button>`
      : `<span class="text-token">${escapeHtml(t.text)}</span>`
    ).join(' ');
    return `<div class="text-satz" data-satz="${si}">${tokensHtml}</div>`;
  }).join('');

  modal.inhalt.innerHTML = `
    <div class="text-npc-kopf"><span class="text-npc-emoji">${escapeHtml(aufgabe.npc)}</span></div>
    <div class="text-schritte" aria-hidden="true">
      <span data-schritt="zahlen">🔢</span><span data-schritt="frage">❓</span><span data-schritt="rechnen">🧮</span>
    </div>
    <div class="text-schritt-prompt"></div>
    <div class="text-saetze">${saetzeHtml}</div>
    <div class="aufgabe__optionen" hidden></div>
    <div class="aufgabe__feedback" hidden></div>
  `;
  const saetzeEl = modal.inhalt.querySelector('.text-saetze');
  const fb = modal.inhalt.querySelector('.aufgabe__feedback');

  function zeigeFehler(text) {
    fb.hidden = false;
    fb.className = 'aufgabe__feedback aufgabe__feedback--fehler';
    fb.textContent = text;
    wackeln(modal);
  }

  function betrete(neu) {
    schritt = neu;
    fehlversuche = 0;
    fb.hidden = true;
    sperre.verriegeln(performance.now());   // der letzte Tipp darf nicht gleich weiterwerten
    modal.inhalt.querySelector('.text-schritt-prompt').textContent = PROMPT[neu];
    modal.inhalt.querySelectorAll('.text-schritte span').forEach(el =>
      el.classList.toggle('aktiv', el.dataset.schritt === neu));
    saetzeEl.className = `text-saetze text-saetze--schritt-${neu}`;
    saetzeEl.querySelectorAll('.text-satz').forEach(el =>
      el.classList.toggle('text-satz--klickbar', neu === 'frage'));
    if (neu === 'zahlen' && erwartet.size === 0) { betrete('frage'); return; }   // Vorlage ohne wichtige Zahl
    if (neu === 'rechnen') zeigeOptionen();
  }

  function verrate() {
    ctx.verraten = true;
    rapportiereWennFaellig(profile, questStart, ctx, aufgabe, false);
  }

  function markiereAlleZahlen() {
    saetzeEl.querySelectorAll('button.text-token').forEach(btn => {
      if (erwartet.has(tokenKey(btn.dataset.satz, btn.dataset.idx))) btn.classList.add('text-token--zahl-markiert');
    });
  }

  // Schritt 1: Zahlen
  saetzeEl.querySelectorAll('button.text-token').forEach(btn => {
    btn.addEventListener('click', () => {
      if (schritt !== 'zahlen') return;
      const key = tokenKey(btn.dataset.satz, btn.dataset.idx);
      if (gefunden.has(key) || btn.classList.contains('text-token--unwichtig')) return;
      const jetzt = performance.now();
      if (sperre.istGesperrt(jetzt)) return;
      sperre.verriegeln(jetzt);
      if (erwartet.has(key)) {
        gefunden.add(key);
        btn.classList.add('text-token--zahl-markiert');
        fb.hidden = true;
        if (gefunden.size === erwartet.size) betrete('frage');
        return;
      }
      btn.classList.add('text-token--unwichtig');
      fehlversuche++;
      if (fehlversuche >= MAX_FEHLVERSUCHE) {
        verrate();
        markiereAlleZahlen();
        betrete('frage');
        return;
      }
      zeigeFehler('Diese Zahl brauchst du nicht.');
    });
  });

  // Schritt 2: Frage
  saetzeEl.querySelectorAll('.text-satz').forEach(el => {
    el.addEventListener('click', () => {
      if (schritt !== 'frage') return;
      const jetzt = performance.now();
      if (sperre.istGesperrt(jetzt)) return;
      sperre.verriegeln(jetzt);
      const si = parseInt(el.dataset.satz, 10);
      const richtig = si === aufgabe.frageIndex;
      if (!richtig) {
        fehlversuche++;
        if (fehlversuche < MAX_FEHLVERSUCHE) { zeigeFehler('Schau nochmal genau hin!'); return; }
        verrate();
      }
      saetzeEl.querySelector(`.text-satz[data-satz="${aufgabe.frageIndex}"]`)?.classList.add('text-satz--frage-markiert');
      betrete('rechnen');
    });
  });

  // Schritt 3: Rechnen
  function zeigeOptionen() {
    const optionen = modal.inhalt.querySelector('.aufgabe__optionen');
    optionen.hidden = false;
    optionen.innerHTML = aufgabe.antwort_optionen.map(opt =>
      `<button class="aufgabe__option" data-wert="${opt}">${opt}</button>`).join('');
    optionen.querySelectorAll('.aufgabe__option').forEach(btn => {
      btn.addEventListener('click', () => pruefen(parseInt(btn.dataset.wert, 10)));
    });
  }

  function pruefen(wert) {
    const jetzt = performance.now();
    if (sperre.istGesperrt(jetzt)) return;
    sperre.verriegeln(jetzt);
    if (wert === aufgabe.ergebnis) {
      // Ergebnis steht fest: richtig, sofern in keinem vorherigen Schritt verraten wurde
      // (war schon verraten, ist ctx.rapportiert bereits gesetzt → Guard greift, kein Doppel-Rapport).
      rapportiereWennFaellig(profile, questStart, ctx, aufgabe, !ctx.verraten);
      abschliessen(true);
      return;
    }
    fehlversuche++;
    if (fehlversuche >= MAX_FEHLVERSUCHE) {
      verrate();
      abschliessen(false);
      return;
    }
    zeigeFehler('Versuch es nochmal!');
  }

  function abschliessen(antwortRichtig) {
    const warRichtig = !ctx.verraten && antwortRichtig;
    if (warRichtig) {
      gebeReward(reward.item, 1);
      zeigeErfolg(modal, reward);
    } else {
      zeigeLoesung(modal, aufgabe);
    }
  }

  betrete('zahlen');
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
