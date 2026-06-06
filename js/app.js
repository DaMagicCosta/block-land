import { renderAuswahl } from './auswahl.js';
import { renderWelt }    from './welt.js';
import { renderKarte }  from './karte.js';
import { renderBurg }   from './burg.js';

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
route();
console.log('[Block-Land] Routing aktiv.');
