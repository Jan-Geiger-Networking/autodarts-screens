# Übergabe — was jetzt bei dir liegt

Stand: 2026-09-09, Branch `feature/fundament-und-live-daten`

Der erste Bauabschnitt ist fertig. Drei Schritte lassen sich nur mit deinem
Autodarts-Konto und deiner Dartscheibe erledigen. Erst danach kann der Adapter
entstehen, der die Rohereignisse in den Anzeigezustand übersetzt.

## Was läuft

- Die Anwendung startet, du wählst Monitore aus, der Player-Screen erscheint im
  Vollbild und zeigt live Rest-Score, Checkout-Weg und den aktuellen Wurf.
- Checkout-Wege und Setup-Empfehlungen sind vollständig und getestet, inklusive
  der Bogey-Zahlen.
- Aufzeichnung und Wiedergabe funktionieren ohne Netz und ohne Anmeldung.
- Anmeldung, REST- und WebSocket-Anbindung sind gebaut, aber nur so weit
  geprüft, wie es ohne Konto möglich war.
- Die rechtlichen Pflichtangaben sind vollständig, im Repository und im
  Über-Panel der Anwendung.

## Was noch fehlt

| Fehlt | Warum |
|---|---|
| Adapter von Rohereignis zu Anzeigezustand | Braucht deinen Mitschnitt, sonst wäre das Schema geraten |
| Anmeldung im Control-Fenster bedienbar | Die Knöpfe sind absichtlich deaktiviert, solange die Anmeldung nicht einmal echt durchgelaufen ist |
| Zuschauer-Screen, Installer, Auto-Update | Zweiter Bauabschnitt |

## Vorbereitung

```powershell
cd F:\DEV\autodarts-screens
npm run dev
```

Umgebungsvariablen setzt du in PowerShell so:

```powershell
$env:AD_TESTZUSTAND = "1"; npm run dev
```

In Git Bash so:

```bash
AD_TESTZUSTAND=1 npm run dev
```

| Variable | Wirkung |
|---|---|
| `AD_TESTZUSTAND=1` | Schickt einen erfundenen Spielzustand an den Player-Screen, ohne Netz und ohne Anmeldung. Zum Ansehen des Layouts. |
| `AD_AUFZEICHNEN=<pfad>` | Schreibt alle Rohereignisse der echten Verbindung mit. |
| `AD_WIEDERGABE=<pfad>` | Spielt eine Aufzeichnung ab, statt sich zu verbinden. Fordert kein Token an. |

## Schritt 1 — Anmeldung einmal durchlaufen

Die Anmeldung ist gebaut, aber noch nie mit einem echten Konto ausgeführt
worden. Sie läuft über ein eingebettetes Fenster auf der echten
Autodarts-Anmeldeseite; die Anwendung sieht dein Passwort nicht, sie fängt nur
den Rückgabe-Code ab.

Es gibt bisher keinen Knopf dafür — die Anbindung ans Control-Fenster fehlt
absichtlich, weil sie erst sinnvoll ist, wenn die Anmeldung nachweislich
funktioniert. Für diesen einen Test rufe ich `anmelden()` beim Start auf, oder
du sagst mir, dass ich den Knopf gleich mitbaue.

**Erfolgskriterium:** Das Anmeldefenster öffnet sich auf der Autodarts-Seite,
du meldest dich mit E-Mail und Passwort an, das Fenster schließt sich von
selbst, und in der Konsole steht ein Token. Beim zweiten Start erscheint kein
Anmeldefenster mehr, weil der Aktualisierungs-Token greift.

**Was ich dabei wissen muss**, weil es nur aus einer echten Serverantwort
hervorgeht: Heißen die Felder in der Antwort tatsächlich `refresh_token` und
`expires_in`, und wird der Aktualisierungs-Token bei jeder Erneuerung
ausgetauscht oder bleibt er gleich? Beides ist bisher nur abgeleitet.

**Falls die Anmeldung über Google statt über Passwort läuft:** Google
verweigert OAuth-Anmeldungen in eingebetteten Fenstern. Dein Konto hat ein
Passwort, deshalb ist das kein Problem — nimm im Anmeldefenster die
Passwort-Anmeldung, nicht den Google-Knopf.

## Schritt 2 — Board-Kennung ermitteln

Nach erfolgreicher Anmeldung:

