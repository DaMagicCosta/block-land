// Familien-Sync für Block-Land — Google Apps Script (V8).
// Deployment: Web-App, "Ausführen als: ich", Zugriff: "Jeder". Absicherung über FAMILIEN_SCHLUESSEL.
// Script-Properties (Projekteinstellungen → Skript-Eigenschaften):
//   FAMILIEN_SCHLUESSEL  frei gewählter Schlüssel (identisch in der App eingetragen)
//   SHEET_ID             ID des Google Sheets (aus der Sheet-URL)
//   BOT_TOKEN            Token des Telegram-Bots (@BotFather)
//   CHAT_IDS             Telegram-Chat-IDs der Eltern, kommagetrennt (zeigeChatIds() hilft)
//   TELEGRAM_SECRET      frei gewählter Schlüssel im Webhook-Query-Parameter (setzeWebhook())
//   WEB_APP_URL          echte Web-App-URL .../exec (aus „Bereitstellung verwalten"; für setzeWebhook())
//   CHAT_NAMEN           Anzeigenamen je Chat-ID, z.B. "12345=Mama, 67890=Papa"

const SPALTEN = ['ts', 'kind', 'alter', 'art', 'typ', 'richtig', 'gesamt', 'zeit_ms', 'detail'];
const TYP_NAMEN = {
  mengen: 'Mengen bis 10', plus: 'Plus', minus: 'Minus', mal: 'Mal-Reihen',
  geteilt: 'Geteilt', rechnen10: 'Rechnen bis 10', stellenwert: 'Stellenwert', text: 'Textaufgaben',
  uhr: 'Uhrzeit',
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
    // Telegram-Webhook? (Button-Klicks) — eigener Pfad, erkannt am Secret-Query-Parameter.
    // Apps Script kann keine HTTP-Header lesen, deshalb steckt das Secret in der URL.
    if (e.parameter && e.parameter.telegram !== undefined) {
      if (e.parameter.telegram !== prop('TELEGRAM_SECRET')) return antwortJson({ ok: false });
      return behandleTelegramUpdate(JSON.parse(e.postData.contents));
    }
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
    let zustandNeu = 0;
    if (zustandEvents.length) {
      // Lock (Final-Review I1): derselbe ScriptLock wie im Telegram-Webhook-Pfad
      // (behandleTelegramUpdate) — der appendet parallel tg_-Zeilen ins Zustand-Blatt.
      // Ohne gemeinsamen Lock könnten Dedup-Read (hier) und Webhook-appendRow sich
      // überschneiden (Row-Clobbering, wenn beide zwischen getLastRow() und setValues()
      // liegen). ACHTUNG Re-Entrancy: innerhalb dieses Blocks NIE erneut denselben
      // ScriptLock nehmen — deshalb rufen die Anfrage-Anlage/Rückzug unten die lock-freien
      // Kern-Funktionen direkt auf (legeAnfrageAnUndBenachrichtigeKern, schliesseAnfrage).
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        const blatt = zustandBlatt();
        // Dedup per Id: verlorene POST-Antwort → Client sendet erneut; ohne Filter
        // stünden dieselben Ereignisse doppelt im Log und würden doppelt angewendet.
        const vorhandene = {};
        if (blatt.getLastRow() > 1) {
          blatt.getRange(2, 1, blatt.getLastRow() - 1, 1).getValues().forEach(function (z) { vorhandene[String(z[0])] = true; });
        }
        const neue = zustandEvents.filter(function (ev) { return ev && ev.id && !vorhandene[String(ev.id)]; });
        zustandNeu = neue.length;
        if (neue.length) {
          const zeilen = neue.map(function (ev) { return [
            String(ev.id || ''), String(ev.ts || ''), String(ev.geraet || ''), String(ev.op || ''),
            JSON.stringify(ev.args || {}),
          ]; });
          blatt.getRange(blatt.getLastRow() + 1, 1, zeilen.length, ZUSTAND_SPALTEN.length).setValues(zeilen);
        }
        // Frisch angenommene Einlöse-Anfragen sofort an die Eltern melden (Spec 2026-07-11).
        // Nur die NEUEN (Dedup oben) — Redelivery erzeugt keine Doppel-Nachricht.
        // try/catch (Final-Review I2): Telegram/Blatt-Fehler dürfen die Zustand-Zeilen (oben
        // bereits geschrieben) nicht rückgängig machen — doPost muss ok:true liefern, sonst
        // wiederholt der Client den Flush endlos und die Eltern-Benachrichtigung geht dauerhaft
        // verloren, obwohl der Zustand serverseitig längst angekommen ist.
        neue.filter(function (ev) { return ev.op === 'gutscheinEinloesungAngefragt'; })
            .forEach(function (ev) {
              try { legeAnfrageAnUndBenachrichtigeKern(ev.args || {}); }
              catch (err) { Logger.log('Anfrage-Anlage fehlgeschlagen: ' + err); }
            });
        // Rückgezogene Anfragen (Kind hat sie storniert, bevor die Eltern entschieden haben):
        // Anfrage schließen, damit kein Geister-Button mehr doppelt abbuchen kann (Final-Review C1).
        neue.filter(function (ev) { return ev.op === 'gutscheinAnfrageZurueckgezogen'; })
            .forEach(function (ev) {
              try { schliesseAnfrage((ev.args || {}).anfrageId); }
              catch (err) { Logger.log('Anfrage-Rückzug fehlgeschlagen: ' + err); }
            });
      } finally {
        lock.releaseLock();
      }
    }
    // angenommen zählt weiterhin zustandEvents.length (nicht zustandNeu): der Client muss
    // auch Duplikate als „angenommen" quittiert bekommen, damit er seine Queue leert.
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
  cursor = Math.max(0, Number(cursor) || 0);
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
  // Sitzungs-Zeiten: nur die letzten 7 Tage (Payload klein halten), Spec 2026-07-12.
  const grenzeZeiten = new Date();
  grenzeZeiten.setDate(grenzeZeiten.getDate() - 6);
  grenzeZeiten.setHours(0, 0, 0, 0);
  events.forEach(ev => {
    const k = map[ev.kind] = map[ev.kind] || {
      kind: ev.kind, alter: ev.alter, gesamt: 0, richtig: 0, zeit_ms: 0, aufsagen: 0, proTyp: {}, verlauf: {}, zeiten: {},
    };
    k.alter = ev.alter;
    k.zeit_ms += ev.zeit_ms;
    if (ev.ts >= grenzeZeiten) {
      const tagZ = tagVon(ev.ts);
      (k.zeiten[tagZ] = k.zeiten[tagZ] || []).push(Utilities.formatDate(ev.ts, Session.getScriptTimeZone(), 'HH:mm'));
    }
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
    Object.keys(k.zeiten).forEach(function (t) { k.zeiten[t].sort(); });
    return {
      kind: k.kind, alter: k.alter, gesamt: k.gesamt, richtig: k.richtig,
      zeit_ms: k.zeit_ms, aufsagen: k.aufsagen,
      proTyp: Object.keys(k.proTyp).map(t => k.proTyp[t]),
      verlauf: k.verlauf,
      zeiten: k.zeiten,
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

// --- Gutschein-Anfragen (Spec docs/superpowers/specs/2026-07-11-gutschein-anfrage-design.md) ---

const ANFRAGE_SPALTEN = ['anfrageId', 'ts', 'kind', 'profilId', 'rezeptId', 'name', 'emoji',
  'anzahl', 'wert', 'einheit', 'status', 'entschiedenVon', 'entschiedenTs', 'nachrichtenJson'];

function anfrageBlatt() {
  const doc = SpreadsheetApp.openById(prop('SHEET_ID'));
  let blatt = doc.getSheetByName('Anfragen');
  if (!blatt) { blatt = doc.insertSheet('Anfragen'); blatt.appendRow(ANFRAGE_SPALTEN); }
  return blatt;
}

// Zeile per anfrageId finden → { zeile: 1-basierter Sheet-Index, daten: Objekt } oder null.
function findeAnfrage(anfrageId) {
  const blatt = anfrageBlatt();
  if (blatt.getLastRow() < 2) return null;
  const werte = blatt.getRange(2, 1, blatt.getLastRow() - 1, ANFRAGE_SPALTEN.length).getValues();
  for (let i = 0; i < werte.length; i++) {
    if (String(werte[i][0]) === String(anfrageId)) {
      const daten = {};
      ANFRAGE_SPALTEN.forEach(function (sp, j) { daten[sp] = werte[i][j]; });
      return { zeile: i + 2, daten: daten, blatt: blatt };
    }
  }
  return null;
}

// Anzeigename des Entscheiders aus CHAT_NAMEN ("12345=Mama, 67890=Papa"), sonst 'Familie'.
function chatName(chatId) {
  const paare = (prop('CHAT_NAMEN') || '').split(',');
  for (let i = 0; i < paare.length; i++) {
    const teile = paare[i].split('=');
    if (teile.length === 2 && teile[0].trim() === String(chatId)) return teile[1].trim();
  }
  return 'Familie';
}

// Nachrichtentext einer Anfrage (pure — testAnfrageNachricht() prüft sie im Editor).
function baueAnfrageText(a, prefix) {
  const summe = (Number(a.wert) > 0) ? ' (= ' + (Number(a.anzahl) * Number(a.wert)) + ' ' + (a.einheit || '') + ')' : '';
  return (prefix || '') + '🎟️ ' + a.kind + ' möchte einlösen:\n'
    + (a.emoji || '') + ' ' + a.name + ' ×' + a.anzahl + summe;
}

function anfrageButtons(anfrageId) {
  return { inline_keyboard: [[
    { text: '✅ Freigeben', callback_data: 'f:' + anfrageId },
    { text: '🌙 Jetzt nicht', callback_data: 'a:' + anfrageId },
  ]] };
}

// Telegram-API-Helfer (POST beliebiger Methoden), loggt Fehler statt zu werfen.
function telegramApi(methode, payload) {
  const res = UrlFetchApp.fetch('https://api.telegram.org/bot' + prop('BOT_TOKEN') + '/' + methode, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) Logger.log('Telegram ' + methode + ': HTTP ' + res.getResponseCode() + ' — ' + res.getContentText().slice(0, 200));
  try { return JSON.parse(res.getContentText()); } catch (err) { return { ok: false }; }
}

// Neue Anfrage: Zeile anlegen (idempotent) + Nachricht mit Buttons an beide Eltern.
// Kern-Variante OHNE eigenen Lock (Final-Review I1): GAS-Script-Locks sind nicht reentrant —
// ein zweiter waitLock() in derselben Ausführung würde bis zum Timeout blockieren/werfen.
// Wird jetzt aus dem bereits gelockten zustandEvents-Block in doPost heraus aufgerufen, der
// denselben ScriptLock hält. Für Aufrufer AUSSERHALB eines bestehenden Locks siehe den
// Wrapper legeAnfrageAnUndBenachrichtige() direkt darunter (z.B. testCallbackSimulation).
function legeAnfrageAnUndBenachrichtigeKern(args) {
  if (!args.anfrageId || findeAnfrage(args.anfrageId)) return;   // idempotent
  const a = {
    anfrageId: String(args.anfrageId), ts: new Date().toISOString(), kind: String(args.kindName || ''),
    profilId: String(args.profilId || ''), rezeptId: String(args.rezeptId || ''),
    name: String(args.name || ''), emoji: String(args.emoji || ''), anzahl: Number(args.anzahl) || 1,
    wert: Number(args.wert) || 0, einheit: String(args.einheit || ''),
    status: 'offen', entschiedenVon: '', entschiedenTs: '', nachrichtenJson: '[]',
  };
  const refs = sendeAnfrageNachricht(a, '');
  a.nachrichtenJson = JSON.stringify(refs);
  anfrageBlatt().appendRow(ANFRAGE_SPALTEN.map(function (sp) { return a[sp]; }));
}

// Wrapper mit eigenem Lock — für Aufrufer, die NICHT schon innerhalb eines gehaltenen
// ScriptLocks laufen (aktuell nur testCallbackSimulation). doPost ruft stattdessen die
// Kern-Variante oben direkt auf, weil der zustandEvents-Block den Lock bereits hält.
// Guard→appendRow ist Read-then-Write: zwei gleichzeitige Aufrufe mit derselben anfrageId
// erzeugten ohne Lock sonst Doppel-Nachricht + Doppel-Zeile.
function legeAnfrageAnUndBenachrichtige(args) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    legeAnfrageAnUndBenachrichtigeKern(args);
  } finally {
    lock.releaseLock();
  }
}

// Nachricht mit Buttons an alle CHAT_IDS senden; gibt [{chat_id, message_id}] zurück.
function sendeAnfrageNachricht(a, prefix) {
  const refs = [];
  (prop('CHAT_IDS') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean)
    .forEach(function (chatId) {
      const res = telegramApi('sendMessage', {
        chat_id: chatId, text: baueAnfrageText(a, prefix), reply_markup: anfrageButtons(a.anfrageId),
      });
      if (res.ok && res.result) refs.push({ chat_id: chatId, message_id: res.result.message_id });
    });
  return refs;
}

// Webhook-Eingang: nur callback_query interessiert (Button-Klick). Alles andere ignorieren.
function behandleTelegramUpdate(update) {
  const cb = update && update.callback_query;
  if (!cb) return antwortJson({ ok: true });
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    verarbeiteCallback(cb);
  } finally {
    lock.releaseLock();
  }
  return antwortJson({ ok: true });
}

