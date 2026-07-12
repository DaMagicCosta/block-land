// Werkstatt / Rezeptbuch: Rohstoffe in Belohnungen "bauen" -> Gutscheine.
import { oeffneModal } from './modal.js';
import {
  getCurrentProfile, getRezepte, getGutscheinStapel, getInventar, kannBauen, baueGutschein,
  getGutscheinAnfragen, stelleGutscheinAnfrage, raeumeAbgelehnteAnfragenAuf, getSyncConfig,
} from './state.js';
import { flushSync } from './sync.js';
import { aktualisiereInventarHeader } from './inventar.js';
import { escapeHtml } from './utils.js';

const ITEM_EMOJI = { holz: '🪵', stein: '🪨', blume: '🌸', eisen: '⛏️', diamant: '💎' };

// nachSchliessen: optionaler Callback, der NACH dem Aufräumen abgelehnter Anfragen läuft
// (Final-Review I3: app.js re-rendert bei blockland:zustandEingespielt nur, wenn kein Modal
// offen ist — die Werkstatt selbst öffnet aber ohne Render-Callback, also blieben Ereignisse,
// die während offener Werkstatt einliefen (z.B. Telegram-Freigabe), bis zum nächsten Routing-
// Trigger unsichtbar. Aufrufer (aktuell nur welt.js) übergibt hier renderWelt).
export function oeffneRezeptbuch(nachSchliessen) {
  const profile = getCurrentProfile();
  if (!profile) return;
  // Live-Umschwung (Live-Test-Befund 2026-07-12): app.js re-rendert bei offenem Modal bewusst
  // nicht — kommt die Telegram-Entscheidung, während das Kind in der Werkstatt wartet, muss
  // die Werkstatt selbst auffrischen, sonst bleibt ⏳ stehen und der Gutschein verschwindet
  // später wortlos. Listener lebt nur solange die Werkstatt offen ist.
  const aufSyncEreignis = () => render();
  window.addEventListener('blockland:zustandEingespielt', aufSyncEreignis);

  const modal = oeffneModal({
    klassen: 'modal-backdrop--werkstatt',
    inhaltHtml: '<div class="modal modal--werkstatt"></div>',
    onClose: () => {
      window.removeEventListener('blockland:zustandEingespielt', aufSyncEreignis);
      raeumeAbgelehnteAnfragenAuf(profile.id);
      if (nachSchliessen) nachSchliessen();
    },
  });
  if (!modal) { window.removeEventListener('blockland:zustandEingespielt', aufSyncEreignis); return; }

  let tab = 'bauen';

  function render() {
    const inv = getInventar(profile.id);
    modal.inhalt.innerHTML = `
      <div class="werkstatt__kopf">🛠️ Werkstatt</div>
      <div class="werkstatt__vorrat">${rendereVorrat(inv)}</div>
      <div class="werkstatt__tabs">
        <button data-tab="bauen" class="${tab === 'bauen' ? 'aktiv' : ''}">📖 Rezepte</button>
        <button data-tab="gutscheine" class="${tab === 'gutscheine' ? 'aktiv' : ''}">🎟️ Gutscheine</button>
      </div>
      <div class="werkstatt__inhalt"></div>
      <button class="werkstatt__schliessen">Fertig</button>
    `;
    const inhalt = modal.inhalt.querySelector('.werkstatt__inhalt');
    if (tab === 'bauen') rendereRezepte(inhalt, profile, render);
    else rendereGutscheine(inhalt, profile, render);

    modal.inhalt.querySelectorAll('.werkstatt__tabs button').forEach(b => {
      b.addEventListener('click', () => { tab = b.dataset.tab; render(); });
    });
    modal.inhalt.querySelector('.werkstatt__schliessen')
      .addEventListener('click', () => modal.schliessen());
  }

  render();
}

function rendereVorrat(inv) {
  const eintraege = Object.entries(inv).filter(([, n]) => n > 0);
  if (!eintraege.length) {
    return '<span class="werkstatt__leer">Noch keine Rohstoffe — übe in der Welt!</span>';
  }
  return eintraege
    .map(([item, n]) => `<span class="werkstatt__roh">${ITEM_EMOJI[item] ?? '❔'} ${n}</span>`)
    .join('');
}

