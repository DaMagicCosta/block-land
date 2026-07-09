// 1x1-Trainer: strukturierter Reihen-Trainer als ein Modal in der Welt.
// Ablauf: Reihen-Auswahl -> Lern-Stufe (Vorlesen/Eintragen) -> Quiz -> Abschluss.
// Jede richtige Quiz-Antwort gibt eine Belohnung (reward stammt vom Werkbank-Tile).

import { oeffneModal } from './modal.js';
import { verteileBelohnung } from './belohnung.js';
import { baueReihe } from './aufsagen-logik.js';
import { protokolliereAufsagen, getCurrentProfile, protokolliereEintragen } from './state.js';
import { meldeAufsagen, meldeEintragen } from './sync.js';
import { kappeLuecke, formatDauer, neuerEintrag, INAKTIV_MS } from './aufsage-protokoll-logik.js';
import { richtungsHinweis, neuerEintrag as neuerEintragEintragen } from './eintragen-protokoll-logik.js';
import { tagesSchluessel } from './statistik-logik.js';
import { rapportiereErgebnis } from './adaptiv.js';

const MAX_FEHLVERSUCHE = 2;

// Finalisierer der laufenden Aufsage-Stufe (gesetzt im Aufsage-Modus); von Modal-Close
// und Lern-Stufen-Tab-Wechsel aufgerufen, damit Zeit/Durchgänge nicht verloren gehen.
let aufsagenFinalisierer = null;

// Finalisierer der laufenden Eintragen-Reihe (schreibt {richtig,fehler,verraten} ins Protokoll).
let eintragenFinalisierer = null;

export function oeffneTrainer(reward) {
  const modal = oeffneModal({
    klassen: 'modal-backdrop--trainer',
    inhaltHtml: '<div class="modal modal--trainer"></div>',
    onClose: () => {
      if (aufsagenFinalisierer) { aufsagenFinalisierer(); aufsagenFinalisierer = null; }
      if (eintragenFinalisierer) { eintragenFinalisierer(); eintragenFinalisierer = null; }
    },
  });
  if (!modal) return;
  zeigeReihenAuswahl(modal.inhalt, modal, reward);
}

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

function mische(arr) {
  const k = [...arr];
  for (let i = k.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [k[i], k[j]] = [k[j], k[i]];
  }
  return k;
}

// --- Schritt 1: Reihen-Auswahl ---
function zeigeReihenAuswahl(wurzel, modal, reward) {
  const kacheln = [];
  for (let n = 1; n <= 10; n++) {
    kacheln.push(`<button class="trainer__reihe" data-reihe="${n}">${n}</button>`);
  }
  wurzel.innerHTML = `
    <div class="trainer__kopf">🧮 Welche Reihe willst du üben?</div>
    <div class="trainer__reihen">${kacheln.join('')}</div>
    <button class="trainer__gemischt" data-reihe="gemischt">🎲 Gemischt</button>
  `;
  wurzel.querySelectorAll('[data-reihe]').forEach(b => {
    b.addEventListener('click', () => {
      const wahl = b.dataset.reihe;
      if (wahl === 'gemischt') starteQuiz(wurzel, modal, reward, 'gemischt');
      else zeigeLernStufe(wurzel, modal, reward, parseInt(wahl, 10));
    });
  });
}

