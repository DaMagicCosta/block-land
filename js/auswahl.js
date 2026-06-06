import { getProfiles, setCurrentProfile, updateProfile, hatKindPin, pruefeKindPin } from './state.js';
import { escapeHtml } from './utils.js';
import { loadAvatare } from './data.js';
import { oeffneModal } from './modal.js';
import { oeffneElternBereich } from './eltern.js';

export async function renderAuswahl(container) {
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

  const karten = profile.map(p => `
    <div class="profil-karte" data-profile-id="${p.id}">
      <div class="profil-karte__avatar">${avatarMap[p.avatar] ?? '❔'}</div>
      <div class="profil-karte__name">${escapeHtml(p.name)}${hatKindPin(p.id) ? ' 🔒' : ''}</div>
      <div class="profil-karte__welt">${escapeHtml(p.weltName)}</div>
      <button class="profil-karte__bild" data-bild="${p.id}">🎨 Bild</button>
    </div>
  `).join('');

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

  container.querySelector('#auswahl-eltern').addEventListener('click', () => oeffneElternBereich());

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
    modal.inhalt.innerHTML = `
      <div class="eltern__kopf">🎨 Wähle dein Bild</div>
      <div class="eltern__avatar-grid">${avatare.map(a => `<button class="eltern__avatar-btn" data-av="${escapeHtml(a.id)}">${a.emoji}</button>`).join('')}</div>
      <button class="eltern__sekundaer eltern__abbruch">Schließen</button>
    `;
    modal.inhalt.querySelectorAll('.eltern__avatar-btn').forEach(b => b.addEventListener('click', () => {
      updateProfile(id, { avatar: b.dataset.av });
      modal.schliessen();
      renderAuswahl(container);
    }));
    modal.inhalt.querySelector('.eltern__abbruch').addEventListener('click', () => modal.schliessen());
  }
}
