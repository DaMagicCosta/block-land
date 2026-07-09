// Familien-Sync für Block-Land — Google Apps Script (V8).
// Deployment: Web-App, "Ausführen als: ich", Zugriff: "Jeder". Absicherung über FAMILIEN_SCHLUESSEL.
// Script-Properties (Projekteinstellungen → Skript-Eigenschaften):
//   FAMILIEN_SCHLUESSEL  frei gewählter Schlüssel (identisch in der App eingetragen)
//   SHEET_ID             ID des Google Sheets (aus der Sheet-URL)
//   BOT_TOKEN            Token des Telegram-Bots (@BotFather)
//   CHAT_IDS             Telegram-Chat-IDs der Eltern, kommagetrennt (zeigeChatIds() hilft)

const SPALTEN = ['ts', 'kind', 'alter', 'art', 'typ', 'richtig', 'gesamt', 'zeit_ms'];
const TYP_NAMEN = {
  mengen: 'Mengen bis 10', plus: 'Plus', minus: 'Minus', mal: 'Mal-Reihen',
  geteilt: 'Geteilt', rechnen10: 'Rechnen bis 10', stellenwert: 'Stellenwert',
};
const ALTER_NAMEN = {
  'kindergarten': 'Vorschule', 'klasse-1': '1. Klasse',
  'klasse-2': '2. Klasse', 'klasse-3': '3. Klasse',
};

function prop(name) { return PropertiesService.getScriptProperties().getProperty(name); }

function antwortJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ereignisBlatt() {
  const doc = SpreadsheetApp.openById(prop('SHEET_ID'));
  let blatt = doc.getSheetByName('Ereignisse');
  if (!blatt) { blatt = doc.insertSheet('Ereignisse'); blatt.appendRow(SPALTEN); }
  return blatt;
}

// Ereignisse von der App annehmen (Queue-Flush).
function doPost(e) {
  try {
    const daten = JSON.parse(e.postData.contents);
    if (daten.schluessel !== prop('FAMILIEN_SCHLUESSEL')) return antwortJson({ ok: false, fehler: 'schluessel' });
    const events = (daten.events || []).slice(0, 500);
    if (events.length) {
      const zeilen = events.map(ev => [
        String(ev.ts || ''), String(ev.kind || ''), String(ev.alter || ''), String(ev.art || ''),
        String(ev.typ || ''), Number(ev.richtig) || 0, Number(ev.gesamt) || 0, Number(ev.zeit_ms) || 0,
      ]);
      const blatt = ereignisBlatt();
      blatt.getRange(blatt.getLastRow() + 1, 1, zeilen.length, SPALTEN.length).setValues(zeilen);
    }
    return antwortJson({ ok: true, angenommen: events.length });
  } catch (err) {
    return antwortJson({ ok: false, fehler: String(err) });
  }
}

// Aggregierte Familien-Statistik für die Eltern-Ansicht (letzte 30 Tage).
function doGet(e) {
  if (((e && e.parameter && e.parameter.schluessel) || '') !== prop('FAMILIEN_SCHLUESSEL')) {
    return antwortJson({ ok: false, fehler: 'schluessel' });
  }
  return antwortJson({ ok: true, kinder: aggregiere(leseEreignisse(30)) });
}

