# Familien-Sync — Einrichtung (einmalig, ~20 Min)

Alle Schritte macht Alexander selbst (Sicherheits-Gate: Deployments/Trigger legt keine KI an).

## 1. Telegram-Bot anlegen
1. In Telegram **@BotFather** öffnen → `/newbot` → Name z.B. „Block-Land Familie",
   Benutzername z.B. `BlockLandFamilieBot`.
2. Den angezeigten **Token** kopieren (Format `123456:ABC-…`).
3. **Beide Eltern** (Alexander + Julia) öffnen den neuen Bot und schicken ihm `/start`.

## 2. Google Sheet anlegen
1. https://sheets.new → Name z.B. „Block-Land Familien-Sync".
2. Aus der URL die **Sheet-ID** kopieren (`https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`).
   (Das Blatt „Ereignisse" legt das Script selbst an.)

## 3. Apps Script deployen
1. https://script.google.com → „Neues Projekt" → Inhalt von `sync/familien-sync.gs` einfügen, speichern.
2. **Projekteinstellungen → Skript-Eigenschaften** anlegen:
   - `FAMILIEN_SCHLUESSEL` = frei gewählter Schlüssel (z.B. 3 Wörter, merken!)
   - `SHEET_ID` = aus Schritt 2
   - `BOT_TOKEN` = aus Schritt 1
   - `CHAT_IDS` = zunächst leer lassen (kommt in Schritt 4)
3. **Bereitstellen → Neue Bereitstellung → Web-App**:
   - Ausführen als: **Ich**
   - Zugriff: **Jeder**
   - → **Web-App-URL** kopieren (endet auf `/exec`).

## 4. Chat-IDs eintragen
1. Im Script-Editor die Funktion `zeigeChatIds` ausführen (Erstlauf: Berechtigungen bestätigen).
2. Die zwei geloggten IDs als `CHAT_IDS` (kommagetrennt, z.B. `1111111,2222222`)
   in die Skript-Eigenschaften eintragen.

## 5. Täglichen Trigger anlegen
Im Script-Editor links **Trigger (Wecker-Symbol) → Trigger hinzufügen**:
- Funktion: `taeglicherDigest`
- Ereignisquelle: **Zeitgesteuert** → Tagestimer → **18:00–19:00**

## 6. App verbinden (pro Spielgerät, 3×)
Block-Land öffnen → **Eltern-Bereich → Tab 📡 Sync**:
- Web-App-URL (Schritt 3) + Familien-Schlüssel (Schritt 3.2) eintragen, „Sync aktiv" ✓, Speichern.
- „Jetzt senden" → sollte `✅ Gesendet` zeigen; im Sheet erscheinen Zeilen im Blatt „Ereignisse".

## 7. Ende-zu-Ende testen
1. Ein paar Aufgaben in der App lösen → „Jetzt senden" (oder 5 Sek. warten).
2. Sheet prüfen: neue Zeilen da?
3. Im Script-Editor `testDigest` ausführen → Log zeigt den Bericht.
4. `testSenden` ausführen → Telegram-Nachricht kommt bei **beiden** Eltern an.

## Wartung
- Neues Script-Update: Code ersetzen → **Bereitstellen → Bereitstellung verwalten → Bearbeiten →
  Version: Neu** (URL bleibt erhalten!).
- Schlüssel wechseln: Skript-Eigenschaft ändern + in allen drei Apps neu eintragen.
- Nach Update von `familien-sync.gs` (z. B. neue Rechenart-Labels wie `text: 'Textaufgaben'`):
  Script neu deployen (s. o.). Die Web-App-URL bleibt gleich; die ausgelieferten HTML-Clients
  (`BlockLand.html`) brauchen kein Update, der Trigger `taeglicherDigest` wertet die neuen
  Labels sofort aus.

## 8. Spielstand-Sync (geräteübergreifende Profile)

Ab SW v60 wandert der komplette Spielstand über das Sheet-Blatt „Zustand" (legt sich selbst an).

**Einmalig nach dem Update:**
1. Apps Script im Editor aktualisieren (Inhalt von `sync/familien-sync.gs`) →
   „Bereitstellen → Bereitstellung verwalten → Bearbeiten → Neue Version" (URL bleibt gleich).
2. Editor-Smoke-Test: `testZustand()` ausführen → Log zeigt „Zustand-Zeilen: 0".
3. **Führendes Gerät** (das mit dem richtigen Spielstand): Eltern-Bereich → Tab „📡 Sync" →
   „⬆️ Spielstand hochladen".
4. **Alle anderen Geräte:** Tab „📡 Sync" → „⬇️ Familien-Spielstand übernehmen"
   (ersetzt die dortigen lokalen Profile — Inventar/Gutscheine dieser Geräte gehen bewusst verloren,
   bei Bedarf danach über die Rohstoff-Korrektur ausgleichen).
5. Neue Geräte später: nur URL + Schlüssel eintragen, Sync aktivieren → „⬇️ übernehmen".

**Laufender Betrieb:** nichts zu tun. Abgleich beim App-Start, alle 60 Sekunden und bei
Rückkehr in den Tab. „🔄 Jetzt abgleichen" erzwingt ihn manuell.
