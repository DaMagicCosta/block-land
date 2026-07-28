// Ad-hoc-Checks für die Beute-Abstufung nach Niveau. Lauf: node tools/check-beute-niveau.mjs
//
// Hintergrund (Befund 29.07.2026): Das Niveau eines Bioms hing an seiner Position in
// BIOME_REIHENFOLGE. Dadurch senkte das achte Biom (Zeitenland) still die Beute in allen
// sechs Bestandsbiomen und nahm dem Geschichten-Dorf die Premium-Beute (Eisen/Diamant).
// Seither hängt das Niveau an der Biom-Kennung (BIOM_NIVEAU in js/biome-logik.js).
//
// Diese Datei nagelt die vollständige Tabelle fest: für JEDE Schulstufe und JEDES Biom den
// wirksamen Beute-Faktor und die Premium-Berechtigung. Die Sollwerte sind die Werte, die
// VOR dem Zeitenland-Zweig galten (Alters-Grenze 6, Index == Niveau) — von Hand aus
// max(0,2 ; 1 − 0,35 · delta) nachgerechnet.
import { BIOME_REIHENFOLGE, biomNiveau, niveauFuerAlter, beuteNiveau, istFrei } from '../js/biome-logik.js';

let fehler = 0;
function pruefe(name, bedingung) {
  if (bedingung) console.log(`  OK  ${name}`);
  else { console.error(`FEHLT ${name}`); fehler += 1; }
}

const ALTER = ['kindergarten', 'klasse-1', 'klasse-2', 'klasse-3'];

// --- Sollwerte: [faktor, premiumErlaubt] je Schulstufe und Biom ---
// Zeitenland steht bewusst gleichrangig neben dem Geschichten-Dorf (beide Niveau 6),
// deshalb hat es überall exakt dieselben Werte wie `text`.
const SOLL = {
  'kindergarten': {   // Niveau-Grenze 1
    mengen: [0.65, false], rechnen10: [1, true], plus: [1, true], minus: [1, true],
    mal: [1, true], geteilt: [1, true], text: [1, true], zeitenland: [1, true],
  },
  'klasse-1': {       // Niveau-Grenze 3
    mengen: [0.2, false], rechnen10: [0.3, false], plus: [0.65, false], minus: [1, true],
    mal: [1, true], geteilt: [1, true], text: [1, true], zeitenland: [1, true],
  },
  'klasse-2': {       // Niveau-Grenze 6
    mengen: [0.2, false], rechnen10: [0.2, false], plus: [0.2, false], minus: [0.2, false],
    mal: [0.3, false], geteilt: [0.65, false], text: [1, true], zeitenland: [1, true],
  },
  'klasse-3': {       // Niveau-Grenze 6 (wie Klasse 2)
    mengen: [0.2, false], rechnen10: [0.2, false], plus: [0.2, false], minus: [0.2, false],
    mal: [0.3, false], geteilt: [0.65, false], text: [1, true], zeitenland: [1, true],
  },
};

function gleich(a, b) { return Math.abs(a - b) < 1e-9; }

function tabelleStimmt() {
  let heil = true;
  for (const alter of ALTER) {
    for (const biom of Object.keys(SOLL[alter])) {
      const [sollFaktor, sollPremium] = SOLL[alter][biom];
      const ist = beuteNiveau(alter, biom);
      if (!gleich(ist.faktor, sollFaktor) || ist.premiumErlaubt !== sollPremium) {
        console.error(`      ${alter} / ${biom}: ist ${ist.faktor}/${ist.premiumErlaubt}, soll ${sollFaktor}/${sollPremium}`);
        heil = false;
      }
    }
  }
  return heil;
}

console.log('--- Vollständige Beute-Tabelle (4 Schulstufen × 8 Biome) ---');
// Erzwingt, dass ein künftiges Biom hier bewusst eingetragen wird, statt still durchzurutschen.
pruefe('Soll-Tabelle deckt jedes Biom aus BIOME_REIHENFOLGE ab',
  ALTER.every(alter => BIOME_REIHENFOLGE.every(biom => Array.isArray(SOLL[alter][biom]))));
pruefe('Alle 32 Kombinationen entsprechen den Werten von vor dem Zeitenland-Zweig', tabelleStimmt());

// Die drei Werte, die im Befund namentlich genannt sind — einzeln festgenagelt, damit eine
// Regression sofort lesbar ist statt nur als „Tabelle stimmt nicht".
{
  const dorf = beuteNiveau('klasse-2', 'text');
  const schlucht = beuteNiveau('klasse-2', 'geteilt');
  const berg = beuteNiveau('klasse-2', 'mal');
  pruefe('Klasse 2 · Geschichten-Dorf: Faktor 1,00 und Premium erlaubt',
    gleich(dorf.faktor, 1) && dorf.premiumErlaubt === true);
  pruefe('Klasse 2 · Geteilt-Schlucht: Faktor 0,65', gleich(schlucht.faktor, 0.65));
  pruefe('Klasse 2 · Mal-Berg: Faktor 0,30', gleich(berg.faktor, 0.3));
}