```
GET https://api.autodarts.com/bs/v0/boards
```

Der Pfad ist geprüft und existiert. Was ich brauche: die Kennung deines Boards
und die tatsächlichen Feldnamen der Antwort. Ich weiß bisher nur, dass der
Endpunkt antwortet, nicht wie seine Antwort aussieht.

## Schritt 3 — Ein Match mitschneiden

Das ist der wichtigste Schritt. Der Mitschnitt ist die einzige Quelle der
Wahrheit über das Ereignis-Schema von Autodarts — es ist nirgends
dokumentiert, und alle Community-Projekte, die ich gefunden habe, beschreiben
noch den im Juni 2026 abgeschalteten Keycloak-Server.

```powershell
$env:AD_AUFZEICHNEN = "docs\fixtures\match.jsonl"; npm run dev
```

Dann auf autodarts.io ein X01-Match starten und **ein vollständiges Leg**
spielen. Wichtig, damit die Fälle abgedeckt sind:

- mindestens einmal überwerfen (Bust)
- mindestens einmal der Wechsel zum anderen Spieler
- wenn möglich ein Leg zu Ende ausmachen

Danach die Anwendung beenden. Die Datei landet unter
`docs/fixtures/match.jsonl`.

**Bitte vorher hineinschauen:** Der Mitschnitt enthält Anzeigenamen aus deinem
Konto — das ist gewollt, damit die Testdaten realistisch sind. Er darf aber
kein Token und keine E-Mail-Adresse enthalten. Falls doch, ersetze diese Werte
durch `"<entfernt>"`, bevor die Datei committet wird.

Der Name `match.jsonl` ist für den echten Mitschnitt reserviert. Unter
`docs/fixtures/beispiel-wiedergabe.jsonl` liegt eine von Hand erfundene Datei
mit fünf Ereignissen; sie belegt nur, dass die Wiedergabe läuft, und taugt
nicht zum Ableiten des Schemas.

## Schritt 4 — Zurück an mich

Sag mir, dass der Mitschnitt da ist. Dann baue ich den Adapter gegen die echten
Ereignisse und der Player-Screen zeigt dein Match statt eines erfundenen
Zustands.

## Unbestätigte Annahmen

Diese Punkte stehen im Code als Annahme markiert. Sie fallen bei Schritt 3
entweder auf oder bestätigen sich:

| Annahme | Wo |
|---|---|
| `POST /ms/v0/tickets` liefert das Ticket in einem bestimmten Antwortformat | `src/autodarts/websocket.ts` |
| Die WebSocket-Adresse lautet `wss://api.autodarts.com/ms/v0/subscribe?ticket=<ticket>` | `src/autodarts/websocket.ts` |
| Abonnements haben die Form `{"channel","type":"subscribe","topic"}` | `src/autodarts/websocket.ts` |
| Die Kanal- und Themennamen für Board und Match | `src/autodarts/websocket.ts` |
| Das Feld, das die Match-Kennung trägt | `src/autodarts/websocket.ts` |
| Feldnamen `refresh_token` und `expires_in` in der Token-Antwort | `src/autodarts/oauth.ts` |

Der Pfad `/ms/v0/tickets` selbst ist geprüft. Die Variante im Singular
existiert nicht — das steht in mehreren Community-Projekten falsch.

## Offene Entscheidung von dir

Bei Rest 48 empfiehlt die Checkout-Logik `8 → D20`. Viele Tabellen lehren
`16 → D16`, weil bei D16 beide Nachbarfelder 8 sind und ein Fehlwurf eine
gerade Zahl übrig lässt, während D20 die Nachbarn 1 und 5 hat. Dasselbe Muster
bei Rest 56 (`16 → D20` statt `T8 → D16`).

Beide Wege sind gültig. Die Vorliebe steht als Kommentar über
`BEVORZUGTE_DOPPEL` in `src/shared/checkout.ts` und ist eine Änderung an einer
Stelle, falls du die D16-Kette bevorzugst.

## Nützliches

```powershell
npm test           # Testlauf
npm run typecheck  # Typprüfung
npm run build      # Produktionsbau nach out\
```

Der Screenshot des Player-Screens liegt unter `docs/screenshots/player.png`.
Die ermittelten API-Endpunkte samt Quelle und Vertrauensgrad stehen in
`docs/autodarts-api.md`.
