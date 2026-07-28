// Darstellung der Uhr im Zeitenland. Analog zu wuerfelhaus.js: eine statische Ansicht für
// Mechanik A (Ablesen) und eine interaktive für Mechanik B (Stellen, siehe Task 3).
// aufgabe-ui.js bekommt dadurch nur Verzweigungspunkte, keine Darstellungslogik.
import { sonnenPositionAmTag } from './aufgaben/uhr.js';

// Winkel in Grad, 12 Uhr = 0, im Uhrzeigersinn.
export function stundenWinkel(minuten) { return ((minuten % 720) / 720) * 360; }
export function minutenWinkel(minuten) { return ((minuten % 60) / 60) * 360; }

function zeigerLinie(winkelGrad, laenge, klasse) {
  const rad = (winkelGrad - 90) * (Math.PI / 180);
  const x = 100 + Math.cos(rad) * laenge;
  const y = 100 + Math.sin(rad) * laenge;
  return `<line class="zifferblatt__zeiger--${klasse}" x1="100" y1="100" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" />`;
}

// Höhe des Bodenstreifens (css .uhr-himmel__boden) — tiefer als das darf die Sonne nicht.
const BODEN_PX = 10;
// Luft über der Sonne. Sie sitzt über translate(-50%, 50%) auf ihrem Mittelpunkt und ragt
// deshalb rund eine halbe Glyphenhöhe (font-size 22px) über den bottom-Wert hinaus.
const GESTIRN_LUFT_PX = 14;

// Der Himmel ist die eigentliche Lektion: Sonne steigt = erste Runde, Sonne sinkt = zweite.
export function rendereHimmel(minuten) {
  const { x, hoehe, istNacht, istDaemmerung } = sonnenPositionAmTag(minuten);
  const gestirn = istNacht ? '🌙' : '☀️';
  const klasse = istNacht ? ' uhr-himmel--nacht' : (istDaemmerung ? ' uhr-himmel--rand' : '');
  // Die senkrechte Lage ergibt sich aus der TATSÄCHLICHEN Höhe des Himmelsbereichs
  // (--himmel-hoehe in css/zifferblatt.css), nicht aus einer fest eingebauten Zahl.
  // Vorher war die 68-Pixel-Fassung einbetoniert; der Mobil-Block senkt die Höhe auf 56 —
  // dadurch lag der Sonnen-Mittelpunkt um 12 Uhr auf der Oberkante und wurde bei
  // abgeschnittenem Überlauf beschnitten (Befund 29.07.2026), ausgerechnet der Scheitel, der
  // die ganze Lektion trägt. Als calc() gerechnet, geht jede spätere Höhenänderung im
  // Stylesheet automatisch mit.
  const abstandUnten =
    `calc(${BODEN_PX}px + ${hoehe.toFixed(3)} * (var(--himmel-hoehe, 68px) - ${BODEN_PX + GESTIRN_LUFT_PX}px))`;
  return `
    <div class="uhr-himmel${klasse}" aria-hidden="true">
      <span class="uhr-himmel__gestirn" style="left:${(x * 100).toFixed(1)}%;bottom:${abstandUnten}">${gestirn}</span>
      <div class="uhr-himmel__boden"></div>
    </div>
  `;
}

export function rendereUhr(minuten, options = {}) {
  const { minutenBeschriftung = true, zeigeHimmel = true } = options;
  const teile = [];

  for (let i = 0; i < 60; i++) {
    const winkel = (i / 60) * 360 - 90;
    const rad = winkel * (Math.PI / 180);
    const voll = i % 5 === 0;
    const r1 = voll ? 78 : 83, r2 = 88;
    teile.push(`<line class="zifferblatt__strich${voll ? ' zifferblatt__strich--voll' : ''}"
      x1="${(100 + Math.cos(rad) * r1).toFixed(1)}" y1="${(100 + Math.sin(rad) * r1).toFixed(1)}"
      x2="${(100 + Math.cos(rad) * r2).toFixed(1)}" y2="${(100 + Math.sin(rad) * r2).toFixed(1)}" />`);
  }

  for (let s = 1; s <= 12; s++) {
    const rad = ((s / 12) * 360 - 90) * (Math.PI / 180);
    teile.push(`<text class="zifferblatt__stundenzahl"
      x="${(100 + Math.cos(rad) * 64).toFixed(1)}" y="${(100 + Math.sin(rad) * 64).toFixed(1)}">${s}</text>`);
  }

  // Die Minuten-Beschriftung ist die HILFE, die das Fehler-Box-Fach ausschleicht
  // (siehe schleifeHilfeAus in aufgabe-ui.js). Zeiger und Himmel sind KEINE Hilfe,
  // sondern die Aufgabe selbst — die bleiben immer.
  if (minutenBeschriftung) {
    for (let s = 1; s <= 12; s++) {
      const rad = ((s / 12) * 360 - 90) * (Math.PI / 180);
      teile.push(`<text class="zifferblatt__minutenzahl"
        x="${(100 + Math.cos(rad) * 95).toFixed(1)}" y="${(100 + Math.sin(rad) * 95).toFixed(1)}">${s * 5}</text>`);
    }
  }

  const svg = `
    <svg class="zifferblatt__svg" viewBox="0 0 200 200" role="img" aria-label="Uhr">
      <circle class="zifferblatt__ring" cx="100" cy="100" r="88" />
      ${teile.join('')}
      ${zeigerLinie(stundenWinkel(minuten), 45, 'stunde')}
      ${zeigerLinie(minutenWinkel(minuten), 70, 'minute')}
      <circle class="zifferblatt__mitte" cx="100" cy="100" r="5" />
    </svg>
  `;

  return `<div class="zifferblatt">${zeigeHimmel ? rendereHimmel(minuten) : ''}${svg}</div>`;
}

