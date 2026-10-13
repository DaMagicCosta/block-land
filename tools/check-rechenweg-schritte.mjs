// Check-Runner für js/rechenweg-schritte.js — Sprünge auf dem Rechenstrich für Plus/Minus.
// Aufruf: node tools/check-rechenweg-schritte.mjs
//
// Drei Regeln werden festgenagelt:
//   1. Der Weg ist immer derselbe: erst die Zehner, dann bis zum vollen Zehner, dann der Rest.
//   2. Die Sprünge führen lückenlos vom Start zum Ergebnis — für JEDE Aufgabe im Zahlenraum.
//   3. Der LETZTE Schritt fragt und verrät nicht (Befund 18.07.2026): Die letzte Landung ist
//      die Antwort, und die geben die Antwortknöpfe. Alles andere wäre Wiedererkennen statt Abruf.
import { berechneRechenweg, berechneSchritte } from '../js/rechenweg-schritte.js';

let fehler = 0;
function check(name, bedingung) {
  if (bedingung) { console.log(`  OK  ${name}`); }
  else { console.error(`  FEHLER  ${name}`); fehler++; }
}

const text = s => s.erklaerung.replace(/<[^>]*>/g, '');
const weg = (aufgabentyp, a, b) => berechneRechenweg({ aufgabentyp, a, b });
const arten = w => w.spruenge.map(s => s.art).join(',');
const ziele = w => w.spruenge.map(s => s.ziel).join(',');

console.log('Minus: erst Zehner, dann bis zum Zehner, dann der Rest');
{
  const w = weg('minus', 85, 37);
  check('85 − 37: drei Sprünge (zehner, bis-zehner, rest)', arten(w) === 'zehner,bis-zehner,rest');
  check('85 − 37: Landungen 55, 50, 48', ziele(w) === '55,50,48');
  check('85 − 37: die 7 ist in 5 und 2 zerlegt',
    w.zerlegung?.ganze === 7 && w.zerlegung.teil1 === 5 && w.zerlegung.teil2 === 2);
}
check('52 − 7: ohne Zehner, zwei Sprünge über die 50', ziele(weg('minus', 52, 7)) === '50,45');
check('58 − 23: kein Übergang, Zehner und Einer je ein Sprung',
  arten(weg('minus', 58, 23)) === 'zehner,einer' && ziele(weg('minus', 58, 23)) === '38,35');
check('85 − 5: landet genau auf dem Zehner, ein Sprung ohne Zerlegung',
  arten(weg('minus', 85, 5)) === 'einer' && weg('minus', 85, 5).zerlegung === null);
check('80 − 2: steht schon auf dem Zehner, ein Sprung', arten(weg('minus', 80, 2)) === 'einer');
check('40 − 17: nach den Zehnern auf dem Zehner, Einer in einem Sprung',
  arten(weg('minus', 40, 17)) === 'zehner,einer' && ziele(weg('minus', 40, 17)) === '30,23');
check('70 − 30: nur ein Zehner-Sprung', arten(weg('minus', 70, 30)) === 'zehner');

console.log('\nPlus: derselbe Weg in die andere Richtung');
{
  const w = weg('plus', 78, 17);
  check('78 + 17: drei Sprünge (zehner, bis-zehner, rest)', arten(w) === 'zehner,bis-zehner,rest');
  check('78 + 17: Landungen 88, 90, 95', ziele(w) === '88,90,95');
  check('78 + 17: die 7 ist in 2 und 5 zerlegt', w.zerlegung?.teil1 === 2 && w.zerlegung.teil2 === 5);
}
check('67 + 13: Einer füllen genau auf, kein Zwischenhalt', arten(weg('plus', 67, 13)) === 'zehner,einer');
check('23 + 45: kein Übergang', ziele(weg('plus', 23, 45)) === '63,68');
check('8 + 7: über die 10', ziele(weg('plus', 8, 7)) === '10,15');

