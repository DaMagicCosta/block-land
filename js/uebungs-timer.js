// Läufer des Übungs-Timers: tickt sekündlich, aber nur bei sichtbarer App + gewähltem
// Profil + aktivem Timer. Persistiert alle 15 s lokal OHNE Sync-Meldung; gemeldet werden
// nur Phasenwechsel (Nacht-Beginn, Sonnenaufgang) und der Verlassen-Checkpoint (Spec §4).
// KEIN anderes Modul tickt oder persistiert Timer-Stände.
import { getCurrentProfile, getTimer, setzeTimerStand } from './state.js';
import { wirksameKonfig, wendeAbwesenheitAn, ticke, istNacht } from './timer-logik.js';

const PERSIST_RASTER_SEK = 15;

// In-Memory-Stand zwischen den Checkpoints — sonst käme jeder Tick vom stalen State-Stand.
let lauf = null;              // { profilId, timer }
let sekundenSeitPersist = 0;

function meldePhase() {
  window.dispatchEvent(new CustomEvent('blockland:timerPhase'));
}

function kontext() {
  const p = getCurrentProfile();
  if (!p) return null;
  const konfig = wirksameKonfig(p.alter, p.timerKonfig);
  if (!konfig.aktiv) return null;
  return { p, konfig };
}

function tick() {
  if (document.hidden) return;
  const ctx = kontext();
  if (!ctx) { lauf = null; return; }
  const { p, konfig } = ctx;
  const jetzt = new Date();
  if (!lauf || lauf.profilId !== p.id) {
    lauf = { profilId: p.id, timer: getTimer(p.id) };
    sekundenSeitPersist = 0;
  }
  // Sonnenaufgang / Abwesenheit zuerst — auch die ablaufende Nacht endet hier.
  const nachPause = wendeAbwesenheitAn(lauf.timer, konfig, jetzt);
  if (nachPause !== lauf.timer) {
    lauf.timer = nachPause;
    setzeTimerStand(p.id, nachPause, { melden: true });   // Sonnenaufgang synct
    sekundenSeitPersist = 0;
    meldePhase();
    return;
  }
  if (istNacht(lauf.timer, jetzt)) return;                // Nacht läuft — nichts zu ticken
  const { timer: neu, nachtBegonnen } = ticke(lauf.timer, konfig, jetzt);
  lauf.timer = neu;
  sekundenSeitPersist += 1;
  if (nachtBegonnen || sekundenSeitPersist >= PERSIST_RASTER_SEK) {
    setzeTimerStand(p.id, neu, { melden: nachtBegonnen });  // Nacht-Beginn synct
    sekundenSeitPersist = 0;
    if (nachtBegonnen) meldePhase();
  }
}

// Nach externen Timer-Änderungen (Sync-Pull, Eltern-Korrektur) frisch vom State laden.
export function verwerfeLaufzeitStand() {
  lauf = null;
}

export function starteTimerLaufzeit() {
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Verlassen-Checkpoint: Stand sichern + melden (Übergabe an andere Geräte).
      if (lauf) { setzeTimerStand(lauf.profilId, lauf.timer, { melden: true }); sekundenSeitPersist = 0; }
    } else {
      verwerfeLaufzeitStand();   // beim Zurückkommen greift die Abwesenheits-Regel im tick()
    }
  });
  // Fremde Ereignisse (anderes Gerät) können den Timer geändert haben.
  window.addEventListener('blockland:zustandEingespielt', verwerfeLaufzeitStand);
}
