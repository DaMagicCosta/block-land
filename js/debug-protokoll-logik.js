// Fehler-Raupe: pure Logik für Protokoll und Meldung.
// Spec: docs/superpowers/specs/2026-09-15-fehler-raupe-design.md
// KEINE DOM-/State-Abhängigkeit (Check: node tools/check-debug-protokoll-logik.mjs).

export const PROTOKOLL_MAX = 50;          // so viele Schritte reichen zurück
export const MELDUNG_MAX_ZEICHEN = 20000; // eine Zelle im Familien-Blatt fasst 50.000
export const MELDE_ABSTAND_MS = 60000;    // gegen Dauertippen: höchstens eine Meldung je Minute
export const FENSTERTEXT_MAX = 1500;

export const GRUENDE = [
  { id: 'antwort', emoji: '🎯', text: 'Die richtige Antwort fehlt' },
  { id: 'haengt',  emoji: '⏳', text: 'Etwas hängt oder geht nicht' },
  { id: 'komisch', emoji: '👀', text: 'Das sieht komisch aus' },
  { id: 'anderes', emoji: '💬', text: 'Etwas anderes' },
];

// Leerraum zusammenziehen, auf max Zeichen kürzen (mit Auslassungszeichen).
export function kuerze(text, max) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

// Ringpuffer: hinten anfügen, bei Überlauf das Älteste verwerfen. NEUES Array.
export function fuegeEintrag(liste, eintrag, max = PROTOKOLL_MAX) {
  const neu = [...(Array.isArray(liste) ? liste : []), eintrag];
  return neu.length > max ? neu.slice(neu.length - max) : neu;
}

// Kurzbeschreibung eines getippten Elements: { tag, klassen, text, wert }.
// Eingabefelder bekommen NIE ihren Inhalt ins Protokoll (PIN, Namen, Schlüssel).
export function beschreibeZiel(ziel) {
  const tag = String(ziel?.tag ?? '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return 'Eingabe im Feld';
  const klasse = ((ziel?.klassen ?? []).find(k => k && !k.startsWith('is-') && k !== 'aktiv') ?? tag) || '?';
  const text = kuerze(ziel?.text, 40);
  const hatWert = ziel?.wert !== undefined && ziel?.wert !== null && ziel?.wert !== '';
  return `${klasse}${text ? ` „${text}"` : ''}${hatWert ? ` (Wert ${ziel.wert})` : ''}`;
}

export function darfMelden(letzteMs, jetztMs, abstand = MELDE_ABSTAND_MS) {
  return letzteMs === null || letzteMs === undefined || jetztMs - letzteMs >= abstand;
}

const zweistellig = n => String(n).padStart(2, '0');

// Kurztext für die Telegram-Nachricht an die Eltern. Das volle Protokoll steht im Blatt.
export function baueKurztext(m, jetzt = new Date()) {
  const grund = GRUENDE.find(g => g.id === m.grund);
  const zeilen = [`🐛 ${m.kind || 'Ein Kind'} meldet: ${grund ? grund.text : m.grund}`];
  zeilen.push([`${zweistellig(jetzt.getHours())}:${zweistellig(jetzt.getMinutes())}`, m.land, m.bildschirm, m.himmel, m.fassung]
    .filter(Boolean).join(' · '));
  if (m.aufgabeText) zeilen.push(kuerze(m.aufgabeText, 120));
  if (m.knoepfe?.length) {
    zeilen.push(`Knöpfe: ${m.knoepfe.map(k => `${kuerze(k.text, 20)}${k.sichtbar ? '' : ' (nicht im Bild)'}`).join(' | ')}`);
  }
  const erg = m.reihe?.aufgabe?.ergebnis;
  if (erg !== undefined && erg !== null) zeilen.push(`Gespeichertes Ergebnis: ${erg}`);
  const fehler = (m.protokoll ?? []).filter(e => e.art === 'fehler').length;
  if (fehler) zeilen.push(`App-Fehler im Protokoll: ${fehler}`);
  if (m.gekappt) zeilen.push('(Protokoll gekürzt)');
  return zeilen.join('\n');
}

// Meldung auf max Zeichen (als JSON) bringen: erst älteste Protokoll-Einträge, dann den
// Fenstertext, zuletzt die gespeicherte Reihe opfern. Die Eingabe wird nie verändert.
export function kappeMeldung(m, max = MELDUNG_MAX_ZEICHEN) {
  const k = structuredClone(m);
  const zuLang = () => JSON.stringify(k).length > max;
  if (!zuLang()) return k;
  k.gekappt = true;
  while (zuLang() && k.protokoll?.length) k.protokoll.shift();
  if (zuLang() && k.fenster) k.fenster = kuerze(k.fenster, 300);
  if (zuLang() && k.reihe) k.reihe = { gekuerzt: true, ergebnis: k.reihe?.aufgabe?.ergebnis ?? null };
  if (zuLang()) k.browser = '';
  return k;
}

// Beschreibung der Antwortknöpfe fürs Protokoll (19.09.2026).
//
// Warum es das gibt: Am 19.09. meldete ein Kind „Die richtige Antwort fehlt". Die
// Momentaufnahme war leer — gemeldet wurde erst, nachdem die Aufgabe verlassen war, und
// danach gibt es kein Fenster mehr zu fotografieren. Im Protokoll stand nur „✓ Gelesen",
// dann zwanzig Sekunden nichts. Ob Knöpfe da waren, welche Werte sie trugen und ob die
// richtige dabei war, ließ sich nicht mehr feststellen; die Frage blieb an einem
// Achtjährigen hängen. Ein Eintrag beim Aufbau beantwortet sie im Nachhinein, unabhängig
// davon, WANN gemeldet wird.
//
// Der Vergleich läuft bewusst über Zeichenketten: Der data-wert eines Knopfes ist immer
// ein String, und genau diese Gleichheit prüft auch antwortPruefen (Befund 16.07.2026:
// ergebnis als String „10" liess die richtige Antwort durchfallen).
export function beschreibeKnoepfe({ werte = [], ergebnis = null, ausserhalb = 0 } = {}) {
  const teile = [`${werte.length} Knöpfe`];
  if (werte.length) teile[0] += `: ${werte.join(', ')}`;
  if (ergebnis !== null && ergebnis !== undefined) {
    teile.push(werte.map(String).includes(String(ergebnis)) ? 'richtige dabei' : 'RICHTIGE FEHLT');
  }
  if (ausserhalb > 0) teile.push(`${ausserhalb} nicht im Bild`);
  return teile.join(' · ');
}
