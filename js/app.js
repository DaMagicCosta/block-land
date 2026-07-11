import { renderAuswahl } from './auswahl.js';
import { renderWelt }    from './welt.js';
import { renderKarte }  from './karte.js';
import { renderBurg }   from './burg.js';
import { initSync } from './sync.js';
import { istModalOffen } from './modal.js';

const root = document.getElementById('app');

// Hinweis: Profil-Anlegen läuft jetzt über den Eltern-Bereich; die alte
// #wizard-Route (js/wizard.js) ist deshalb nicht mehr verlinkt.
const routes = {
  '':        () => renderAuswahl(root),
  'auswahl': () => renderAuswahl(root),
  'welt':    () => renderWelt(root),
  'karte':   () => renderKarte(root),
  'burg':    () => renderBurg(root),
};

function route() {
  const hash = location.hash.replace('#', '');
  const handler = routes[hash] ?? routes[''];
  handler();
}

window.addEventListener('hashchange', route);

// Frisch eingespielten Familien-Spielstand sofort zeigen — aber nie mitten in einer
// offenen Aufgabe re-rendern (nächster Pull/Screenwechsel holt es nach).
window.addEventListener('blockland:zustandEingespielt', () => {
  if (!istModalOffen()) route();
});

initSync();
route();
console.log('[Block-Land] Routing aktiv.');