function verarbeiteCallback(cb) {
  const daten = String(cb.data || '');                      // 'f:<anfrageId>' | 'a:<anfrageId>'
  const aktion = daten.slice(0, 1);
  const anfrageId = daten.slice(2);
  const chatId = String(cb.message && cb.message.chat && cb.message.chat.id || '');
  const erlaubte = (prop('CHAT_IDS') || '').split(',').map(function (s) { return s.trim(); });
  const toast = function (text) { telegramApi('answerCallbackQuery', { callback_query_id: cb.id, text: text }); };

  if (erlaubte.indexOf(chatId) < 0) { toast(''); return; }  // fremder Chat → still ignorieren
  const fund = findeAnfrage(anfrageId);
  if (!fund) { toast('Anfrage nicht gefunden.'); return; }
  if (fund.daten.status !== 'offen') { toast('Schon entschieden: ' + fund.daten.status + ' 👍'); return; }

  const von = chatName(chatId);
  const jetzt = new Date().toISOString();
  const freigegeben = aktion === 'f';
  const status = freigegeben ? 'freigegeben' : 'abgelehnt';

  // 1) Ereignisse ans Zustand-Log — Reihenfolge ist bindend: ERST entschieden (_e),
  //    DANN eingelöst (_g). Deterministische Ids: Webhook-Retries laufen in die App-Dedup.
  //    Bewusst VOR dem Blatt-Status: scheitert danach das Status-Schreiben, bleibt die
  //    Anfrage 'offen' und ein zweiter Klick re-appendet dieselben Ids (App-Dedup fängt sie).
  //    Umgekehrt stünde die Anfrage auf entschieden, ohne dass die App je davon erfährt.
  const z = zustandBlatt();
  z.appendRow(['tg_' + anfrageId + '_e', jetzt, 'telegram', 'gutscheinAnfrageEntschieden',
    JSON.stringify({ anfrageId: anfrageId, profilId: fund.daten.profilId, entscheidung: status, von: von })]);
  if (freigegeben) {
    z.appendRow(['tg_' + anfrageId + '_g', jetzt, 'telegram', 'gutscheineEingeloest',
      JSON.stringify({ profilId: fund.daten.profilId, rezeptId: fund.daten.rezeptId, anzahl: Number(fund.daten.anzahl) || 1 })]);
  }

  // 2) Status im Anfragen-Blatt (Spalten status/entschiedenVon/entschiedenTs = 11..13)
  fund.blatt.getRange(fund.zeile, 11, 1, 3).setValues([[status, von, jetzt]]);

  // 3) Alle zugehörigen Nachrichten editieren (Original + Erinnerungen) — Buttons weg.
  const uhrzeit = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  const schluss = freigegeben ? ('\n\n✅ Von ' + von + ' freigegeben · ' + uhrzeit)
                              : ('\n\n🌙 Von ' + von + ': jetzt nicht · ' + uhrzeit);
  editiereAnfrageNachrichten(fund, baueAnfrageText(fund.daten, '') + schluss);
  toast(freigegeben ? 'Freigegeben ✅' : 'Abgelehnt 🌙');
}