function tagVon(datum) {
  return Utilities.formatDate(datum, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// Alle Ereignisse der letzten maxTage Tage (inkl. heute) aus dem Sheet.
function leseEreignisse(maxTage) {
  const blatt = ereignisBlatt();
  if (blatt.getLastRow() < 2) return [];
  const werte = blatt.getRange(2, 1, blatt.getLastRow() - 1, SPALTEN.length).getValues();
  const grenze = new Date();
  grenze.setDate(grenze.getDate() - (maxTage - 1));
  grenze.setHours(0, 0, 0, 0);
  return werte
    .map(z => ({
      ts: new Date(z[0]), kind: String(z[1]), alter: String(z[2]), art: String(z[3]),
      typ: String(z[4]), richtig: Number(z[5]) || 0, gesamt: Number(z[6]) || 0, zeit_ms: Number(z[7]) || 0,
    }))
    .filter(ev => !isNaN(ev.ts) && ev.ts >= grenze);
}

// Ereignisse → pro Kind: Summen, pro Rechenart, pro Tag.
function aggregiere(events) {
  const map = {};
  events.forEach(ev => {
    const k = map[ev.kind] = map[ev.kind] || {
      kind: ev.kind, alter: ev.alter, gesamt: 0, richtig: 0, zeit_ms: 0, aufsagen: 0, proTyp: {}, proTag: {},
    };
    k.alter = ev.alter;
    k.zeit_ms += ev.zeit_ms;
    if (ev.art === 'aufsagen') { k.aufsagen += 1; return; }
    k.gesamt += ev.gesamt;
    k.richtig += ev.richtig;
    const t = k.proTyp[ev.typ] = k.proTyp[ev.typ] || { typ: ev.typ, gesamt: 0, richtig: 0 };
    t.gesamt += ev.gesamt;
    t.richtig += ev.richtig;
    const tag = tagVon(ev.ts);
    const tg = k.proTag[tag] = k.proTag[tag] || { tag: tag, gesamt: 0, richtig: 0 };
    tg.gesamt += ev.gesamt;
    tg.richtig += ev.richtig;
  });
  return Object.keys(map).map(name => {
    const k = map[name];
    return {
      kind: k.kind, alter: k.alter, gesamt: k.gesamt, richtig: k.richtig,
      zeit_ms: k.zeit_ms, aufsagen: k.aufsagen,
      proTyp: Object.keys(k.proTyp).map(t => k.proTyp[t]),
      proTag: Object.keys(k.proTag).sort().map(t => k.proTag[t]),
    };
  });
}

// Digest-Text bauen (pure Funktion — testDigest() prüft sie im Editor).
function baueDigest(events, datum) {
  const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const kopf = '🧱 Block-Land — ' + WOCHENTAGE[datum.getDay()] + ', '
    + Utilities.formatDate(datum, Session.getScriptTimeZone(), 'dd.MM.');
  const bloecke = aggregiere(events).map(k => {
    const zeilen = k.proTyp.map(t => {
      const name = TYP_NAMEN[t.typ] || t.typ;
      const quote = t.gesamt ? Math.round(100 * t.richtig / t.gesamt) : 0;
      return '• ' + name + ': ' + t.gesamt + ' Aufgaben, ' + t.richtig + ' richtig (' + quote + '%)';
    });
    if (k.aufsagen) zeilen.push('• 🗣️ Reihen aufgesagt: ' + k.aufsagen + '×');
    zeilen.push('• ⏱️ ca. ' + Math.max(1, Math.round(k.zeit_ms / 60000)) + ' Min geübt');
    return '👦 ' + k.kind + ' (' + (ALTER_NAMEN[k.alter] || k.alter) + ')\n' + zeilen.join('\n');
  });
  return kopf + '\n\n' + bloecke.join('\n\n');
}

// Zeit-Trigger-Ziel (täglich ~19:00): Digest nur bei Aktivität senden.
function taeglicherDigest() {
  const heute = tagVon(new Date());
  const events = leseEreignisse(1).filter(ev => tagVon(ev.ts) === heute);
  if (!events.length) return;   // übungsfreier Tag → keine Nachricht (Beschluss)
  sendeTelegram(baueDigest(events, new Date()));
}

function sendeTelegram(text) {
  const token = prop('BOT_TOKEN');
  const chatIds = (prop('CHAT_IDS') || '').split(',').map(s => s.trim()).filter(Boolean);
  chatIds.forEach(chatId => {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chatId, text: text }),
      muteHttpExceptions: true,
    });
  });
}

// --- Einmalige Setup-Helfer (im Apps-Script-Editor ausführen) ---

// Nachdem beide Eltern dem Bot geschrieben haben: Chat-IDs im Log anzeigen.
function zeigeChatIds() {
  const res = UrlFetchApp.fetch('https://api.telegram.org/bot' + prop('BOT_TOKEN') + '/getUpdates');
  const updates = JSON.parse(res.getContentText());
  updates.result.forEach(u => {
    if (u.message) Logger.log(u.message.chat.id + ' — ' + (u.message.chat.first_name || ''));
  });
  if (!updates.result.length) Logger.log('Keine Updates — dem Bot zuerst eine Nachricht schicken.');
}

// Digest des heutigen Tages ins Log schreiben (ohne zu senden).
function testDigest() {
  const heute = tagVon(new Date());
  const events = leseEreignisse(1).filter(ev => tagVon(ev.ts) === heute);
  Logger.log(events.length ? baueDigest(events, new Date()) : '(heute keine Ereignisse)');
}

// Digest des heutigen Tages wirklich senden (Ende-zu-Ende-Test).
function testSenden() {
  taeglicherDigest();
}