// --- Schritt 2: Lern-Stufe (Vorlesen / Aufsagen / Eintragen) ---
function zeigeLernStufe(wurzel, modal, reward, reihe) {
  let modus = 'vorlesen';
  const profileId = getCurrentProfile()?.id ?? null;
  let eintragenStat = { richtig: 0, fehler: 0, verraten: 0, aktiv: false };
  function finalisiereEintragen() {
    if (!eintragenStat.aktiv) return;
    eintragenStat.aktiv = false;
    const summe = eintragenStat.richtig + eintragenStat.fehler + eintragenStat.verraten;
    if (profileId && summe > 0) {
      protokolliereEintragen(profileId, neuerEintragEintragen({
        datum: tagesSchluessel(new Date()),
        reihe, richtig: eintragenStat.richtig, fehler: eintragenStat.fehler, verraten: eintragenStat.verraten,
      }));
      meldeEintragen(profileId, {
        richtig: eintragenStat.richtig, fehler: eintragenStat.fehler, verraten: eintragenStat.verraten,
      });
    }
  }
  wurzel.innerHTML = `
    <div class="trainer__kopf">Die ${reihe}er-Reihe</div>
    <div class="trainer__umschalter">
      <button data-m="vorlesen" class="aktiv">🔊 Vorlesen</button>
      <button data-m="aufsagen">🗣️ Aufsagen</button>
      <button data-m="eintragen">✏️ Eintragen</button>
    </div>
    <div class="trainer__liste"></div>
    <button class="trainer__weiter">Jetzt abfragen →</button>
  `;
  const liste = wurzel.querySelector('.trainer__liste');
  const weiterBtn = wurzel.querySelector('.trainer__weiter');

  function baue() {
    liste.innerHTML = '';
    if (modus === 'eintragen') {
      eintragenStat = { richtig: 0, fehler: 0, verraten: 0, aktiv: true };
      eintragenFinalisierer = finalisiereEintragen;
    }
    for (let i = 1; i <= 10; i++) {
      const erg = i * reihe;
      const z = document.createElement('div');
      if (modus === 'vorlesen') {
        z.className = 'trainer__zeile trainer__zeile--vorlesbar';
        z.innerHTML = `<span>${i} · ${reihe} =</span><span class="trainer__erg">${erg}</span><span class="trainer__laut">🔊</span>`;
        z.addEventListener('click', () => sprich(`${i} mal ${reihe} gleich ${erg}`));
      } else {
        z.className = 'trainer__zeile';
        z.innerHTML = `<span>${i} · ${reihe} =</span><input type="number" inputmode="numeric" /><span class="trainer__hinweis"></span>`;
        const inp = z.querySelector('input');
        const hinweis = z.querySelector('.trainer__hinweis');
        const zeile = { fehler: 0, fertig: false };

        function fokusNaechstes() {
          const offen = liste.querySelector('.trainer__zeile input:not([readonly])');
          if (offen) offen.focus();
        }
        function markiereRichtig() {
          z.classList.add('trainer__zeile--korrekt');
          z.classList.remove('trainer__zeile--falsch');
          hinweis.textContent = '';
          inp.readOnly = true;
          zeile.fertig = true;
          eintragenStat.richtig += 1;
          fokusNaechstes();
        }
        function pruefeFalsch() {
          if (zeile.fertig) return;
          const roh = inp.value.trim();
          if (roh === '') { z.classList.remove('trainer__zeile--falsch'); hinweis.textContent = ''; return; }
          const wert = parseInt(roh, 10);
          if (wert === erg) { markiereRichtig(); return; }
          zeile.fehler += 1;
          eintragenStat.fehler += 1;
          z.classList.add('trainer__zeile--falsch');
          hinweis.textContent = richtungsHinweis(wert, erg);
          z.classList.remove('trainer__zeile--wackeln'); void z.offsetWidth; z.classList.add('trainer__zeile--wackeln');
          if (zeile.fehler >= 2) {
            inp.value = String(erg);
            z.classList.remove('trainer__zeile--falsch');
            z.classList.add('trainer__zeile--verraten');
            hinweis.textContent = '';
            inp.readOnly = true;
            zeile.fertig = true;
            eintragenStat.verraten += 1;
            fokusNaechstes();
          }
        }
        inp.addEventListener('input', () => {
          if (zeile.fertig) return;
          if (parseInt(inp.value.trim(), 10) === erg) markiereRichtig();
          else z.classList.remove('trainer__zeile--korrekt');
        });
        inp.addEventListener('change', pruefeFalsch);
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') pruefeFalsch(); });
      }
      liste.appendChild(z);
    }
  }

  function aktualisiere() {
    // Beim Verlassen von Aufsagen/Eintragen jeweils finalisieren (kein Datenverlust).
    if (modus !== 'aufsagen' && aufsagenFinalisierer) { aufsagenFinalisierer(); aufsagenFinalisierer = null; }
    if (modus !== 'eintragen' && eintragenFinalisierer) { eintragenFinalisierer(); eintragenFinalisierer = null; }
    if (modus === 'aufsagen') {
      weiterBtn.hidden = true;
      rendereAufsagen(wurzel, liste, modal, reward, reihe);
    } else {
      weiterBtn.hidden = false;
      baue();
    }
  }

  wurzel.querySelectorAll('.trainer__umschalter button').forEach(b => {
    b.addEventListener('click', () => {
      modus = b.dataset.m;
      wurzel.querySelectorAll('.trainer__umschalter button')
        .forEach(x => x.classList.toggle('aktiv', x === b));
      aktualisiere();
    });
  });
  weiterBtn.addEventListener('click', () => {
    if (eintragenFinalisierer) { eintragenFinalisierer(); eintragenFinalisierer = null; }
    starteQuiz(wurzel, modal, reward, reihe);
  });
  aktualisiere();
}

