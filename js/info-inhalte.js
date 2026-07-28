// ℹ️ Info-Bereich — reine Inhalts-Daten (Darstellung: js/info.js).
// Drei Seiten für drei Leser: Skeptiker (Über), Betreiber (Anleitung), Nachbauer (Konzept).
// Statischer, von uns verfasster Inhalt — kein escapeHtml nötig, KEINE User-Strings einmischen.
// Regeln (geprüft von tools/check-info-inhalte.mjs): einziger externer Link ist EINRICHTUNG.md;
// Querverweise zwischen Seiten via <a href="#" data-info-ziel="...">.

export const INFO_SEITEN = [
  {
    id: 'ueber', tabLabel: 'Über', icon: 'ℹ️',
    intro: 'Block-Land ist eine Mathe-Lern-App im Minecraft-Stil — gebaut von einem Papa für seine zwei Jungs. Hier steht offen, was die App tut, wie sie aufgebaut ist und worauf sie beim Lernen setzt.',
    kapitel: [
      {
        emoji: '📡', titel: 'Was passiert mit den Daten?', offen: true,
        inhaltHtml: `
          <p><strong>Alles bleibt bei eurer Familie.</strong></p>
          <ul>
            <li>Der Spielstand liegt im Browser-Speicher des Geräts — <strong>kein Konto, keine Anmeldung, keine Cloud-Pflicht</strong>. Die App funktioniert komplett offline.</li>
            <li>Der Familien-Sync (freiwillig) läuft über ein <strong>eigenes, privates Google Sheet</strong>, das die Eltern selbst anlegen und besitzen. Es gibt keinen Server des App-Machers.</li>
            <li>Telegram-Nachrichten (Lern-Bericht, Gutschein-Anfragen) gehen ausschließlich an <strong>Mama und Papa</strong> — über einen Bot, den die Familie selbst betreibt.</li>
            <li><strong>Keine Werbung, keine Tracker, keine Analyse-Dienste, keine In-App-Käufe.</strong></li>
          </ul>`,
      },
      {
        emoji: '🗺️', titel: 'Wie ist die App aufgebaut?', offen: true,
        inhaltHtml: `
          <ul>
            <li><strong>Eine Welt aus Biomen</strong> — jedes Biom ist eine Rechenart: Mengen-Wiese (Vorschule), Würfel-Teich (bis 10), Plus-Wald, Minus-Höhle, Mal-Berg, Geteilt-Schlucht, das Geschichten-Dorf (Textaufgaben) und das Zeitenland (Uhrzeit ablesen).</li>
            <li><strong>Aufgaben mit Vorlese-Pflicht:</strong> Erst laut vorlesen, dann rechnen — Lesen übt mit.</li>
            <li><strong>Die Belohnungskette:</strong> Richtig gelöste Aufgaben geben Rohstoffe (🪵 🪨 🌸) → in der Werkstatt werden daraus Gutscheine gebaut → eingelöst wird nur mit Zustimmung von Mama und Papa.</li>
            <li><strong>Tagesauftrag:</strong> Wenige Aufgaben pro Tag füllen eine Schatztruhe — bewusst klein gehalten, damit tägliches Üben leicht fällt.</li>
          </ul>`,
      },
      {
        emoji: '🎓', titel: 'Nach welchen Lernkonzepten?', offen: true,
        inhaltHtml: `
          <ul>
            <li><strong>Mengen sichtbar machen:</strong> Zehnerhaus und Würfelbilder (nach Christine Strauß-Ehret) zeigen Zahlen als Mengen, nicht nur als Ziffern.</li>
            <li><strong>Adaptive Schwierigkeit:</strong> Die Stufe steigt und fällt automatisch mit den Ergebnissen; bei Mühe wechselt die App auf einen zweiten Lösungsweg (Mengen selbst legen statt Antwort tippen).</li>
            <li><strong>Kein Frust-Loop:</strong> Nach zwei Fehlversuchen wird die Lösung gezeigt und es geht weiter. <strong>Kein Streak-Zwang</strong>, keine Bestrafung für Pausen.</li>
            <li><strong>Gesunde Grenzen:</strong> Übungs-Timer mit Pausen (angelehnt an Lern-Studien) und Nacht-Sperre — Schlaf schlägt Lernen.</li>
            <li><strong>Ehrliche Grenze:</strong> Block-Land ergänzt Schule und Elternhaus — es ersetzt keinen Unterricht und keine Förderdiagnostik.</li>
          </ul>`,
      },
    ],
  },
  {
    id: 'anleitung', tabLabel: 'Anleitung', icon: '📖',
    intro: 'Das Betriebshandbuch für Eltern: von den ersten Schritten in der App bis zum zugesperrten Kinder-Handy. Kapitel antippen zum Aufklappen.',
    kapitel: [
      {
        emoji: '🚀', titel: 'Erste Schritte in der App',
        inhaltHtml: `
          <ol>
            <li>Unten auf der Startseite <strong>⚙️ Eltern-Bereich</strong> öffnen (beim ersten Mal eine Eltern-PIN festlegen).</li>
            <li>Im Tab <strong>🧒 Kinder</strong> für jedes Kind ein Profil anlegen — die Altersstufe (Kindergarten bis 3. Klasse) bestimmt, welche Aufgaben und Biome es bekommt. Jedes Kind tauft seine eigene Welt.</li>
            <li>Das Kind wählt auf der Startseite sein Bild — und steht in seiner Welt. Antippbare Felder (Baum, Stein, Blume …) starten Aufgaben, richtige Antworten geben Rohstoffe.</li>
            <li>Die Tafel „📜" in der Welt zeigt den <strong>Tagesauftrag</strong>: wenige Aufgaben pro Tag, dann öffnet sich eine Schatztruhe.</li>
          </ol>`,
      },
      {
        emoji: '⚙️', titel: 'Eltern-Bereich einrichten',
        inhaltHtml: `
          <ul>
            <li><strong>🎁 Belohnungen:</strong> Der Gutschein-Katalog eurer Familie — Namen, Emojis, Preise (Rohstoff-Kosten) frei gestaltbar. Faustregel: Ein Gutschein = ein Gerät = eine klare Belohnung („📱 15 Min Handy-Zeit", „🕹️ 30 Min Switch"). Hier liegt auch der Übungs-Timer (Üben-/Pausen-Zeiten pro Kind, Standard nach Lern-Studien).</li>
            <li><strong>🎟️ Gutscheine:</strong> Was die Kinder gebaut haben — hier wird vor Ort eingelöst, wenn das Kind direkt daneben steht.</li>
            <li><strong>🧒 Kinder:</strong> Profile, Altersstufe und Kind-PIN.</li>
            <li><strong>📡 Sync:</strong> Web-App-URL und Familien-Schlüssel eintragen (bekommt ihr aus der technischen Ersteinrichtung — siehe Kapitel „Nachbau" bzw. den Admin eurer Familie), dann „Sync aktiv" ✓. Ab jetzt: Lern-Bericht per Telegram und gemeinsamer Spielstand auf allen Geräten.</li>
            <li><strong>📊 Statistik:</strong> Familienweite Lern-Statistik mit Förder-Kompass (wo hakt es, was läuft sicher).</li>
          </ul>`,
      },
      {
        emoji: '🔓', titel: 'Warum öffnen die Reihen nacheinander?',
        inhaltHtml: `
          <p>Im Mal- und im Geteilt-Berg ist am Anfang nicht jede Reihe (1er bis 10er) gleichzeitig da —
            sie schalten sich <strong>Schritt für Schritt frei</strong>, in einer festen, fachlich
            begründeten Reihenfolge (Tab <strong>🔓 Reihen</strong> im Eltern-Bereich). Grund: Ein Kind,
            das sich frei zwischen zehn Reihen aussuchen darf, übt selten dort, wo es am meisten bringt.
            Die Freischaltung sorgt für <strong>Festigung statt Beliebigkeit</strong> — erst sitzt eine
            Reihe wirklich, dann kommt die nächste.</p>
          <p>Die Reihenfolge ist nicht 1 bis 10, sondern folgt dem, was am Rechnen leicht oder schwer ist:</p>
          <ol>
            <li><strong>1er, 2er</strong> — Einstieg, Verdoppeln, denkbar leicht</li>
            <li><strong>10er</strong> — eine der beiden wichtigsten Reihen (Zehnerschritte)</li>
            <li><strong>5er</strong> — die andere wichtigste Reihe („Kraft der 5")</li>
            <li><strong>4er</strong> — Verdoppeln der 2er</li>
            <li><strong>3er</strong> — knüpft an die 2er und die 10er an</li>
            <li><strong>6er</strong> — Verdoppeln der 3er</li>
            <li><strong>9er</strong> — ein weniger als die 10er</li>
            <li><strong>8er</strong> — Verdoppeln der 4er, enthält 8·8</li>
            <li><strong>7er</strong> — zuletzt, enthält 7·8 — die letzte wirklich schwere Aufgabe</li>
          </ol>
          <p><strong>Wann öffnet die nächste Reihe?</strong> Sobald die aktuelle Reihe an <strong>zwei
            unterschiedlichen Tagen</strong> mit <strong>höchstens einem Fehler von zehn</strong> Fragen
            abgeschlossen wurde. Ein einzelner guter Abend reicht bewusst nicht — erst zwei Tage zeigen,
            dass es wirklich sitzt.</p>
          <p><strong>Der Umweg (keine Sackgasse):</strong> Klemmt eine Reihe drei Tage lang, öffnet die
            App die nächste trotzdem. Kein Kind bleibt an einer einzelnen schwierigen Reihe hängen —
            dranbleiben lohnt sich also so oder so.</p>
          <p><strong>Der Eltern-Regler</strong> (Tab 🔓 Reihen): zeigt je Kind und Rechenart die aktuelle
            Stufe und lässt sie händisch setzen — nach oben (z.B. wenn ein Kind die Reihen längst aus der
            Schule kann) oder nach unten. <strong>Nicht setzen, während das Kind gerade spielt</strong> —
            ein Sprung mitten in einer Sitzung wirkt für das Kind wie ein Rucken im Boden unter den Füßen.</p>
          <p><strong>Die 1er-Reihe ist ein Sonderfall:</strong> Für Vorschul- und Erstklasskinder ist sie
            der schnelle erste Erfolg direkt am Anfang. Größere Kinder sehen sie im Berg nur noch als
            freiwillig antippbare Kachel — in Prüfungen, im Umweg-Kriterium und in Wiederholungen taucht
            die 1er nicht mehr auf, weil „mal 1" nichts zu rechnen gibt. Einen eigenen Abschalt-Schalter
            dafür gibt es deshalb bewusst nicht.</p>`,
      },
      {
        emoji: '✅', titel: 'Gutschein-Freigabe bedienen (Telegram)',
        inhaltHtml: `
          <p>Kind tippt in der Werkstatt auf <strong>„📨 Mama &amp; Papa fragen"</strong> → bei beiden Eltern klingelt Telegram → <strong>wer zuerst drückt, entscheidet</strong> (✅ Freigeben / 🌙 Jetzt nicht). Danach genau ein Handgriff — je nach Gutschein-Sorte (Handy: Bonuszeit geben, Switch: heute verlängern, Folge: am TV starten).</p>
          <p><strong>Die Spielregeln:</strong></p>
          <ol>
            <li>Freigegebene Zeit = exakt Gutschein-Höhe (sonst entwertet ihr die Werkstatt-Preise).</li>
            <li>🌙 „Jetzt nicht" ist kein Nein für immer — der Gutschein bleibt, das Kind darf später neu fragen.</li>
            <li>Offene Anfragen erinnern euch am Vormittag von selbst per Telegram.</li>
            <li>Kind steht neben euch? Einfach im Eltern-Bereich vor Ort einlösen — eine offene Anfrage zieht sich automatisch zurück.</li>
            <li>Nichts muss zurückgedreht werden: Zeit läuft ab, das System sperrt sich selbst.</li>
            <li>Beim ✅ zuverlässig liefern, beim 🌙 konsequent bleiben — das ist die pädagogische Hälfte des Systems.</li>
          </ol>`,
      },
      {
        emoji: '🔒', titel: 'Kinder-Handy zusperren (Google Family Link)',
        inhaltHtml: `
          <p>Ziel: Das Handy ist standardmäßig <strong>zu</strong> — nur Block-Land läuft immer. Alles andere gibt es über erarbeitete Bonuszeit. So richtet ihr das ein (Android-Gerät mit beaufsichtigtem Google-Konto):</p>
          <ol>
            <li><strong>Tageslimit auf 0 Minuten</strong> stellen (täglich, auch im Wochenplan). Optional eine Ruhezeit für die Nacht — sie sperrt ALLES, auch Block-Land (Schlaf schlägt Lernen).</li>
            <li><strong>Block-Land freischalten:</strong> In Chrome die App-Seite öffnen und „App installieren". Achtung, häufige Falle: Die installierte App taucht in Family Link als <strong>eigener Eintrag „Block-Land"</strong> auf und ist anfangs blockiert — in den App-Limits auf <strong>„Immer erlauben"</strong> stellen. <strong>Chrome ebenfalls</strong> auf „Immer erlauben" (die PWA braucht beides).</li>
            <li><strong>Chrome-Whitelist:</strong> In Family Link unter Websites „Nur zugelassene Websites" wählen und nur die Block-Land-Adresse erlauben — Chrome kann dann nichts anderes öffnen.</li>
            <li><strong>Sperrbildschirm-Einstellung:</strong> Family Link → Geräteeinstellungen → „Einstellungen für Sperrbildschirm" → <strong>„Apps ohne Zeitlimit"</strong> wählen — so läuft Block-Land auch, wenn ihr das Gerät manuell sperrt.</li>
            <li><strong>Andere Browser blockieren</strong> (z.B. Samsung Internet) — die Website-Whitelist gilt nur in Chrome, jeder andere Browser wäre ein Loch.</li>
            <li><strong>Alles Übrige blockieren</strong>, was die Kinder nicht brauchen (Stores, YouTube, Cloud- und System-Apps). Harmloses (Rechner, Kamera …) könnt ihr mit App-Limits deckeln — die wirken als Obergrenze innerhalb der Bonuszeit.</li>
            <li><strong>Nicht alles ist blockierbar:</strong> Einstellungen und Telefon nimmt Family Link aus. Die kritischen Hebel (Beaufsichtigung beenden, Konten) sind trotzdem geschützt; beim Play Store helfen strenge Altersfreigaben + Genehmigungspflicht für Installationen.</li>
          </ol>
          <p><strong>So funktioniert die Freigabe danach:</strong> Bonuszeit (in Family Link, 2 Taps) öffnet das Gerät für X Minuten — für alle nicht-blockierten Apps. Blockiertes bleibt zu, „Immer erlauben" läuft immer, und nach Ablauf sperrt sich alles von selbst. Zeit vorzeitig beenden: Bonuszeit löschen (nicht „Gerät sperren" — das ist die Notbremse für alles).</p>`,
      },
      {
        emoji: '🕹️', titel: 'Switch & Fernseher',
        inhaltHtml: `
          <ul>
            <li><strong>Nintendo Switch:</strong> Die Nintendo-Altersbeschränkungen-App kann die Spielzeit <strong>„für heute verlängern"</strong> — der perfekte Hebel: exakt dosierbar und stellt sich morgen von selbst zurück. Gutschein freigegeben → Minuten für heute dazu geben, fertig.</li>
            <li><strong>Fernseher (Netflix, Prime &amp; Co.):</strong> Hier gibt es keinen feinen Software-Hebel — es gilt das <strong>Anwesenheits-Prinzip</strong>: Die Folge wird von euch gestartet, wenn es passt. Der Gutschein regelt das „ob", ihr regelt das „wann".</li>
          </ul>`,
      },
    ],
  },
  {
    id: 'nachbau', tabLabel: 'Nachbau', icon: '🧭',
    intro: 'Ihr wollt das Gesamtsystem für eure eigene Familie? Hier steht, wie es zusammenspielt und wie ihr es Schritt für Schritt nachbaut — die App selbst ist kostenlos und der einzige Einstiegspunkt, den ihr braucht.',
    kapitel: [
      {
        emoji: '💡', titel: 'Die Idee in einem Absatz',
        inhaltHtml: `
          <p>Lernen erzeugt Rohstoffe → die Werkstatt macht daraus <strong>Gutscheine</strong> → die Eltern geben per <strong>Telegram-Knopf</strong> frei → das Kind bekommt <strong>echte Freizeit</strong> (Handy-Minuten, Switch-Zeit, eine Folge). Das Gerät ist standardmäßig zu, das Kind schaltet es sich selbst frei — und <strong>Lernen ist niemals gesperrt</strong>. Aus „darf ich…?" wird „ich hab's mir verdient". Der Anker-Satz für die Kinder: <strong>„Euer Land ist nie zu."</strong></p>`,
      },
      {
        emoji: '🧺', titel: 'Zutaten-Liste',
        inhaltHtml: `
          <ul>
            <li><strong>Die App</strong> — läuft in jedem Browser, kostenlos, ohne Konto (diese hier).</li>
            <li><strong>Ein Google-Konto</strong> — für ein privates Google Sheet + Apps Script (euer eigener „Familien-Server", kostenlos).</li>
            <li><strong>Telegram</strong> — ein eigener Bot (in 2 Minuten beim BotFather angelegt) schickt Lern-Berichte und Gutschein-Anfragen an beide Eltern.</li>
            <li><strong>Google Family Link</strong> — sperrt das Kinder-Handy zu und gibt Bonuszeit frei.</li>
            <li><strong>Optional: Nintendo-Altersbeschränkungen-App</strong> — derselbe Trick für die Switch.</li>
          </ul>`,
      },
      {
        emoji: '🛤️', titel: 'Der Fahrplan (4 Phasen — hier am Handy starten)',
        inhaltHtml: `
          <p><strong>Ihr könnt genau hier beginnen, wo ihr gerade lest</strong> — am Handy. Nur Phase 2 braucht einmalig einen PC; die Anleitung sagt euch, wann ihr wechselt und wann ihr zurückkommt.</p>
          <ol>
            <li><strong>📱 Am Handy — einfach spielen (sofort, 0 Min Setup):</strong> Diese App ist schon die richtige. Profil anlegen (⚙️ Eltern-Bereich → 🧒 Kinder), üben lassen, Rohstoffe sammeln, in der Werkstatt den ersten Gutschein bauen. Alles läuft lokal — einlösen geht in dieser Phase direkt bei euch (Eltern-Bereich → 🎟️ Gutscheine).</li>
            <li><strong>💻 Einmalig an den PC — euer Familien-Server (~20 Min):</strong> Öffnet dort die Schritt-für-Schritt-Anleitung <a href="https://github.com/DaMagicCosta/block-land/blob/main/sync/EINRICHTUNG.md">sync/EINRICHTUNG.md</a> (Google Sheet + Apps Script + Telegram-Bot — alles kostenlos, alles in eurem Besitz). <strong>Am Ende habt ihr zwei Werte:</strong> die Web-App-URL und euren Familien-Schlüssel. <strong>Damit zurück ans Handy:</strong> Eltern-Bereich → 📡 Sync → beide Werte eintragen, „Sync aktiv" ✓ — ab jetzt klingelt euer Telegram (siehe <a href="#" data-info-ziel="anleitung">📖 Anleitung</a>).</li>
            <li><strong>📱 Am Eltern-Handy — Kinder-Handy zusperren (~30 Min):</strong> Family Link nach dem Rezept in der <a href="#" data-info-ziel="anleitung">📖 Anleitung</a> konfigurieren — Tageslimit 0, Block-Land „Immer erlauben", Website-Whitelist, Browser-Löcher schließen.</li>
            <li><strong>📱 Feinschliff — Belohnungs-Katalog anpassen:</strong> Preise und Gutschein-Sorten an eure Familie anpassen (Eltern-Bereich → 🎁 Belohnungen). Faustregel: ein Gutschein = ein Gerät = ein Eltern-Handgriff.</li>
          </ol>
          <p><strong>Das Ergebnis, wenn ihr allen vier Phasen gefolgt seid:</strong> Das Kind tippt in der Werkstatt „📨 Mama &amp; Papa fragen" → euer Telegram klingelt → ein Tipp auf ✅ → Bonuszeit bzw. Switch-Minuten geben — fertig. Das Kinder-Handy ist sonst zu, Lernen geht immer. Genau so läuft es täglich in der Familie, die diese App gebaut hat.</p>`,
      },
      {
        emoji: '⚖️', titel: 'Ehrliche Grenzen',
        inhaltHtml: `
          <ul>
            <li><strong>Family Link hat keine Schnittstelle</strong> — die letzte Meile jeder Freigabe bleibt ein manueller Eltern-Handgriff (~10 Sekunden: Bonuszeit geben bzw. Switch verlängern). Vollautomatik gibt es nicht, und Bastel-Umgehungen wären gegen die Nutzungsbedingungen.</li>
            <li><strong>Bonuszeit wirkt geräteweit:</strong> In erarbeiteter Handy-Zeit sind alle nicht-blockierten Apps nutzbar — bei einer aufgeräumten Blockiert-Liste ist der Beifang minimal.</li>
            <li><strong>Das System erzieht nicht für euch:</strong> Es macht Absprachen sichtbar und Freigaben mühelos — zuverlässig liefern und konsequent bleiben müsst ihr selbst. Was die App dabei tut und lässt, steht unter <a href="#" data-info-ziel="ueber">ℹ️ Über Block-Land</a>.</li>
          </ul>`,
      },
      {
        emoji: '📲', titel: 'Weitergeben',
        inhaltHtml: `
          <p>Einfach dieses Handy zeigen — Kamera drauf, fertig:</p>
          <p class="info__qr"><img src="qr-app.svg" alt="QR-Code zur Block-Land-App" width="220" height="220"></p>
          <p class="info__link-zeile"><code>https://damagiccosta.github.io/block-land/</code></p>
          <p><button class="info__kopieren" data-kopieren="https://damagiccosta.github.io/block-land/">📋 Link kopieren</button></p>
          <p>Die App ist kostenlos, braucht kein Konto und läuft in jedem Browser — den Rest erklärt dieser Info-Bereich.</p>`,
      },
    ],
  },
];
