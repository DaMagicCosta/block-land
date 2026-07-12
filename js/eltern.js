// Eltern-Bereich: PIN-Gate + Dashboard (Belohnungen, Gutscheine, Kinder, PIN).
import { oeffneModal } from './modal.js';
import {
  istPinGesetzt, pruefePin, setzePin,
  getProfiles, getInventar, setzeRohstoff,
  getGutscheinStapel, loeseGutscheineEin, loescheGutscheinStapel,
  getRezepte, speichereRezepte, setzeRezepteStandard,
  getDropChancen, setzeDropChance,
  addProfile, deleteProfile, setzeKindPin,
  getBiomFreigabe, setBiomElternStatus,
  getSyncConfig, setzeSyncConfig,
  updateProfile, getTimer, setzeTimerStand,
} from './state.js';
import {
  flushSync, anzahlWartend,
  anzahlWartendZustand, zustandCursor, getLetzterPull,
  ladeSpielstandHoch, logEnthaeltProfile, uebernehmeFamilienstand, pullZustand,
} from './sync.js';
import { tabStatistik } from './statistik.js';
import { escapeHtml } from './utils.js';
import { loadBiomManifest } from './data.js';
import { istFrei, BIOME_REIHENFOLGE } from './biome-logik.js';
import { standardFuer, wirksameKonfig, GRENZEN, istNacht, frischerTag } from './timer-logik.js';
import { verwerfeLaufzeitStand } from './uebungs-timer.js';

const ITEM_KEYS = ['holz', 'stein', 'blume', 'eisen', 'diamant'];
const ITEM_EMOJI = { holz: '🪵', stein: '🪨', blume: '🌸', eisen: '⛏️', diamant: '💎' };
const KATEGORIEN = ['Eltern-Zeit', 'Naschen & Essen', 'Bildschirm-Zeit', 'Erlebnisse'];
const ALTER = [['kindergarten', 'Kindergarten'], ['klasse-1', '1. Klasse'], ['klasse-2', '2. Klasse'], ['klasse-3', '3. Klasse']];
const AVATARE = [['krieger', '🗡️'], ['bergmann', '⛏️'], ['magier', '🧙'], ['ninja', '🥷'], ['ritter', '🛡️'], ['schurke', '🦹'], ['tier', '🐺'], ['drache', '🐉']];

export function oeffneElternBereich(onClose) {
  // backdropSchliesst: false — der Eltern-Bereich wird nur über „Fertig"/Escape verlassen,
  // ein Wisch/Tipp daneben wirft nicht raus (sonst ständig neue PIN-Eingabe).
  const modal = oeffneModal({ klassen: 'modal-backdrop--eltern', inhaltHtml: '<div class="modal modal--eltern"></div>', onClose, backdropSchliesst: false });
  if (!modal) return;
  if (istPinGesetzt()) pinAbfrage(modal);
  else pinErstellen(modal);
}

function pinAbfrage(modal) {
  modal.inhalt.innerHTML = `
    <div class="eltern__kopf">🔒 Eltern-Bereich</div>
    <p class="eltern__hinweis">Bitte PIN eingeben.</p>
    <input class="eltern__feld eltern__pin" type="password" inputmode="numeric" maxlength="8" />
    <div class="eltern__fehler" hidden></div>
    <button class="eltern__primary">Öffnen</button>
    <button class="eltern__sekundaer eltern__abbruch">Abbrechen</button>
  `;
  const inp = modal.inhalt.querySelector('.eltern__pin');
  const fehler = modal.inhalt.querySelector('.eltern__fehler');
  inp.focus();
  function versuch(zeigeFehler) {
    if (pruefePin(inp.value)) { dashboard(modal); return; }
    if (zeigeFehler) { fehler.hidden = false; fehler.textContent = 'Falsche PIN.'; inp.value = ''; inp.focus(); }
  }
  // Auto-weiter, sobald die PIN stimmt — gleiche Mechanik wie die Kind-PIN in auswahl.js.
  inp.addEventListener('input', () => { fehler.hidden = true; versuch(false); });
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') versuch(true); });
  modal.inhalt.querySelector('.eltern__primary').addEventListener('click', () => versuch(true));
  modal.inhalt.querySelector('.eltern__abbruch').addEventListener('click', () => modal.schliessen());
}

