// Check-Runner für js/debug-protokoll-logik.js — Fehler-Raupe (Protokoll, Kurztext, Kappen).
import {
  PROTOKOLL_MAX, GRUENDE, kuerze, fuegeEintrag, beschreibeZiel, darfMelden, baueKurztext, kappeMeldung,
} from '../js/debug-protokoll-logik.js';

let fehler = 0;
function check(name, bedingung, info = '') {
  if (bedingung) { console.log(`  OK  ${name}`); }
  else { console.error(`  FEHLER  ${name}${info ? `\n      ${info}` : ''}`); fehler++; }
}

check('vier Gründe', GRUENDE.length === 4 && GRUENDE.every(g => g.id && g.emoji && g.text));

check('kürzen: Leerraum zusammengezogen', kuerze('  a \n  b  ', 10) === 'a b');
check('kürzen: mit Auslassungszeichen', kuerze('abcdefghij', 5) === 'abcd…');
check('kürzen: null wird leer', kuerze(null, 5) === '');

{
  let l = [];
  for (let i = 0; i < PROTOKOLL_MAX + 7; i++) l = fuegeEintrag(l, { i });
  check('Ringpuffer hält Maximum', l.length === PROTOKOLL_MAX);
  check('Ringpuffer verwirft das Älteste', l[0].i === 7 && l[l.length - 1].i === PROTOKOLL_MAX + 6);
  const vorher = [{ i: 1 }];
  fuegeEintrag(vorher, { i: 2 });
  check('Ringpuffer verändert die Eingabe nicht', vorher.length === 1);
}

check('Eingabefeld ohne Inhalt', beschreibeZiel({ tag: 'INPUT', klassen: ['eltern__feld'], text: '1234' }) === 'Eingabe im Feld');
check('Select ohne Inhalt', beschreibeZiel({ tag: 'SELECT', text: 'geheim' }) === 'Eingabe im Feld');
check('Antwortknopf mit Wert', beschreibeZiel({ tag: 'BUTTON', klassen: ['aufgabe__option'], text: ' 52 ', wert: '52' })
  === 'aufgabe__option „52" (Wert 52)', beschreibeZiel({ tag: 'BUTTON', klassen: ['aufgabe__option'], text: ' 52 ', wert: '52' }));
check('Hilfsklassen übersprungen', beschreibeZiel({ tag: 'DIV', klassen: ['is-interaktiv', 'welt__tile'], text: '🌳' }) === 'welt__tile „🌳"');
check('ohne Klasse: Tag', beschreibeZiel({ tag: 'BUTTON', klassen: [], text: 'x' }) === 'button „x"');

check('erste Meldung erlaubt', darfMelden(null, 1000));
check('nach 30 s gesperrt', !darfMelden(1000, 31000));
check('nach 60 s frei', darfMelden(1000, 61000));

{
  const m = {
    kind: 'Kind', grund: 'antwort', land: 'plus', bildschirm: '#welt', himmel: 'Tag', fassung: 'v92',
    aufgabeText: '34 + 18 = ?',
    knoepfe: [{ text: '42', sichtbar: true }, { text: '52', sichtbar: false }],
    reihe: { aufgabe: { ergebnis: 52 } },
    protokoll: [{ art: 'tipp' }, { art: 'fehler' }],
  };
  const t = baueKurztext(m, new Date(2026, 8, 15, 9, 5));
  check('Kurztext: Kopf', t.startsWith('🐛 Kind meldet: Die richtige Antwort fehlt'), t);
  check('Kurztext: Uhrzeit zweistellig', t.includes('09:05 · plus · #welt · Tag · v92'), t);
  check('Kurztext: unsichtbarer Knopf markiert', t.includes('52 (nicht im Bild)') && !t.includes('42 (nicht im Bild)'), t);
  check('Kurztext: Ergebnis und Fehlerzahl', t.includes('Gespeichertes Ergebnis: 52') && t.includes('App-Fehler im Protokoll: 1'), t);
  check('Kurztext: Ergebnis 0 wird genannt', baueKurztext({ ...m, reihe: { aufgabe: { ergebnis: 0 } } }).includes('Ergebnis: 0'));
}

{
  const gross = { id: 'm1', fenster: 'x'.repeat(3000), reihe: { aufgabe: { ergebnis: 7, text: 'y'.repeat(2000) } },
    protokoll: Array.from({ length: 50 }, (_, i) => ({ t: i, art: 'tipp', text: 'z'.repeat(150) })) };
  const k = kappeMeldung(gross, 5000);
  check('Kappen: unter dem Maximum', JSON.stringify(k).length <= 5000, String(JSON.stringify(k).length));
  check('Kappen: markiert', k.gekappt === true);
  check('Kappen: neueste Einträge bleiben', !k.protokoll.length || k.protokoll[k.protokoll.length - 1].t === 49);
  check('Kappen: Eingabe unverändert', gross.protokoll.length === 50 && gross.fenster.length === 3000);
  const klein = { id: 'm2', protokoll: [] };
  check('Kappen: kleine Meldung unverändert', !kappeMeldung(klein).gekappt);
}

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle debug-protokoll-Checks grün.');
