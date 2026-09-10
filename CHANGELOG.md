# Änderungen

Das Format folgt Keep a Changelog, die Versionierung folgt Semantic Versioning.

## [Unveröffentlicht]

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