function pinErstellen(modal) {
  modal.inhalt.innerHTML = `
    <div class="eltern__kopf">🔒 PIN festlegen</div>
    <p class="eltern__hinweis">Lege eine Eltern-PIN fest (Zahlen). Sie hält die Kinder aus diesem Bereich — kein echter Passwortschutz.</p>
    <input class="eltern__feld eltern__pin" type="password" inputmode="numeric" maxlength="8" placeholder="Neue PIN" />
    <input class="eltern__feld eltern__pin2" type="password" inputmode="numeric" maxlength="8" placeholder="Wiederholen" />
    <div class="eltern__fehler" hidden></div>
    <button class="eltern__primary">Speichern</button>
    <button class="eltern__sekundaer eltern__abbruch">Abbrechen</button>
  `;
  const inp = modal.inhalt.querySelector('.eltern__pin');
  const inp2 = modal.inhalt.querySelector('.eltern__pin2');
  const fehler = modal.inhalt.querySelector('.eltern__fehler');
  inp.focus();
  modal.inhalt.querySelector('.eltern__primary').addEventListener('click', () => {
    const a = inp.value.trim();
    if (a.length < 3) { fehler.hidden = false; fehler.textContent = 'Mindestens 3 Zeichen.'; return; }
    if (a !== inp2.value.trim()) { fehler.hidden = false; fehler.textContent = 'PINs stimmen nicht überein.'; return; }
    setzePin(a);
    dashboard(modal);
  });
  modal.inhalt.querySelector('.eltern__abbruch').addEventListener('click', () => modal.schliessen());
}

function dashboard(modal) {
  let tab = 'belohnungen';
  function render() {
    modal.inhalt.innerHTML = `
      <div class="eltern__kopf">⚙️ Eltern-Bereich</div>
      <div class="eltern__tabs">
        ${[
          ['belohnungen', '🎁', 'Belohnungen'],
          ['gutscheine', '🎟️', 'Gutscheine'],
          ['kinder', '🧒', 'Kinder'],
          ['biome', '🗺️', 'Biome'],
          ['statistik', '📊', 'Statistik'],
          ['sync', '📡', 'Sync'],
          ['pin', '🔒', 'PIN'],
        ].map(([id, icon, label]) => `
          <button data-tab="${id}" class="${tab === id ? 'aktiv' : ''}">
            <span class="eltern__tab-icon">${icon}</span><span class="eltern__tab-label">${label}</span>
          </button>`).join('')}
      </div>
      <div class="eltern__inhalt"></div>
      <button class="eltern__sekundaer eltern__info-link">ℹ️ Über Block-Land &amp; Anleitung</button>
      <button class="eltern__sekundaer eltern__schliessen">Fertig</button>
    `;
    const inhalt = modal.inhalt.querySelector('.eltern__inhalt');
    if (tab === 'belohnungen') tabBelohnungen(inhalt, render);
    else if (tab === 'gutscheine') tabGutscheine(inhalt, render);
    else if (tab === 'kinder') tabKinder(inhalt, render);
    else if (tab === 'biome') tabBiome(inhalt, render);
    else if (tab === 'statistik') tabStatistik(inhalt, render);
    else if (tab === 'sync') tabSync(inhalt, render);
    else tabPin(inhalt);
    modal.inhalt.querySelectorAll('.eltern__tabs button').forEach(b => {
      b.addEventListener('click', () => { tab = b.dataset.tab; render(); });
    });
    modal.inhalt.querySelector('.eltern__schliessen').addEventListener('click', () => modal.schliessen());
    modal.inhalt.querySelector('.eltern__info-link').addEventListener('click', () => {
      modal.schliessen();
      location.hash = 'info';
    });
  }
  render();
}

function kostenText(kosten) {
  return Object.entries(kosten).map(([it, n]) => `${ITEM_EMOJI[it] ?? '❔'}${n}`).join(' ') || '—';
}

function preisFormHtml(kosten) {
  return `<div class="eltern__kosten-grid">${ITEM_KEYS.map(it => `
    <label class="eltern__kosten-feld">${ITEM_EMOJI[it]}<input type="number" min="0" data-kost="${it}" value="${kosten[it] ?? 0}" /></label>
  `).join('')}</div>`;
}

function leseKostenForm(scope) {
  const kosten = {};
  scope.querySelectorAll('[data-kost]').forEach(inp => {
    const n = parseInt(inp.value, 10);
    if (n > 0) kosten[inp.dataset.kost] = n;
  });
  return kosten;
}