// --- Schritt 2b: Aufsage-Modus (Mitsprechen + Auswendig) ---
// Selbstbestimmt: Kind tippt „Weiter →"; die aktuelle Zeile ist groß markiert und wird
// gesprochen (Mitsprechen) bzw. auf „Aufdecken" enthüllt+gesprochen (Auswendig = Hilfe).
// „Ich kann's! Jetzt testen →" führt ins bestehende belohnte Quiz. Kein eigener Reward.
// Misst pro Stufe Durchgänge + aktive Zeit (Idle-Cap), finalisiert ins aufsagenProtokoll.
function rendereAufsagen(wurzel, container, modal, reward, reihe) {
  const schritte = baueReihe(reihe);
  const profileId = getCurrentProfile()?.id ?? null;
  let stufe = 'mitsprechen';   // 'mitsprechen' | 'auswendig'
  let idx = 0;                 // aktueller Schritt; === schritte.length ⇒ geschafft
  let aufgedeckt = false;      // Auswendig: aktuelle Zeile aufgedeckt?

  // Mess-State (pro Stufe)
  let durchgaenge = 0;
  let aktiveZeitMs = 0;
  let letzteAktionZeit = performance.now();
  let inaktivTimer = null;

  function armiereInaktivTimer() {
    clearTimeout(inaktivTimer);
    inaktivTimer = setTimeout(loeseNickerchenAus, INAKTIV_MS);
  }

  // Bei jeder Kind-Aktion: Denk-/Hänge-Zeit bis hierher (gekappt) anrechnen, Timer neu setzen.
  function registriereAktion() {
    const jetzt = performance.now();
    aktiveZeitMs += kappeLuecke(jetzt - letzteAktionZeit);
    letzteAktionZeit = jetzt;
    armiereInaktivTimer();
  }

  function betreteStufe(neu) {
    stufe = neu; idx = 0; aufgedeckt = false;
    durchgaenge = 0; aktiveZeitMs = 0; letzteAktionZeit = performance.now();
    aufsagenFinalisierer = verlasseStufe;   // solange wir im Aufsagen sind: finalisierbar
    armiereInaktivTimer();
    render();
    if (stufe === 'mitsprechen') sprichAktuell();
  }

  // Idempotent: schreibt nur bei ≥1 vollem Durchgang, setzt danach zurück.
  function verlasseStufe() {
    clearTimeout(inaktivTimer);
    if (profileId && durchgaenge >= 1) {
      protokolliereAufsagen(profileId, neuerEintrag({
        datum: tagesSchluessel(new Date()),
        reihe, stufe, durchgaenge, zeit_ms: aktiveZeitMs,
      }));
      meldeAufsagen(profileId, { zeit_ms: aktiveZeitMs });
    }
    durchgaenge = 0; aktiveZeitMs = 0;
  }

  function loeseNickerchenAus() {
    verlasseStufe();              // ohne registriereAktion: Weglauf-Zeit zählt NICHT
    aufsagenFinalisierer = null;
    zeigeNickerchen();
  }

  function sprichAktuell() {
    if (idx < schritte.length) sprich(schritte[idx].vorlese);
  }

  function zeileHtml(s, i) {
    const istAktiv = idx < schritte.length && i === idx;
    let erg;
    if (stufe === 'mitsprechen' || (istAktiv && aufgedeckt)) {
      erg = `<span class="trainer__erg">${s.ergebnis}</span>`;
    } else {
      erg = `<span class="trainer__erg trainer__erg--verdeckt">?</span>`;
    }
    return `<div class="trainer__zeile${istAktiv ? ' trainer__zeile--aktiv' : ''}"><span>${s.i} · ${reihe} =</span>${erg}</div>`;
  }

  function zaehlerHtml() {
    return `<div class="trainer__aufsagen-zaehler">🔁 ×${durchgaenge} · ⏱ ${formatDauer(aktiveZeitMs)}</div>`;
  }

  function steuerHtml() {
    const geschafft = idx >= schritte.length;
    if (geschafft) {
      if (stufe === 'mitsprechen') {
        return `<div class="trainer__tipp">🎉 Geschafft!</div>
          <div class="trainer__aufsagen-knoepfe">
            <button class="trainer__fertig" data-nochmal-aufsagen>🔁 Nochmal aufsagen</button>
            <button class="trainer__weiter" data-auswendig>🧠 Auswendig probieren</button>
          </div>`;
      }
      return `<div class="trainer__tipp">🎉 Geschafft!</div>
        <div class="trainer__aufsagen-knoepfe">
          <button class="trainer__fertig" data-nochmal>🔁 Nochmal</button>
        </div>`;
    }
    if (stufe === 'mitsprechen') {
      return `<div class="trainer__aufsagen-knoepfe">
        <button class="trainer__fertig" data-nochmal-laut>🔊 Nochmal</button>
        <button class="trainer__weiter" data-weiter>Weiter →</button>
      </div>`;
    }
    if (!aufgedeckt) {
      return `<div class="trainer__aufsagen-knoepfe"><button class="trainer__weiter" data-aufdecken>Aufdecken</button></div>`;
    }
    return `<div class="trainer__aufsagen-knoepfe"><button class="trainer__weiter" data-weiter>Weiter →</button></div>`;
  }

  function render() {
    container.innerHTML = `
      <div class="trainer__umschalter">
        <button data-s="mitsprechen" class="${stufe === 'mitsprechen' ? 'aktiv' : ''}">① Mitsprechen</button>
        <button data-s="auswendig" class="${stufe === 'auswendig' ? 'aktiv' : ''}">② Auswendig</button>
      </div>
      ${zaehlerHtml()}
      <div class="trainer__aufsagen-liste">${schritte.map(zeileHtml).join('')}</div>
      ${steuerHtml()}
      <button class="trainer__testen" data-testen>Ich kann's! Jetzt testen →</button>
    `;
    verdrahte();
  }

  function zeigeNickerchen() {
    container.innerHTML = `
      <div class="trainer__nickerchen">
        <div class="trainer__nickerchen-emoji">😴</div>
        <div class="trainer__kopf">Block-Land macht eine Pause</div>
        <p class="trainer__nickerchen-text">Geh kurz raus und schau in die Ferne — dann üben wir weiter!</p>
        <div class="trainer__aufsagen-knoepfe">
          <button class="trainer__weiter" data-weiter-ueben>Weiter üben</button>
          <button class="trainer__fertig" data-fertig>Fertig</button>
        </div>
      </div>
    `;
    const w = container.querySelector('[data-weiter-ueben]');
    if (w) w.addEventListener('click', () => betreteStufe(stufe));
    const f = container.querySelector('[data-fertig]');
    if (f) f.addEventListener('click', () => modal.schliessen());
  }

  function verdrahte() {
    container.querySelectorAll('.trainer__umschalter button').forEach(b =>
      b.addEventListener('click', () => {
        if (b.dataset.s !== stufe) { registriereAktion(); verlasseStufe(); betreteStufe(b.dataset.s); }
      }));

    const weiter = container.querySelector('[data-weiter]');
    if (weiter) weiter.addEventListener('click', () => {
      registriereAktion();
      idx++;
      if (idx >= schritte.length) durchgaenge++;   // ein voller Durchgang
      aufgedeckt = false;
      render();
      if (stufe === 'mitsprechen' && idx < schritte.length) sprichAktuell();
    });

    const nochmalLaut = container.querySelector('[data-nochmal-laut]');
    if (nochmalLaut) nochmalLaut.addEventListener('click', () => { registriereAktion(); sprichAktuell(); });

    const aufdecken = container.querySelector('[data-aufdecken]');
    if (aufdecken) aufdecken.addEventListener('click', () => { registriereAktion(); aufgedeckt = true; sprichAktuell(); render(); });

    const auswendig = container.querySelector('[data-auswendig]');
    if (auswendig) auswendig.addEventListener('click', () => { registriereAktion(); verlasseStufe(); betreteStufe('auswendig'); });

    const nochmal = container.querySelector('[data-nochmal]');
    if (nochmal) nochmal.addEventListener('click', () => { registriereAktion(); idx = 0; aufgedeckt = false; render(); });

    const nochmalAufsagen = container.querySelector('[data-nochmal-aufsagen]');
    if (nochmalAufsagen) nochmalAufsagen.addEventListener('click', () => { registriereAktion(); idx = 0; aufgedeckt = false; render(); sprichAktuell(); });

    const testen = container.querySelector('[data-testen]');
    if (testen) testen.addEventListener('click', () => { registriereAktion(); verlasseStufe(); aufsagenFinalisierer = null; starteQuiz(wurzel, modal, reward, reihe); });
  }

  betreteStufe('mitsprechen');
}

