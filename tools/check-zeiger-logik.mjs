// Ad-hoc-Checks für die reine Zeiger-Rechnung in js/zifferblatt.js.
// Lauf: node tools/check-zeiger-logik.mjs
import { rasteMinuten, winkelZuMinuten, stundenWinkel, minutenWinkel } from '../js/zifferblatt.js';

let fehler = 0;
function pruefe(name, bedingung) {
  if (bedingung) console.log(`  OK  ${name}`);
  else { console.error(`FEHLT ${name}`); fehler += 1; }
}

// --- Rastung: nie eine ungültige Zeigerstellung ---
pruefe('rastet auf 15er ab', rasteMinuten(913, 15) === 915);
pruefe('rastet auf 15er auf', rasteMinuten(922, 15) === 915);
pruefe('rastet auf 5er', rasteMinuten(907, 5) === 905);
pruefe('rastet auf volle Stunde', rasteMinuten(935, 60) === 960);
pruefe('rastet nie feiner als der Schritt',
  [5, 15, 30, 60].every(r => [0, 137, 619, 1439].every(m => rasteMinuten(m, r) % r === 0)));

// --- Winkel → Minuten, MIT Kopplung des Stundenzeigers ---
// Kernregel: Der Minutenzeiger nimmt den Stundenzeiger mit. Zieht man von 3:00 auf die 6
// (180°), muss 3:30 herauskommen — nicht 3:00 mit verrutschtem Minutenzeiger.
pruefe('3:00 + halbe Drehung = 3:30', winkelZuMinuten(180, 180) === 210);
pruefe('3:00 + viertel Drehung = 3:15', winkelZuMinuten(90, 180) === 195);
pruefe('bleibt in derselben Stunde bei kleiner Bewegung', winkelZuMinuten(30, 180) === 185);

// Über die 12 hinaus: läuft rund weiter in die nächste Stunde, springt nicht zurück.
pruefe('von 3:50 über die 12 auf 4:05', winkelZuMinuten(30, 230) === 245);
// Rückwärts über die 12: eine Stunde zurück.
pruefe('von 3:05 rückwärts über die 12 auf 2:55', winkelZuMinuten(330, 185) === 175);

// Tagesgrenzen
pruefe('bleibt im Tag (unten)', winkelZuMinuten(330, 5) >= 0);
pruefe('bleibt im Tag (oben)', winkelZuMinuten(30, 1435) <= 1439);

// --- Winkel-Umrechnung ---
pruefe('12 Uhr = 0 Grad', stundenWinkel(720) === 0);
pruefe('3 Uhr = 90 Grad', stundenWinkel(180) === 90);
pruefe('halb = Stundenzeiger auf halbem Weg', Math.abs(stundenWinkel(210) - 105) < 0.001);
pruefe('Minutenzeiger auf 30 = 180 Grad', minutenWinkel(210) === 180);

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle zeiger-logik-Checks grün.');
