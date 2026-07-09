// Pure Logik für die Textaufgaben (Geschichten-Dorf): Vorlage wählen, Slots würfeln,
// Ausdruck lösen, Sätze in Wort-Tokens zerlegen, Distraktoren bauen.
// KEINE DOM-/State-Abhängigkeit (node-testbar über tools/check-text-logik.mjs).
// Exportiert: generiereTextaufgabe(vorlagen, stufe, rnd), plus Bausteine für Checks.

const MAX_WUERFEL_VERSUCHE = 20;

function ganzzahl(rnd, min, max) { return min + Math.floor(rnd() * (max - min + 1)); }

// Fisher-Yates mit injiziertem rnd (kein Math.random hier).
function mische(arr, rnd) {
  const kopie = [...arr];
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie;
}

// Prüft, ob der aus `werte` gelöste Ausdruck der Vorlage ganzzahlig in [0, 100] liegt.
function istGueltig(vorlage, werte) {
  const ergebnis = loeseAusdruck(vorlage.loesung, werte);
  return Number.isInteger(ergebnis) && ergebnis >= 0 && ergebnis <= 100;
}

// Slots einer Vorlage würfeln; Division erzwingt a = Vielfaches von b (Slot mit
// "vielfachesVon" wird erst NACH seiner Basis gewürfelt, min/max sind dann der
// Faktor-Bereich). Ergebnis muss ganzzahlig in [0, 100] liegen — sonst neu würfeln
// (Cap MAX_WUERFEL_VERSUCHE, danach Minimalwerte als Fallback).
export function wuerfleSlots(vorlage, rnd) {
  const slotNamen = Object.keys(vorlage.slots);
  const unabhaengig = slotNamen.filter((n) => !vorlage.slots[n].vielfachesVon);
  const abhaengig = slotNamen.filter((n) => vorlage.slots[n].vielfachesVon);

  const wuerfleEinmal = () => {
    const werte = {};
    for (const name of unabhaengig) {
      const s = vorlage.slots[name];
      werte[name] = ganzzahl(rnd, s.min, s.max);
    }
    for (const name of abhaengig) {
      const s = vorlage.slots[name];
      const basis = werte[s.vielfachesVon];
      const faktor = ganzzahl(rnd, s.min, s.max);
      werte[name] = basis * faktor;
    }
    return werte;
  };

  let werte = wuerfleEinmal();
  let versuche = 1;
  while (!istGueltig(vorlage, werte) && versuche < MAX_WUERFEL_VERSUCHE) {
    werte = wuerfleEinmal();
    versuche += 1;
  }

  if (!istGueltig(vorlage, werte)) {
    // Fallback: Minimalwerte (garantiert deterministisch, keine weitere Würfelung).
    const fallback = {};
    for (const name of unabhaengig) fallback[name] = vorlage.slots[name].min;
    for (const name of abhaengig) {
      const s = vorlage.slots[name];
      fallback[name] = fallback[s.vielfachesVon] * s.min;
    }
    werte = fallback;
  }
  return werte;
}

// Löst "a-b"/"a+b"/"a*b"/"a/b" mit den gewürfelten Werten (nur diese vier Formen).
export function loeseAusdruck(ausdruck, werte) {
  const match = ausdruck.match(/^([a-z])([+\-*/])([a-z])$/);
  if (!match) throw new Error(`[text] unbekannter Ausdruck: ${ausdruck}`);
  const [, linksName, op, rechtsName] = match;
  const links = werte[linksName];
  const rechts = werte[rechtsName];
  switch (op) {
    case '+': return links + rechts;
    case '-': return links - rechts;
    case '*': return links * rechts;
    case '/': return links / rechts;
    default: throw new Error(`[text] unbekannte Operation: ${op}`);
  }
}