function editiereAnfrageNachrichten(fund, text) {
  let refs = [];
  try { refs = JSON.parse(fund.daten.nachrichtenJson || '[]'); } catch (err) { refs = []; }
  refs.forEach(function (r) {
    telegramApi('editMessageText', { chat_id: r.chat_id, message_id: r.message_id, text: text });
  });
}

// Kind zieht eine noch offene Anfrage zurück (z.B. schon vor Ort eingelöst, bevor die Eltern
// entschieden haben) — Final-Review C1. Kein eigener Lock: wird nur aus dem bereits
// gelockten zustandEvents-Block in doPost aufgerufen (GAS-Locks sind nicht reentrant).
// Nur bei status 'offen' schließen — bei freigegeben/abgelehnt haben die Eltern längst
// entschieden, ein verspäteter Rückzug darf das nicht überschreiben.
function schliesseAnfrage(anfrageId) {
  if (!anfrageId) return;
  const fund = findeAnfrage(anfrageId);
  if (!fund || fund.daten.status !== 'offen') return;   // nicht gefunden oder schon entschieden
  const jetzt = new Date().toISOString();
  // Spalten 11-13 = status/entschiedenVon/entschiedenTs (wie in verarbeiteCallback).
  fund.blatt.getRange(fund.zeile, 11, 1, 3).setValues([['zurueckgezogen', '', jetzt]]);
  const uhrzeit = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  editiereAnfrageNachrichten(fund, baueAnfrageText(fund.daten, '') + '\n\n↩️ Schon vor Ort eingelöst · ' + uhrzeit);
}