function tabBelohnungen(container, neuRendern) {
  const chancen = getDropChancen();
  const MATERIAL = [
    ['holz', '🪵 Holz'], ['stein', '🪨 Stein'], ['blume', '🌸 Blume'],
    ['eisen', '⛏️ Eisen (schwere Aufgaben)'], ['diamant', '💎 Diamant (schwere Aufgaben)'],
  ];
  const ALTER_LABEL = { 'kindergarten': 'Vorschule', 'klasse-1': '1. Klasse', 'klasse-2': '2. Klasse', 'klasse-3': '3. Klasse' };
  const avatarEmojiMapTimer = Object.fromEntries(AVATARE);
  const timerBloecke = getProfiles().map(p => {
    const std = standardFuer(p.alter);
    const k = wirksameKonfig(p.alter, p.timerKonfig);
    const eigene = !!p.timerKonfig;
    const nacht = istNacht(getTimer(p.id));
    return `
      <div class="eltern__timer-kind">
        <div class="eltern__timer-titel">${avatarEmojiMapTimer[p.avatar] ?? '🧒'} <b>${escapeHtml(p.name)}</b> —
          ${eigene ? 'eigene Einstellung' : `Standard (${ALTER_LABEL[p.alter] ?? escapeHtml(p.alter)})`}:
          ${k.uebenMin} Min üben / ${k.pauseMin} Min Pause</div>
        <label class="eltern__timer-feld">Üben (Min)
          <input type="number" min="${GRENZEN.ueben[0]}" max="${GRENZEN.ueben[1]}" data-timer-ueben="${p.id}" value="${k.uebenMin}" /></label>
        <label class="eltern__timer-feld">Pause (Min)
          <input type="number" min="${GRENZEN.pause[0]}" max="${GRENZEN.pause[1]}" data-timer-pause="${p.id}" value="${k.pauseMin}" /></label>
        <label class="eltern__timer-feld"><input type="checkbox" data-timer-aktiv="${p.id}" ${k.aktiv ? 'checked' : ''} /> Sonne aktiv</label>
        <button class="eltern__sekundaer" data-timer-standard="${p.id}">Zurück auf Standard (${std.uebenMin}/${std.pauseMin})</button>
        ${nacht ? `<button class="eltern__sekundaer" data-timer-aufgang="${p.id}">☀️ Sonne jetzt aufgehen lassen</button>` : ''}
      </div>`;
  }).join('');
  container.innerHTML = `
    <div class="eltern__abschnitt-titel">Häufigkeit der Materialien</div>
    <div class="eltern__regler">
      ${MATERIAL.map(([k, l]) => {
        const proz = Math.round((chancen[k] ?? 0) * 100);
        return `
          <div class="eltern__regler-zeile">
            <span class="eltern__regler-label">${l}</span>
            <button type="button" class="eltern__regler-step" data-dropstep="${k}" data-richtung="-1" aria-label="weniger">−</button>
            <input type="range" min="0" max="100" step="5" data-drop="${k}" value="${proz}" />
            <button type="button" class="eltern__regler-step" data-dropstep="${k}" data-richtung="1" aria-label="mehr">+</button>
            <span class="eltern__regler-wert" data-dropwert="${k}">${proz}%</span>
          </div>
        `;
      }).join('')}
    </div>
    <p class="eltern__hinweis">Fällt mal nichts, gibt's eine kleine Gratulation. 🎉</p>

    <h3 class="eltern__untertitel">☀️ Übungs-Timer (wandernde Sonne)</h3>
    <p class="eltern__hinweis">Standardzeiten folgen Empfehlungen zur Konzentrationsdauer je Altersstufe.
      Änderungen gelten nur für dieses Kind; „Zurück auf Standard" übernimmt auch künftige Anpassungen der Standards.</p>
    ${timerBloecke}

    <div class="eltern__abschnitt-titel">Eigene Belohnung</div>
    <p class="eltern__hinweis eltern__hinweis--links">Lege selbst fest, was es zu gewinnen gibt — eigener Name, Emoji und wie viel das Kind dafür sammeln muss.</p>
    <button class="eltern__neu-belohnung eltern__neu-toggle">➕ Eigene Belohnung erstellen</button>
    <div class="eltern__neu-form" hidden></div>

    <div class="eltern__abschnitt-titel">Alle Belohnungen</div>
    <div class="eltern__rezepte"></div>
    <button class="eltern__sekundaer eltern__standard">↺ Standard wiederherstellen</button>
  `;

  // Reglerwert setzen (0..100 geklemmt) + persistieren + Anzeige aktualisieren.
  function setzeReglerWert(item, proz) {
    proz = Math.max(0, Math.min(100, proz));
    const slider = container.querySelector(`[data-drop="${item}"]`);
    if (slider) slider.value = proz;
    container.querySelector(`[data-dropwert="${item}"]`).textContent = proz + '%';
    setzeDropChance(item, proz / 100);
  }
  container.querySelectorAll('[data-drop]').forEach(slider => {
    slider.addEventListener('input', () => setzeReglerWert(slider.dataset.drop, parseInt(slider.value, 10)));
  });
  // −/+ treffen auch die Endpunkte 0 %/100 % sicher (am Slider-Rand schwer per Touch).
  container.querySelectorAll('[data-dropstep]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.dataset.dropstep;
      const slider = container.querySelector(`[data-drop="${item}"]`);
      setzeReglerWert(item, parseInt(slider.value, 10) + 5 * parseInt(btn.dataset.richtung, 10));
    });
  });
  container.querySelector('.eltern__standard').addEventListener('click', () => {
    if (confirm('Alle Belohnungen auf die Standard-Liste zurücksetzen?')) { setzeRezepteStandard(); neuRendern(); }
  });

  // Übungs-Timer: Konfig speichern (jede Änderung an einem der drei Felder schreibt timerKonfig).
  const speichereTimerKonfig = (profilId) => {
    const lese = (sel) => container.querySelector(`[${sel}="${profilId}"]`);
    updateProfile(profilId, { timerKonfig: {
      uebenMin: Number(lese('data-timer-ueben').value),
      pauseMin: Number(lese('data-timer-pause').value),
      aktiv: lese('data-timer-aktiv').checked,
    } });
    neuRendern();
  };
  container.querySelectorAll('[data-timer-ueben],[data-timer-pause],[data-timer-aktiv]').forEach(el => {
    el.addEventListener('change', () => speichereTimerKonfig(el.dataset.timerUeben ?? el.dataset.timerPause ?? el.dataset.timerAktiv));
  });
  container.querySelectorAll('[data-timer-standard]').forEach(btn => {
    btn.addEventListener('click', () => { updateProfile(btn.dataset.timerStandard, { timerKonfig: null }); neuRendern(); });
  });
  container.querySelectorAll('[data-timer-aufgang]').forEach(btn => {
    btn.addEventListener('click', () => {
      setzeTimerStand(btn.dataset.timerAufgang, frischerTag(), { melden: true });  // synct: Nacht endet überall
      verwerfeLaufzeitStand();
      neuRendern();
    });
  });

  const liste = container.querySelector('.eltern__rezepte');
  liste.innerHTML = getRezepte().map(r => `
    <div class="eltern__rezept" data-id="${escapeHtml(r.id)}">
      <div class="eltern__rezept-kopf">
        <span>${r.emoji} ${escapeHtml(r.name)}</span>
        <label class="eltern__aktiv"><input type="checkbox" data-akt ${r.aktiv ? 'checked' : ''}/> aktiv</label>
      </div>
      <div class="eltern__rezept-zeile">
        <span class="eltern__rezept-kosten">${kostenText(r.kosten)}</span>
        <button class="eltern__mini" data-edit>✏️ Preis</button>
        <button class="eltern__mini eltern__mini--rot" data-del>✕</button>
      </div>
      <div class="eltern__preis-form" hidden></div>
    </div>
  `).join('');

  liste.querySelectorAll('.eltern__rezept').forEach(row => {
    const id = row.dataset.id;
    row.querySelector('[data-akt]').addEventListener('change', (e) => {
      speichereRezepte(getRezepte().map(r => r.id === id ? { ...r, aktiv: e.target.checked } : r));
    });
    row.querySelector('[data-del]').addEventListener('click', () => {
      const r = getRezepte().find(x => x.id === id);
      if (r && confirm(`„${r.name}" löschen?`)) { speichereRezepte(getRezepte().filter(x => x.id !== id)); neuRendern(); }
    });
    row.querySelector('[data-edit]').addEventListener('click', () => {
      const form = row.querySelector('.eltern__preis-form');
      if (!form.hidden) { form.hidden = true; form.innerHTML = ''; return; }
      const r = getRezepte().find(x => x.id === id);
      form.hidden = false;
      form.innerHTML = preisFormHtml(r ? r.kosten : {}) + '<button class="eltern__mini" data-save>Speichern</button>';
      form.querySelector('[data-save]').addEventListener('click', () => {
        const kosten = leseKostenForm(form);
        speichereRezepte(getRezepte().map(x => x.id === id ? { ...x, kosten } : x));
        neuRendern();
      });
    });
  });

  const neuForm = container.querySelector('.eltern__neu-form');
  container.querySelector('.eltern__neu-toggle').addEventListener('click', () => {
    if (!neuForm.hidden) { neuForm.hidden = true; neuForm.innerHTML = ''; return; }
    neuForm.hidden = false;
    // Bekannte Rubriken = Standard-Kategorien + alle bereits selbst angelegten.
    const vorhandeneKategorien = [...new Set([...KATEGORIEN, ...getRezepte().map(r => r.kategorie)])];
    neuForm.innerHTML = `
      <label class="eltern__form-label">Name der Belohnung</label>
      <input class="eltern__feld" data-name placeholder="z.B. Eis essen gehen" maxlength="30" />
      <label class="eltern__form-label">Aussehen</label>
      <div class="eltern__neu-zeile">
        <input class="eltern__feld eltern__feld--emoji" data-emoji placeholder="Emoji" maxlength="4" value="🎁" />
        <select class="eltern__feld" data-kat>
          ${vorhandeneKategorien.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('')}
          <option value="__neu__">➕ Neue Rubrik…</option>
        </select>
      </div>
      <input class="eltern__feld" data-neukat placeholder="Name der neuen Rubrik (z.B. Fototour)" maxlength="30" hidden />
      <label class="eltern__form-label">Wert (optional) — fürs Aufsummieren gleicher Gutscheine</label>
      <div class="eltern__neu-zeile">
        <input class="eltern__feld" data-wert type="number" min="0" placeholder="z.B. 15" />
        <input class="eltern__feld" data-einheit placeholder="Einheit (z.B. Min)" maxlength="12" />
      </div>
      <label class="eltern__form-label">Wie viel muss das Kind dafür sammeln? (mind. 1 Rohstoff)</label>
      ${preisFormHtml({ holz: 5 })}
      <button class="eltern__primary" data-add>✓ Belohnung speichern</button>
    `;
    const katSelect = neuForm.querySelector('[data-kat]');
    const neuKatFeld = neuForm.querySelector('[data-neukat]');
    katSelect.addEventListener('change', () => {
      const istNeu = katSelect.value === '__neu__';
      neuKatFeld.hidden = !istNeu;
      if (istNeu) neuKatFeld.focus();
    });
    neuForm.querySelector('[data-add]').addEventListener('click', () => {
      const name = neuForm.querySelector('[data-name]').value.trim();
      if (!name) { neuForm.querySelector('[data-name]').focus(); return; }
      const emoji = neuForm.querySelector('[data-emoji]').value.trim() || '🎁';
      let kategorie = katSelect.value;
      if (kategorie === '__neu__') {
        kategorie = neuKatFeld.value.trim();
        if (!kategorie) { neuKatFeld.focus(); return; }
      }
      const kosten = leseKostenForm(neuForm);
      if (Object.keys(kosten).length === 0) { alert('Bitte mindestens einen Rohstoff als Preis setzen.'); return; }
      const wertRoh = parseInt(neuForm.querySelector('[data-wert]').value, 10);
      const einheit = neuForm.querySelector('[data-einheit]').value.trim();
      const wertFelder = (wertRoh > 0) ? { wert: wertRoh, einheit: einheit || 'Stück' } : {};
      const neu = [...getRezepte(), { id: `r_custom_${Date.now()}`, name, emoji, kategorie, kosten, aktiv: true, ...wertFelder }];
      speichereRezepte(neu);
      neuRendern();
    });
  });
}