// --- Reine Zeiger-Rechnung (node-testbar, Check: tools/check-zeiger-logik.mjs) ---

export function rasteMinuten(rohMinuten, rastung) {
  let gerastet = Math.round(rohMinuten / rastung) * rastung;
  // Tagesgrenzen NICHT hart auf 1439 klemmen — das würde die Rastung verletzen (z. B.
  // wäre 1439 bei Rastung 60 kein Vielfaches mehr). Stattdessen auf den letzten gültigen
  // Rastungs-Schritt vor Mitternacht bzw. den ersten ab 0 Uhr zurückfallen.
  if (gerastet > 1439) gerastet = Math.floor(1439 / rastung) * rastung;
  if (gerastet < 0) gerastet = 0;
  return gerastet;
}

// Zieh-Rastung der Stelluhr — bewusst von der Aufgaben-Rastung ENTKOPPELT (Befund
// 28.07.2026, Prüfungsrunde 2). Übernähme das Ziehen die Aufgaben-Rastung direkt, bewegen
// auf Stufe 1 (60 Minuten) aus einer Ruhelage heraus nur rund 4 von 360 Winkelgraden
// überhaupt die eingestellte Zeit — fast jede Zeigerbewegung wird entweder weggerundet
// oder als Überlauf über die 12 gewertet und hebt sich auf (siehe winkelZuMinuten: erst ab
// mehr als einer halben Umdrehung Unterschied zählt ein Überlauf, bei grober Rastung tritt
// dieser Fall fast immer ein). Ausgerechnet das trifft die Auffangstufe: Hierher schaltet
// die App, wenn ein Kind beim Ablesen schon zweimal danebenlag — eine Uhr, die sich in
// diesem Moment tot anfühlt, ist schlimmer als keine Auffangstufe.
//
// Deshalb gilt beim Ziehen höchstens ein 15-Minuten-Schritt, nie feiner als die
// Aufgabenstufe ohnehin verlangt (Math.min ist nie GRÖBER als aufgabenRastung) — die
// Anforderung an das Kind sinkt dadurch nicht, nur die Bedienung wird benutzbar. Bei
// unseren RASTUNG-Werten {60,30,15,5} (js/aufgaben/uhr.js) ist das Ergebnis immer ein
// Teiler der Aufgaben-Rastung — genau das hält jeden geforderten Zielwert exakt
// erreichbar. NICHT wieder mit der Aufgaben-Rastung vereinheitlichen, ohne diese Begründung
// neu zu widerlegen — siehe tools/check-zeiger-logik.mjs („Bewegbarkeit"/„Erreichbarkeit"),
// das genau diese beiden Eigenschaften absichert.
export function ziehRastungFuer(aufgabenRastung) {
  return Math.min(aufgabenRastung, 15);
}

// Der Minutenzeiger nimmt den Stundenzeiger mit — eine Uhr, bei der beide Zeiger unabhängig
// springen, gibt es nicht. Und genau die Zwischenstellung des Stundenzeigers ist der Grund,
// warum „halb vier" nicht 4:30 heißt.
// Über die 12 hinaus läuft der Zeiger rund weiter in die nächste Stunde, statt zurückzuspringen.
export function winkelZuMinuten(winkelGrad, aktuelleMinuten) {
  const zielMinute = ((winkelGrad % 360) + 360) % 360 / 6;   // 0..59.99
  const stunde = Math.floor(aktuelleMinuten / 60);
  const alteMinute = aktuelleMinuten % 60;
  let neueStunde = stunde;
  // Sprung über die 12 erkennen: mehr als eine halbe Umdrehung Unterschied heißt,
  // der Finger ist über die 12 gegangen.
  if (alteMinute - zielMinute > 30) neueStunde += 1;
  else if (zielMinute - alteMinute > 30) neueStunde -= 1;
  const gesamt = neueStunde * 60 + Math.round(zielMinute);
  return Math.min(1439, Math.max(0, gesamt));
}

