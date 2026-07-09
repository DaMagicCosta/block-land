// Statistik-Tab: Übersicht aller Kinder + Detailansicht pro Kind mit Tages-/Wochen-Verlauf.
// Render-Modul (DOM). Aggregation/Reihen kommen aus statistik-logik.js.
import { getProfiles, getSchwierigkeit, getVerlauf, getBiomFreigabe, getAufsagenProtokoll, getEintragenProtokoll, getSyncConfig } from './state.js';
import { stufeLabel, formatDauer } from './aufsage-protokoll-logik.js';
import { freieBiome } from './biome-logik.js';
import { summen, quoteFarbe, verlaufTage, verlaufWochen } from './statistik-logik.js';
import { escapeHtml } from './utils.js';

const AVATAR_EMOJI = {
  krieger: '🗡️', bergmann: '⛏️', magier: '🧙', ninja: '🥷',
  ritter: '🛡️', schurke: '🦹', tier: '🐺', drache: '🐉',
};
const TYP_LABEL = { mengen: 'Mengen', plus: 'Plus', minus: 'Minus', mal: 'Mal' };
const FILTER = [['alle', 'Alle'], ['mengen', 'Mengen'], ['plus', 'Plus'], ['minus', 'Minus'], ['mal', 'Mal']];

function prozent(quote) { return `${Math.round(quote * 100)}%`; }

// Balkendiagramm aus einer Reihe ({ label, gesamt, quote }[]).
function diagrammHtml(reihe) {
  const max = Math.max(1, ...reihe.map(p => p.gesamt));
  const balken = reihe.map(p => {
    const h = Math.round((p.gesamt / max) * 100);
    const farbe = quoteFarbe(p.quote, p.gesamt);
    const titel = p.gesamt ? `${p.gesamt} Aufgaben · ${prozent(p.quote)} richtig` : 'keine Aufgaben';
    return `
      <div class="stat-balken" title="${escapeHtml(titel)}">
        <div class="stat-balken__saeule">
          <div class="stat-balken__fuellung stat-balken__fuellung--${farbe}" style="height:${h}%"></div>
        </div>
        <div class="stat-balken__label">${escapeHtml(p.label)}</div>
      </div>`;
  }).join('');
  return `<div class="stat-diagramm">${balken}</div>`;
}

const LEGENDE = `
  <div class="stat-legende">
    <span><i class="stat-punkt stat-punkt--gut"></i>≥80%</span>
    <span><i class="stat-punkt stat-punkt--mittel"></i>50–79%</span>
    <span><i class="stat-punkt stat-punkt--schwach"></i>&lt;50%</span>
  </div>`;

// Aufsage-Protokoll (Mal-Reihen): jüngste Einträge als schlichte Liste.
function aufsagenProtokollHtml(profileId) {
  const log = getAufsagenProtokoll(profileId).slice(0, 20);
  if (!log.length) {
    return '<div class="eltern__leer">Noch kein Aufsagen protokolliert.</div>';
  }
  const zeilen = log.map(e => {
    const d = e.datum ? `${e.datum.slice(8, 10)}.${e.datum.slice(5, 7)}.` : '';
    return `<li class="stat-aufsagen__zeile">
      <span class="stat-aufsagen__reihe">${escapeHtml(String(e.reihe))}er</span>
      <span class="stat-aufsagen__stufe">${escapeHtml(stufeLabel(e.stufe))}</span>
      <span class="stat-aufsagen__wdh">🔁 ×${e.durchgaenge}</span>
      <span class="stat-aufsagen__zeit">⏱ ${escapeHtml(formatDauer(e.zeit_ms))}</span>
      <span class="stat-aufsagen__datum">${escapeHtml(d)}</span>
    </li>`;
  }).join('');
  return `<ul class="stat-aufsagen">${zeilen}</ul>`;
}

// Eintragen-Protokoll (Mal-Trainer): jüngste Einträge als schlichte Liste.
function eintragenProtokollHtml(profileId) {
  const log = getEintragenProtokoll(profileId).slice(0, 20);
  if (!log.length) {
    return '<div class="eltern__leer">Noch kein Eintragen protokolliert.</div>';
  }
  const zeilen = log.map(e => {
    const d = e.datum ? `${e.datum.slice(8, 10)}.${e.datum.slice(5, 7)}.` : '';
    return `<li class="stat-aufsagen__zeile">
      <span class="stat-aufsagen__reihe">${escapeHtml(String(e.reihe))}er</span>
      <span>✅ ${e.richtig}/10</span>
      <span>✖ ${e.fehler}</span>
      <span>💡 ${e.verraten}</span>
      <span class="stat-aufsagen__datum">${escapeHtml(d)}</span>
    </li>`;
  }).join('');
  return `<ul class="stat-aufsagen">${zeilen}</ul>`;
}