// Sätze -> Token-Listen; ersetzt {slot} durch Wert, markiert Zahl-Tokens
// (istZahl) und deren Relevanz (irrelevante_slots der Vorlage -> relevant: false).
export function zerlegeSaetze(vorlage, werte) {
  const irrelevant = new Set(vorlage.irrelevante_slots ?? []);
  return vorlage.saetze.map((satzVorlage) => {
    const woerter = satzVorlage.split(' ');
    const tokens = woerter.map((wort) => {
      const slotMatch = wort.match(/^\{(\w+)\}$/);
      if (slotMatch) {
        const slot = slotMatch[1];
        return { text: String(werte[slot]), istZahl: true, relevant: !irrelevant.has(slot) };
      }
      return { text: wort, istZahl: false, relevant: false };
    });
    return { tokens };
  });
}

// 4 Distraktoren: falsche Operation, Teilzahl (a oder b), Ergebnis±1/±2, Zahlendreher
// (nur wenn zweistellig und Dreher != Ergebnis); alles >= 0, keine Duplikate,
// Auffüllen mit ±3/±4 falls nötig.
export function baueDistraktoren(ergebnis, werte, operation, rnd) {
  const { a, b } = werte;
  const kandidaten = [];

  // Falsche Operation: die jeweils andere naheliegende Rechenart.
  let falscheOperation;
  if (operation === 'plus') falscheOperation = Math.abs(a - b);
  else if (operation === 'minus') falscheOperation = a + b;
  else if (operation === 'mal') falscheOperation = a + b;
  else falscheOperation = a * b; // geteilt
  kandidaten.push(falscheOperation);

  // Teilzahl: eine der beiden Ausgangszahlen (die, die nicht zufällig = Ergebnis ist).
  kandidaten.push(a !== ergebnis ? a : b);

  // Ergebnis ± 1 / ± 2
  kandidaten.push(ergebnis + 1, ergebnis - 1, ergebnis + 2, ergebnis - 2);

  // Zahlendreher (nur zweistellig, Dreher != Ergebnis)
  if (ergebnis >= 10 && ergebnis <= 99) {
    const zehner = Math.floor(ergebnis / 10);
    const einer = ergebnis % 10;
    const dreher = einer * 10 + zehner;
    if (dreher !== ergebnis) kandidaten.push(dreher);
  }

  const optionen = new Set([ergebnis]);
  for (const kandidat of kandidaten) {
    if (optionen.size >= 5) break;
    if (Number.isInteger(kandidat) && kandidat >= 0 && kandidat <= 100 && !optionen.has(kandidat)) {
      optionen.add(kandidat);
    }
  }

  // Auffüllen mit wachsendem Abstand, falls noch zu wenige eindeutige Optionen.
  let zusatz = 3;
  while (optionen.size < 5 && zusatz <= 30) {
    for (const kandidat of [ergebnis + zusatz, ergebnis - zusatz]) {
      if (optionen.size >= 5) break;
      if (kandidat >= 0 && kandidat <= 100 && !optionen.has(kandidat)) optionen.add(kandidat);
    }
    zusatz += 1;
  }

  return mische(Array.from(optionen), rnd);
}

export function generiereTextaufgabe(vorlagen, stufe, rnd = Math.random) {
  const passend = vorlagen.filter((v) => v.stufe === stufe);
  const index = Math.min(passend.length - 1, Math.floor(rnd() * passend.length));
  const vorlage = passend[index];

  const werte = wuerfleSlots(vorlage, rnd);
  const ergebnis = loeseAusdruck(vorlage.loesung, werte);
  const antwort_optionen = baueDistraktoren(ergebnis, werte, vorlage.operation, rnd);
  const saetze = zerlegeSaetze(vorlage, werte);
  const vorlese_text = saetze.map((s) => s.tokens.map((t) => t.text).join(' ')).join(' ');

  return {
    aufgabentyp: 'text',
    stufe,
    npc: vorlage.npc,
    detail: `T${stufe} ${vorlage.id}`,
    saetze,
    frageIndex: vorlage.frage_index,
    ergebnis,
    antwort_optionen,
    vorlese_text,
  };
}
