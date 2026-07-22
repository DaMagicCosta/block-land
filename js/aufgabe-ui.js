import { oeffneModal, schliesseAlleModals } from './modal.js';
import { rendereZehnerhaus, rendereLegehaus, rendereStatischesFeld } from './wuerfelhaus.js';
import { generierePlusAufgabe } from './aufgaben/plus.js';
import { generiereMalAufgabe } from './aufgaben/mal.js';
import { generiereMengenAufgabe } from './aufgaben/mengen.js';
import { generiereMinusAufgabe } from './aufgaben/minus.js';
import { generiereRechnen10Aufgabe } from './aufgaben/rechnen10.js';
import { generiereGeteiltAufgabe } from './aufgaben/geteilt.js';
import { rendereStellenwert } from './stellenwert.js';
import { verteileBelohnung } from './belohnung.js';
import { loadAufgabenPool, loadBiomManifest } from './data.js';
import { waehleMechanik, aktuelleStufe, rapportiereErgebnis } from './adaptiv.js';
import { getCurrentProfile, getAktivesBiom, schalteNaechstesBiomFrei, getAktiveReihe, setzeAktiveReihe, getFehlerbox, setzeFehlerboxEintrag, getFreischaltung } from './state.js';
import { offeneReihen } from './freischaltung-logik.js';
import { aufgabeSchluessel, neuerEintrag, planeWieder, verschiebeAufMorgen, naechsteFaellige, hilfeStufeFuer } from './fehlerbox-logik.js';
import { normalisiereAufgabe } from './aufgaben/normalisiere.js';
import { neueKlickSperre } from './klick-sperre.js';
import { reihenLaenge, istReiheFertig, fortschrittPunkte } from './reihe-logik.js';
import { BIOME_REIHENFOLGE, baselineMaxIndex } from './biome-logik.js';
import { escapeHtml, sprich } from './utils.js';

const MAX_FEHLVERSUCHE = 2;  // Nach 2 Fehlversuchen Lösung zeigen.

let letzteAufgabeKey = null;
function aufgabeKey(a) { return `${a.aufgabentyp}:${a.a}:${a.b}`; }
function istKleinkind(profile) {
  return profile.alter === 'kindergarten' || profile.alter === 'klasse-1';
}

// Würfel-Teich: Auswahl beim Betreten — Querbeet (adaptiv) oder gezielt eine Art.
// Der Tile-Tap zeigt IMMER die Auswahl; eine Wahl startet eine frische Reihe der Art
// (eine offene Reihe fortsetzen läuft separat über den „▶ Weitermachen"-Knopf in der Welt).
const RECHNEN10_ARTEN = [
  { label: '🎲 Querbeet', festeStufe: null },
  { label: '① Zerlegen', festeStufe: 1 },
  { label: '② Verliebte Zahlen', festeStufe: 2 },
  { label: '③ Plus & Minus', festeStufe: 3 },
];

