# Änderungen

Das Format folgt Keep a Changelog, die Versionierung folgt Semantic Versioning.

## [Unveröffentlicht]

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
