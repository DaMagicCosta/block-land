// Statistik-Tab: Übersicht aller Kinder + Detailansicht pro Kind mit Tages-/Wochen-Verlauf.
// Render-Modul (DOM). Aggregation/Reihen kommen aus statistik-logik.js.
import { getProfiles, getSchwierigkeit, getVerlauf, getBiomFreigabe, getAufsagenProtokoll, getEintragenProtokoll, getSyncConfig } from './state.js';
import { stufeLabel, formatDauer } from './aufsage-protokoll-logik.js';
import { freieBiome } from './biome-logik.js';
import { summen, quoteFarbe, verlaufTage, verlaufWochen } from './statistik-logik.js';
import { escapeHtml } from './utils.js';
import { holeFamilienStatistik } from './sync.js';
import { erzeugeBefunde } from './befund-logik.js';
import { clustereTag, sitzungsKennzahlen, minutenVon } from './sitzungs-logik.js';

const AVATAR_EMOJI = {
  krieger: '🗡️', bergmann: '⛏️', magier: '🧙', ninja: '🥷',
  ritter: '🛡️', schurke: '🦹', tier: '🐺', drache: '🐉',
};
const TYP_LABEL = { mengen: 'Mengen', plus: 'Plus', minus: 'Minus', mal: 'Mal', text: 'Textaufgaben' };

function prozent(quote) { return `${Math.round(quote * 100)}%`; }