function tabGutscheine(container, neuRendern) {
  const profile = getProfiles();
  if (!profile.length) { container.innerHTML = '<div class="eltern__leer">Keine Profile.</div>'; return; }
  container.innerHTML = profile.map(p => {
    const stapel = getGutscheinStapel(p.id);
    const rows = stapel.length
      ? stapel.map(s => {
          const summe = (typeof s.wert === 'number' && s.wert > 0)
            ? ` = ${s.anzahl * s.wert} ${escapeHtml(s.einheit ?? '')}`
            : '';
          return `
            <div class="eltern__gutschein" data-pid="${p.id}" data-rid="${escapeHtml(s.rezeptId)}">
              <span class="eltern__gutschein-name">${s.emoji} ${escapeHtml(s.name)} <strong>×${s.anzahl}</strong>${summe}</span>
              <span class="eltern__gutschein-einloesen">
                einlösen:
                <input type="number" class="eltern__gutschein-menge" min="1" max="${s.anzahl}" value="${s.anzahl}" />
                <span class="eltern__gutschein-von">von ${s.anzahl}</span>
                <button class="eltern__mini" data-ok>ok</button>
                <button class="eltern__mini eltern__mini--rot" data-clear>✕ Stapel</button>
              </span>
            </div>`;
        }).join('')
      : '<div class="eltern__leer">keine Gutscheine</div>';
    return `<div class="eltern__abschnitt-titel">${escapeHtml(p.name)}</div>${rows}`;
  }).join('');

  container.querySelectorAll('.eltern__gutschein').forEach(row => {
    const pid = row.dataset.pid;
    const rid = row.dataset.rid;
    if (!rid) return; // Leer-Zeile
    row.querySelector('[data-ok]').addEventListener('click', () => {
      const feld = row.querySelector('.eltern__gutschein-menge');
      const menge = Math.max(1, parseInt(feld.value, 10) || 1);
      loeseGutscheineEin(pid, rid, menge);
      neuRendern();
    });
    row.querySelector('[data-clear]').addEventListener('click', () => {
      if (confirm('Diesen Gutschein-Stapel ganz entfernen?')) { loescheGutscheinStapel(pid, rid); neuRendern(); }
    });
  });
}