console.log('\nVollständig: jede Aufgabe im Zahlenraum 100');
{
  let luecken = 0, falschesZiel = 0, zuViele = 0, verraten = 0, keinZehnerhalt = 0, ohneFrage = 0;
  let anzahl = 0;
  for (const typ of ['plus', 'minus']) {
    for (let a = 0; a <= 100; a++) {
      for (let b = 1; b <= 100; b++) {
        const ergebnis = typ === 'plus' ? a + b : a - b;
        if (ergebnis < 0 || ergebnis > 100) continue;
        anzahl++;
        const aufgabe = { aufgabentyp: typ, a, b, ergebnis };
        const w = berechneRechenweg(aufgabe);
        let stand = a;
        for (const s of w.spruenge) {
          if (s.von !== stand) luecken++;
          stand = s.ziel;
          if (s.art === 'bis-zehner' && s.ziel % 10 !== 0) keinZehnerhalt++;
        }
        if (stand !== ergebnis) falschesZiel++;
        if (w.spruenge.length > 3) zuViele++;
        const schritte = berechneSchritte(aufgabe);
        const letzter = schritte[schritte.length - 1];
        if (!text(letzter).includes('= ?')) ohneFrage++;
        // Keine Gleichung im ganzen Hilfetext darf das Ergebnis ausschreiben.
        if (schritte.some(s => new RegExp(`= ${ergebnis}(?!\\d)`).test(text(s)) && !istZerlegungszeile(s, w, ergebnis))) verraten++;
      }
    }
  }
  check(`${anzahl} Aufgaben geprüft (Stichprobe ist der ganze Zahlenraum)`, anzahl > 9000);
  check('Sprünge schließen lückenlos aneinander an', luecken === 0);
  check('letzte Landung ist das Ergebnis', falschesZiel === 0);
  check('nie mehr als drei Sprünge', zuViele === 0);
  check('„bis zum Zehner" landet immer auf einem vollen Zehner', keinZehnerhalt === 0);
  check('der letzte Schritt stellt die Frage („= ?")', ohneFrage === 0);
  check('kein Schritt schreibt das Ergebnis als Gleichung aus', verraten === 0);
}

// Die Zerlegungszeile „7 = 5 + 2" beginnt mit der zerlegten Zahl, nicht mit „= Ergebnis".
// Sie kann das Ergebnis nur zufällig berühren, wenn es der Zerlegung gleicht — kein Verrat.
function istZerlegungszeile(schritt, w, ergebnis) {
  if (!w.zerlegung) return false;
  const z = w.zerlegung;
  return text(schritt).replace(`${z.ganze} = ${z.teil1} + ${z.teil2}`, '').match(new RegExp(`= ${ergebnis}(?!\\d)`)) === null;
}

console.log('\nSchritte: je Sprung einer, die Frage wandert mit');
{
  const s = berechneSchritte({ aufgabentyp: 'minus', a: 85, b: 37, ergebnis: 48 });
  check('85 − 37: drei Schritte', s.length === 3);
  check('85 − 37: Schritt 1 fragt nach 85 − 30', text(s[0]).includes('85 − 30 = ?'));
  check('85 − 37: Schritt 2 fragt nach 55 − 5', text(s[1]).includes('55 − 5 = ?'));
  check('85 − 37: Schritt 3 zeigt die Zerlegung und fragt nach 50 − 2',
    text(s[2]).includes('7 = 5 + 2') && text(s[2]).includes('50 − 2 = ?'));
  check('85 − 37: vom Zehner weg kommt der Hinweis auf die kleine Aufgabe', text(s[2]).includes('Denk an 10 − 2'));
  check('85 − 37: die 48 steht nirgends', s.every(x => !/48/.test(text(x))));
}
{
  const s = berechneSchritte({ aufgabentyp: 'minus', a: 14, b: 7, ergebnis: 7 });
  check('14 − 7: bei der 10 selbst kein „Denk an"-Hinweis (wäre die Aufgabe noch einmal)',
    !text(s[s.length - 1]).includes('Denk an'));
}
{
  const s = berechneSchritte({ aufgabentyp: 'plus', a: 78, b: 17, ergebnis: 95 });
  check('78 + 17: Plus sagt „dazu", nicht „weg"', text(s[0]).includes('dazu') && !text(s[0]).includes('weg'));
  check('78 + 17: die 95 steht nirgends', s.every(x => !/95/.test(text(x))));
}
{
  // Befund beim Durchspielen 12.10.2026: „1 fehlen noch".
  const s = berechneSchritte({ aufgabentyp: 'minus', a: 87, b: 48, ergebnis: 39 });
  check('87 − 48: Einzahl bei der 1 („1 fehlt noch")', text(s[2]).includes('1 fehlt noch') && text(s[2]).includes('7 sind schon weg'));
  const t = berechneSchritte({ aufgabentyp: 'minus', a: 61, b: 7, ergebnis: 54 });
  check('61 − 7: Einzahl bei der 1 („1 ist schon weg")', text(t[1]).includes('1 ist schon weg') && text(t[1]).includes('6 fehlen noch'));
}
{
  const s = berechneSchritte({ aufgabentyp: 'minus', a: 12, b: 0, ergebnis: 12 });
  check('ohne Sprung (b = 0): ein Schritt, der nur fragt', s.length === 1 && s[0].sprungIdx === -1);
}

console.log(fehler === 0 ? '\nAlles grün.' : `\n${fehler} Fehler.`);
process.exit(fehler === 0 ? 0 : 1);
