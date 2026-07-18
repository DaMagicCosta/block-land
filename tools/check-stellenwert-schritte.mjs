// Check-Runner für js/stellenwert-schritte.js — geführte Schrittfolge Plus/Minus.
// Kernregel (Arthur-Befund 18.07.2026): Der LETZTE Schritt darf das Ergebnis NICHT
// verraten — er stellt die Frage („9 Zehner und 5 Einer = ?"), die Antwort geben
// die Antwort-Knöpfe danach. Alles andere wäre Wiedererkennen statt Abruf.
import { berechneSchritte } from '../js/stellenwert-schritte.js';

let fehler = 0;
function check(name, bedingung) {
  if (bedingung) { console.log(`  OK  ${name}`); }
  else { console.error(`  FEHLER  ${name}`); fehler++; }
}

function letzter(aufgabe) {
  const schritte = berechneSchritte(aufgabe);
  return schritte[schritte.length - 1];
}

// Ergebnis-Zahl als eigenstehende Zahl im Text? (95 in „= 95" ja, 9 in „9 Zehner" nein)
function verraetErgebnis(schritt, ergebnis) {
  const zahlen = (schritt.erklaerung.replace(/<[^>]*>/g, ' ').match(/\d+/g) ?? []).map(Number);
  return zahlen.includes(ergebnis) || schritt.visual.ergebnis === ergebnis;
}

// --- Plus mit Übergang (Arthurs Screenshot-Fall: 78 + 17 = 95) ---
{
  const s = berechneSchritte({ aufgabentyp: 'plus', a: 78, b: 17, ergebnis: 95 });
  check('plus 78+17: 5 Schritte (mit Bündeln)', s.length === 5);
  check('plus 78+17: letzter Schritt fragt („?")', s[4].erklaerung.includes('?'));
  check('plus 78+17: letzter Schritt verrät 95 nicht', !verraetErgebnis(s[4], 95));
  check('plus 78+17: Zehner/Einer-Zerlegung bleibt (9 und 5)', s[4].visual.zehner === 9 && s[4].visual.einer === 5);
}

// --- Plus ohne Übergang (23 + 45 = 68) ---
{
  const s = berechneSchritte({ aufgabentyp: 'plus', a: 23, b: 45, ergebnis: 68 });
  check('plus 23+45: 4 Schritte (ohne Bündeln)', s.length === 4);
  check('plus 23+45: letzter Schritt verrät 68 nicht', !verraetErgebnis(s[s.length - 1], 68));
}

// --- Minus mit Borgen (53 − 17 = 36) ---
{
  const s = berechneSchritte({ aufgabentyp: 'minus', a: 53, b: 17, ergebnis: 36 });
  check('minus 53−17: 6 Schritte (mit Entbündeln)', s.length === 6);
  check('minus 53−17: letzter Schritt fragt („?")', s[s.length - 1].erklaerung.includes('?'));
  check('minus 53−17: letzter Schritt verrät 36 nicht', !verraetErgebnis(s[s.length - 1], 36));
  check('minus 53−17: Zerlegung bleibt (3 und 6)', s[s.length - 1].visual.zehner === 3 && s[s.length - 1].visual.einer === 6);
}

// --- Minus ohne Borgen (58 − 23 = 35) ---
{
  const s = berechneSchritte({ aufgabentyp: 'minus', a: 58, b: 23, ergebnis: 35 });
  check('minus 58−23: 4 Schritte (ohne Entbündeln)', s.length === 4);
  check('minus 58−23: letzter Schritt verrät 35 nicht', !verraetErgebnis(s[s.length - 1], 35));
}

// --- Zwischenschritte bleiben lehrreich (Rechenweg zeigen ist erwünscht, nur das Endergebnis nicht) ---
{
  const s = berechneSchritte({ aufgabentyp: 'plus', a: 78, b: 17, ergebnis: 95 });
  check('plus 78+17: Einer-Schritt rechnet vor (15)', s[1].erklaerung.includes('15'));
  check('plus 78+17: Zehner-Schritt rechnet vor (9)', s[3].erklaerung.includes('9'));
}

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle stellenwert-schritte-Checks grün.');