// --- Schritt 3: Quiz ---
function starteQuiz(wurzel, modal, reward, reihe) {
  const profileId = getCurrentProfile()?.id ?? null;
  const fakten = [];
  if (reihe === 'gemischt') {
    const alle = [];
    for (let a = 2; a <= 10; a++) for (let b = 2; b <= 10; b++) alle.push([a, b]);
    mische(alle).slice(0, 10).forEach(([a, b]) => fakten.push({ a, b }));
  } else {
    mische([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).forEach(a => fakten.push({ a, b: reihe }));
  }
  let index = 0;
  let sterne = 0;

  function distraktoren(a, b) {
    const richtig = a * b;
    const set = new Set([a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, richtig + 1, richtig - 1, richtig + 2]);
    const liste = [...set].filter(x => x > 0 && x !== richtig);
    return mische(liste).slice(0, 3);
  }

  function zeigeFrage() {
    const f = fakten[index];
    const richtig = f.a * f.b;
    let fehler = 0;
    const frageStart = performance.now();
    // Quiz zählt wie eine normale Aufgabe (Statistik + Familien-Sync). Stufe bleibt fix —
    // die Reihen-Wahl ist die Schwierigkeit des Quiz, nicht die adaptive Mal-Stufe.
    function rapportiere(warRichtig) {
      if (profileId) rapportiereErgebnis(profileId, 'mal', warRichtig, performance.now() - frageStart, { adaptStufe: false });
    }
    const optionen = mische([richtig, ...distraktoren(f.a, f.b)]);
    wurzel.innerHTML = `
      <div class="trainer__fortschritt">Frage ${index + 1} von ${fakten.length} · ⭐ ${sterne}</div>
      <div class="trainer__aufgabe">${f.a} · ${f.b} = ?</div>
      <div class="trainer__antworten"></div>
      <div class="trainer__tipp" hidden></div>
    `;
    const ant = wurzel.querySelector('.trainer__antworten');
    optionen.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'trainer__antwort';
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        if (opt === richtig) {
          btn.classList.add('trainer__antwort--richtig');
          ant.querySelectorAll('button').forEach(x => { x.disabled = true; });
          sterne++;
          rapportiere(true);
          // einzelne Reihe = Stufe 3, Gemischt = Stufe 4 (maxStufe 4) → Gemischt gibt besseres Material
          verteileBelohnung(reihe === 'gemischt' ? 4 : 3, 4, reward.item);
          setTimeout(weiter, 700);
        } else {
          btn.classList.add('trainer__antwort--falsch');
          btn.disabled = true;
          fehler++;
          if (fehler >= MAX_FEHLVERSUCHE) {
            ant.querySelectorAll('button').forEach(x => {
              x.disabled = true;
              if (parseInt(x.textContent, 10) === richtig) x.classList.add('trainer__antwort--richtig');
            });
            rapportiere(false);
            const tipp = wurzel.querySelector('.trainer__tipp');
            tipp.hidden = false;
            tipp.textContent = `Die Lösung ist ${richtig} 👍`;
            setTimeout(weiter, 1600);
          }
        }
      });
      ant.appendChild(btn);
    });
  }

  function weiter() {
    index++;
    if (index >= fakten.length) zeigeAbschluss(wurzel, modal, reward, sterne, fakten.length);
    else zeigeFrage();
  }

  zeigeFrage();
}

// --- Abschluss ---
function zeigeAbschluss(wurzel, modal, reward, sterne, max) {
  wurzel.innerHTML = `
    <div class="trainer__abschluss">
      <div class="trainer__abschluss-emoji">🎉</div>
      <div class="trainer__kopf">Super gemacht!</div>
      <p class="trainer__abschluss-text">⭐ ${sterne} von ${max} richtig</p>
      <button class="trainer__nochmal">🔁 Nochmal</button>
      <button class="trainer__fertig">Fertig</button>
    </div>
  `;
  wurzel.querySelector('.trainer__nochmal')
    .addEventListener('click', () => zeigeReihenAuswahl(wurzel, modal, reward));
  wurzel.querySelector('.trainer__fertig')
    .addEventListener('click', () => modal.schliessen());
}
