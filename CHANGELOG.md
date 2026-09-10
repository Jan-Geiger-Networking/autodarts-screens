# Änderungen

Das Format folgt Keep a Changelog, die Versionierung folgt Semantic Versioning.

## [Unveröffentlicht]

## [0.1.0-beta.4] - 2026-09-10

Vierte Beta. Der Kreis schließt sich: ein Wurf auf der Scheibe erreicht jetzt
beide Bildschirme.

### Hinzugefügt
- Der Adapter, der bisher in jeder Version gefehlt hat. Er übersetzt die
  Rohereignisse des Match-Kanals in den Anzeigezustand, den Player- und
  Zuschauer-Screen darstellen: Rest-Punktzahlen, aktueller Spieler, die drei
  Darts des laufenden Wurfs, Leg- und Satzstand, Average und Checkout-Quote
- Checkout-Weg und Setup-Wurf werden aus der Rest-Punktzahl selbst berechnet,
  nicht vom Server übernommen
- Spielerwechsel, 180er, High Finish, Leg- und Match-Gewinn werden aus dem
  Vergleich mit dem vorherigen Zustand abgeleitet und lösen die Szenen des
  Zuschauer-Screens aus
- Die Anwendung abonniert den Zustandskanal eines Matches, sobald das Board
  eines meldet. Bis hierher wurde nur das Board selbst abonniert, es kamen
  also nie Wurf-Ereignisse an