function kostenText(kosten) {
  return Object.entries(kosten)
    .map(([it, n]) => `${ITEM_EMOJI[it] ?? '❔'}${n}`)
    .join(' ');
}

function rendereRezepte(container, profile, neuRendern) {
  const rezepte = getRezepte().filter(r => r.aktiv);
  const kategorien = [...new Set(rezepte.map(r => r.kategorie))];
  container.innerHTML = kategorien.map(kat => `
    <div class="werkstatt__kategorie">${escapeHtml(kat)}</div>
    <div class="werkstatt__rezepte">
      ${rezepte.filter(r => r.kategorie === kat).map(r => {
        const machbar = kannBauen(profile.id, r.kosten);
        return `
          <div class="werkstatt__rezept${machbar ? '' : ' werkstatt__rezept--gesperrt'}">
            <div class="werkstatt__rezept-name">${r.emoji} ${escapeHtml(r.name)}</div>
            <div class="werkstatt__rezept-kosten">${kostenText(r.kosten)}</div>
            <button class="werkstatt__bauen" data-id="${escapeHtml(r.id)}"${machbar ? '' : ' disabled'}>Bauen</button>
          </div>
        `;
      }).join('')}
    </div>
  `).join('');

  container.querySelectorAll('.werkstatt__bauen').forEach(btn => {
    btn.addEventListener('click', () => {
      const rezept = getRezepte().find(r => r.id === btn.dataset.id);
      if (!rezept) return;
      const gutschein = baueGutschein(profile.id, rezept);
      if (!gutschein) return;
      aktualisiereInventarHeader(true);
      const hinweis = document.createElement('div');
      hinweis.className = 'werkstatt__gebaut';
      hinweis.textContent = `🎉 Gebaut: ${rezept.emoji} ${rezept.name}! Gutschein liegt bereit.`;
      container.prepend(hinweis);
      setTimeout(neuRendern, 1400);
    });
  });
}

