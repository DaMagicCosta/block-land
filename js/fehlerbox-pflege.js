// Aufräumen der Fehler-Box: Verfall und Bestandsschnitt in einem Durchgang.
//
// Reine Verdrahtung — die Regeln stehen in fehlerbox-logik.js, die Persistenz in state.js.
// Eigenes Modul, weil zwei Stellen aufräumen müssen: der Aufgaben-Einstieg (dort entsteht
// der Bestand) und die Eltern-Statistik (dort wird er angesehen). Ohne den zweiten Aufruf
// zeigt der Eltern-Bereich einen Stand, der beim nächsten Spielen sofort verfällt — und ein
// Bestand von 73 bei einer Grenze von 20 liest sich dort wie ein Fehler.
//
// Der Aufruf ist idempotent: Zweimal hintereinander ändert beim zweiten Mal nichts.
import { getFehlerbox, setzeFehlerboxEintrag } from './state.js';
import { verfallene, ueberzaehlige } from './fehlerbox-logik.js';

export function raeumeFehlerboxAuf(profileId) {
  if (!profileId) return 0;
  let entfernt = 0;
  for (const schluessel of verfallene(getFehlerbox(profileId))) {
    setzeFehlerboxEintrag(profileId, schluessel, null, 'verfallen');
    entfernt++;
  }
  // Erst nach dem Verfall schneiden: Sonst würde geschnitten, was ohnehin verfallen wäre,
  // und der Schnitt träfe einen Eintrag zu viel.
  for (const schluessel of ueberzaehlige(getFehlerbox(profileId))) {
    setzeFehlerboxEintrag(profileId, schluessel, null, 'verdraengt');
    entfernt++;
  }
  return entfernt;
}
