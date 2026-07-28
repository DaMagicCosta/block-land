import { oeffneModal, schliesseAlleModals } from './modal.js';
import { rendereZehnerhaus, rendereLegehaus, rendereStatischesFeld } from './wuerfelhaus.js';
import { generierePlusAufgabe } from './aufgaben/plus.js';
import { generiereMalAufgabe } from './aufgaben/mal.js';
import { generiereMengenAufgabe } from './aufgaben/mengen.js';
import { generiereMinusAufgabe } from './aufgaben/minus.js';
import { generiereRechnen10Aufgabe } from './aufgaben/rechnen10.js';
import { generiereGeteiltAufgabe } from './aufgaben/geteilt.js';
import { generiereUhrAufgabe, formatiereZeit, formatiereDigital, RASTUNG, wuerfleAngezeigteSprechweise } from './aufgaben/uhr.js';
import { rendereUhr, rendereStelluhr, ziehRastungFuer } from './zifferblatt.js';
import { rendereStellenwert } from './stellenwert.js';
import { verteileBelohnung } from './belohnung.js';
import { loadAufgabenPool, loadBiomManifest } from './data.js';
import { waehleMechanik, aktuelleStufe, rapportiereErgebnis } from './adaptiv.js';
import { getCurrentProfile, getAktivesBiom, schalteNaechstesBiomFrei, getAktiveReihe, setzeAktiveReihe, getFehlerbox, setzeFehlerboxEintrag, getFreischaltung, getSprechweise } from './state.js';
import { offeneReihen, ohneEinserreihe, nurEineReiheOffen, beuteFaktor } from './freischaltung-logik.js';
import { aufgabeSchluessel, neuerEintrag, planeWieder, verschiebeAufMorgen, naechsteFaellige, hilfeStufeFuer } from './fehlerbox-logik.js';
import { normalisiereAufgabe } from './aufgaben/normalisiere.js';
import { neueKlickSperre } from './klick-sperre.js';
import { reihenLaenge, istReiheFertig, fortschrittPunkte } from './reihe-logik.js';
import { beuteNiveau } from './biome-logik.js';
import { escapeHtml, sprich } from './utils.js';

const MAX_FEHLVERSUCHE = 2;  // Nach 2 Fehlversuchen Lösung zeigen.

let letzteAufgabeKey = null;
function aufgabeKey(a) { return `${a.aufgabentyp}:${a.a}:${a.b}`; }