// Gutschein-Tab: Stapel-Anzeige + „Mama & Papa fragen" (nur bei konfiguriertem Sync).
// Zustände pro Sorte: normal | Anzahl-Wahl offen | ⏳ Anfrage offen | ✅ freigegeben | 🌙 abgelehnt.
// anfrageWahl lebt nur solange die Werkstatt offen ist (Modul-Scope wäre ein Leck).
function rendereGutscheine(container, profile, neuRendern, anfrageWahl = null) {
  const stapel = getGutscheinStapel(profile.id);
  const cfg = getSyncConfig();
  const syncAktiv = !!(cfg.aktiv && cfg.url && cfg.schluessel);
  const anfragen = getGutscheinAnfragen(profile.id);

  // Freigegebene Anfragen, deren Sorte nicht mehr im Stapel liegt (die Einlösung hat die
  // letzte Karte abgebucht): als eigene Bestätigungs-Zeile zeigen — ein Gutschein darf nie
  // wortlos verschwinden (Live-Test-Befund 2026-07-12). Felder sind Anfrage-Snapshots.
  const nurFreigegeben = anfragen.filter(a =>
    a.status === 'freigegeben' && !stapel.some(s => s.rezeptId === a.rezeptId));

  if (!stapel.length && !nurFreigegeben.length) {
    container.innerHTML = '<div class="werkstatt__leer">Noch keine Gutscheine gebaut.</div>';
    return;
  }

  container.innerHTML = `
    <div class="werkstatt__gutscheine">
      ${stapel.map(s => {
        const summe = (typeof s.wert === 'number' && s.wert > 0)
          ? `<span class="werkstatt__gutschein-summe">= ${s.anzahl * s.wert} ${escapeHtml(s.einheit ?? '')}</span>`
          : '';
        const offen = anfragen.find(a => a.status === 'offen' && a.rezeptId === s.rezeptId);
        const freigegeben = anfragen.find(a => a.status === 'freigegeben' && a.rezeptId === s.rezeptId);
        const abgelehnt = anfragen.find(a => a.status === 'abgelehnt' && a.rezeptId === s.rezeptId);
        const wahlOffen = anfrageWahl?.rezeptId === s.rezeptId;
        let aktion = '';
        if (freigegeben) {
          aktion = '<div class="werkstatt__anfrage-status werkstatt__anfrage-status--ja">✅ Freigegeben — viel Spaß!</div>';
        } else if (offen) {
          aktion = '<div class="werkstatt__anfrage-status">⏳ Gefragt — warte auf Mama oder Papa</div>';
        } else if (abgelehnt) {
          aktion = '<div class="werkstatt__anfrage-status werkstatt__anfrage-status--nein">🌙 Jetzt nicht — frag später nochmal</div>';
        } else if (wahlOffen) {
          const n = anfrageWahl.anzahl;
          const zwischensumme = (typeof s.wert === 'number' && s.wert > 0)
            ? ` = ${n * s.wert} ${escapeHtml(s.einheit ?? '')}` : '';
          aktion = `
            <div class="werkstatt__anfrage-wahl">
              <button class="werkstatt__stepper" data-schritt="-1" ${n <= 1 ? 'disabled' : ''}>−</button>
              <span class="werkstatt__anfrage-anzahl">×${n}${zwischensumme}</span>
              <button class="werkstatt__stepper" data-schritt="1" ${n >= s.anzahl ? 'disabled' : ''}>+</button>
              <button class="werkstatt__anfrage-senden" data-senden="${escapeHtml(s.rezeptId)}">Abschicken</button>
            </div>`;
        } else if (syncAktiv) {
          aktion = `<button class="werkstatt__anfragen" data-anfragen="${escapeHtml(s.rezeptId)}">📨 Mama &amp; Papa fragen</button>`;
        }
        return `
          <div class="werkstatt__gutschein">
            <span class="werkstatt__gutschein-name">${s.emoji} ${escapeHtml(s.name)}</span>
            <span class="werkstatt__gutschein-anzahl">×${s.anzahl}</span>
            ${summe}
            ${aktion}
          </div>`;
      }).join('')}
      ${nurFreigegeben.map(a => `
        <div class="werkstatt__gutschein">
          <span class="werkstatt__gutschein-name">${a.emoji ?? '🎟️'} ${escapeHtml(a.name ?? 'Gutschein')}</span>
          <span class="werkstatt__gutschein-anzahl">×${Number(a.anzahl) || 1}</span>
          <div class="werkstatt__anfrage-status werkstatt__anfrage-status--ja">✅ Freigegeben — viel Spaß!</div>
        </div>`).join('')}
    </div>
  `;

  const neu = (wahl) => rendereGutscheine(container, profile, neuRendern, wahl);
  container.querySelectorAll('[data-anfragen]').forEach(btn => {
    btn.addEventListener('click', () => neu({ rezeptId: btn.dataset.anfragen, anzahl: 1 }));
  });
  container.querySelectorAll('.werkstatt__stepper').forEach(btn => {
    btn.addEventListener('click', () => {
      const eintrag = stapel.find(s => s.rezeptId === anfrageWahl.rezeptId);
      const n = Math.min(eintrag?.anzahl ?? 1, Math.max(1, anfrageWahl.anzahl + Number(btn.dataset.schritt)));
      neu({ ...anfrageWahl, anzahl: n });
    });
  });
  container.querySelectorAll('[data-senden]').forEach(btn => {
    btn.addEventListener('click', () => {
      const eintrag = stapel.find(s => s.rezeptId === btn.dataset.senden);
      if (eintrag && stelleGutscheinAnfrage(profile.id, eintrag, anfrageWahl.anzahl)) {
        flushSync();   // Sofort-Versand: die Nachricht soll unmittelbar bei den Eltern ankommen
      }
      neu(null);       // re-rendert — die Sorte zeigt jetzt ⏳ (oder den Button, falls Guard zuschlug)
    });
  });
}
