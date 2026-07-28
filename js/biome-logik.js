// Pure Logik für das Biom-System: Reihenfolge + Freigabe-Berechnung. KEINE DOM-/State-Abhängigkeit.
// Persistenz liegt in state.js, Anzeige-Daten im Manifest. Hier nur die Regeln.

// Reihenfolge der Reise über die Karte. Sie sagt, was WANN kommt — nicht, wie schwer es ist.
export const BIOME_REIHENFOLGE = ['mengen', 'rechnen10', 'plus', 'minus', 'mal', 'geteilt', 'text', 'zeitenland'];

// --- Niveau: die fachliche Einstufung eines Bioms, BEWUSST getrennt vom Listenindex ---
//
// Bis 28.07.2026 waren beide dasselbe: das Niveau war die Position in BIOME_REIHENFOLGE.
// Das hatte eine stille Nebenwirkung, die erst beim achten Biom auffiel — jedes neu
// angehängte Biom hob die Alters-Grenze um eins und schob damit ALLE Bestandsbiome eine
// Stufe „unter Niveau": Beim Zeitenland-Zweig fiel die Beute im Geschichten-Dorf von 1,00
// auf 0,65, in der Geteilt-Schlucht von 0,65 auf 0,30, und Eisen/Diamant gab es plötzlich
// nur noch im neuesten Biom. Ein Kind hätte über Nacht in sechs vertrauten Ländern
// schlechter verdient, ohne dass sich dort irgendetwas geändert hätte.
//
// Deshalb hängt das Niveau jetzt an der Biom-KENNUNG. Ein neu angehängtes Biom bekommt hier
// seine eigene Zahl und verschiebt nichts. Gleichrangige Biome teilen sich dieselbe Zahl:
// Zeitenland (Größen/Sachrechnen) steht NEBEN dem Geschichten-Dorf, nicht darüber.
// Der bewusst kleinstmögliche Umbau: Die Zahlen sind exakt die alten Indizes des Bestands,
// die Beute-Tabelle bleibt dadurch Wert für Wert dieselbe wie vor dem Zeitenland-Zweig.
// Nachweis: tools/check-beute-niveau.mjs.
const BIOM_NIVEAU = {
  mengen: 0, rechnen10: 1, plus: 2, minus: 3, mal: 4, geteilt: 5, text: 6, zeitenland: 6,
};

// Unbekannt → bewusst UNENDLICH hoch, nicht 0: ein vergessener Eintrag darf weder ein Biom
// versehentlich freischalten noch es als „unter Niveau" abwerten. Beides fällt so auf.
export function biomNiveau(id) {
  return BIOM_NIVEAU[id] ?? Number.POSITIVE_INFINITY;
}

// Höchstes standardmäßig offenes Niveau je Schulstufe (alles darunter ebenfalls offen).
// Klasse 2 und 3 erreichen Niveau 6 — dort liegen Geschichten-Dorf UND Zeitenland.
const ALTER_NIVEAU = { 'kindergarten': 1, 'klasse-1': 3, 'klasse-2': 6, 'klasse-3': 6 };

export function niveauFuerAlter(alter) {
  return ALTER_NIVEAU[alter] ?? 0; // Unbekannt → konservativ nur Mengen
}

// Beute-Abstufung für ein Biom UNTER dem Niveau des Kindes: weniger Basis-Material und kein
// Eisen/Diamant. Hier als reine Funktion, damit der Nachweis (tools/check-beute-niveau.mjs)
// genau die Rechnung prüft, die die App benutzt — und nicht eine Kopie davon.
// Auf oder über eigenem Niveau bleibt alles bei 1 und Premium ist erlaubt.
export function beuteNiveau(alter, biomId) {
  const delta = niveauFuerAlter(alter) - biomNiveau(biomId);
  const unterNiveau = delta > 0;
  return {
    faktor: unterNiveau ? Math.max(0.2, 1 - 0.35 * delta) : 1,
    premiumErlaubt: !unterNiveau,
  };
}

function index(id) { return BIOME_REIHENFOLGE.indexOf(id); }

// freigabe = { alter, autoFrei?, elternFrei?, elternGesperrt? }
export function istFrei(id, freigabe = {}) {
  if (index(id) === -1) return false;
  if ((freigabe.elternGesperrt ?? []).includes(id)) return false; // Eltern-Sperre überstimmt alles
  if (biomNiveau(id) <= niveauFuerAlter(freigabe.alter)) return true;
  if ((freigabe.autoFrei ?? []).includes(id)) return true;
  if ((freigabe.elternFrei ?? []).includes(id)) return true;
  return false;
}

export function freieBiome(freigabe = {}) {
  return BIOME_REIHENFOLGE.filter(id => istFrei(id, freigabe));
}

export function naechstesBiom(id) {
  const i = index(id);
  if (i === -1 || i + 1 >= BIOME_REIHENFOLGE.length) return null;
  return BIOME_REIHENFOLGE[i + 1];
}

// Höchstes freigeschaltetes Biom — Default für das aktive Biom beim Eintritt.
export function hoechstesFreies(freigabe = {}) {
  const frei = freieBiome(freigabe);
  return frei.length ? frei[frei.length - 1] : BIOME_REIHENFOLGE[0];
}