// Zähler für den Hütten-Hinweis (siehe zeigeReiheGeschafft): bewusst nicht bei JEDER
// abgeschlossenen Reihe, sonst wird er bei einem Kind, das zwangsläufig viele Reihen auf
// derselben einzigen offenen Reihe übt, zur Nörgelei. Gleiches Muster wie letzteWarAusBox
// weiter unten ("nur jede zweite"), nur session-weit statt pro Frage.
let huettenHinweisZaehler = 0;
function sollHuettenHinweisZeigen(profile, typ) {
  // Nur Mal/Geteilt kennen einen Reihen-Trainer — andere Biome (Plus, Mengen, ...) haben
  // keine Trainer-Hütte, der Hinweis wäre dort sinnlos.
  if (typ !== 'mal' && typ !== 'geteilt') return false;
  if (!nurEineReiheOffen(getFreischaltung(profile.id, typ), typ)) return false;
  huettenHinweisZaehler++;
  return huettenHinweisZaehler % 2 === 1;
}
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
    // Bei Mal zusätzlich die 1er ausgeschlossen (Nachtrag A): sie läuft in der Freischaltung nur
    // trivial mit und wäre sonst rund die Hälfte aller freien Aufgaben auf Stufe 1 — für ein
    // Kind, das schon Übungsverlauf hat, Langeweile statt Übung. Geteilt filtert die 1 bereits
    // selbst im Erzeuger (js/aufgaben/geteilt.js), hier bewusst nicht doppelt angefasst.
    const erlaubteReihen = typ === 'mal'
      ? ohneEinserreihe(offeneReihen(getFreischaltung(profile.id, typ)))
      : typ === 'geteilt'
        ? offeneReihen(getFreischaltung(profile.id, typ))
        : null;
    if (typ === 'mal') return generiereMalAufgabe(stufenConfig, pool.mal.distraktoren, erlaubteReihen);
    if (typ === 'mengen') return generiereMengenAufgabe(stufenConfig, pool.mengen.distraktoren);
    if (typ === 'minus') return generiereMinusAufgabe(stufenConfig, pool.minus.distraktoren);
    if (typ === 'rechnen10') return generiereRechnen10Aufgabe(stufenConfig, pool.rechnen10.distraktoren);
    if (typ === 'geteilt') return generiereGeteiltAufgabe(stufenConfig, pool.geteilt.distraktoren, erlaubteReihen);
    if (typ === 'uhr') return generiereUhrAufgabe(stufenConfig);
    return generierePlusAufgabe(stufenConfig, pool.plus.distraktoren);
  }
  // Wiedervorlage aus der Fehler-Box (Leitner). Bewusst NUR jede zweite Aufgabe:
  // Bestünde eine Reihe nur aus alten Fehlern, wäre sie für das Kind eine Strafrunde.
  // Erfolg und Wiederholung müssen sich abwechseln, sonst bricht die Motivation weg.
  let letzteWarAusBox = false;

  function ausFehlerbox() {
    if (letzteWarAusBox) return null;
    // Bewusst OHNE Reihen-Filter: eine fällige Box-Konserve kann eine Reihe zeigen, die die
    // Reihen-Freischaltung noch gar nicht offen hat (z.B. 7·8, während die 7er-Reihe noch
    // gesperrt ist) — anders als einmalGenerieren() oben, das über erlaubteReihen streng an
    // die Freischaltung gebunden ist. Das ist keine Lücke, sondern Entscheidung: Die Box zeigt
    // eine bekannte, bereits gescheiterte Aufgabe erneut — fachlich vertretbar unabhängig vom
    // aktuellen Freischaltungsstand, weil das Kind ihr schon einmal begegnet ist.
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
    // Uhr-Konserve: zeigeDigital NICHT aus der Box übernehmen (Live-Befund 28.07.2026).
    // Die Konserve wurde ggf. beim ursprünglichen Fehlversuch mit einer gewürfelten Form
    // gespeichert (rendereFrageInModal schreibt zeigeDigital auf dasselbe Aufgabe-Objekt,
    // das pflegeFehlerbox() unverändert einlagert). Bliebe das Feld gesetzt, würde
    // rendereFrageInModal es nie neu würfeln (der Guard dort prüft nur „noch undefined") —
    // die Wiedervorlage käme jedes Mal in derselben Form zurück. Das entfernt genau den
    // Lernzweck der Box: „dreiviertel vier" und „15:45" als dieselbe Zeit erkennen.
    delete sauber.zeigeDigital;
    // Dieselbe Überlegung gilt für die Sprechweise DIESER Frage (angezeigteSprechweise,
    // siehe rendereFrageInModal): bliebe sie aus der Konserve stehen, käme eine
    // Fehlerbox-Wiedervorlage jedes Mal in derselben Sprechweise zurück, statt neu zwischen
    // eingestellter und anderer Form zu würfeln.
    delete sauber.angezeigteSprechweise;
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
      zeigeReiheGeschafft(modal, istKleinkind(profile), sollHuettenHinweisZeigen(profile, typ));
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

  // Die Uhr regelt ihr Ausschleichen NICHT hier, sondern beim Zeichnen: rendereUhr() und
  // rendereStelluhr() bekommen die Hilfestufe als Parameter (uhrHilfeStufe/baueAufgabeInhalt,
  // verdrahtet in starteAufgabe). Grund (Befund 29.07.2026): In der Stell-Form heißt der
  // Container `.aufgabe__stelluhr` und ist zum Aufrufzeitpunkt noch leer — hier war also gar
  // nichts zu finden, Fach 2 und 3 zeigten die volle Beschriftung. Und selbst eine
  // nachträgliche DOM-Reparatur wäre nach der ersten Zeigerbewegung wieder fort, weil die
  // Stelluhr bei jeder Bewegung neu zeichnet.
  if (aufgabe.aufgabentyp === 'uhr') return;

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
  // zeigeDigital wird beim Rendern gewürfelt, nicht im Generator — es ist eine reine
  // Anzeige-Entscheidung für DIESE Frageninstanz (wird z. B. beim erneuten Rendern nach
  // Mitten-drin-Verlassen NICHT neu gewürfelt, damit eine offene Frage nicht die Form
  // wechselt). Bei Wiedervorlage aus der Fehler-Box ist das Feld hier absichtlich wieder
  // `undefined`: ausFehlerbox() oben entfernt es explizit aus der Konserve, bevor sie zu
  // reihe.aufgabe wird — genau deshalb würfelt dieser Guard bei jeder Box-Wiedervorlage neu.
  if (aufgabe.aufgabentyp === 'uhr' && aufgabe.zeigeDigital === undefined) {
    aufgabe.zeigeDigital = Math.random() < 0.5;
  }
  // Sprechweise DIESER Frage — gleiches Muster wie zeigeDigital direkt darüber: einmal pro
  // Frageninstanz gewürfelt, über Fehlversuche und erneutes Rendern hinweg stabil, bei
  // Fehlerbox-Wiedervorlage neu entschieden (ausFehlerbox() unten entfernt das Feld explizit
  // aus der Konserve). Erst ab Stufe 3 kommen Viertelstunden vor — darunter bleibt es immer
  // bei der eingestellten Form, ein Wechsel hätte noch keinen Gegenstand. Ab Stufe 3 zeigt sich
  // mit halber Wahrscheinlichkeit statt der eingestellten Form die jeweils andere: die
  // eingestellte bleibt die Hauptform (Übereinstimmung mit der Schule), die andere kommt
  // gelegentlich daneben vor, genau daran soll das Kind erkennen, dass beide dieselbe Zeit
  // meinen (siehe Kommentar in aufgaben/uhr.js: „dreiviertel vier"/„viertel vor vier" führen
  // auf denselben Wert, nie zwei richtige Knöpfe).
  if (aufgabe.aufgabentyp === 'uhr' && aufgabe.angezeigteSprechweise === undefined) {
    aufgabe.angezeigteSprechweise = wuerfleAngezeigteSprechweise(aufgabe.stufe, getSprechweise(profile.id));
  }
  const istKlein = istKleinkind(profile);
  // Bei der Uhr sind a/b Stunde und Minute, keine Rechengröße — die Schwelle für „große Zahl"
  // (die bei Plus/Minus das Würfelbild sinnlos macht) darf hier nicht greifen.
  const grosseZahl = aufgabe.aufgabentyp !== 'uhr' && (aufgabe.a > 20 || aufgabe.b > 20);
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

// Der data-wert eines Antwort-Knopfes ist IMMER die Zahl (antwortPruefen vergleicht strikt).
// Nur die Beschriftung unterscheidet sich: Die Uhr zeigt mal die gesprochene, mal die
// geschriebene Form — beide führen auf denselben Wert. Genau dadurch lernt das Kind, dass
// „dreiviertel vier" und „15:45" dasselbe meinen. Innerhalb der gesprochenen Form gilt
// dasselbe Prinzip nochmal eine Ebene tiefer: aufgabe.angezeigteSprechweise (siehe
// rendereFrageInModal) entscheidet EINMAL pro Frage zwischen „sued"/„nord" — alle Knöpfe
// UND die Lösungsanzeige (zeigeLoesung ruft dieselbe Funktion auf) einer Frage benutzen
// dieselbe Form. Fallback auf getSprechweise, falls die Frage das Feld ausnahmsweise nicht
// trägt (defensiv, sollte über rendereFrageInModal immer gesetzt sein).
function knopfBeschriftung(wert, aufgabe, profile) {
  if (aufgabe.aufgabentyp !== 'uhr') return String(wert);
  return aufgabe.zeigeDigital
    ? formatiereDigital(wert)
    : formatiereZeit(wert, aufgabe.angezeigteSprechweise ?? getSprechweise(profile.id));
}

function baueOptionenHtml(aufgabe, profile) {
  return aufgabe.antwort_optionen.map(opt =>
    `<button class="aufgabe__option" data-wert="${opt}">${escapeHtml(knopfBeschriftung(opt, aufgabe, profile))}</button>`
  ).join('');
}

// Hilfestufe der Fehler-Box für eine Uhr-Aufgabe ('voll' | 'anstoss' | 'keine').
// Ohne Box-Marker (normale, nicht wiedervorgelegte Aufgabe) gilt immer 'voll'.
function uhrHilfeStufe(aufgabe) {
  return aufgabe.box?.hilfe ?? 'voll';
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
  if (aufgabe.aufgabentyp === 'uhr') {
    const profile = getCurrentProfile();
    // Hilfe-Ausschleichen der Fehler-Box: Bei der Uhr ist die HILFE ausschließlich die äußere
    // Minuten-Beschriftung. Zifferblatt, Zeiger und Himmel sind die Aufgabe selbst und
    // bleiben in JEDEM Fach. Die Stufe wird beim Zeichnen durchgereicht, nicht danach im DOM
    // repariert — siehe Kommentar in schleifeHilfeAus().
    const hilfe = uhrHilfeStufe(aufgabe);
    const zeigeMinuten = hilfe === 'voll';
    const hilfeKnopf = hilfe === 'anstoss'
      ? '<button class="aufgabe__hilfe-knopf" data-uhr-hilfe>💡 Ich brauche die Minuten</button>'
      : '';
    if (mechanik === 'B') {
      // Stellen: Die Zeit steht als Text da, das Kind zieht die Zeiger.
      const ziel = aufgabe.zeigeDigital
        ? formatiereDigital(aufgabe.ergebnis)
        : formatiereZeit(aufgabe.ergebnis, aufgabe.angezeigteSprechweise ?? getSprechweise(profile.id));
      return `
        <div class="aufgabe__text">Stell die Uhr auf ${escapeHtml(ziel)}</div>
        ${hilfeKnopf}
        <div class="aufgabe__stelluhr" data-soll="${aufgabe.ergebnis}"></div>
        <div class="aufgabe__optionen" hidden></div>
        <div class="aufgabe__feedback" hidden></div>
      `;
    }
    return `
      <div class="aufgabe__text">${escapeHtml(aufgabe.text)}</div>
      ${hilfeKnopf}
      <div class="aufgabe__visualisierung">${rendereUhr(aufgabe.ergebnis, { minutenBeschriftung: zeigeMinuten })}</div>
      <div class="aufgabe__optionen">${baueOptionenHtml(aufgabe, profile)}</div>
      <div class="aufgabe__feedback" hidden></div>
    `;
  }
  const aufgabenText = `<div class="aufgabe__text">${aufgabe.text}</div>`;

  if (mechanik === 'A') {
    const profile = getCurrentProfile();
    if (istStellenwertFall(aufgabe)) {
      // Optionen zunächst verborgen — werden nach den Schritten (oder per Skip) gezeigt.
      return `
        ${aufgabenText}
        <div class="aufgabe__stellenwert"></div>
        <div class="aufgabe__optionen" hidden>${baueOptionenHtml(aufgabe, profile)}</div>
        <div class="aufgabe__feedback" hidden></div>
      `;
    }
    const visualisierung = baueVisualisierung(aufgabe);
    return `
      ${aufgabenText}
      ${visualisierung}
      <div class="aufgabe__optionen">${baueOptionenHtml(aufgabe, profile)}</div>
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
      // In der Stell-Form (Uhr + Mechanik B) steht die Zielzeit im Klartext im Aufgabentext
      // („Stell die Uhr auf dreiviertel vier"), und der richtige Antwortknopf trägt wörtlich
      // dieselbe Beschriftung. Das Kind zieht die Zeiger, bis die Knöpfe erscheinen, und
      // tippt den textgleichen — ein Treffer belegt hier also KEIN Abrufen aus dem Kopf,
      // sondern nur einen Textvergleich. Als „auf Anhieb gekonnt" gewertet, würde die
      // Aufgabe im Fehler-Box-Fach aufsteigen und mit weniger Hilfe wiederkommen, ohne dass
      // das Kind sie je abgerufen hätte — genau der Mechanismus, gegen den die Box gebaut
      // wurde. Deshalb wie ein Treffer im zweiten Anlauf behandelt: Fach bleibt, die Aufgabe
      // kommt wieder, ein Fehler wird nicht angerechnet (verschiebeAufMorgen in pflegeFehlerbox).
      const istStellForm = aufgabe.aufgabentyp === 'uhr' && mechanik === 'B';
      pflegeFehlerbox(true, reihe.fehlversuche === 0 && !istStellForm);
      rapportiereErgebnis(profile.id, aufgabe.aufgabentyp, true, zeit_ms,
        { maxStufe, adaptStufe: !reihe.festeStufe, detail: detailFuer(aufgabe, maxStufe) });
      // Niveau-Abstufung: in Biomen UNTER der Schulstufe weniger Basis-Drops + kein Premium.
      // Die Einstufung hängt an der Biom-Kennung, NICHT an der Listenposition (siehe
      // beuteNiveau in js/biome-logik.js) — sonst würde jedes neu angehängte Biom die
      // Beute in allen bestehenden Ländern absenken.
      const biomId = getAktivesBiom(profile.id);
      const { faktor: biomFaktor, premiumErlaubt } = beuteNiveau(profile.alter, biomId);
      // Premium-Beute zusätzlich am Reihen-Fortschritt skaliert — nur Mal/Geteilt kennen eine
      // Reihen-Freischaltung, alle anderen Rechenarten bleiben bei 1 (siehe beuteFaktor).
      const reihenFaktor = (aufgabe.aufgabentyp === 'mal' || aufgabe.aufgabentyp === 'geteilt')
        ? beuteFaktor(getFreischaltung(profile.id, aufgabe.aufgabentyp))
        : 1;
      const gegeben = verteileBelohnung(aufgabe.stufe, maxStufe, reihe.reward.item, biomFaktor, premiumErlaubt, reihenFaktor);
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
      zeigeLoesung(aufgabe, profile, modal, istKleinkind(profile), onWeiter);
      return;
    }
    feedbackZeigen('Versuch es nochmal!', 'fehler');
    if (istKleinkind(profile)) sprich('Versuch es nochmal!');
    inhalt.classList.add('aufgabe--puls-fehler');
    setTimeout(() => inhalt.classList.remove('aufgabe--puls-fehler'), 600);
  }

  // Hilfe-Knopf der Uhr (Fach 2 'anstoss'). Er wird beim Bauen erzeugt (baueAufgabeInhalt)
  // und hier verdrahtet, weil erst hier die gezeichnete Uhr bzw. ihre Steuerung vorliegt.
  const uhrHilfeKnopf = inhalt.querySelector('[data-uhr-hilfe]');

  if (mechanik === 'A') {
    if (uhrHilfeKnopf) {
      uhrHilfeKnopf.addEventListener('click', () => {
        const bild = inhalt.querySelector('.aufgabe__visualisierung');
        // Neu zeichnen statt im DOM herumzuschneiden — dieselbe Quelle wie beim ersten Bauen.
        if (bild) bild.innerHTML = rendereUhr(aufgabe.ergebnis, { minutenBeschriftung: true });
        uhrHilfeKnopf.remove();
      });
    }
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
    const stelluhr = inhalt.querySelector('.aufgabe__stelluhr');
    if (stelluhr) {
      const soll = parseInt(stelluhr.dataset.soll, 10);
      const aufgabenRastung = RASTUNG[aufgabe.stufe] ?? 15;
      // Zieh-Rastung ist bewusst von der Aufgaben-Rastung entkoppelt — Begründung und
      // Eigenschaften stehen bei ziehRastungFuer() in js/zifferblatt.js.
      const ziehRastung = ziehRastungFuer(aufgabenRastung);
      // Startzeit bewusst versetzt: Stünde die Uhr schon richtig, wäre nichts zu tun. Der
      // Versatz richtet sich nach der ZIEH-Rastung, nicht der Aufgaben-Rastung — sonst wären
      // es auf Stufe 1 bis zu drei Stunden Unterschied. Sichtbar daneben reicht, keine
      // Weltreise.
      const start = Math.max(0, Math.min(1439, soll - ziehRastung * 3));
      const steuerung = rendereStelluhr(start, stelluhr, (minuten) => {
        const optionen = inhalt.querySelector('.aufgabe__optionen');
        if (minuten !== soll) {
          // Uhr wieder verstellt: Antwortknöpfe verschwinden erneut (Befund 29.07.2026).
          // Sonst blieben sie nach einem Treffer stehen, und das Kind könnte antworten,
          // während das Zifferblatt längst eine andere Zeit zeigt.
          if (!optionen.hidden) { optionen.hidden = true; optionen.innerHTML = ''; }
          return;
        }
        if (!optionen.hidden) return;
        optionen.hidden = false;
        optionen.innerHTML = baueOptionenHtml(aufgabe, profile);
        optionen.querySelectorAll('.aufgabe__option').forEach(btn => {
          btn.addEventListener('click', () => antwortPruefen(parseInt(btn.dataset.wert, 10)));
        });
        sperre.verriegeln(performance.now());   // Reveal: der letzte Zieh-Tipp darf nicht gleich antworten
      }, { rastung: ziehRastung, minutenBeschriftung: uhrHilfeStufe(aufgabe) === 'voll' });
      if (uhrHilfeKnopf) {
        uhrHilfeKnopf.addEventListener('click', () => {
          steuerung.setzeMinutenBeschriftung(true);   // überlebt jede weitere Zeigerbewegung
          uhrHilfeKnopf.remove();
        });
      }
      return;
    }

    const legeBereich = inhalt.querySelector('.aufgabe__legebereich');
    const sollZahl = parseInt(legeBereich.dataset.soll, 10);
    const startGefuellt = parseInt(legeBereich.dataset.start ?? '0', 10) || 0;
    rendereLegehaus(sollZahl, legeBereich, (aktuell, gesamt) => {
      if (aktuell === gesamt) {
        const optionen = inhalt.querySelector('.aufgabe__optionen');
        if (optionen.hidden) {
          optionen.hidden = false;
          optionen.innerHTML = baueOptionenHtml(aufgabe, profile);
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
  sanduhr: { e: '⌛', l: 'Sanduhr' },
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

// Lösungs-Anzeige nach 2 Fehlversuchen. Bei der Uhr ist aufgabe.ergebnis die Minutenzahl
// seit Mitternacht — für die Anzeige gilt dieselbe Darstellungsentscheidung wie für die
// Antwort-Knöpfe DIESER Frage (knopfBeschriftung, gesteuert über aufgabe.zeigeDigital),
// sonst stünde hier „Die Lösung ist 450." statt einer lesbaren Uhrzeit. Für alle anderen
// Aufgabentypen liefert knopfBeschriftung unverändert String(wert) — keine Änderung.
function zeigeLoesung(aufgabe, profile, modal, istKlein = false, onWeiter = null) {
  const loesungsText = escapeHtml(knopfBeschriftung(aufgabe.ergebnis, aufgabe, profile));
  modal.inhalt.querySelector('.aufgabe__inhalt').innerHTML = `
    <div class="aufgabe__loesung">
      <div class="aufgabe__text">${aufgabe.text}</div>
      <div class="aufgabe__loesung-text">Die Lösung ist <strong>${loesungsText}</strong>.</div>
      <p class="aufgabe__loesung-hinweis">Macht nichts — beim nächsten Mal klappt es!</p>
      <button class="modal__close">Weiter</button>
    </div>
  `;
  const weiter = modal.inhalt.querySelector('.modal__close');
  if (istKlein) {
    sprich(`Die Lösung ist ${loesungsText}. Tippe auf Weiter.`);
    weiter.classList.add('modal__close--puls');
  }
  weiter.addEventListener('click', onWeiter ?? (() => modal.schliessen()));
}

// Abschluss-Feier am Ende einer Reihe (kein Extra-Material — Belohnungs-Neutralität).
// huettenHinweis: beiläufiger Hinweis auf den Reihen-Trainer (siehe sollHuettenHinweisZeigen
// oben, das auch das „nur jede zweite Reihe" drosselt) — bewusst hier statt bei jeder
// einzelnen Aufgabe, damit er nicht zur Nörgelei wird. Ziel, kein Vorwurf: kein „gesperrt",
// kein „musst du" — nur wo die nächste Reihe herkommt.
function zeigeReiheGeschafft(modal, istKlein = false, huettenHinweis = false) {
  const huetteHtml = huettenHinweis
    ? `<p class="feier__unlock">🛖 In der Hütte kannst du die nächste Reihe aufmachen.</p>`
    : '';
  modal.inhalt.innerHTML = `
    <div class="modal modal--erfolg">
      <div class="modal__emoji feier__huepf">🏆</div>
      <div class="feier__konfetti">✨🎊⭐🎉✨</div>
      <div class="modal__titel">REIHE GESCHAFFT!</div>
      <p class="modal__text">Super durchgehalten!</p>
      ${huetteHtml}
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
