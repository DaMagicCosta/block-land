import { addProfile, setCurrentProfile } from './state.js';
import { loadAvatare } from './data.js';
import { escapeHtml } from './utils.js';

const ALTER_OPTIONEN = [
  { id: 'kindergarten', label: 'Kindergarten (3-5 Jahre)' },
  { id: 'klasse-1',     label: '1. Klasse (ZR 20)' },
  { id: 'klasse-2',     label: '2. Klasse (ZR 100)' },
  { id: 'klasse-3',     label: '3. Klasse (ZR 1000)' },
];

export async function renderWizard(container) {
  let list;
  try {
    list = await loadAvatare();
  } catch (err) {
    container.innerHTML = `
      <div style="padding:var(--space-xl);text-align:center;color:var(--color-danger)">
        <p>Fehler beim Laden des Wizards.</p>
        <p style="color:var(--color-text-dim);font-size:var(--font-size-sm);margin-top:var(--space-md)">${escapeHtml(err.message)}</p>
      </div>
    `;
    return;
  }
  const formState = { name: '', weltName: '', avatar: null, alter: 'klasse-2' };

  container.innerHTML = `
    <div class="wizard">
      <h1 class="wizard__title">NEUES PROFIL</h1>
      <p class="wizard__step">Schritt für ein neues Block-Land-Abenteuer</p>

      <div class="wizard__panel">
        <div>
          <div class="wizard__label">Wie heißt Du?</div>
          <input class="wizard__input" id="w-name" placeholder="z.B. Arthur" maxlength="20" />
        </div>

        <div>
          <div class="wizard__label">Wie soll Dein Land heißen?</div>
          <input class="wizard__input" id="w-welt" placeholder="z.B. Zombi-Land" maxlength="30" />
        </div>

        <div>
          <div class="wizard__label">Wähle Deinen Avatar</div>
          <div class="wizard__avatare" id="w-avatare">
            ${list.map(a => `
              <div class="wizard__avatar" data-avatar="${escapeHtml(a.id)}">
                <div class="wizard__avatar__emoji">${a.emoji}</div>
                <div class="wizard__avatar__label">${escapeHtml(a.label)}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div>
          <div class="wizard__label">Wie alt bist Du?</div>
          <select class="wizard__select" id="w-alter">
            ${ALTER_OPTIONEN.map(o => `
              <option value="${o.id}" ${o.id === formState.alter ? 'selected' : ''}>${o.label}</option>
            `).join('')}
          </select>
        </div>

        <div class="wizard__actions">
          <button class="btn btn--secondary" id="w-cancel">Abbrechen</button>
          <button class="btn btn--primary" id="w-create" disabled>Block-Land öffnen</button>
        </div>
      </div>
    </div>
  `;

  const elName   = container.querySelector('#w-name');
  const elWelt   = container.querySelector('#w-welt');
  const elAlter  = container.querySelector('#w-alter');
  const elCreate = container.querySelector('#w-create');
  const elCancel = container.querySelector('#w-cancel');
  const elAvatarRow = container.querySelector('#w-avatare');

  function refreshButton() {
    const ok = formState.name.trim() && formState.weltName.trim() && formState.avatar;
    elCreate.disabled = !ok;
  }

  elName.addEventListener('input', () => { formState.name = elName.value; refreshButton(); });
  elWelt.addEventListener('input', () => { formState.weltName = elWelt.value; refreshButton(); });
  elAlter.addEventListener('change', () => { formState.alter = elAlter.value; });

  elAvatarRow.addEventListener('click', (e) => {
    const card = e.target.closest('.wizard__avatar');
    if (!card) return;
    elAvatarRow.querySelectorAll('.wizard__avatar').forEach(c => c.classList.remove('is-selected'));
    card.classList.add('is-selected');
    formState.avatar = card.dataset.avatar;
    refreshButton();
  });

  elCancel.addEventListener('click', () => { location.hash = 'auswahl'; });

  elCreate.addEventListener('click', () => {
    const id = addProfile({
      name: formState.name.trim(),
      weltName: formState.weltName.trim(),
      avatar: formState.avatar,
      alter: formState.alter,
    });
    setCurrentProfile(id);
    location.hash = 'welt';
  });

  // Auto-Fokus aufs erste Feld — schnell loslegen können
  elName.focus();
}