// Balkendiagramm aus einer Reihe ({ label, gesamt, quote, zeitSchnittMs }[]).
// metrik 'aufgaben': Balkenhöhe = Aufgabenzahl. metrik 'zeit': Balkenhöhe = ⌀ Zeit pro
// Aufgabe. Die Farbe bleibt in beiden Fällen die Quote (Qualitätssignal).
function diagrammHtml(reihe, metrik = 'aufgaben') {
  const wert = p => (metrik === 'zeit' ? (p.zeitSchnittMs ?? 0) : p.gesamt);
  const max = Math.max(1, ...reihe.map(wert));
  const balken = reihe.map(p => {
    const h = Math.round((wert(p) / max) * 100);
    const farbe = quoteFarbe(p.quote, p.gesamt);
    const zeitText = p.zeitSchnittMs ? `⌀ ${(p.zeitSchnittMs / 1000).toFixed(1)}s` : 'keine Zeiten erfasst';
    const titel = p.gesamt
      ? (metrik === 'zeit' ? `${zeitText} · ${p.gesamt} Aufgaben` : `${p.gesamt} Aufgaben · ${prozent(p.quote)} richtig`)
      : 'keine Aufgaben';
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

// „🕒 Sitzungen": 7-Tage-Zeitleiste (wann hingesetzt, wie lange, Pausen) aus Server-Rohzeiten.
// Festes Fenster 7-20 Uhr → Tage sind auf einen Blick vergleichbar (Spec 2026-07-12).
// Bekannte Grenze: Sitzungen über Mitternacht werden durch die Tages-Buckets geteilt —
// praktisch irrelevant, weil die Ruhezeit (20–8 Uhr) das Gerät nachts sperrt.
const SITZUNG_VON = 7 * 60, SITZUNG_BIS = 20 * 60;   // Minuten seit 0:00
function sitzungenHtml(zeiten) {
  if (!zeiten) return `
    <div class="stat-detail__abschnitt">🕒 Sitzungen (letzte 7 Tage)</div>
    <div class="stat-quelle">Sitzungs-Zeiten kommen nach dem Server-Update.</div>`;

  const heute = new Date();
  const tage = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(heute); d.setDate(heute.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // de-AT liefert bei day:'numeric' bereits einen Punkt nach der Zahl ("Sa., 11.") — kein
    // zusätzliches ".": sonst Doppelpunkt-Artefakt "Sa., 11.." (per Screenshot-Sichtprüfung gefunden).
    const label = i === 0 ? 'Heute' : d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric' });
    tage.push({ iso, label });
  }
  const spanne = SITZUNG_BIS - SITZUNG_VON;
  const prozentZeit = (min) => Math.max(0, Math.min(100, ((min - SITZUNG_VON) / spanne) * 100));

  const kz = sitzungsKennzahlen(zeiten);
  const startTxt = kz.ersterStartMin === null ? '–'
    : `${String(Math.floor(kz.ersterStartMin / 60)).padStart(2, '0')}:${String(kz.ersterStartMin % 60).padStart(2, '0')}`;
  const wiederTxt = kz.wiederaufnahmeMin === null ? '–' : `${kz.wiederaufnahmeMin} Min`;

  const zeilen = tage.map(({ iso, label }) => {
    const { bloecke, luecken } = clustereTag(zeiten[iso]);
    const segmente = bloecke.map(b => {
      const links = prozentZeit(minutenVon(b.start));
      const breite = Math.max(prozentZeit(minutenVon(b.ende)) - links, 1.2);   // Mindestbreite ~6px (css: min-width 6px)
      // Klemm-Reserve ≥3%: CSS min-width (6px, border-box) kann die tatsächliche Breite über die
      // hier berechnete % anheben (z.B. schmalster Mobile-Track ~230px -> 6px ≈ 2,6%) — ohne Reserve
      // würde der rechte Rand knapp über den Track hinausragen (Final-Review F3/F4-Interaktion).
      const linksGeklemmt = Math.min(links, 100 - Math.max(breite, 3));
      return `<div class="stat-sitzung__block" style="left:${linksGeklemmt}%;width:${breite}%"
        title="${escapeHtml(b.start)}–${escapeHtml(b.ende)} · ${b.anzahl} Aufgaben"></div>`;
    }).join('');
    const caption = bloecke.length
      ? bloecke.map((b, i) => {
          const teil = `${escapeHtml(b.start)}–${escapeHtml(b.ende)} (${b.anzahl})`;
          const l = luecken[i];
          return l ? `${teil}${l.pause ? ` · ☕ ${l.minuten} Min · ` : ' · '}` : teil;
        }).join('')
      : '—';
    return `
      <div class="stat-sitzung__zeile">
        <span class="stat-sitzung__tag">${label}</span>
        <div class="stat-sitzung__track">
          ${[8, 12, 16, 20].map(h => `<span class="stat-sitzung__tick" style="left:${prozentZeit(h * 60)}%"></span>`).join('')}
          ${segmente}
        </div>
      </div>
      <div class="stat-sitzung__caption">${caption}</div>`;
  }).join('');

  return `
    <div class="stat-detail__abschnitt">🕒 Sitzungen (letzte 7 Tage)</div>
    <div class="stat-sitzung__kennzahlen">
      <span>⌀ erster Start: <b>${startTxt}</b></span>
      <span>⌀ Wiederaufnahme nach Pause: <b>${wiederTxt}</b></span>
    </div>
    <div class="stat-sitzung">
      ${zeilen}
      <div class="stat-sitzung__achse">
        <span class="stat-sitzung__tag"></span>
        <div class="stat-sitzung__achse-track">
          ${[8, 12, 16, 20].map(h => `<span class="stat-sitzung__stunde" style="left:${prozentZeit(h * 60)}%">${h}</span>`).join('')}
        </div>
      </div>
    </div>`;
}

const ALTER_LABEL = { 'kindergarten': 'Vorschule', 'klasse-1': '1. Klasse', 'klasse-2': '2. Klasse', 'klasse-3': '3. Klasse' };
const SYNC_TYP_LABEL = {
  mengen: 'Mengen bis 10', plus: 'Plus', minus: 'Minus', mal: 'Mal-Reihen',
  geteilt: 'Geteilt', rechnen10: 'Rechnen bis 10', stellenwert: 'Stellenwert', text: 'Textaufgaben',
};

// Server-Daten holen; kinder=null heißt: lokaler Fallback (mit Hinweis-Text).
async function holeServerKinder() {
  const cfg = getSyncConfig();
  if (!cfg.url || !cfg.schluessel) {
    return { kinder: null, hinweis: 'Familien-Sync nicht eingerichtet (Tab 📡 Sync) — Ansicht zeigt nur dieses Gerät.' };
  }
  try {
    const json = await holeFamilienStatistik();
    return { kinder: Array.isArray(json.kinder) ? json.kinder : [] };
  } catch {
    return { kinder: null, hinweis: '⚠️ Familien-Statistik nicht erreichbar — Ansicht zeigt nur dieses Gerät.' };
  }
}

export function tabStatistik(container, neuRendern) {
  // Hauptquelle ist der Sync-Server (geräteübergreifend); lokale Daten sind Fallback
  // (offline/unkonfiguriert) und liefern die Geräte-Details (Stufe, Protokolle).
  const view = { kindName: null, fenster: 'woche', filter: 'alle', metrik: 'aufgaben' };
  let server = { kinder: null, hinweis: null };

  function render() {
    if (view.kindName) renderDetail();
    else renderUebersicht();
  }

  function kartenHtml(name, avatar, kennzahl, mini) {
    return `
      <button class="stat-karte" data-kind="${escapeHtml(name)}">
        <div class="stat-karte__kopf">
          <span class="stat-karte__avatar">${avatar}</span>
          <span class="stat-karte__name">${escapeHtml(name)}</span>
          <span class="stat-karte__pfeil">›</span>
        </div>
        <div class="stat-karte__kennzahl">${escapeHtml(kennzahl)}</div>
        <div class="stat-karte__mini">${mini}</div>
      </button>`;
  }

  function renderUebersicht() {
    const profile = getProfiles();
    const profilNachName = new Map(profile.map(p => [p.name, p]));
    const karten = [];

    if (server.kinder) {
      for (const k of server.kinder) {
        const p = profilNachName.get(k.kind);
        const gesamt = Number(k.gesamt) || 0;
        const richtig = Number(k.richtig) || 0;
        const minuten = Math.max(1, Math.round((Number(k.zeit_ms) || 0) / 60000));
        const kennzahl = gesamt
          ? `${gesamt} Aufgaben · ${prozent(richtig / gesamt)} richtig · ca. ${minuten} Min`
          : 'noch nicht geübt';
        karten.push(kartenHtml(k.kind, p ? (AVATAR_EMOJI[p.avatar] ?? '🧒') : '🧒', kennzahl,
          diagrammHtml(verlaufTage(k.verlauf ?? {}, 'alle', 7, new Date()))));
      }
      // Lokale Profile, die serverseitig noch keine Ereignisse haben, trotzdem anzeigen.
      for (const p of profile) {
        if (!server.kinder.some(k => k.kind === p.name)) {
          karten.push(kartenHtml(p.name, AVATAR_EMOJI[p.avatar] ?? '🧒', 'noch nicht geübt',
            diagrammHtml(verlaufTage({}, 'alle', 7, new Date()))));
        }
      }
    } else {
      // Fallback: lokale Statistik dieses Geräts.
      for (const p of profile) {
        const s = summen(p.statistik ?? {});
        const kennzahl = s.gesamt ? `${s.gesamt} Aufgaben · ${prozent(s.quote)} richtig` : 'noch nicht geübt';
        karten.push(kartenHtml(p.name, AVATAR_EMOJI[p.avatar] ?? '🧒', kennzahl,
          diagrammHtml(verlaufTage(getVerlauf(p.id), 'alle', 7, new Date()))));
      }
    }

    if (!karten.length) {
      container.innerHTML = '<div class="eltern__leer">Noch keine Kinder. Lege im Tab 🧒 Kinder eins an.</div>';
      return;
    }
    const quelle = server.kinder
      ? '<div class="stat-quelle">🌐 Alle Geräte · letzte 30 Tage</div>'
      : `<div class="stat-quelle">${escapeHtml(server.hinweis ?? '')}</div>`;
    container.innerHTML = `${quelle}<div class="stat-uebersicht">${karten.join('')}</div>`;
    container.querySelectorAll('[data-kind]').forEach(btn => {
      btn.addEventListener('click', () => { view.kindName = btn.dataset.kind; view.filter = 'alle'; render(); });
    });
  }

  function renderDetail() {
    const profile = getProfiles();
    const p = profile.find(x => x.name === view.kindName) ?? null;
    const k = server.kinder?.find(x => x.kind === view.kindName) ?? null;
    if (!k && !p) { view.kindName = null; render(); return; }

    const avatar = p ? (AVATAR_EMOJI[p.avatar] ?? '🧒') : '🧒';
    let tabelle, verlaufObj, filterTypen, quelle, extras = [], kompassTypen = [];

    if (k) {
      const proTyp = k.proTyp ?? [];
      tabelle = proTyp.length
        ? `<table class="stat-tabelle">
            <thead><tr><th>Rechenart</th><th>Richtig</th><th>Quote</th><th>⌀ Zeit</th><th>Stufe</th></tr></thead>
            <tbody>${proTyp.map(t => {
              const gesamt = Number(t.gesamt) || 0;
              const richtig = Number(t.richtig) || 0;
              const zeit = Number(t.zeit_ms) || 0;
              return `<tr>
                <td class="stat-tabelle__typ">${escapeHtml(SYNC_TYP_LABEL[t.typ] ?? t.typ)}</td>
                <td>${richtig}/${gesamt}</td>
                <td>${gesamt ? prozent(richtig / gesamt) : '—'}</td>
                <td>${gesamt && zeit ? `${(zeit / gesamt / 1000).toFixed(1)}s` : '—'}</td>
                <td>${p ? getSchwierigkeit(p.id, t.typ) : '—'}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>`
        : '<div class="eltern__leer">Noch keine Aufgaben gelöst.</div>';
      verlaufObj = k.verlauf ?? {};
      filterTypen = proTyp.map(t => t.typ);
      kompassTypen = proTyp;
      quelle = '🌐 Alle Geräte · letzte 30 Tage';
      const aufsagen = Number(k.aufsagen) || 0;
      if (aufsagen) extras.push(`🗣️ ${aufsagen}× Reihen aufgesagt`);
      extras.push(`⏱️ ca. ${Math.max(1, Math.round((Number(k.zeit_ms) || 0) / 60000))} Min geübt`);
    } else {
      const s = summen(p.statistik ?? {});
      tabelle = s.proTyp.length
        ? `<table class="stat-tabelle">
            <thead><tr><th>Rechenart</th><th>Richtig</th><th>Quote</th><th>⌀ Zeit</th><th>Stufe</th></tr></thead>
            <tbody>${s.proTyp.map(t => `
              <tr>
                <td class="stat-tabelle__typ">${escapeHtml(SYNC_TYP_LABEL[t.typ] ?? t.typ)}</td>
                <td>${t.richtig}/${t.gesamt}</td>
                <td>${prozent(t.quote)}</td>
                <td>${(t.zeitSchnittMs / 1000).toFixed(1)}s</td>
                <td>${getSchwierigkeit(p.id, t.typ)}</td>
              </tr>`).join('')}</tbody>
          </table>`
        : '<div class="eltern__leer">Noch keine Aufgaben gelöst.</div>';
      verlaufObj = getVerlauf(p.id);
      filterTypen = s.proTyp.map(t => t.typ);
      kompassTypen = s.proTyp.map(t => ({ typ: t.typ, gesamt: t.gesamt, richtig: t.richtig, zeit_ms: t.zeitSumme }));
      quelle = server.hinweis ?? '📱 Nur dieses Gerät';
    }

    const reihe = view.fenster === 'woche'
      ? verlaufTage(verlaufObj, view.filter, 7, new Date())
      : verlaufWochen(verlaufObj, view.filter, 5, new Date());

    const chips = [['alle', 'Alle'], ...filterTypen.map(t => [t, SYNC_TYP_LABEL[t] ?? t])].map(([key, label]) =>
      `<button class="stat-chip ${view.filter === key ? 'aktiv' : ''}" data-filter="${escapeHtml(key)}">${escapeHtml(label)}</button>`
    ).join('');

    const befunde = erzeugeBefunde(kompassTypen, SYNC_TYP_LABEL);
    const kompass = `
        <div class="stat-detail__abschnitt">🧭 Förder-Kompass</div>
        <div class="stat-befunde">${befunde.map(b =>
          `<div class="stat-befund stat-befund--${b.farbe}">${escapeHtml(b.text)}</div>`).join('')}</div>`;

    // Geräte-Details (Stufe steht in der Tabelle; hier Biome + Protokolle) nur, wenn das
    // Kind auf DIESEM Gerät ein Profil hat — diese Daten werden bewusst nicht gesynct.
    const geraeteTeil = p ? `
        <div class="stat-detail__abschnitt">📱 Auf diesem Gerät</div>
        <div class="stat-biome">Freigeschaltet: ${escapeHtml(freieBiome(getBiomFreigabe(p.id)).map(id => SYNC_TYP_LABEL[id] ?? TYP_LABEL[id] ?? id).join(' · ') || '—')}</div>

        <div class="stat-detail__abschnitt">🗣️ Aufsagen-Protokoll</div>
        ${aufsagenProtokollHtml(p.id)}

        <div class="stat-detail__abschnitt">✏️ Eintragen-Protokoll</div>
        ${eintragenProtokollHtml(p.id)}` : '';

    const kindDaten = k ?? null;
    container.innerHTML = `
      <div class="stat-detail">
        <button class="stat-zurueck" data-zurueck>← Zurück</button>
        <div class="stat-detail__kopf"><span>${avatar}</span> ${escapeHtml(view.kindName)}${kindDaten ? ` <span class="stat-detail__alter">(${escapeHtml(ALTER_LABEL[kindDaten.alter] ?? kindDaten.alter)})</span>` : ''}</div>
        <div class="stat-quelle">${escapeHtml(quelle)}</div>
        ${kompass}

        <div class="stat-detail__abschnitt">📊 Gelöst je Rechenart</div>
        ${tabelle}
        ${extras.length ? `<div class="stat-biome">${escapeHtml(extras.join(' · '))}</div>` : ''}

        <div class="stat-detail__abschnitt">📈 Verlauf</div>
        <div class="stat-fenster">
          <button class="stat-chip ${view.fenster === 'woche' ? 'aktiv' : ''}" data-fenster="woche">Woche</button>
          <button class="stat-chip ${view.fenster === 'monat' ? 'aktiv' : ''}" data-fenster="monat">Monat</button>
          <span class="stat-fenster__trenner"></span>
          <button class="stat-chip ${view.metrik === 'aufgaben' ? 'aktiv' : ''}" data-metrik="aufgaben">📊 Aufgaben</button>
          <button class="stat-chip ${view.metrik === 'zeit' ? 'aktiv' : ''}" data-metrik="zeit">⏱️ ⌀ Zeit</button>
        </div>
        <div class="stat-chips">${chips}</div>
        ${diagrammHtml(reihe, view.metrik)}
        ${LEGENDE}
        ${server.kinder && k ? sitzungenHtml(k.zeiten) : ''}
        ${geraeteTeil}
      </div>`;

    container.querySelector('[data-zurueck]').addEventListener('click', () => { view.kindName = null; render(); });
    container.querySelectorAll('[data-fenster]').forEach(b =>
      b.addEventListener('click', () => { view.fenster = b.dataset.fenster; render(); }));
    container.querySelectorAll('[data-metrik]').forEach(b =>
      b.addEventListener('click', () => { view.metrik = b.dataset.metrik; render(); }));
    container.querySelectorAll('[data-filter]').forEach(b =>
      b.addEventListener('click', () => { view.filter = b.dataset.filter; render(); }));
  }

  // Beim Öffnen: Server-Daten laden (einmal pro Tab-Öffnen), dann rendern.
  container.innerHTML = '<div class="eltern__leer">Lade Familien-Statistik …</div>';
  holeServerKinder().then(ergebnis => { server = ergebnis; render(); });
}