// Gleichrangigkeit: Zeitenland darf das Geschichten-Dorf nicht überragen.
{
  let gleichrangig = true;
  for (const alter of ALTER) {
    const a = beuteNiveau(alter, 'text');
    const b = beuteNiveau(alter, 'zeitenland');
    if (!gleich(a.faktor, b.faktor) || a.premiumErlaubt !== b.premiumErlaubt) gleichrangig = false;
  }
  pruefe('Zeitenland ist auf jeder Schulstufe exakt gleichrangig mit dem Geschichten-Dorf', gleichrangig);
  pruefe('Beide tragen dasselbe Niveau', biomNiveau('text') === biomNiveau('zeitenland'));
}

// --- Der eigentliche Punkt: ein neuntes Biom darf nichts mehr verschieben ---
// BIOME_REIHENFOLGE ist ein Array und damit zur Laufzeit erweiterbar. Genau so simulieren
// wir das nächste Biom — ohne die Quelldatei anzufassen.
console.log('--- Gegenprobe: hypothetisches neuntes Biom ---');
{
  const vorher = ALTER.flatMap(alter =>
    BIOME_REIHENFOLGE.map(biom => `${alter}/${biom}=${beuteNiveau(alter, biom).faktor}/${beuteNiveau(alter, biom).premiumErlaubt}`));
  const grenzenVorher = ALTER.map(a => niveauFuerAlter(a)).join(',');

  BIOME_REIHENFOLGE.push('kalenderbaum');   // das nächste geplante Biom, hier nur als Attrappe

  const nachher = ALTER.flatMap(alter =>
    BIOME_REIHENFOLGE.filter(b => b !== 'kalenderbaum')
      .map(biom => `${alter}/${biom}=${beuteNiveau(alter, biom).faktor}/${beuteNiveau(alter, biom).premiumErlaubt}`));
  const grenzenNachher = ALTER.map(a => niveauFuerAlter(a)).join(',');

  pruefe('Ein neuntes Biom verschiebt keinen einzigen Beute-Wert der acht bestehenden',
    vorher.join('|') === nachher.join('|'));
  pruefe('Ein neuntes Biom hebt keine Alters-Niveau-Grenze', grenzenVorher === grenzenNachher);
  pruefe('Die vollständige Soll-Tabelle gilt auch nach dem Anhängen unverändert', tabelleStimmt());

  // Ein Biom ohne Niveau-Eintrag: darf weder abgewertet noch automatisch freigeschaltet werden.
  const attrappe = beuteNiveau('klasse-2', 'kalenderbaum');
  pruefe('Biom ohne Niveau-Eintrag wird nicht abgewertet (Faktor 1, Premium erlaubt)',
    gleich(attrappe.faktor, 1) && attrappe.premiumErlaubt === true);
  pruefe('Biom ohne Niveau-Eintrag ist NICHT automatisch offen',
    istFrei('kalenderbaum', { alter: 'klasse-3' }) === false);

  BIOME_REIHENFOLGE.pop();   // Attrappe wieder entfernen
}

// --- Freischaltung: die Niveau-Umstellung darf am bisherigen Verhalten nichts ändern ---
console.log('--- Freischaltung (Regression) ---');
pruefe('Vorschule: Mengen + Würfel-Teich offen, Plus noch nicht',
  istFrei('mengen', { alter: 'kindergarten' }) && istFrei('rechnen10', { alter: 'kindergarten' })
  && !istFrei('plus', { alter: 'kindergarten' }));
pruefe('Klasse 1: bis Minus offen, Mal noch nicht',
  istFrei('minus', { alter: 'klasse-1' }) && !istFrei('mal', { alter: 'klasse-1' }));
pruefe('Klasse 2: Geschichten-Dorf UND Zeitenland offen',
  istFrei('text', { alter: 'klasse-2' }) && istFrei('zeitenland', { alter: 'klasse-2' }));
pruefe('Vorschule: Zeitenland zu', !istFrei('zeitenland', { alter: 'kindergarten' }));
pruefe('Eltern-Sperre überstimmt das Niveau weiterhin',
  !istFrei('text', { alter: 'klasse-2', elternGesperrt: ['text'] }));
pruefe('Eltern-Freigabe öffnet ein Biom über dem Niveau weiterhin',
  istFrei('mal', { alter: 'klasse-1', elternFrei: ['mal'] }));

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle beute-niveau-Checks grün.');
