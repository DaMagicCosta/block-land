// Pure Logik: zerlegt eine Plus-/Minus-Aufgabe in Sprünge auf dem Rechenstrich.
// KEINE DOM-Abhängigkeit (in Node testbar). Der Renderer (rechenweg.js) macht daraus das Bild.
//
// Ein Weg für beide Rechenarten, derselbe wie im Schulbuch („Zuerst die Zehner weg, dann …"):
//   1. erst die Zehner            85 − 30 = 55
//   2. dann bis zum vollen Zehner 55 −  5 = 50
//   3. dann der Rest der Einer    50 −  2 = 48
// Schritt 2 und 3 fallen zusammen, wenn die Einer ohne Übergang reichen.
//
// Löst die Entbündel-Schritte ab (bis v102, stellenwert-schritte.js): „einen Zehner öffnen"
// ist der Gedanke des schriftlichen Rechnens und ein ANDERER Weg als der, der im Kopf und in
// der Schule gegangen wird. Zwei Wege für dieselbe Aufgabe sind Last, keine Hilfe.
//
// Warum Sprünge: Der Strich hält die Zwischenergebnisse fest. Im Kopf müssen sonst vier Dinge
// gleichzeitig stehen (Abstand zum Zehner, Zerlegung, Zwischenstand, was noch fehlt).
//
// Farbcodierung in erklaerung: <b class="rw-z">…</b> = Zehner, <b class="rw-e">…</b> = Einer.

// Sprung = { um, von, ziel, art }
//   art: 'zehner'     ganze Zehner
//        'einer'      Einer ohne Übergang (auch: landet genau auf dem Zehner)
//        'bis-zehner' erster Teil der Einer, landet auf dem vollen Zehner
//        'rest'       zweiter Teil der Einer, vom vollen Zehner weiter
export function berechneRechenweg(aufgabe) {
  const istMinus = aufgabe.aufgabentyp === 'minus';
  const richtung = istMinus ? -1 : 1;
  const a = Number(aufgabe.a), b = Number(aufgabe.b);
  const weg = { start: a, zeichen: istMinus ? '−' : '+', istMinus, spruenge: [], zerlegung: null };
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 1) return weg;

  let stand = a;
  function springe(um, art) {
    const ziel = stand + richtung * um;
    weg.spruenge.push({ um, von: stand, ziel, art });
    stand = ziel;
  }

  const zehner = Math.floor(b / 10) * 10, einer = b % 10;
  if (zehner > 0) springe(zehner, 'zehner');
  if (einer > 0) {
    const standEiner = stand % 10;
    // Abstand zum nächsten vollen Zehner in Rechenrichtung. Steht man schon auf einem,
    // gibt es keinen Zwischenhalt — dann ist es ein einziger Sprung.
    const bisZehner = istMinus ? standEiner : (10 - standEiner) % 10;
    if (bisZehner > 0 && einer > bisZehner) {
      springe(bisZehner, 'bis-zehner');
      springe(einer - bisZehner, 'rest');
      weg.zerlegung = { ganze: einer, teil1: bisZehner, teil2: einer - bisZehner };
    } else {
      springe(einer, 'einer');
    }
  }
  return weg;
}

// Schritt = { titel, erklaerung (HTML), sprungIdx }
// Je Sprung ein Schritt. Der Schritt stellt die Frage nach der Landung; aufgedeckt wird sie
// erst mit dem nächsten Schritt. Die LETZTE Landung wird nie aufgedeckt — das ist die Antwort,
// und die gibt das Kind (Befund 18.07.2026: alles andere ist „wie cheaten").
export function berechneSchritte(aufgabe) {
  const weg = berechneRechenweg(aufgabe);
  const z = weg.zeichen;
  const dazu = weg.istMinus ? 'weg' : 'dazu';
  const nimm = weg.istMinus ? 'Nimm' : 'Gib';
  const n = weg.spruenge.length;

  if (n === 0) {
    return [{ titel: 'Rechne', erklaerung: `<b>${aufgabe.a} ${z} ${aufgabe.b} = ?</b> — Du sagst es!`, sprungIdx: -1 }];
  }

  return weg.spruenge.map((s, i) => {
    const letzter = i === n - 1;
    const frage = `<b>${s.von} ${z} ${s.um} = ?</b>`;
    const schluss = letzter ? ' — Du sagst es!' : '';
    let titel, text;
    switch (s.art) {
      case 'zehner':
        titel = n === 1 ? 'Nur Zehner' : 'Erst die Zehner';
        text = `${nimm}${n === 1 ? '' : ' zuerst'} die <b class="rw-z">${s.um}</b> ${dazu}: ${frage}`;
        break;
      case 'bis-zehner':
        titel = 'Bis zum Zehner';
        text = `${i === 0 ? 'Die' : 'Jetzt die'} <b class="rw-e">${weg.zerlegung.ganze}</b>, in zwei Sprüngen. Spring erst bis zum Zehner: ${frage}`;
        break;
      case 'rest':
        titel = 'Der Rest';
        text = `<b class="rw-e">${weg.zerlegung.ganze} = ${weg.zerlegung.teil1} + ${weg.zerlegung.teil2}</b>. `
          + `${weg.zerlegung.teil1} ${weg.zerlegung.teil1 === 1 ? 'ist' : 'sind'} schon ${dazu}, `
          + `${weg.zerlegung.teil2} ${weg.zerlegung.teil2 === 1 ? 'fehlt' : 'fehlen'} noch: ${frage}`
          + kleineAufgabe(s, weg);
        break;
      default:
        titel = n === 1 ? 'Ein Sprung' : 'Jetzt die Einer';
        text = `${n === 1 ? nimm : 'Jetzt'} die <b class="rw-e">${s.um}</b> ${dazu}: ${frage}` + kleineAufgabe(s, weg);
    }
    return { titel, erklaerung: text + schluss, sprungIdx: i };
  });
}

// Vom vollen Zehner zurück ist immer dieselbe kleine Aufgabe (80 − 2 wie 10 − 2). Der Hinweis
// steht nur bei Minus und nicht bei der 10 selbst — dort wäre er die Aufgabe noch einmal.
function kleineAufgabe(sprung, weg) {
  if (!weg.istMinus || sprung.von % 10 !== 0 || sprung.von <= 10 || sprung.um >= 10) return '';
  return ` Denk an 10 − ${sprung.um}.`;
}