export function oeffneRechnen10Auswahl(reward, { onClose } = {}) {
  const profile = getCurrentProfile();
  if (!profile) return;

  const knoepfe = RECHNEN10_ARTEN.map((a, i) =>
    `<button class="rechnen10-auswahl__knopf${a.festeStufe === null ? ' rechnen10-auswahl__knopf--querbeet' : ''}" data-idx="${i}">${a.label}</button>`).join('');
  let gewaehlt = false;
  const modal = oeffneModal({
    klassen: 'modal-backdrop--trainer',
    inhaltHtml: `<div class="modal modal--trainer">
      <div class="trainer__kopf">🦆 Was möchtest du üben?</div>
      <div class="rechnen10-auswahl__knoepfe">${knoepfe}</div>
    </div>`,
    onClose: () => { if (!gewaehlt && onClose) onClose(); },
  });
  if (!modal) return;
  modal.inhalt.querySelectorAll('[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const wahl = RECHNEN10_ARTEN[parseInt(btn.dataset.idx, 10)];
      gewaehlt = true;
      modal.schliessen();
      // Frische Reihe der gewählten Art: offene Teich-Reihe verwerfen, damit festeStufe greift.
      setzeAktiveReihe(profile.id, 'rechnen10', null);
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
    // Reihen-Freischaltung: Mal und Geteilt ziehen nur aus dem, was im Trainer offen ist.
    // Sonst bliebe die Sperre löchrig — im Biom liefe dem Kind weiterhin 7·8 über den Weg,
    // während die 7er-Reihe noch gar nicht dran ist.
    const erlaubteReihen = (typ === 'mal' || typ === 'geteilt')
      ? offeneReihen(getFreischaltung(profile.id, typ))
      : null;
    if (typ === 'mal') return generiereMalAufgabe(stufenConfig, pool.mal.distraktoren, erlaubteReihen);
    if (typ === 'mengen') return generiereMengenAufgabe(stufenConfig, pool.mengen.distraktoren);
    if (typ === 'minus') return generiereMinusAufgabe(stufenConfig, pool.minus.distraktoren);
    if (typ === 'rechnen10') return generiereRechnen10Aufgabe(stufenConfig, pool.rechnen10.distraktoren);
    if (typ === 'geteilt') return generiereGeteiltAufgabe(stufenConfig, pool.geteilt.distraktoren, erlaubteReihen);
    return generierePlusAufgabe(stufenConfig, pool.plus.distraktoren);
  }
  // Wiedervorlage aus der Fehler-Box (Leitner). Bewusst NUR jede zweite Aufgabe:
  // Bestünde eine Reihe nur aus alten Fehlern, wäre sie für das Kind eine Strafrunde.
  // Erfolg und Wiederholung müssen sich abwechseln, sonst bricht die Motivation weg.
  let letzteWarAusBox = false;

  function ausFehlerbox() {
    if (letzteWarAusBox) return null;
    const eintrag = naechsteFaellige(getFehlerbox(profile.id), typ);
    if (!eintrag) return null;
    // Konserve numerisch säubern (Live-Befund 2026-07-16: ergebnis als String "10" →
    // richtige Antwort wird abgelehnt). Nicht reparierbar → Eintrag löschen, sonst
    // bliebe er ewig „nächstfällig" und käme bei jeder zweiten Aufgabe wieder.
    const sauber = normalisiereAufgabe(eintrag.aufgabe);
    if (!sauber) {
      console.warn('[aufgabe-ui] Kaputte Fehlerbox-Konserve verworfen:', eintrag.schluessel);
      setzeFehlerboxEintrag(profile.id, eintrag.schluessel, null);
      return null;
    }
    return {
      ...sauber,
      // Marker für antwortPruefen(). Fährt mit der Reihe mit (wird persistiert).
      box: { schluessel: eintrag.schluessel, fach: eintrag.fach, hilfe: hilfeStufeFuer(eintrag) },
    };
  }

  function generiere() {
    const wieder = ausFehlerbox();
    if (wieder) {
      letzteWarAusBox = true;
      letzteAufgabeKey = aufgabeKey(wieder);
      return wieder;
    }
    letzteWarAusBox = false;
    let a = einmalGenerieren();
    // Nicht zweimal hintereinander dieselbe Aufgabe (wirkt sonst monoton).
    for (let v = 0; v < 6 && aufgabeKey(a) === letzteAufgabeKey; v++) a = einmalGenerieren();
    letzteAufgabeKey = aufgabeKey(a);
    return a;
  }

  // Laufende Reihe DIESES Bioms fortsetzen, sonst neue starten.
  // Auch die restaurierte Reihe ist eine Konserve (localStorage/Sync) — Aufgabe säubern;
  // nicht reparierbar → frische Aufgabe an gleicher Position (Reihe läuft normal weiter).
  let reihe = getAktiveReihe(profile.id, aktivBiom);
  if (reihe) {
    aktiveFesteStufe = reihe.festeStufe ?? null;
    const sauber = normalisiereAufgabe(reihe.aufgabe);
    if (sauber) {
      reihe.aufgabe = sauber;
    } else {
      console.warn('[aufgabe-ui] Kaputte Reihen-Konserve — Aufgabe wird frisch erzeugt.');
      reihe.aufgabe = generiere();
      reihe.fehlversuche = 0;
      setzeAktiveReihe(profile.id, reihe.biom, reihe);
    }
  }
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
// Hilfe-Ausschleichen für Aufgaben aus der Fehler-Box (fehlerbox-logik.js: HILFE).
// Der Sinn der Box ist Abruf, nicht Wiedererkennen — deshalb wird die Anschauung von Fach
// zu Fach zurückgenommen, bis das Kind die Aufgabe aus dem Kopf holt:
//   Fach 1 'voll'    → Würfelbild wie immer (er hat sie gerade erst nicht gekonnt)
//   Fach 2 'anstoss' → Bild ist da, aber verborgen. Er muss aktiv danach greifen.
//                      Selbst entscheiden „ich brauche noch Hilfe" ist der halbe Weg zum Abruf.
//   Fach 3 'keine'   → nichts. Jetzt muss es aus dem Kopf kommen.
//
// WICHTIG: Angefasst wird nur die Anschauung VOR dem Fehler. Die Leitplanke „nach 2
// Fehlversuchen wird die Lösung gezeigt" bleibt unangetastet — es entsteht kein Frust-Loop.
// Der geführte Stellenwert-Fall (.aufgabe__stellenwert) und das Legen der B-Mechanik
// (.aufgabe__legebereich) sind keine Hilfe, sondern die Aufgabe selbst — Finger weg.
function schleifeHilfeAus(inhalt, aufgabe) {
  const stufe = aufgabe.box?.hilfe;
  if (!stufe || stufe === 'voll') return;

  const bild = inhalt.querySelector('.aufgabe__visualisierung');
  if (!bild) return;

  if (stufe === 'keine') { bild.remove(); return; }

  // 'anstoss': verbergen, Kind kann sie sich selbst holen.
  bild.hidden = true;
  const knopf = document.createElement('button');
  knopf.className = 'aufgabe__hilfe-knopf';
  knopf.textContent = '💡 Ich brauche das Bild';
  knopf.addEventListener('click', () => { bild.hidden = false; knopf.remove(); });
  bild.insertAdjacentElement('beforebegin', knopf);
}

function rendereFrageInModal(modal, reihe, profile, maxStufe, onWeiter) {
  const aufgabe = reihe.aufgabe;
  const istKlein = istKleinkind(profile);
  const grosseZahl = aufgabe.a > 20 || aufgabe.b > 20;
  const mechanik = (aufgabe.aufgabentyp === 'mengen' || aufgabe.aufgabentyp === 'geteilt' || aufgabe.form === 'subitizing' || grosseZahl)
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
    schleifeHilfeAus(inhalt, aufgabe);
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
  // 'subitizing' wird nicht mehr erzeugt, aber alte (persistierte) Reihen sollen noch
  // korrekt rendern + abschließbar bleiben (Rückwärts-Kompatibilität).
  if (aufgabe.aufgabentyp === 'mengen' || aufgabe.form === 'subitizing') {
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
  // Doppeltipp-Schutz (Live-Befund 16.07., Ilian): gewertet wird höchstens alle 300 ms —
  // verriegelt auch beim Start und bei jedem Reveal, damit der rhythmische Lege-/Tipp-Finger
  // nicht auf frisch erschienenen Knöpfen landet.
  const sperre = neueKlickSperre();
  sperre.verriegeln(startZeit);

  function feedbackZeigen(text, klasse) {
    const fb = inhalt.querySelector('.aufgabe__feedback');
    fb.hidden = false;
    fb.className = `aufgabe__feedback aufgabe__feedback--${klasse}`;
    fb.textContent = text;
  }

  // Fehler-Box pflegen. Die einzige Stelle, die Einträge anlegt oder fortschreibt.
  // Regel: Aufstieg nur, wenn die Aufgabe AUF ANHIEB saß — das ist die Definition von
  // „abrufen können". Wer erst im zweiten Anlauf trifft, hat sie hergeleitet, nicht abgerufen.
  function pflegeFehlerbox(warRichtig, aufAnhieb) {
    const marker = aufgabe.box;
    if (!marker) {
      // Neue Aufgabe endgültig danebengegangen → sie kommt ab morgen wieder.
      if (!warRichtig) {
        const eintrag = neuerEintrag(aufgabe);
        if (eintrag) setzeFehlerboxEintrag(profile.id, eintrag.schluessel, eintrag);
      }
      return;
    }
    // Wiedervorlage: Fach hoch, halten oder zurück.
    const box = getFehlerbox(profile.id);
    const alt = box[marker.schluessel];
    if (!alt) return;   // Aufgabe wurde zwischenzeitlich (anderes Gerät) erledigt
    const neu = warRichtig
      ? (aufAnhieb ? planeWieder(alt, true) : verschiebeAufMorgen(alt))
      : planeWieder(alt, false);
    setzeFehlerboxEintrag(profile.id, marker.schluessel, neu);   // neu === null → verlässt die Box
  }

  // Bei Mal und Geteilt wandert die Reihe mit ins Protokoll. Grund: Sobald die Reihen
  // nacheinander aufgehen, sinkt der Gesamtschnitt zwangsläufig (anfangs nur 2er-Aufgaben,
  // später 7er). Ein späterer Fortschritts-Vergleich über alle Mal-Aufgaben würde dem Kind
  // deshalb anzeigen, es werde langsamer, während es besser wird. Rückwirkend ist das nicht
  // zu retten — deshalb ab jetzt mitschreiben.
  function detailFuer(aufgabe, maxStufe) {
    const stufe = aufgabe?.stufe ?? maxStufe;
    if ((aufgabe?.aufgabentyp === 'mal' || aufgabe?.aufgabentyp === 'geteilt') && aufgabe?.b) {
      return `stufe ${stufe} · reihe ${aufgabe.b}`;
    }
    return `stufe ${stufe}`;
  }

  function antwortPruefen(wert) {
    const jetzt = performance.now();
    if (sperre.istGesperrt(jetzt)) return;   // Nachzittern eines Doppeltipps — keine Wertung
    sperre.verriegeln(jetzt);
    const richtig = wert === aufgabe.ergebnis;
    if (richtig) {
      const zeit_ms = performance.now() - startZeit;
      pflegeFehlerbox(true, reihe.fehlversuche === 0);
      rapportiereErgebnis(profile.id, aufgabe.aufgabentyp, true, zeit_ms,
        { maxStufe, adaptStufe: !reihe.festeStufe, detail: detailFuer(aufgabe, maxStufe) });
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
      pflegeFehlerbox(false, false);
      rapportiereErgebnis(profile.id, aufgabe.aufgabentyp, false, zeit_ms,
        { maxStufe, adaptStufe: !reihe.festeStufe, detail: detailFuer(aufgabe, maxStufe) });
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
          sperre.verriegeln(performance.now());   // Reveal: Doppeltipp vom Weiter-Knopf abfangen
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
          sperre.verriegeln(performance.now());   // Reveal: der letzte Lege-Tipp darf nicht gleich antworten
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
