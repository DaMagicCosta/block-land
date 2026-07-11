// Familien-Sync für Block-Land — Google Apps Script (V8).
// Deployment: Web-App, "Ausführen als: ich", Zugriff: "Jeder". Absicherung über FAMILIEN_SCHLUESSEL.
// Script-Properties (Projekteinstellungen → Skript-Eigenschaften):
//   FAMILIEN_SCHLUESSEL  frei gewählter Schlüssel (identisch in der App eingetragen)
//   SHEET_ID             ID des Google Sheets (aus der Sheet-URL)
//   BOT_TOKEN            Token des Telegram-Bots (@BotFather)
//   CHAT_IDS             Telegram-Chat-IDs der Eltern, kommagetrennt (zeigeChatIds() hilft)

const SPALTEN = ['ts', 'kind', 'alter', 'art', 'typ', 'richtig', 'gesamt', 'zeit_ms', 'detail'];
const TYP_NAMEN = {
  mengen: 'Mengen bis 10', plus: 'Plus', minus: 'Minus', mal: 'Mal-Reihen',
  geteilt: 'Geteilt', rechnen10: 'Rechnen bis 10', stellenwert: 'Stellenwert', text: 'Textaufgaben',
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
  // Kopfzeile nachziehen, wenn neue Spalten dazukommen (z.B. 'detail') — idempotent.
  if (blatt.getLastColumn() < SPALTEN.length) blatt.getRange(1, 1, 1, SPALTEN.length).setValues([SPALTEN]);
  return blatt;
}

const ZUSTAND_SPALTEN = ['id', 'ts', 'geraet', 'op', 'argsJson'];

function zustandBlatt() {
  const doc = SpreadsheetApp.openById(prop('SHEET_ID'));
  let blatt = doc.getSheetByName('Zustand');
  if (!blatt) { blatt = doc.insertSheet('Zustand'); blatt.appendRow(ZUSTAND_SPALTEN); }
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
        String(ev.detail || ''),
      ]);
      const blatt = ereignisBlatt();
      blatt.getRange(blatt.getLastRow() + 1, 1, zeilen.length, SPALTEN.length).setValues(zeilen);
    }
    // Spielstand-Ereignisse (Spec 2026-07-11): Cap 2000 = Client-Queue-Cap — ein Flush
    // kann nie mehr schicken; ohne dieses Alignment würde der Client bei ok:true
    // ungesendete Ereignisse aus der Queue löschen (stiller Verlust).
    const zustandEvents = (daten.zustandEvents || []).slice(0, 2000);
    if (zustandEvents.length) {
      const zeilen = zustandEvents.map(ev => [
        String(ev.id || ''), String(ev.ts || ''), String(ev.geraet || ''), String(ev.op || ''),
        JSON.stringify(ev.args || {}),
      ]);
      const blatt = zustandBlatt();
      blatt.getRange(blatt.getLastRow() + 1, 1, zeilen.length, ZUSTAND_SPALTEN.length).setValues(zeilen);
    }
    return antwortJson({ ok: true, angenommen: events.length + zustandEvents.length });
  } catch (err) {
    return antwortJson({ ok: false, fehler: String(err) });
  }
}

// Aggregierte Familien-Statistik für die Eltern-Ansicht (letzte 30 Tage).
function doGet(e) {
  try {
    if (((e && e.parameter && e.parameter.schluessel) || '') !== prop('FAMILIEN_SCHLUESSEL')) {
      return antwortJson({ ok: false, fehler: 'schluessel' });
    }
    if (e.parameter.zustandSeit !== undefined) {
      return antwortJson(zustandSeit(Number(e.parameter.zustandSeit) || 0));
    }
    return antwortJson({ ok: true, kinder: aggregiere(leseEreignisse(30)) });
  } catch (err) {
    return antwortJson({ ok: false, fehler: String(err) });
  }
}