- Jedes Match wird ab dieser Version automatisch nach
  `%APPDATA%\autodarts-screens\mitschnitte\` aufgezeichnet. Ohne einen
  echten Mitschnitt lässt sich der Adapter nicht gegen die Wirklichkeit
  prüfen (siehe „Bekannte Einschränkungen")

### Geändert
- Vorspann: die Fahrt zwischen zwei Folien ist langsamer (1200 statt 700
  Millisekunden), das Logo größer, und zwischen zwei Leistungsfolien schiebt
  sich eine eigene Folie „Es geht gleich los" durch das Bild
- Ein Fehler im Adapter reißt die Verbindung nicht ab. Der zuletzt bekannte
  Zustand bleibt auf beiden Bildschirmen stehen, der Fehler landet im
  Diagnoseprotokoll

### Bekannte Einschränkungen
- Die Feldnamen **innerhalb** der Ereignisse sind teilweise geraten. Die
  äußere Form des Zustands ist aus einem echten Protokoll belegt; was genau
  in `players`, `turns`, `gameScores` und `stats` steht, konnte mangels
  Mitschnitt eines echten Matches nicht überprüft werden. Der Adapter meldet
  jede solche Annahme einmalig im Diagnoseprotokoll (Zeilen mit `Adapter:`).
  Bleiben Felder leer oder stehen falsche Zahlen auf dem Bildschirm, liegt
  die Ursache mit hoher Wahrscheinlichkeit hier — der Mitschnitt des
  betroffenen Matches genügt, um es zu berichtigen
- Der Satzstand ist die schwächste Ableitung: es gibt kein erkanntes Signal
  für das Ende eines Satzes
- Keine Selbstaktualisierung

## [0.1.0-beta.3] - 2026-09-10

Dritte Beta. Anmeldung und Verbindung funktionieren jetzt wirklich, und die
Anwendung hört auf dem Board mit.

### Behoben
- Der Verbindungsaufbau scheiterte unmittelbar nach jeder erfolgreichen
  Anmeldung. Zwei Annahmen aus Community-Projekten waren falsch, beide gegen
  den echten Server belegt: das WebSocket-Ticket kommt im Feld `code` statt
  als reine Zeichenkette, und der Subscribe-Endpunkt erwartet den Parameter
  `code` statt `ticket`. Mit `ticket` antwortete der Server `unauthorized` —
  er ignorierte den unbekannten Parameter und behandelte die Anwendung wie
  nicht angemeldet
- Ein Fehler bei der Anmeldung blieb unsichtbar: das Control-Fenster zeigte
  nichts an, und es gab nichts zum Nachlesen
- Statt des Kontonamens stand „Angemeldet als: angemeldet" im
  Control-Fenster

### Hinzugefügt
- Die Anwendung abonniert das eingestellte Board und erkennt ein startendes
  Match. Ohne eingetragene Board-Kennung wird das ausdrücklich gemeldet,
  statt stumm zu bleiben
- Diagnoseprotokoll unter `%APPDATA%\autodarts-screens\diagnose.log`, im
  Control-Fenster verlinkt. Es enthält Hosts, Pfade, Statuscodes und die
  Namen von Antwortfeldern — niemals Token, Codes oder Passwörter
- Verständliche Fehlermeldungen im Control-Fenster statt Schweigen
- Der Kontoname wird angezeigt. Er stammt aus dem Zugriffstoken selbst, ohne
  zusätzlichen Abruf
- Vorspann auf dem Zuschauer-Screen: solange kein Match läuft, zeigt er im
  festen Takt die Leistungen des Herausgebers statt nur des Logos

### Fehlt in dieser Version
- Der Adapter, der Rohereignisse in die Anzeige übersetzt. Beide Screens
  zeigen deshalb weiterhin kein laufendes Match — die Ereignisse kommen an
  und lassen sich aufzeichnen, aber noch nicht darstellen
- Keine Selbstaktualisierung

## [0.1.0-beta.2] - 2026-09-10

Zweite Beta. Bringt den Zuschauer-Screen.

### Hinzugefügt
- Zuschauer-Screen im Broadcast-Look: zwei Spielertafeln mit großen
  Rest-Punktzahlen, Leg- und Satzstand in der Mitte, Statistikleiste und
  Leg-Verlauf am unteren Rand
- Sieben Szenen, die sich aus dem Match-Zustand ableiten: Ruhezustand,
  Spieler-Vorstellung, Scoreboard, Spielerwechsel, 180er und High Finish,
  Leg-Gewinn und Match-Gewinn
- Beim Spielerwechsel wandert eine grüne Signalkante über die Trennfuge zur
  Tafel des Spielers, der an der Reihe ist
- Vorführmodus: der Zuschauer-Screen spielt mit dem Abfrageparameter
  `?vorfuehrung` alle Szenen ohne laufendes Match durch, zum Einrichten des
  Monitors

### Geändert
- Der Zuschauer-Screen kommt ohne Animationsbibliothek aus. Die Übergänge
  laufen über CSS, das spart eine Abhängigkeit im Installer

### Fehlt in dieser Version
- Keine Selbstaktualisierung: die Anwendung prüft nicht auf neue Versionen und
  aktualisiert sich nicht selbst; eine neue Version muss von Hand
  heruntergeladen und installiert werden
- Der Autodarts-Adapter (Rohereignis zu Anzeigezustand) fehlt noch, deshalb
  zeigen Player- und Zuschauer-Screen noch keine echten Live-Match-Daten an.
  Anmeldung und Verbindung funktionieren bereits; zum Ansehen der Layouts
  dienen ein synthetischer Testzustand (`AD_TESTZUSTAND=1`), die Wiedergabe
  einer Aufzeichnung (`AD_WIEDERGABE`) und der Vorführmodus

## [0.1.0-beta.1] - 2026-09-10

Erste Beta. Zum Ausprobieren auf dem Zielrechner, nicht für den produktiven
Turniereinsatz — siehe „Fehlt in dieser Version" unten.

### Hinzugefügt
- Projektgerüst mit Electron, Vite, React und TypeScript
- Rechtliche Pflichtangaben
- Anmeldung bei Autodarts per OAuth Authorization Code + PKCE im eingebetteten Fenster
- Live-Anbindung an die Autodarts-API
- Aufzeichnung und Wiedergabe von Match-Ereignissen
- Monitor-Auswahl für Player- und Spectator-Screen im Control-Fenster
- Player-Screen mit Rest-Score, Checkout-Weg und aktuellem Wurf
- Über-Panel mit Herausgeberangaben, Datenschutz- und Sicherheitshinweisen
- Funktion „Alle lokalen Daten löschen" im Control-Fenster
- Unsignierter Windows-Installer (NSIS, pro Nutzer, ohne Administratorrecht)
- Fremdlizenzen-Dokument (`THIRD-PARTY-LICENSES.md`) für die mitgelieferten
  Produktionsabhängigkeiten und die Electron-Laufzeit
- Stückliste (CycloneDX) als Anhang dieses Releases

### Fehlt in dieser Version
- Kein Zuschauer-Screen (Spectator): die Monitor-Auswahl dafür existiert im
  Control-Fenster, die Broadcast-Ansicht selbst ist noch nicht gebaut
- Keine Selbstaktualisierung: die Anwendung prüft nicht auf neue Versionen und
  aktualisiert sich nicht selbst; eine neue Version muss von Hand
  heruntergeladen und installiert werden
- Der Autodarts-Adapter (Rohereignis zu Anzeigezustand) fehlt noch, deshalb
  zeigt der Player-Screen noch keine echten Live-Match-Daten an. Anmeldung
  und Verbindung funktionieren bereits; zum Ansehen des Layouts dient ein
  synthetischer Testzustand (`AD_TESTZUSTAND=1`) oder die Wiedergabe einer
  Aufzeichnung (`AD_WIEDERGABE`)
