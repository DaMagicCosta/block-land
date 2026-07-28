// Ad-hoc-Checks für die reine Zeiger-Rechnung in js/zifferblatt.js.
// Lauf: node tools/check-zeiger-logik.mjs
import { rasteMinuten, winkelZuMinuten, stundenWinkel, minutenWinkel, ziehRastungFuer } from '../js/zifferblatt.js';
import { RASTUNG } from '../js/aufgaben/uhr.js';

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

// --- Zieh-Rastung der Stelluhr: Bewegbarkeit + Erreichbarkeit (Befund 28.07.2026,
// Prüfungsrunde 2) ---
// Diese Prüfung hätte den Fehler gefunden: Übernahm die Stelluhr die Aufgaben-Rastung
// direkt (RASTUNG[stufe], z. B. 60 Minuten auf Stufe 1), bewegten aus einer Ruhelage
// heraus nur rund 4 von 360 Winkelgraden überhaupt die eingestellte Zeit — fast jede
// Bewegung wurde entweder weggerundet oder als Überlauf über die 12 gewertet und hob sich
// auf. ziehRastungFuer() in js/zifferblatt.js koppelt die Zieh-Rastung deshalb ab
// (höchstens 15 Minuten). Beide folgenden Zusicherungen sichern die tragenden
// Eigenschaften dieser Entkopplung ab und MÜSSEN fehlschlagen, würde sie wieder entfernt
// (z. B. durch Ersetzen von ziehRastungFuer(r) mit r) — das wurde von Hand gegengeprobt
// (Zieh-Rastung testweise auf die Aufgaben-Rastung zurückgesetzt, beide Zusicherungen
// schlugen wie erwartet fehl, Originalzustand danach exakt wiederhergestellt).

// 1) Bewegbarkeit: aus mehreren, realistischen Ruhelagen (Uhr-Aufgaben laufen nur zwischen
// 6:00 und Mitternacht, siehe generiereUhrAufgabe „frueheste" — exakte Tagesränder sind
// hier bewusst ausgeklammert, das sind reine Rastungs-Randeffekte von rasteMinuten/
// winkelZuMinuten am Tagesanfang/-ende, siehe „bleibt im Tag" oben, kein Symptom dieses
// Befunds) alle 360 Winkelgrade durchgehen und zählen, bei wie vielen sich die eingestellte
// Zeit tatsächlich ändert. Muss auf JEDER Stufe deutlich über der Hälfte liegen.
const RUHELAGEN_BEWEGBARKEIT = [375, 600, 735, 900, 1200, 1350]; // 6:15, 10:00, 12:15, 15:00, 20:00, 22:30
function bewegbarkeitsAnteil(startMinuten, rastung) {
  const start = rasteMinuten(startMinuten, rastung);
  let bewegt = 0;
  for (let winkel = 0; winkel < 360; winkel++) {
    const neu = rasteMinuten(winkelZuMinuten(winkel, start), rastung);
    if (neu !== start) bewegt++;
  }
  return bewegt / 360;
}
for (const stufe of Object.keys(RASTUNG).map(Number).sort((a, b) => a - b)) {
  const aufgabenRastung = RASTUNG[stufe];
  const ziehRastung = ziehRastungFuer(aufgabenRastung);
  for (const ruhelage of RUHELAGEN_BEWEGBARKEIT) {
    const anteil = bewegbarkeitsAnteil(ruhelage, ziehRastung);
    pruefe(
      `Bewegbarkeit Stufe ${stufe} (Zieh-Rastung ${ziehRastung}) ab ${ruhelage} min: deutlich über der Hälfte bewegt sich (${(anteil * 100).toFixed(0)}%)`,
      anteil > 0.6
    );
  }
}

// 2) Erreichbarkeit: die Zieh-Rastung muss auf jeder Stufe ein Teiler der Aufgaben-Rastung
// sein — sonst wäre der von der Aufgabe geforderte Zielwert beim Ziehen gar nicht exakt
// treffbar (z. B. eine volle Stunde bei einer Zieh-Rastung, die nicht glatt in 60 aufgeht).
for (const stufe of Object.keys(RASTUNG).map(Number).sort((a, b) => a - b)) {
  const aufgabenRastung = RASTUNG[stufe];
  const ziehRastung = ziehRastungFuer(aufgabenRastung);
  pruefe(
    `Erreichbarkeit Stufe ${stufe}: Zieh-Rastung ${ziehRastung} teilt Aufgaben-Rastung ${aufgabenRastung} glatt`,
    aufgabenRastung % ziehRastung === 0
  );
}

if (fehler) { console.error(`\n${fehler} Check(s) fehlgeschlagen.`); process.exit(1); }
console.log('\nAlle zeiger-logik-Checks grün.');