// Zeit-Trigger-Ziel (~10:00): je OFFENER Anfrage eine Erinnerung mit frischen Buttons.
// Keine offenen Anfragen → Stille. Neue message_ids werden angehängt (mit-editierbar).
function erinnereOffeneAnfragen() {
  const blatt = anfrageBlatt();
  if (blatt.getLastRow() < 2) return;
  const werte = blatt.getRange(2, 1, blatt.getLastRow() - 1, ANFRAGE_SPALTEN.length).getValues();
  werte.forEach(function (zeile, i) {
    if (String(zeile[10]) !== 'offen') return;   // Spalte 11 = status
    const a = {};
    ANFRAGE_SPALTEN.forEach(function (sp, j) { a[sp] = zeile[j]; });
    const neueRefs = sendeAnfrageNachricht(a, '⏰ Erinnerung — hier wartet noch eine Anfrage:\n\n');
    let refs = [];
    try { refs = JSON.parse(a.nachrichtenJson || '[]'); } catch (err) { refs = []; }
    blatt.getRange(i + 2, 14).setValue(JSON.stringify(refs.concat(neueRefs)));  // Spalte 14 = nachrichtenJson
  });
}

// --- Einmalige Setup-/Test-Helfer (im Apps-Script-Editor ausführen) ---