const ALTER_LABEL = { 'kindergarten': 'Vorschule', 'klasse-1': '1. Klasse', 'klasse-2': '2. Klasse', 'klasse-3': '3. Klasse' };
const SYNC_TYP_LABEL = {
  mengen: 'Mengen bis 10', plus: 'Plus', minus: 'Minus', mal: 'Mal-Reihen',
  geteilt: 'Geteilt', rechnen10: 'Rechnen bis 10', stellenwert: 'Stellenwert',
};

// Ein Kind-Block der Familien-Statistik (Daten kommen aggregiert vom Sync-Server).
function familienKindHtml(k) {
  const zeilen = (k.proTyp ?? []).map(t => `
    <tr>
      <td class="stat-tabelle__typ">${escapeHtml(SYNC_TYP_LABEL[t.typ] ?? t.typ)}</td>
      <td>${t.richtig}/${t.gesamt}</td>
      <td>${t.gesamt ? prozent(t.richtig / t.gesamt) : '—'}</td>
    </tr>`).join('');
  const extras = [];
  if (k.aufsagen) extras.push(`🗣️ ${k.aufsagen}× aufgesagt`);
  extras.push(`⏱️ ca. ${Math.max(1, Math.round((k.zeit_ms ?? 0) / 60000))} Min geübt`);
  return `
    <div class="stat-familie__kind">
      <div class="stat-familie__name">👦 ${escapeHtml(k.kind)} <span>(${escapeHtml(ALTER_LABEL[k.alter] ?? k.alter)})</span></div>
      <table class="stat-tabelle">
        <thead><tr><th>Rechenart</th><th>Richtig</th><th>Quote</th></tr></thead>
        <tbody>${zeilen}</tbody>
      </table>
      <div class="stat-familie__extras">${escapeHtml(extras.join(' · '))}</div>
    </div>`;
}