// Zustands-Ereignisse ab „cursor" (= Anzahl bereits gelesener) in Log-Reihenfolge.
// Antwort-cursor = Gesamtanzahl — der Client schreibt ihn nach erfolgreichem Einspielen fort.
function zustandSeit(cursor) {
  const blatt = zustandBlatt();
  const gesamt = Math.max(0, blatt.getLastRow() - 1);
  if (cursor >= gesamt) return { ok: true, events: [], cursor: gesamt };
  const werte = blatt.getRange(2 + cursor, 1, gesamt - cursor, ZUSTAND_SPALTEN.length).getValues();
  const events = werte.map(function (z) {
    let args = {};
    try { args = JSON.parse(z[4] || '{}'); } catch (err) { /* kaputte Zeile → leere args, Client überspringt */ }
    return { id: String(z[0]), ts: String(z[1]), geraet: String(z[2]), op: String(z[3]), args: args };
  });
  return { ok: true, events: events, cursor: gesamt };
}

// Editor-Testlauf: Zeilenzahl + erste Ereignisse ins Log.
function testZustand() {
  Logger.log('Zustand-Zeilen: ' + Math.max(0, zustandBlatt().getLastRow() - 1));
  Logger.log(JSON.stringify(zustandSeit(0)).slice(0, 800));
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
      detail: String(z[8] || ''),
    }))
    .filter(ev => !isNaN(ev.ts) && ev.ts >= grenze);
}

// Ereignisse → pro Kind: Summen, pro Rechenart (inkl. Zeit) und Tages-Verlauf.
// `verlauf` hat dasselbe Format wie der lokale Verlauf der App
// ({ 'YYYY-MM-DD': { typ: { gesamt, richtig } } }), damit die Statistik-Ansicht
// Server-Daten mit denselben Funktionen rendert wie lokale.
function aggregiere(events) {
  const map = {};
  events.forEach(ev => {
    const k = map[ev.kind] = map[ev.kind] || {
      kind: ev.kind, alter: ev.alter, gesamt: 0, richtig: 0, zeit_ms: 0, aufsagen: 0, proTyp: {}, verlauf: {},
    };
    k.alter = ev.alter;
    k.zeit_ms += ev.zeit_ms;
    if (ev.art === 'aufsagen') { k.aufsagen += 1; return; }
    k.gesamt += ev.gesamt;
    k.richtig += ev.richtig;
    const t = k.proTyp[ev.typ] = k.proTyp[ev.typ] || { typ: ev.typ, gesamt: 0, richtig: 0, zeit_ms: 0 };
    t.gesamt += ev.gesamt;
    t.richtig += ev.richtig;
    t.zeit_ms += ev.zeit_ms;
    const tag = tagVon(ev.ts);
    const tagObj = k.verlauf[tag] = k.verlauf[tag] || {};
    const vt = tagObj[ev.typ] = tagObj[ev.typ] || { gesamt: 0, richtig: 0, zeit_ms: 0 };
    vt.gesamt += ev.gesamt;
    vt.richtig += ev.richtig;
    vt.zeit_ms += ev.zeit_ms;
  });
  return Object.keys(map).map(name => {
    const k = map[name];
    return {
      kind: k.kind, alter: k.alter, gesamt: k.gesamt, richtig: k.richtig,
      zeit_ms: k.zeit_ms, aufsagen: k.aufsagen,
      proTyp: Object.keys(k.proTyp).map(t => k.proTyp[t]),
      verlauf: k.verlauf,
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
  // Fehlkonfiguration sichtbar machen — ein Tippfehler im Property-Namen liefe sonst lautlos durch.
  if (!token) { Logger.log('FEHLER: Skript-Eigenschaft BOT_TOKEN fehlt/leer.'); return; }
  if (!chatIds.length) { Logger.log('FEHLER: Skript-Eigenschaft CHAT_IDS fehlt/leer.'); return; }
  chatIds.forEach(chatId => {
    const res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chatId, text: text }),
      muteHttpExceptions: true,
    });
    Logger.log('Telegram an ' + chatId + ': HTTP ' + res.getResponseCode() + ' — ' + res.getContentText().slice(0, 120));
  });
}

// Sendet eine fixe Testnachricht an alle CHAT_IDS — unabhängig von Ereignissen.
// Zum Diagnostizieren des Sendepfads im Editor ausführen, dann Log ansehen.
function testTelegram() {
  Logger.log('BOT_TOKEN gesetzt: ' + (prop('BOT_TOKEN') ? 'ja' : 'NEIN'));
  Logger.log('CHAT_IDS gesetzt: ' + (prop('CHAT_IDS') || 'NEIN'));
  sendeTelegram('🔧 Block-Land: Sendepfad-Test — wenn Du das liest, funktioniert der Versand.');
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