// Webhook beim Bot registrieren (einmalig nach dem Deployment; Log prüfen!).
// WICHTIG (Live-Befund 2026-07-12, Telegram-Fehler „401 Unauthorized"):
// ScriptApp.getService().getUrl() liefert beim Editor-Lauf die URL der TEST-Bereitstellung —
// auch nach /dev→/exec-Umschreibung bleibt deren Deployment-ID falsch, die Adresse existiert
// öffentlich nicht. Deshalb kommt die echte Web-App-URL aus der Property WEB_APP_URL
// (dieselbe /exec-URL, die auch die App im Sync-Tab nutzt).
function setzeWebhook() {
  if (!prop('TELEGRAM_SECRET')) { Logger.log('FEHLER: Skript-Eigenschaft TELEGRAM_SECRET fehlt.'); return; }
  const basis = String(prop('WEB_APP_URL') || '').trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(basis)) {
    Logger.log('FEHLER: Skript-Eigenschaft WEB_APP_URL fehlt oder ist keine .../exec-Adresse.');
    Logger.log('Bitte die Web-App-URL eintragen (Bereitstellen → Bereitstellung verwalten → URL, endet auf /exec — dieselbe wie im Sync-Tab der App).');
    return;
  }
  const url = basis + '?telegram=' + encodeURIComponent(prop('TELEGRAM_SECRET'));
  Logger.log(JSON.stringify(telegramApi('setWebhook', { url: url })));
  Logger.log('Webhook-URL: ' + url);
}

