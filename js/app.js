import { renderAuswahl } from './auswahl.js';
import { renderWelt }    from './welt.js';
import { renderKarte }  from './karte.js';
import { renderBurg }   from './burg.js';
import { renderInfo } from './info.js';
import { initSync } from './sync.js';
import { istModalOffen } from './modal.js';
import { starteTimerLaufzeit } from './uebungs-timer.js';

const root = document.getElementById('app');

// Hinweis: Profil-Anlegen läuft jetzt über den Eltern-Bereich; die alte
// #wizard-Route (js/wizard.js) ist deshalb nicht mehr verlinkt.
const routes = {
  '':        () => renderAuswahl(root),
  'auswahl': () => renderAuswahl(root),
  'welt':    () => renderWelt(root),
  'karte':   () => renderKarte(root),
  'burg':    () => renderBurg(root),
  'info':    () => renderInfo(root),
};

function route() {
  const hash = location.hash.replace('#', '');
  const handler = routes[hash] ?? routes[''];
  handler();
}

window.addEventListener('hashchange', route);

// Frisch eingespielten Familien-Spielstand und Timer-Phasenwechsel sofort zeigen —
// aber nie mitten in einer offenen Aufgabe re-rendern.
['blockland:zustandEingespielt', 'blockland:timerPhase'].forEach(ereignis =>
  window.addEventListener(ereignis, () => { if (!istModalOffen()) route(); }));

initSync();
starteTimerLaufzeit();
route();
console.log('[Block-Land] Routing aktiv.');
