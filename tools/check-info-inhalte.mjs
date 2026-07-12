// Ad-hoc-Checks für js/info-inhalte.js (kein Test-Runner im Projekt).
// Lauf: node tools/check-info-inhalte.mjs  (aus dem Block-Land-Root)
import { INFO_SEITEN } from '../js/info-inhalte.js';

let fehler = 0;
function pruefe(name, bedingung) {
  if (bedingung) { console.log(`  OK  ${name}`); }
  else { console.error(`FEHLT ${name}`); fehler += 1; }
}

// Struktur: genau 3 Seiten mit festen Ids in fester Reihenfolge
pruefe('3 Seiten', Array.isArray(INFO_SEITEN) && INFO_SEITEN.length === 3);
pruefe('Seiten-Ids ueber/anleitung/nachbau',
  JSON.stringify(INFO_SEITEN.map(s => s.id)) === JSON.stringify(['ueber', 'anleitung', 'nachbau']));

// Jede Seite: tabLabel, icon, intro, Kapitel mit Pflichtfeldern
for (const s of INFO_SEITEN) {
  pruefe(`${s.id}: tabLabel+icon+intro`, !!s.tabLabel && !!s.icon && typeof s.intro === 'string' && s.intro.length > 20);
  pruefe(`${s.id}: hat Kapitel`, Array.isArray(s.kapitel) && s.kapitel.length >= 3);
  for (const [i, k] of (s.kapitel ?? []).entries()) {
    pruefe(`${s.id}[${i}]: emoji+titel+inhaltHtml`, !!k.emoji && !!k.titel && typeof k.inhaltHtml === 'string' && k.inhaltHtml.length > 80);
  }
}

// Kapitel-Anzahl laut Spec: Über=3, Anleitung=5, Nachbau=5 (inkl. 📲 Weitergeben)
const anzahl = Object.fromEntries(INFO_SEITEN.map(s => [s.id, s.kapitel.length]));
pruefe('Kapitel-Anzahl 3/5/5', anzahl.ueber === 3 && anzahl.anleitung === 5 && anzahl.nachbau === 5);

// Über-Seite: alle Kapitel offen (Transparenz ohne Taps lesbar)
pruefe('ueber: alle Kapitel offen', INFO_SEITEN[0].kapitel.every(k => k.offen === true));

const gesamt = INFO_SEITEN.map(s => s.intro + s.kapitel.map(k => k.inhaltHtml).join('')).join('');

// Link-Regeln (Spec, Anti-Doppelpflege): einziger externer Link ist EINRICHTUNG.md
const externe = [...gesamt.matchAll(/href="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
const EINRICHTUNG = 'https://github.com/DaMagicCosta/block-land/blob/main/sync/EINRICHTUNG.md';
pruefe('genau 1 externer Link (EINRICHTUNG.md)', externe.length === 1 && externe[0] === EINRICHTUNG);
pruefe('kein http:// (nur https)', !gesamt.includes('http://'));

// Querverweise zeigen auf existierende Seiten-Ids
const ziele = [...gesamt.matchAll(/data-info-ziel="([^"]+)"/g)].map(m => m[1]);
pruefe('Querverweise vorhanden (Seite 3 verweist)', ziele.length >= 2);
pruefe('Querverweis-Ziele existieren', ziele.every(z => ['ueber', 'anleitung', 'nachbau'].includes(z)));

// Weitergeben-Kapitel: QR-Bild + kopierbarer Link (exakt die kurze Live-URL)
const LIVE_URL = 'https://damagiccosta.github.io/block-land/';
pruefe('QR-Bild referenziert qr-app.svg', gesamt.includes('src="qr-app.svg"'));
pruefe('Link-kopieren-Ziel = Live-URL', [...gesamt.matchAll(/data-kopieren="([^"]+)"/g)].every(m => m[1] === LIVE_URL)
  && gesamt.includes('data-kopieren="'));

// Keine Platzhalter, keine unerlaubten Tags (Inhalt ist trusted, aber nur Text-Auszeichnung)
pruefe('keine TODO/TBD-Marker', !/TODO|TBD|PLATZHALTER/i.test(gesamt));
pruefe('keine <script>-Tags', !gesamt.includes('<script'));

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle info-inhalte-Checks grün.');