// Lädt die geräteübergreifende Statistik vom Sync-Server (letzte 30 Tage).
async function ladeFamilienStatistik(ziel) {
  const cfg = getSyncConfig();
  if (!cfg.url || !cfg.schluessel) {
    ziel.innerHTML = '<div class="eltern__leer">Familien-Sync ist nicht eingerichtet (Tab 📡 Sync).</div>';
    return;
  }
  ziel.innerHTML = '<div class="eltern__leer">Lade …</div>';
  try {
    const res = await fetch(`${cfg.url}?schluessel=${encodeURIComponent(cfg.schluessel)}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.fehler ?? 'abgelehnt');
    ziel.innerHTML = json.kinder.length
      ? json.kinder.map(familienKindHtml).join('')
      : '<div class="eltern__leer">Noch keine Ereignisse in den letzten 30 Tagen.</div>';
  } catch {
    ziel.innerHTML = '<div class="eltern__leer">⚠️ Konnte die Familien-Statistik nicht laden.</div>';
  }
}

export function tabStatistik(container, neuRendern) {
  const view = { kindId: null, fenster: 'woche', filter: 'alle' };

  function render() {
    if (view.kindId) renderDetail();
    else renderUebersicht();
  }

  function renderUebersicht() {
    const profile = getProfiles();
    if (!profile.length) {
      container.innerHTML = '<div class="eltern__leer">Noch keine Kinder. Lege im Tab 🧒 Kinder eins an.</div>';
      return;
    }
    const karten = profile.map(p => {
      const s = summen(p.statistik ?? {});
      const mini = diagrammHtml(verlaufTage(getVerlauf(p.id), 'alle', 7, new Date()));
      const avatar = AVATAR_EMOJI[p.avatar] ?? '🧒';
      const kennzahl = s.gesamt
        ? `${s.gesamt} Aufgaben · ${prozent(s.quote)} richtig`
        : 'noch nicht geübt';
      return `
        <button class="stat-karte" data-kind="${p.id}">
          <div class="stat-karte__kopf">
            <span class="stat-karte__avatar">${avatar}</span>
            <span class="stat-karte__name">${escapeHtml(p.name)}</span>
            <span class="stat-karte__pfeil">›</span>
          </div>
          <div class="stat-karte__kennzahl">${escapeHtml(kennzahl)}</div>
          <div class="stat-karte__mini">${mini}</div>
        </button>`;
    }).join('');
    container.innerHTML = `
      <div class="stat-uebersicht">${karten}</div>
      <div class="stat-detail__abschnitt">🌐 Familien-Statistik (alle Geräte, 30 Tage)</div>
      <div class="stat-familie">
        <button class="eltern__sekundaer" data-familie-laden>Laden</button>
        <div class="stat-familie__inhalt"></div>
      </div>`;
    const familieBtn = container.querySelector('[data-familie-laden]');
    familieBtn.addEventListener('click', () => {
      familieBtn.hidden = true;
      ladeFamilienStatistik(container.querySelector('.stat-familie__inhalt'));
    });
    container.querySelectorAll('[data-kind]').forEach(btn => {
      btn.addEventListener('click', () => { view.kindId = btn.dataset.kind; render(); });
    });
  }

  function renderDetail() {
    const profile = getProfiles();
    const p = profile.find(x => x.id === view.kindId);
    if (!p) { view.kindId = null; render(); return; }

    const s = summen(p.statistik ?? {});
    const tabelle = s.proTyp.length
      ? `<table class="stat-tabelle">
          <thead>
            <tr>
              <th>Rechenart</th><th>Richtig</th><th>Quote</th><th>⌀ Zeit</th><th>Stufe</th>
            </tr>
          </thead>
          <tbody>
            ${s.proTyp.map(t => `
              <tr>
                <td class="stat-tabelle__typ">${escapeHtml(TYP_LABEL[t.typ] ?? t.typ)}</td>
                <td>${t.richtig}/${t.gesamt}</td>
                <td>${prozent(t.quote)}</td>
                <td>${(t.zeitSchnittMs / 1000).toFixed(1)}s</td>
                <td>${getSchwierigkeit(p.id, t.typ)}</td>
              </tr>`).join('')}
          </tbody>
        </table>`
      : '<div class="eltern__leer">Noch keine Aufgaben gelöst.</div>';

    const frei = freieBiome(getBiomFreigabe(p.id))
      .map(id => TYP_LABEL[id] ?? id).join(' · ') || '—';

    const reihe = view.fenster === 'woche'
      ? verlaufTage(getVerlauf(p.id), view.filter, 7, new Date())
      : verlaufWochen(getVerlauf(p.id), view.filter, 5, new Date());

    const chips = FILTER.map(([key, label]) =>
      `<button class="stat-chip ${view.filter === key ? 'aktiv' : ''}" data-filter="${key}">${label}</button>`
    ).join('');

    const avatar = AVATAR_EMOJI[p.avatar] ?? '🧒';
    container.innerHTML = `
      <div class="stat-detail">
        <button class="stat-zurueck" data-zurueck>← Zurück</button>
        <div class="stat-detail__kopf"><span>${avatar}</span> ${escapeHtml(p.name)}</div>

        <div class="stat-detail__abschnitt">📊 Gelöst je Rechenart</div>
        ${tabelle}
        <div class="stat-biome">Freigeschaltet: ${escapeHtml(frei)}</div>

        <div class="stat-detail__abschnitt">📈 Verlauf</div>
        <div class="stat-fenster">
          <button class="stat-chip ${view.fenster === 'woche' ? 'aktiv' : ''}" data-fenster="woche">Woche</button>
          <button class="stat-chip ${view.fenster === 'monat' ? 'aktiv' : ''}" data-fenster="monat">Monat</button>
        </div>
        <div class="stat-chips">${chips}</div>
        ${diagrammHtml(reihe)}
        ${LEGENDE}

        <div class="stat-detail__abschnitt">🗣️ Aufsagen-Protokoll</div>
        ${aufsagenProtokollHtml(p.id)}

        <div class="stat-detail__abschnitt">✏️ Eintragen-Protokoll</div>
        ${eintragenProtokollHtml(p.id)}
      </div>`;

    container.querySelector('[data-zurueck]').addEventListener('click', () => { view.kindId = null; render(); });
    container.querySelectorAll('[data-fenster]').forEach(b =>
      b.addEventListener('click', () => { view.fenster = b.dataset.fenster; render(); }));
    container.querySelectorAll('[data-filter]').forEach(b =>
      b.addEventListener('click', () => { view.filter = b.dataset.filter; render(); }));
  }

  render();
}