// B-Mechanik: Das Kind zieht die Zeiger, Sonne und Himmel wandern live mit. Das ist die
// eingebaute Hilfestufe — adaptiv.js schaltet hierher, wenn Ablesen hakt.
export function rendereStelluhr(startMinuten, container, onChange, options = {}) {
  const { rastung = 15 } = options;
  // Bewusst `let` und NICHT aus options destrukturiert-konstant: Die Hilfestufe der
  // Fehler-Box kann während der Aufgabe umschlagen (Knopf „💡 Ich brauche die Minuten").
  // Weil zeichne() bei JEDER Zeigerbewegung neu zeichnet, muss die Einstellung hier im
  // Verschluss liegen — eine nachträgliche DOM-Reparatur wäre nach dem ersten Ziehen wieder
  // fort. Umgeschaltet wird ausschließlich über setzeMinutenBeschriftung() unten.
  let zeigeMinuten = options.minutenBeschriftung ?? true;
  let minuten = rasteMinuten(startMinuten, rastung);

  // touch-action muss auf dem GESAMTEN Ziehbereich liegen: Die Pointer-Listener hängen
  // unten am `container` (er umschließt Himmel UND Zifferblatt), nicht nur am SVG. Die
  // CSS-Klasse .zifferblatt__svg--stellbar (touch-action: none) sitzt aber nur auf dem
  // SVG selbst — beginnt ein Zug auf dem Himmelsbild, scrollt das Handy die Seite mit,
  // während der Zeiger gleichzeitig springt (Live-Befund 28.07.2026). Deshalb hier direkt
  // auf dem Container gesetzt, EINMALIG außerhalb von zeichne(): zeichne() ersetzt nur
  // die Kinder über innerHTML, der Container-Knoten selbst bleibt über alle Redraws hinweg
  // derselbe, der Stil geht also nicht verloren.
  container.style.touchAction = 'none';

  function zeichne() {
    container.innerHTML = rendereUhr(minuten, { minutenBeschriftung: zeigeMinuten, zeigeHimmel: true });
    container.querySelector('.zifferblatt__svg')?.classList.add('zifferblatt__svg--stellbar');
  }

  function ausZeigerPosition(ev) {
    const svg = container.querySelector('.zifferblatt__svg');
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    // Diese Rechnung setzt voraus, dass r.width === r.height ist — nur dann entspricht
    // das Verhältnis von dx zu dy dem quadratischen Koordinatensystem des SVG (viewBox
    // "0 0 200 200"). Wäre der Rahmen rechteckig (z. B. weil CSS width und height
    // unabhängig voneinander begrenzt), würde Math.atan2 einen verzerrten Winkel liefern —
    // das Kind zieht auf eine Stelle, der Zeiger springt woandershin. Deshalb erzwingt
    // css/zifferblatt.css für .zifferblatt__svg `aspect-ratio: 1 / 1` + `height: auto`
    // statt eines zweiten festen Höhenwerts: Breite und Höhe dürfen nie getrennt
    // begrenzbar sein. Diese Kopplung nicht entfernen, ohne diese Stelle mitzudenken.
    const dx = ev.clientX - (r.left + r.width / 2);
    const dy = ev.clientY - (r.top + r.height / 2);
    const winkel = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    const neu = rasteMinuten(winkelZuMinuten(winkel, minuten), rastung);
    if (neu === minuten) return;
    minuten = neu;
    zeichne();
    onChange(minuten);
  }

  let zieht = false;
  container.addEventListener('pointerdown', (ev) => {
    // Nur Berührungen IM Zifferblatt bewegen die Zeiger (Befund 29.07.2026). Vorher hing der
    // Listener am gesamten Container und wertete sofort aus — ein Tipp auf das Himmelsbild
    // verstellte damit die Uhr. Der Himmel ist aber das didaktische Element, das ein Kind
    // naturgemäß antippt („warum steht die Sonne da?"), und kein Bedienelement.
    // Die touch-action bleibt trotzdem auf dem GESAMTEN Container (siehe oben) — sonst
    // scrollt das Handy, sobald ein Zug über das Himmelsbild läuft.
    if (!(ev.target instanceof Element) || !ev.target.closest('.zifferblatt__svg')) return;
    zieht = true;
    container.setPointerCapture?.(ev.pointerId);
    ausZeigerPosition(ev);
  });
  container.addEventListener('pointermove', (ev) => { if (zieht) ausZeigerPosition(ev); });
  container.addEventListener('pointerup', () => { zieht = false; });
  container.addEventListener('pointercancel', () => { zieht = false; });

  zeichne();
  return {
    getMinuten: () => minuten,
    // Blendet die Minuten-Beschriftung nachträglich ein oder aus — überlebt jede
    // Zeigerbewegung, weil zeichne() den Wert aus dem Verschluss liest (siehe oben).
    setzeMinutenBeschriftung(anzeigen) {
      if (zeigeMinuten === anzeigen) return;
      zeigeMinuten = anzeigen;
      zeichne();
    },
  };
}
