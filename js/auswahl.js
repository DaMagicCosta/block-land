import { getProfiles, setCurrentProfile, updateProfile, hatKindPin, pruefeKindPin, getAvatarFoto, setzeAvatarFoto } from './state.js';
import { escapeHtml } from './utils.js';
import { loadAvatare } from './data.js';
import { oeffneModal, schliesseAlleModals } from './modal.js';
import { oeffneElternBereich } from './eltern.js';
import { oeffneKamera } from './kamera.js';

export async function renderAuswahl(container) {
  // Offene Modals (z.B. hängengebliebene Aufgabe) dürfen nicht in die Auswahl mitwandern —
  // gleiches Muster wie in welt.js (Live-Befund 23.07.: Aufgaben-Modal schwebte über „Wer übt heute?").
  schliesseAlleModals();
  // Auswahl-Screen = kein Kind aktiv: nullt das persistierte Profil, damit der
  // Übungs-Timer nach einem App-Neustart nicht auf dem Auswahl-Screen weitertickt.
  setCurrentProfile(null);

  const profile = getProfiles();

  let avatare;
  try {
    avatare = await loadAvatare();
  } catch (err) {
    container.innerHTML = `
      <div style="padding:var(--space-xl);text-align:center;color:var(--color-danger)">
        <p>Fehler beim Laden der Avatare.</p>
        <p style="color:var(--color-text-dim);font-size:var(--font-size-sm);margin-top:var(--space-md)">${escapeHtml(err.message)}</p>
      </div>
    `;
    return;
  }

  const avatarMap = Object.fromEntries(avatare.map(a => [a.id, a.emoji]));

  // Foto schlägt Emoji. Die Data-URL kommt aus dem eigenen localStorage (nicht aus dem Sync)
  // und stammt immer aus der eigenen Kamera — sie wird als src gesetzt, nie als HTML geparst.
  const karten = profile.map(p => {
    const foto = getAvatarFoto(p.id);
    const bildHtml = foto
      ? `<img class="profil-karte__foto" src="${escapeHtml(foto)}" alt="">`
      : (avatarMap[p.avatar] ?? '❔');
    return `
    <div class="profil-karte" data-profile-id="${p.id}">
      <div class="profil-karte__avatar">${bildHtml}</div>
      <div class="profil-karte__name">${escapeHtml(p.name)}${hatKindPin(p.id) ? ' 🔒' : ''}</div>
      <div class="profil-karte__welt">${escapeHtml(p.weltName)}</div>
      <button class="profil-karte__bild" data-bild="${p.id}">🎨 Bild</button>
    </div>
  `;
  }).join('');

  const leer = profile.length
    ? ''
    : '<p class="auswahl__leer">Noch keine Kinder angelegt.<br>Eltern: unten einrichten 👇</p>';

  container.innerHTML = `
    <div class="auswahl">
      <h1 class="auswahl__title">BLOCK-LAND</h1>
      <p class="auswahl__subtitle">Wer übt heute?</p>
      ${leer}
      <div class="auswahl__grid">${karten}</div>
      <button class="auswahl__eltern" id="auswahl-eltern">⚙️ Eltern-Bereich</button>
      <button class="auswahl__info" id="auswahl-info">ℹ️ Über diese App &amp; Anleitung</button>
    </div>
  `;

  container.querySelectorAll('.profil-karte').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-bild]')) return; // Bild-Knopf getrennt behandeln
      const id = el.dataset.profileId;
      if (hatKindPin(id)) kindPinAbfrage(id);
      else { setCurrentProfile(id); location.hash = 'welt'; }
    });
  });

  container.querySelectorAll('[data-bild]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); bildAendern(btn.dataset.bild); });
  });

  // Nach Schließen des Eltern-Bereichs die Startseite neu rendern — neu angelegte
  // (oder gelöschte/umbenannte) Kinder erscheinen so sofort, ohne manuelles Reload.
  container.querySelector('#auswahl-eltern').addEventListener('click', () => oeffneElternBereich(() => renderAuswahl(container)));

  container.querySelector('#auswahl-info').addEventListener('click', () => { location.hash = 'info'; });

  function kindPinAbfrage(id) {
    const modal = oeffneModal({ klassen: 'modal-backdrop--eltern', inhaltHtml: '<div class="modal modal--eltern"></div>' });
    if (!modal) return;
    modal.inhalt.innerHTML = `
      <div class="eltern__kopf">🔒 Dein Profil</div>
      <p class="eltern__hinweis">Gib deine PIN ein.</p>
      <input class="eltern__feld eltern__pin" type="password" inputmode="numeric" maxlength="8" />
      <div class="eltern__fehler" hidden></div>
      <button class="eltern__primary">Los</button>
      <button class="eltern__sekundaer eltern__abbruch">Zurück</button>
    `;
    const inp = modal.inhalt.querySelector('.eltern__pin');
    const fehler = modal.inhalt.querySelector('.eltern__fehler');
    inp.focus();
    function versuch(zeigeFehler) {
      if (pruefeKindPin(id, inp.value)) { modal.schliessen(); setCurrentProfile(id); location.hash = 'welt'; return; }
      if (zeigeFehler) { fehler.hidden = false; fehler.textContent = 'Falsche PIN.'; inp.value = ''; inp.focus(); }
    }
    // Auto-weiter, sobald die PIN stimmt — kein Bestätigen nötig (blockiert sonst den Einstieg).
    inp.addEventListener('input', () => { fehler.hidden = true; versuch(false); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') versuch(true); });
    modal.inhalt.querySelector('.eltern__primary').addEventListener('click', () => versuch(true));
    modal.inhalt.querySelector('.eltern__abbruch').addEventListener('click', () => modal.schliessen());
  }

  function bildAendern(id) {
    const modal = oeffneModal({ klassen: 'modal-backdrop--eltern', inhaltHtml: '<div class="modal modal--eltern"></div>' });
    if (!modal) return;
    const hatFoto = !!getAvatarFoto(id);
    modal.inhalt.innerHTML = `
      <div class="eltern__kopf">🎨 Wähle dein Bild</div>
      <button class="eltern__primary profil-karte__kamera">📷 Foto von mir machen</button>
      ${hatFoto ? '<button class="eltern__sekundaer profil-karte__fotoweg">🗑️ Foto löschen</button>' : ''}
      <p class="eltern__hinweis">Oder nimm ein Bild aus der Liste:</p>
      <div class="eltern__avatar-grid">${avatare.map(a => `<button class="eltern__avatar-btn" data-av="${escapeHtml(a.id)}">${a.emoji}</button>`).join('')}</div>
      <button class="eltern__sekundaer eltern__abbruch">Schließen</button>
    `;

    modal.inhalt.querySelector('.profil-karte__kamera').addEventListener('click', () => {
      modal.schliessen();
      oeffneKamera(id, () => renderAuswahl(container));
    });

    modal.inhalt.querySelector('.profil-karte__fotoweg')?.addEventListener('click', () => {
      setzeAvatarFoto(id, null);
      modal.schliessen();
      renderAuswahl(container);
    });

    // Emoji wählen entfernt auch das Foto — sonst wählt man ein Emoji und sieht weiter das Bild.
    modal.inhalt.querySelectorAll('.eltern__avatar-btn').forEach(b => b.addEventListener('click', () => {
      setzeAvatarFoto(id, null);
      updateProfile(id, { avatar: b.dataset.av });
      modal.schliessen();
      renderAuswahl(container);
    }));
    modal.inhalt.querySelector('.eltern__abbruch').addEventListener('click', () => modal.schliessen());
  }
}