function tabKinder(container, neuRendern) {
  const profile = getProfiles();
  container.innerHTML = `
    <button class="eltern__mini eltern__kind-neu-toggle">➕ Kind anlegen</button>
    <div class="eltern__kind-neu-form" hidden></div>
    <div class="eltern__kinder"></div>
  `;

  let gewaehlterAvatar = AVATARE[0][0];
  const neuForm = container.querySelector('.eltern__kind-neu-form');
  container.querySelector('.eltern__kind-neu-toggle').addEventListener('click', () => {
    if (!neuForm.hidden) { neuForm.hidden = true; neuForm.innerHTML = ''; return; }
    neuForm.hidden = false;
    gewaehlterAvatar = AVATARE[0][0];
    neuForm.innerHTML = `
      <input class="eltern__feld" data-kname placeholder="Name des Kindes" maxlength="20" />
      <select class="eltern__feld" data-kalter>${ALTER.map(([k, l]) => `<option value="${k}"${k === 'klasse-2' ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <div class="eltern__abschnitt-titel">Startbild (Kind kann es später ändern)</div>
      <div class="eltern__avatar-grid">${AVATARE.map(([k, e], i) => `<button class="eltern__avatar-btn${i === 0 ? ' aktiv' : ''}" data-av="${k}">${e}</button>`).join('')}</div>
      <input class="eltern__feld" data-kpin placeholder="Kind-PIN (optional)" inputmode="numeric" maxlength="8" />
      <button class="eltern__mini" data-kadd>Anlegen</button>
    `;
    neuForm.querySelectorAll('.eltern__avatar-btn').forEach(b => b.addEventListener('click', () => {
      gewaehlterAvatar = b.dataset.av;
      neuForm.querySelectorAll('.eltern__avatar-btn').forEach(x => x.classList.toggle('aktiv', x === b));
    }));
    neuForm.querySelector('[data-kadd]').addEventListener('click', () => {
      const name = neuForm.querySelector('[data-kname]').value.trim();
      if (!name) { neuForm.querySelector('[data-kname]').focus(); return; }
      const alter = neuForm.querySelector('[data-kalter]').value;
      const kpin = neuForm.querySelector('[data-kpin]').value.trim();
      addProfile({ name, weltName: `${name}s Welt`, avatar: gewaehlterAvatar, alter, kindPin: kpin || null });
      neuRendern();
    });
  });

  const kinder = container.querySelector('.eltern__kinder');
  if (!profile.length) {
    kinder.innerHTML = '<div class="eltern__leer">Noch keine Kinder. Lege oben eins an.</div>';
    return;
  }
  const avatarEmojiMap = Object.fromEntries(AVATARE);
  const alterLabelMap = Object.fromEntries(ALTER);
  kinder.innerHTML = profile.map(p => {
    const inv = getInventar(p.id);
    const felder = ITEM_KEYS.map(it => `
      <label class="eltern__kosten-feld">${ITEM_EMOJI[it]}<input type="number" min="0" data-roh="${it}" data-pid="${p.id}" value="${inv[it] ?? 0}" /></label>
    `).join('');
    const stat = p.statistik ?? {};
    const statText = Object.keys(stat).length
      ? Object.entries(stat).map(([typ, s]) => {
          const schnitt = s.gesamt ? (s.zeit_summe_ms ?? 0) / s.gesamt / 1000 : 0;
          return `${typ}: ${s.richtig}/${s.gesamt} · ⌀ ${schnitt.toFixed(1)}s`;
        }).join(' · ')
      : 'noch keine';
    const avatarEmoji = avatarEmojiMap[p.avatar] ?? '🧒';
    const alterLabel = alterLabelMap[p.alter] ?? p.alter;
    return `
      <div class="eltern__kind-karte">
        <div class="eltern__kind-kopf">
          <span class="eltern__kind-avatar">${avatarEmoji}</span>
          <span class="eltern__kind-name">${escapeHtml(p.name)}</span>
          <span class="eltern__kind-alter">${escapeHtml(alterLabel)}</span>
        </div>
        <div class="eltern__kind-block">
          <div class="eltern__kind-label">🎒 Rohstoffe</div>
          <div class="eltern__kosten-grid">${felder}</div>
          <button class="eltern__mini eltern__roh-speichern" data-saveroh="${p.id}">💾 Rohstoffe speichern</button>
        </div>
        <div class="eltern__kind-block">
          <div class="eltern__kind-label">📊 Statistik</div>
          <div class="eltern__stat">${escapeHtml(statText)}</div>
        </div>
        <div class="eltern__kind-block">
          <div class="eltern__kind-label">🔒 Kind-PIN <span class="eltern__alter">(leer = keine)</span></div>
          <div class="eltern__kind-verwalt">
            <input class="eltern__feld" data-kpinp="${p.id}" placeholder="z.B. 123" inputmode="numeric" maxlength="8" value="${escapeHtml(p.kindPin ?? '')}" />
            <button class="eltern__mini" data-savekpin="${p.id}">PIN setzen</button>
          </div>
        </div>
        <button class="eltern__mini eltern__mini--rot eltern__kind-loeschen" data-delkind="${p.id}">🗑️ Kind löschen</button>
      </div>
    `;
  }).join('');

  kinder.querySelectorAll('[data-saveroh]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.saveroh;
      kinder.querySelectorAll(`[data-roh][data-pid="${pid}"]`).forEach(inp => {
        setzeRohstoff(pid, inp.dataset.roh, parseInt(inp.value, 10) || 0);
      });
      neuRendern();
    });
  });
  kinder.querySelectorAll('[data-savekpin]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.savekpin;
      const val = kinder.querySelector(`[data-kpinp="${pid}"]`).value.trim();
      setzeKindPin(pid, val || null);
      neuRendern();
    });
  });
  kinder.querySelectorAll('[data-delkind]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.delkind;
      const p = profile.find(x => x.id === pid);
      if (confirm(`Kind „${p ? p.name : ''}" wirklich löschen? Alle Fortschritte gehen verloren.`)) {
        deleteProfile(pid);
        neuRendern();
      }
    });
  });
}