// Webhook-Diagnose: registrierte URL, Update-Stau und Telegrams letzte Fehlermeldung ins Log.
function zeigeWebhookStatus() {
  Logger.log(JSON.stringify(telegramApi('getWebhookInfo', {})));
}

function loescheWebhook() {
  Logger.log(JSON.stringify(telegramApi('deleteWebhook', {})));
}

// Nachrichtentext im Log prüfen (ohne zu senden).
function testAnfrageNachricht() {
  Logger.log(baueAnfrageText({ kind: 'Arthur', emoji: '⏱️', name: '15 Min Spielen', anzahl: 2, wert: 15, einheit: 'Min' }, ''));
  Logger.log(baueAnfrageText({ kind: 'Ilian', emoji: '🍫', name: 'Nasch-Gutschein', anzahl: 1, wert: 0, einheit: '' }, '⏰ Erinnerung — hier wartet noch eine Anfrage:\n\n'));
}

// Kompletten Callback-Pfad ohne Telegram durchspielen: legt eine Test-Anfrage an,
// entscheidet sie und prüft die Zustand-Zeilen. Räumt NICHT auf (Sichtkontrolle im Sheet).
function testCallbackSimulation() {
  legeAnfrageAnUndBenachrichtige({ anfrageId: 'a_test_sim', profilId: 'p_test', kindName: 'Testkind',
    rezeptId: 'r_spiel15', name: '15 Min Spielen', emoji: '⏱️', anzahl: 2, wert: 15, einheit: 'Min' });
  const chatId = (prop('CHAT_IDS') || '').split(',')[0].trim();
  verarbeiteCallback({ id: 'test', data: 'f:a_test_sim', message: { chat: { id: chatId } } });
  const fund = findeAnfrage('a_test_sim');
  Logger.log('Status: ' + fund.daten.status + ' von ' + fund.daten.entschiedenVon);
  Logger.log('Erwartung: freigegeben; Zustand-Blatt hat tg_a_test_sim_e und tg_a_test_sim_g als letzte Zeilen.');
}
