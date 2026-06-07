// Statistik-Tab: Übersicht aller Kinder + Detailansicht pro Kind mit Tages-/Wochen-Verlauf.
// Render-Modul (DOM). Aggregation/Reihen kommen aus statistik-logik.js.
import { getProfiles, getSchwierigkeit, getVerlauf, getBiomFreigabe } from './state.js';
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
    container.innerHTML = `<div class="stat-uebersicht">${karten}</div>`;
    container.querySelectorAll('[data-kind]').forEach(btn => {
      btn.addEventListener('click', () => { view.kindId = btn.dataset.kind; render(); });
    });
  }

  function renderDetail() {
    const profile = getProfiles();
    const p = profile.find(x => x.id === view.kindId);
    if (!p) { view.kindId = null; render(); return; }

    const s = summen(p.statistik ?? {});
    const zeilen = s.proTyp.length
      ? s.proTyp.map(t => `
          <div class="stat-zeile">
            <span class="stat-zeile__typ">${escapeHtml(TYP_LABEL[t.typ] ?? t.typ)}</span>
            <span class="stat-zeile__wert">${t.richtig}/${t.gesamt}</span>
            <span class="stat-zeile__wert">${prozent(t.quote)}</span>
            <span class="stat-zeile__wert">⌀ ${(t.zeitSchnittMs / 1000).toFixed(1)}s</span>
            <span class="stat-zeile__wert">Stufe ${getSchwierigkeit(p.id, t.typ)}</span>
          </div>`).join('')
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
        <div class="stat-tabelle">${zeilen}</div>
        <div class="stat-biome">Freigeschaltet: ${escapeHtml(frei)}</div>

        <div class="stat-detail__abschnitt">📈 Verlauf</div>
        <div class="stat-fenster">
          <button class="stat-chip ${view.fenster === 'woche' ? 'aktiv' : ''}" data-fenster="woche">Woche</button>
          <button class="stat-chip ${view.fenster === 'monat' ? 'aktiv' : ''}" data-fenster="monat">Monat</button>
        </div>
        <div class="stat-chips">${chips}</div>
        ${diagrammHtml(reihe)}
        ${LEGENDE}
      </div>`;

    container.querySelector('[data-zurueck]').addEventListener('click', () => { view.kindId = null; render(); });
    container.querySelectorAll('[data-fenster]').forEach(b =>
      b.addEventListener('click', () => { view.fenster = b.dataset.fenster; render(); }));
    container.querySelectorAll('[data-filter]').forEach(b =>
      b.addEventListener('click', () => { view.filter = b.dataset.filter; render(); }));
  }

  render();
}