async function tabBiome(container, neuRendern) {
  const profile = getProfiles();
  if (!profile.length) { container.innerHTML = '<div class="eltern__leer">Keine Profile.</div>'; return; }
  let manifest;
  try { manifest = await loadBiomManifest(); }
  catch { container.innerHTML = '<div class="eltern__leer">Manifest nicht ladbar.</div>'; return; }
  const order = BIOME_REIHENFOLGE;   // Single Source of Truth — alle Biome (inkl. rechnen10, geteilt, künftige)

  container.innerHTML = profile.map(p => {
    const frei = getBiomFreigabe(p.id);
    const zeilen = order.map(id => {
      const offen = istFrei(id, frei);
      return `
        <label class="eltern__rezept-zeile">
          <span class="eltern__rezept-kosten">${manifest[id].icon} ${escapeHtml(manifest[id].name)}</span>
          <input type="checkbox" data-biom="${escapeHtml(id)}" data-pid="${p.id}" ${offen ? 'checked' : ''} />
          <span class="eltern__aktiv">${offen ? 'offen' : '🔒'}</span>
        </label>`;
    }).join('');
    return `<div class="eltern__abschnitt-titel">${escapeHtml(p.name)}</div>${zeilen}`;
  }).join('');

  container.querySelectorAll('[data-biom]').forEach(cb => {
    cb.addEventListener('change', () => {
      setBiomElternStatus(cb.dataset.pid, cb.dataset.biom, cb.checked);
      neuRendern();
    });
  });
}

