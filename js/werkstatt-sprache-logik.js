// Sprachführung der Werkstatt für Kinder, die noch nicht lesen (Kindergarten, 1. Klasse).
// Pure Logik: baut nur die Sätze, gesprochen wird in werkstatt.js über sprich().
// KEINE DOM-/State-Abhängigkeit (Check: node tools/check-werkstatt-sprache.mjs).
//
// Warum es das gibt: Die Aufgaben sprechen seit jeher mit jüngeren Kindern, die Werkstatt dagegen war
// reine Schrift — Rezeptnamen, Kosten als Emoji mit Zahl, „Bauen" auf einem Knopf. Für ein
// Kind, das nicht liest, war das Eintauschen der erarbeiteten Rohstoffe damit Raten.

// Mengenangaben. Die Eins ausgeschrieben, weil die Sprachausgabe „1 Stein" als „eins Stein"
// vorliest — und dann braucht es den Fall: „Du brauchst EINEN Stein" (Akkusativ), aber
// „Dir fehlt noch EIN Stein" (Nominativ).
const WORT = {
  holz:    { akk: 'ein Stück Holz',  nom: 'ein Stück Holz',  mehr: 'Holz' },
  stein:   { akk: 'einen Stein',     nom: 'ein Stein',       mehr: 'Steine' },
  blume:   { akk: 'eine Blume',      nom: 'eine Blume',      mehr: 'Blumen' },
  eisen:   { akk: 'ein Stück Eisen', nom: 'ein Stück Eisen', mehr: 'Eisen' },
  diamant: { akk: 'einen Diamanten', nom: 'ein Diamant',     mehr: 'Diamanten' },
  sanduhr: { akk: 'eine Sanduhr',    nom: 'eine Sanduhr',    mehr: 'Sanduhren' },
};

export function mengeText(item, anzahl, fall = 'akk') {
  const w = WORT[item] ?? { akk: `ein ${item}`, nom: `ein ${item}`, mehr: item };
  return anzahl === 1 ? w[fall] : `${anzahl} ${w.mehr}`;
}

// „a", „a und b", „a, b und c"
export function aufzaehlung(teile) {
  if (teile.length <= 1) return teile.join('');
  return `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`;
}

export function vorratSatz(inventar) {
  const teile = Object.entries(inventar ?? {})
    .filter(([, n]) => n > 0)
    .map(([item, n]) => mengeText(item, n));
  if (!teile.length) return 'Du hast noch keine Rohstoffe. Übe in der Welt, dann findest du welche.';
  return `Du hast ${aufzaehlung(teile)}.`;
}

export function willkommenSatz(inventar) {
  return `Das ist deine Werkstatt. ${vorratSatz(inventar)} Tippe auf einen Wunsch, dann sage ich dir, was er kostet.`;
}

export function rezeptSatz(rezept, inventar) {
  const kosten = Object.entries(rezept.kosten ?? {});
  const brauchst = aufzaehlung(kosten.map(([item, n]) => mengeText(item, n)));
  const fehlt = kosten
    .map(([item, n]) => [item, n - (inventar?.[item] ?? 0)])
    .filter(([, rest]) => rest > 0)
    .map(([item, rest]) => ({ text: mengeText(item, rest, 'nom'), rest }));
  // „Dir fehlt noch ein Stein" / „Dir fehlen noch 6 Steine" / „… ein Stück Holz und ein Stein"
  const verb = fehlt.length === 1 && fehlt[0].rest === 1 ? 'fehlt' : 'fehlen';
  const schluss = fehlt.length
    ? `Dir ${verb} noch ${aufzaehlung(fehlt.map(f => f.text))}.`
    : 'Du hast genug. Tippe auf Bauen!';
  return `${rezept.name}. Dafür brauchst du ${brauchst}. ${schluss}`;
}

export function gebautSatz(rezept) {
  return `Gebaut! ${rezept.name}. Der Gutschein liegt jetzt bei deinen Gutscheinen.`;
}

export function tabSatz(tab) {
  return tab === 'gutscheine' ? 'Hier liegen deine Gutscheine.' : 'Hier kannst du Wünsche bauen.';
}

// status: 'offen' | 'freigegeben' | 'abgelehnt' | null
export function gutscheinSatz(name, anzahl, status = null) {
  const menge = anzahl === 1 ? 'einen Gutschein' : `${anzahl} Gutscheine`;
  const zusatz = status === 'offen' ? ' Du hast Mama und Papa schon gefragt. Warte auf ihre Antwort.'
    : status === 'freigegeben' ? ' Mama oder Papa haben ja gesagt. Viel Spaß!'
    : status === 'abgelehnt' ? ' Jetzt gerade nicht. Frag später nochmal.'
    : '';
  return `${name}. Du hast ${menge}.${zusatz}`;
}

export function gefragtSatz() {
  return 'Ich habe Mama und Papa gefragt. Warte auf ihre Antwort.';
}