function tabPin(container) {
  container.innerHTML = `
    <div class="eltern__abschnitt-titel">PIN ändern</div>
    <input class="eltern__feld eltern__pin" type="password" inputmode="numeric" maxlength="8" placeholder="Neue PIN" />
    <input class="eltern__feld eltern__pin2" type="password" inputmode="numeric" maxlength="8" placeholder="Wiederholen" />
    <div class="eltern__fehler" hidden></div>
    <button class="eltern__mini" data-savepin>PIN speichern</button>
  `;
  const fehler = container.querySelector('.eltern__fehler');
  container.querySelector('[data-savepin]').addEventListener('click', () => {
    const a = container.querySelector('.eltern__pin').value.trim();
    const b = container.querySelector('.eltern__pin2').value.trim();
    if (a.length < 3) { fehler.hidden = false; fehler.className = 'eltern__fehler'; fehler.textContent = 'Mindestens 3 Zeichen.'; return; }
    if (a !== b) { fehler.hidden = false; fehler.className = 'eltern__fehler'; fehler.textContent = 'Stimmt nicht überein.'; return; }
    setzePin(a);
    fehler.hidden = false;
    fehler.className = 'eltern__erfolg';
    fehler.textContent = 'PIN geändert ✓';
  });
}

// --- Tab: Familien-Sync (Übermittlung der Lernergebnisse) ---
function tabSync(inhalt, render) {
  const cfg = getSyncConfig();
  inhalt.innerHTML = `
    <p class="eltern__hinweis">Schickt die Lern-Ereignisse an Euer Familien-Sheet — Grundlage für den
      abendlichen Telegram-Bericht und die Familien-Statistik. Einrichtung: <code>sync/EINRICHTUNG.md</code>.</p>
    <label class="eltern__sync-label">Web-App-URL
      <input class="eltern__feld" type="url" data-sync="url" value="${escapeHtml(cfg.url)}"
             placeholder="https://script.google.com/macros/s/…/exec" />
    </label>
    <label class="eltern__sync-label">Familien-Schlüssel
      <input class="eltern__feld" type="text" data-sync="schluessel" value="${escapeHtml(cfg.schluessel)}" />
    </label>
    <label class="eltern__sync-label eltern__sync-label--zeile">
      <input type="checkbox" data-sync="aktiv" ${cfg.aktiv ? 'checked' : ''} /> Sync aktiv
    </label>
    <div class="eltern__sync-status">Wartende Ereignisse auf diesem Gerät: <b>${anzahlWartend()}</b></div>
    <div class="eltern__fehler" hidden></div>
    <button class="eltern__primary" data-aktion="speichern">Speichern</button>
    <button class="eltern__sekundaer" data-aktion="senden">Jetzt senden</button>
    <h3 class="eltern__untertitel">🧳 Spielstand geräteübergreifend</h3>
    <p class="eltern__hinweis">Profile, Inventar und Gutscheine wandern automatisch zwischen den Geräten,
      sobald der Sync aktiv ist. Einmalig nötig: EIN Gerät lädt hoch, alle anderen übernehmen.</p>
    <div class="eltern__sync-status">
      Wartende Spielstand-Ereignisse: <b data-zustand="wartend">${anzahlWartendZustand()}</b>
      · Gelesen bis: <b data-zustand="cursor">${zustandCursor()}</b>
      · Letzter Abgleich: <b data-zustand="pull">${getLetzterPull() ? (getLetzterPull().grund ?? 'ok') : '–'}</b>
    </div>
    <button class="eltern__sekundaer" data-aktion="abgleichen">🔄 Jetzt abgleichen</button>
    <button class="eltern__sekundaer" data-aktion="hochladen">⬆️ Spielstand hochladen (führendes Gerät)</button>
    <button class="eltern__sekundaer" data-aktion="uebernehmen">⬇️ Familien-Spielstand übernehmen</button>
  `;
  const meldung = inhalt.querySelector('.eltern__fehler');
  function zeige(text, erfolg = false) {
    meldung.hidden = false;
    meldung.className = erfolg ? 'eltern__erfolg' : 'eltern__fehler';
    meldung.textContent = text;
  }

  inhalt.querySelector('[data-aktion="speichern"]').addEventListener('click', () => {
    setzeSyncConfig({
      url: inhalt.querySelector('[data-sync="url"]').value,
      schluessel: inhalt.querySelector('[data-sync="schluessel"]').value,
      aktiv: inhalt.querySelector('[data-sync="aktiv"]').checked,
    });
    render();
  });

  inhalt.querySelector('[data-aktion="senden"]').addEventListener('click', async () => {
    zeige('Sende …');
    const ergebnis = await flushSync();
    if (ergebnis.ok) {
      zeige(`✅ Gesendet: ${ergebnis.gesendet} Ereignis(se).`, true);
      inhalt.querySelector('.eltern__sync-status b').textContent = anzahlWartend();
    }
    else zeige(`⚠️ Senden fehlgeschlagen: ${ergebnis.grund}.`);
  });

  inhalt.querySelector('[data-aktion="abgleichen"]').addEventListener('click', async () => {
    await flushSync();
    await pullZustand();
    render();
  });

  inhalt.querySelector('[data-aktion="hochladen"]').addEventListener('click', async () => {
    try {
      if (await logEnthaeltProfile()
        && !confirm('Das Familien-Log enthält bereits Profile. Trotzdem hochladen? (Gefahr doppelter Profile)')) return;
    } catch (err) {
      // Fehlerursache unterscheiden: fehlende Konfiguration ist kein Netzproblem.
      alert(err && err.message === 'nicht konfiguriert'
        ? 'Sync ist nicht konfiguriert — zuerst Web-App-URL und Familien-Schlüssel speichern (Sync aktiv).'
        : 'Server nicht erreichbar — Hochladen später erneut versuchen.');
      return;
    }
    if (!confirm('Diesen Spielstand als führenden Familien-Stand hochladen?')) return;
    const ergebnis = await ladeSpielstandHoch();
    alert(ergebnis.ok ? `${ergebnis.hochgeladen} Profil(e) hochgeladen.` : `Fehlgeschlagen: ${ergebnis.grund}`);
    render();
  });

  inhalt.querySelector('[data-aktion="uebernehmen"]').addEventListener('click', async () => {
    if (!confirm('ACHTUNG: Alle lokalen Profile dieses Geräts werden durch den Familien-Spielstand ersetzt. Fortfahren?')) return;
    const ergebnis = await uebernehmeFamilienstand();
    alert(ergebnis.ok ? `Übernommen — ${ergebnis.angewendet} Ereignisse eingespielt.` : `Fehlgeschlagen: ${ergebnis.grund}`);
    render();
  });
}
