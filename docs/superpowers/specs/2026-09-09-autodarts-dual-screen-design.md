# Autodarts Dual-Screen — Design

Stand: 2026-09-09
Status: freigegeben

## 1. Ziel

Eine Windows-Anwendung, die während eines Autodarts-Matches zwei Monitore im
Vollbild bespielt:

- **Player-Screen** — steht neben der Dartscheibe. Zeigt den Rest-Score, den
  empfohlenen Checkout-Weg und die drei Darts des laufenden Wurfs. Dunkel und
  bewegungsarm, damit er niemanden aus dem Wurf holt.
- **Spectator-Screen** — steht bei den Zuschauern. Zeigt dasselbe Match im
  Broadcast-Look: großes Scoreboard, animierte Spielerwechsel, Live-Statistiken
  und Einblendungen bei 180ern und High Finishes.

Beide Monitore werden vom Nutzer in der Anwendung ausgewählt. Die Anwendung
aktualisiert sich selbständig über GitHub Releases.

## 2. Nicht-Ziele für v1

Bewusst ausgeklammert, mit den Andockpunkten für später:

| Thema | Warum nicht in v1 | Andockpunkt |
|---|---|---|
| Cricket und andere Modi | Eigene Darstellung auf beiden Screens, verdoppelt den UI-Aufwand | Fallback-Scoreboard ohne Modus-Logik ist vorhanden |
| Ton und Ansagen | `autodarts-caller` löst das bereits besser | — |
| OBS-/Streaming-Ausgabe | Kein aktueller Bedarf | Spectator-Renderer ist eine reine Web-Ansicht und ließe sich später über einen lokalen HTTP-Server als Browser-Source anbieten |
| Turnierverwaltung | Deutlich größeres Thema | — |
| Mehr als 4 Spieler | Praktisch irrelevant | Raster-Layout skaliert |

## 3. Technische Entscheidungen

| Entscheidung | Gewählt | Begründung |
|---|---|---|
| Laufzeit | Electron | Zwei Vollbild-Fenster auf verschiedenen Monitoren sind eine eingebaute Fähigkeit. `electron-updater` gegen GitHub Releases ist gelöster Standard. Die Broadcast-Animationen sind mit CSS und JavaScript um Größenordnungen billiger als nativ. |
| UI | React + TypeScript + Vite | Szenen-Umschaltung und Zustandsableitung sind der Kern der Spectator-Ansicht |
| Animation | Framer Motion | `AnimatePresence` orchestriert Ein- und Ausblendungen ganzer Szenen; von Hand geschriebene CSS-Transitions werden bei überlappenden Szenenwechseln unübersichtlich |
| Authentifizierung | offen, siehe Abschnitt 5.2 | Der Device Authorization Grant ist für die Client-Kennung von Autodarts gesperrt (eigener Test). Es bleiben zwei Wege, die sich in der Zusage unterscheiden, kein Passwort entgegenzunehmen. Die Entscheidung liegt beim Herausgeber. |
| Token-Ablage | `safeStorage` (Electron, DPAPI) | Eingebaut, kein zusätzliches natives Modul |
| Installer | `electron-builder`, NSIS, unsigniert | Kein Zertifikat nötig. Einmalig SmartScreen bestätigen, danach nie wieder. |
| Ziel-PC | Keine Vorbedingungen | Electron bringt Node und Chromium mit. Node und Git braucht nur der Entwicklungsrechner. |

## 4. Architektur

Ein Electron-Hauptprozess, drei Fenster:

| Fenster | Platzierung | Inhalt |
|---|---|---|
| Control | Arbeitsmonitor, normales Fenster | Login, Monitor-Auswahl, Spieler-Verwaltung, Verbindungs- und Update-Status |
| Player | gewählter Monitor, Vollbild, ohne Rahmen | Rest-Score, Checkout, aktueller Wurf |
| Spectator | gewählter Monitor, Vollbild, ohne Rahmen | Broadcast-Ansicht |

Der Hauptprozess führt sämtliche Netzwerkarbeit aus: Authentifizierung, REST,
WebSocket. Er hält genau einen normalisierten `MatchState` und sendet ihn per
IPC an beide Renderer. Die Renderer stellen ausschließlich dar — kein Token,
keine Verbindung, kein Fetch.

Das hat drei Gründe: eine Verbindung statt drei, ein einziges Wahrheitsobjekt
(die Screens können nicht auseinanderlaufen), und Renderer, die sich ohne
Dartscheibe im Browser entwickeln lassen.

```
                Autodarts API
                      |
  OAuth / REST / WebSocket        (Hauptprozess)
                      |
             +--------------------+
             | Autodarts-Adapter  |
             +--------------------+
                      |
                  MatchState
                      |
               IPC-Broadcast
              /                \
     Player-Renderer      Spectator-Renderer
```

## 5. Autodarts-Integration

### 5.1 Bekannter Stand

Aus öffentlich einsehbaren Community-Projekten ([python-autodarts],
[tools-for-autodarts], [autodarts-api-capabilities]):

- Basis `https://api.autodarts.com`
- Bearer-Token-Authentifizierung, Refresh über den Auth-Dienst
- Dienste nach Pfad-Präfix: `/gs/v0` Spiele, `/bs/v0` Boards, `/as/v0`
  Statistiken, `/us/v0` Nutzer, `/ms/v0` Nachrichten
- `GET /gs/v0/matches/{matchId}/state` liefert den Match-Zustand
- `/ms/v0/subscribe` ist der WebSocket-Kanal für Live-Ereignisse

[python-autodarts]: https://github.com/belese/python-autodarts
[tools-for-autodarts]: https://github.com/creazy231/tools-for-autodarts
[autodarts-api-capabilities]: https://github.com/thomasasen/autodarts_local_tournament/blob/main/docs/autodarts-api-capabilities.md

### 5.2 Anmeldung — Stand nach der Migration vom 28.06.2026

Die Erkundung hat ergeben, dass Autodarts am 28.06.2026 von einem
Keycloak-Server (`login.autodarts.io`) auf einen selbst betriebenen
OAuth-2.0-Server unter `api.autodarts.com` umgestellt hat. Der alte Server
antwortet nicht mehr. Jede Angabe aus älteren Community-Projekten zu Realms,
Keycloak-Pfaden oder `grant_type=password` ist damit hinfällig.

Die vollständige Tabelle der selbst abgerufenen Werte samt Quelle und
Vertrauensgrad steht in `docs/autodarts-api.md`. Für das Design zählen zwei
Feststellungen:

**Erstens:** Für die Client-Kennung `autodarts-play` ist ausschließlich
`https://play.autodarts.com/auth/google/callback` als Umleitungsziel
registriert. Ein eigenes Ziel — `localhost` oder ein Custom-Scheme — wird mit
`400 invalid_redirect_uri` abgelehnt.

**Zweitens:** Der Device Authorization Grant steht nicht zur Verfügung, obwohl
der Server ihn serverweit bewirbt. Die Liste `grant_types_supported` enthält
`urn:ietf:params:oauth:grant-type:device_code` und es gibt einen Endpunkt
`/auth/v1/device/code`, aber für die Client-Kennung `autodarts-play` ist die
Ablaufart gesperrt. Eigener Test am 2026-09-09:

```
POST https://api.autodarts.com/auth/v1/device/code
Content-Type: application/json
{"client_id": "autodarts-play"}

400 {"error": "unauthorized_client",
     "error_description": "client may not use the device authorization grant"}
```

Damit bleiben genau zwei gangbare Wege, und sie unterscheiden sich in einer
Zusage, die diese Spezifikation und `PRIVACY.md` bereits machen — nämlich dass
die Anwendung nie ein Passwort entgegennimmt.

**Weg 1 — eingebettetes Fenster, Umleitung abfangen.** Die Anwendung öffnet den
Autorisierungs-Endpunkt in einem `BrowserWindow`, der Nutzer meldet sich auf
der Autodarts-Seite an, und die Anwendung fängt die Navigation ab, sobald sie
`https://play.autodarts.com/auth/…/callback?code=…` erreicht. Der Code wird
gegen `/auth/v1/exchange` eingetauscht. Die Anwendung sieht kein Passwort, die
Zusage bleibt gehalten. Risiko: Google und Apple verweigern OAuth-Anmeldungen
aus eingebetteten Webviews. Für ein Konto mit Passwort funktioniert der Weg,
für die Anmeldung über Google ist er unsicher und hängt am gesetzten
User-Agent.

**Weg 2 — Passwort-Ablauf über `/auth/v1/login`.** Der Endpunkt existiert und
verlangt laut eigenem Test mit leerem Rumpf die Felder `client_id` und
`password` (und, sobald diese vorliegen, erwartbar eine Kennung des Kontos).
Kein Browser, kein Umleitungsziel, keine Webview-Beschränkung. Preis: die
Anwendung nimmt das Passwort selbst entgegen und muss es weiterreichen. Die
Zusage aus Abschnitt 18.3 und aus `PRIVACY.md` wäre damit gebrochen und müsste
umformuliert werden, und die Anmeldung funktioniert nur für Konten, die
überhaupt ein Passwort haben — für ein reines Google-Konto nicht.

Die Entscheidung zwischen beiden Wegen liegt beim Herausgeber, weil sie eine
zugesagte Eigenschaft gegen die Unterstützung von Single-Sign-On abwägt. Bis
sie getroffen ist, entsteht kein Anmeldecode.

### 5.2a Offene Punkte und wie sie geschlossen werden

Die exakten Kanalnamen, das Ticket-Verfahren für den WebSocket und die
Ereignis-Payloads sind nirgends offiziell dokumentiert. Deshalb ist der erste
Implementierungsschritt ein Erkundungsschritt:

1. Mit echtem Account authentifizieren
2. WebSocket verbinden, Board abonnieren, ein vollständiges Match spielen
3. Alle Roh-Ereignisse unverändert in eine JSONL-Datei schreiben
4. Aus dem Mitschnitt das tatsächliche Schema ableiten

Erst danach entsteht Produktivcode gegen dieses Schema. Alles, was in dieser
Spezifikation über konkrete Feldnamen steht, gilt als Annahme bis zu diesem
Schritt.

### 5.3 Record & Replay

Der Mitschnitt aus Schritt 5.2a bleibt dauerhaft eingebaut:

- **Record** — jede Sitzung kann ihre Roh-Ereignisse mit Zeitstempel nach
  `%APPDATA%/autodarts-screens/recordings/*.jsonl` schreiben
- **Replay** — eine Aufzeichnung wird mit Originalgeschwindigkeit oder im
  Zeitraffer eingespielt, statt sich mit der API zu verbinden

Damit lässt sich die Spectator-Ansicht ohne Scheibe und ohne Mitspieler
entwickeln, jederzeit reproduzierbar. Dieselben Aufzeichnungen dienen als
Testfixtures.

### 5.4 Adapter-Schicht

Zwischen API und Anwendung liegt ein Adapter-Modul. Es ist die einzige Stelle,
die Autodarts-Feldnamen kennt, und übersetzt sie in `MatchState`. Ändert
Autodarts sein Schema, wird eine Datei angefasst, nicht die Oberfläche.

### 5.5 Match-Erkennung

Der Nutzer wählt einmalig sein Board. Die Anwendung abonniert den Board-Kanal.
Startet auf autodarts.io ein Match, erscheint dort eine Match-Kennung; die
Anwendung abonniert daraufhin das Match und wechselt aus dem Ruhezustand in die
Match-Ansicht. Endet das Match, kehrt sie nach der Siegerdarstellung in den
Ruhezustand zurück. Während des Spielens ist keine Bedienung nötig.

## 6. Datenmodell

`MatchState` ist die einzige Schnittstelle zwischen Hauptprozess und Renderern.

```ts
type Segment = { name: string; value: number; multiplier: 1 | 2 | 3 }

type LegEntry = {
  playerId: string
  darts: Segment[]     // 1 bis 3 Darts
  scored: number       // Summe, 0 bei Bust
  remainingAfter: number
  bust: boolean
}

type Player = {
  id: string
  autodartsName: string
  displayName: string        // aus Spieler-Verwaltung, sonst autodartsName
  photoPath?: string
  country?: string           // ISO-3166-1 alpha-2 fuer Flagge
  avatarUrl?: string         // Fallback aus der API
}

type PlayerScore = {
  playerId: string
  remaining: number
  legs: number
  sets: number
  average3: number | null
  checkoutAttempts: number
  checkoutHits: number
  count180: number
  highestFinish: number | null
}

type MatchState = {
  phase: 'idle' | 'intro' | 'playing' | 'legBreak' | 'finished'
  matchId: string | null
  variant: 'x01' | 'other'
  startScore: number            // 501, 301, ...
  players: Player[]
  scores: PlayerScore[]
  activePlayerId: string | null
  currentThrow: Segment[]       // 0 bis 3 Darts des laufenden Wurfs
  currentThrowTotal: number
  bust: boolean
  checkout: string[] | null     // z.B. ['T20','T20','D4'], null wenn kein Finish
  checkoutHint: string | null   // Setup-Wurf, wenn checkout null ist, z.B. 'T20'
  legHistory: LegEntry[]        // Wurf-fuer-Wurf des laufenden Legs
  lastEvent: MatchEvent | null  // loest Einblendungen aus
}

type MatchEvent = { seq: number } & (
  | { kind: 'throw' }
  | { kind: 'playerChange'; toPlayerId: string }
  | { kind: 'oneEighty'; playerId: string }
  | { kind: 'highFinish'; playerId: string; score: number }
  | { kind: 'legWon'; playerId: string }
  | { kind: 'matchWon'; playerId: string }
)
```

`seq` steigt über die gesamte Match-Laufzeit monoton. Die Renderer merken sich
die zuletzt verarbeitete Nummer und lösen eine Einblendung dadurch genau einmal
aus; ein erneutes Rendern wiederholt sie nicht.

`checkout` und `checkoutHint` schließen sich aus: ist ein Finish möglich, steht
der Weg in `checkout` und `checkoutHint` ist `null`. Ist keins möglich (Rest
über 170 oder Bogey-Zahl), ist `checkout` `null` und `checkoutHint` trägt den
empfohlenen Setup-Wurf. Beide gleichzeitig gesetzt ist ein Fehler.

## 7. Player-Screen

```
+------------------------------------------------+
|  JAN  3 - 2  MARKUS                   Leg 6    |   gedaempft, klein
|                                                |
|                     128                        |   ~40 % der Bildhoehe
|                                                |
|            T20   .   T20   .   D4              |   Neon-Gruen
|                                                |
|  --------------------------------------------  |
|    T20     5     D16                   41      |
+------------------------------------------------+
```

Regeln:

- Hintergrund nahezu schwarz (`--jg-bg`), keine Muster, keine Bewegung außer
  einer kurzen Überblendung beim Zahlenwechsel
- Der Rest-Score ist das mit Abstand größte Element und aus Wurfentfernung
  lesbar
- Der Checkout-Weg steht in der Signalfarbe, sobald ein Finish möglich ist;
  ist keins möglich (Bogey-Zahl oder Rest über 170), steht dort stattdessen
  der empfohlene Setup-Wurf
- Ein Bust färbt den Rest-Score kurz rot und stellt ihn dann zurück
- Kein Blinken, keine Popups, keine Statistiken im Zentrum. Der Screen steht
  neben der Scheibe.

Bei mehr als zwei Spielern zeigt die Kopfzeile nur den führenden Gegner und
die eigene Position.

## 8. Spectator-Screen

### 8.1 Szenen

Die Szene wird aus `MatchState` abgeleitet, nicht separat gesteuert.
`AnimatePresence` blendet zwischen Szenen über.

| Szene | Auslöser | Dauer |
|---|---|---|
| `idle` | kein Match aktiv | dauerhaft |
| `intro` | Match beginnt | ca. 8 s, dann automatisch weiter |
| `scoreboard` | Normalzustand | dauerhaft |
| `playerChange` | `lastEvent.kind === 'playerChange'` | ca. 2,5 s als Überlagerung |
| `bigMoment` | `oneEighty` oder `highFinish` | ca. 3,5 s als Vollbild |
| `legWin` | `legWon` | ca. 4 s |
| `matchWin` | `matchWon` | ca. 12 s, danach `idle` |

Überlagerungen unterbrechen das Scoreboard nicht, sie legen sich darüber und
geben es wieder frei. Trifft während einer Einblendung ein neues Ereignis ein,
wird die laufende abgekürzt statt in eine Warteschlange gestellt.

### 8.2 Scoreboard-Aufbau

```
+-------------------------------------------------------------+
| |JGN                                          BEST OF 11    |
|                                                             |
|  +---------------+                    +---------------+     |
|  |   [Foto]      |                    |   [Foto]      |     |
|  |   JAN   DE    |        3 - 2       |  MARKUS  DE   |     |
|  |               |                    |               |     |
|  |      128      |                    |      301      |     |
|  +---------------+                    +---------------+     |
|   ^ aktiv, Neon-Rahmen                                      |
|                                                             |
|  +-------------------------------+   +-------------------+  |
|  | O 68.4   CO 42%   180er: 3    |   | Leg-Verlauf       |  |
|  +-------------------------------+   | 180 . 140 . 45 .. |  |
|                                      +-------------------+  |
+-------------------------------------------------------------+
```

- Der aktive Spieler wird durch einen Neon-Rahmen und leichte Anhebung
  hervorgehoben; der Wechsel ist animiert
- Rest-Scores zählen animiert herunter statt zu springen
- Das JGN-Logo steht dauerhaft als Bug in der Ecke
- Ab drei Spielern wird aus den zwei Karten ein Raster; die Stats-Leiste zeigt
  dann nur den aktiven Spieler

### 8.3 Einblendungen

- **Spielerwechsel** — Karte des neuen Spielers fährt mit Foto, Flagge und
  3-Dart-Average von der Seite ein, bleibt kurz stehen, fährt heraus
- **180** — Vollbild, Zahl groß, Neon-Grün, kurzer Puls
- **High Finish** — Vollbild mit dem geworfenen Weg und der Checkout-Zahl
- **Leg-Gewinn** — Legstand aktualisiert sich mit Hervorhebung des Gewinners
- **Match-Gewinn** — Siegerkarte mit den Match-Statistiken beider Spieler

## 9. Checkout-Logik

Statische Tabelle für Rest 2 bis 170, jeweils in Varianten für drei, zwei und
einen verbleibenden Dart. Einmal erzeugt, zur Laufzeit nur nachgeschlagen —
kein Solver.

Regeln:

- Doppel-Out (Standard bei Autodarts-X01)
- Bogey-Zahlen 169, 168, 166, 165, 163, 162 und 159 sind mit drei Darts nicht
  auszumachen; dort wird kein Weg gezeigt, sondern ein Setup-Wurf empfohlen
- Über 170 wird ein Setup-Wurf empfohlen, der eine Finish-Zahl herstellt
- Bevorzugt werden die gängigen Wege (T20-orientiert), nicht die theoretisch
  optimalen mit ungewöhnlichen Feldern

Dies ist die einzige nennenswerte Logik im Projekt und wird mit Tests
abgesichert.

## 10. Monitor-Auswahl

`screen.getAllDisplays()` liefert die Monitore. Das Control-Fenster zeigt sie
mit Auflösung, Position und Skalierung und bietet einen **Identify**-Knopf, der
auf jedem Monitor kurz eine große Ziffer einblendet.

Die Auswahl wird als Display-ID gespeichert. Ist ein gespeicherter Monitor beim
nächsten Start nicht vorhanden, öffnet das betroffene Fenster auf dem primären
Monitor und das Control-Fenster weist darauf hin — statt dass ein Fenster
unsichtbar irgendwo liegt.

Beide Vollbild-Fenster lassen sich per Escape verlassen und über das
Control-Fenster wieder öffnen.

## 11. Spieler-Verwaltung und Branding

Im Control-Fenster gepflegt, abgelegt unter
`%APPDATA%/autodarts-screens/players.json` samt Bilderordner:

| Feld | Zweck |
|---|---|
| `autodartsName` | Schlüssel für die automatische Zuordnung im Match |
| `displayName` | Anzeigename auf dem Spectator-Screen |
| `photo` | Bild für Spieler-Karte und Einblendungen |
| `country` | Flagge |

Ohne Eintrag greift die Anwendung auf den Autodarts-Avatar zurück, ohne diesen
auf die Initialen.

Logo und Hintergründe stammen aus dem bestehenden JGNet-Bestand
(`00-JGN--Prog/JGNet Design System/assets/`) und werden ins Projekt kopiert.

## 12. Design-Tokens

Übernommen aus `00-JGN--Prog/JGNet Design System/colors_and_type.css`:

| Token | Wert | Verwendung |
|---|---|---|
| `--jg-bg` | `#020617` | Grundfläche beider Screens |
| `--jg-surface` | `#0a1324` | Karten, Leisten |
| `--jg-accent` | `#04FC4C` | aktiver Spieler, möglicher Checkout, 180er |
| `--jg-warning` | `#ff4444` | ausschließlich Bust |
| `--jg-text` | `#e5ecf5` | Werte und Namen |
| `--jg-muted` | `#8a9db5` | Nebeninformationen |
| Amber `#F5A623` | aus dem Logo | Highlights auf dem Spectator-Screen |
| `--jg-font-display` | Barlow Condensed | alle Zahlen und Namen |
| `--jg-font-mono` | JetBrains Mono | technische Werte im Control-Fenster |

Schriften werden lokal eingebettet, nicht von Google Fonts geladen — die
Anwendung muss ohne Internetzugang zur Schriftauslieferung starten.

## 13. Release und Versionierung

- Semantische Versionierung in `package.json`
- `CHANGELOG.md` als Versionsübersicht, ein Abschnitt je Version
- Tag `vX.Y.Z` auf `main` löst eine GitHub Action aus, die den NSIS-Installer
  baut und samt `latest.yml` an das Release hängt
- `electron-updater` prüft beim Start auf Aktualisierungen, lädt im Hintergrund
  und installiert beim Beenden — nie während eines laufenden Matches
- Nach einem Update zeigt das Control-Fenster einmalig den Changelog-Abschnitt
  der neuen Version

## 14. Fehlerbehandlung

| Fall | Verhalten |
|---|---|
| Kein Internet beim Start | Control-Fenster zeigt den Zustand, Screens bleiben im Ruhezustand mit Hinweis |
| WebSocket bricht ab | Automatischer Wiederverbindungsversuch mit wachsendem Abstand; nach der Wiederverbindung wird der Match-Zustand per REST neu geladen statt Ereignisse zu raten |
| Token abgelaufen | Stille Erneuerung; scheitert sie, fordert das Control-Fenster zur erneuten Anmeldung auf, die Screens laufen mit dem letzten Stand weiter |
| Unbekannter Spielmodus | Fallback-Scoreboard ohne Checkout und ohne Modus-Logik |
| Unerwartetes Ereignis-Schema | Ereignis wird protokolliert und übersprungen, die Anwendung stürzt nicht ab |

Ein Anzeigefehler darf ein laufendes Match nie unterbrechen. Im Zweifel zeigt
die Anwendung den letzten bekannten guten Zustand.

## 15. Testing

- **Checkout-Tabelle** — Einheitstests: jeder erreichbare Rest hat einen
  gültigen Weg, jeder Weg endet auf einem Doppel und ergibt exakt den Rest;
  Bogey-Zahlen liefern keinen Weg
- **State-Adapter** — gegen aufgezeichnete JSONL-Fixtures aus echten Matches:
  Ereignisfolge hinein, erwartete `MatchState`-Folge heraus
- **Renderer** — kein automatisierter Test. Prüfung erfolgt durch Replay einer
  Aufzeichnung; das ist bei Animationen aussagekräftiger als Snapshot-Tests

Werkzeug: Vitest.

## 16. Projektstruktur

```
darts/
  src/
    main/           Hauptprozess: Fenster, IPC, Konfiguration, Updater
    autodarts/      Auth, REST, WebSocket, Adapter, Record & Replay
    shared/         MatchState-Typen, Checkout-Tabelle
    renderer/
      control/      Control-Fenster
      player/       Player-Screen
      spectator/    Spectator-Screen inklusive Szenen
  assets/           Logo, Hintergruende, Schriften
  docs/
  .github/workflows/release.yml
```

## 17. Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| API-Schema unbekannt und kürzlich geändert | Erkundungsschritt vor jedem Produktivcode; Adapter isoliert alle Feldnamen |
| Autodarts ändert das Schema erneut | Eine Datei betroffen; aufgezeichnete Fixtures zeigen die Abweichung sofort |
| Zwei Vollbild-Fenster auf skalierten Monitoren | Layouts durchgehend in relativen Einheiten; früher Test auf der Zielhardware |
| Zielrechner ist ein anderer als der Entwicklungsrechner | Früh einen ersten Installer bauen und die Monitor-Erkennung dort real prüfen |

## 18. Rechtliche Pflichtangaben (EU)

Die Anwendung erscheint als quelloffenes Projekt unter MIT-Lizenz, jedoch unter
dem Namen Jan Geiger Networking. Weil damit ein geschäftlicher Bezug besteht,
greift die Ausnahme des Cyber Resilience Act für freie Software außerhalb einer
Geschäftstätigkeit nicht sicher. Die Pflichtangaben werden deshalb vollständig
umgesetzt.

Dies ist eine technische Umsetzungsvorgabe, keine Rechtsberatung. Die konkreten
Angaben liefert der Herausgeber.

### 18.1 Rechtsgrundlagen und Fristen

| Grundlage | Betrifft | Ab wann |
|---|---|---|
| Cyber Resilience Act, VO (EU) 2024/2847, Art. 14 | Meldung aktiv ausgenutzter Schwachstellen und schwerwiegender Vorfälle an ENISA und die nationale CSIRT | 11.09.2026 |
| Cyber Resilience Act, übrige Pflichten | CE-Kennzeichnung, EU-Konformitätserklärung, technische Dokumentation, Support-Zeitraum, SBOM, Schwachstellenmanagement | 11.12.2027 |
| DSGVO | Verarbeitung von Kontodaten, Spielernamen, Fotos und Statistiken | laufend |
| § 5 DDG | Anbieterkennzeichnung bei geschäftsmäßigen digitalen Diensten | laufend |
| Lizenzbedingungen der verwendeten Bibliotheken | Namensnennung und Lizenztexte | laufend |

Nicht anwendbar: Produktsicherheitsverordnung (nur körperliche Produkte),
Barrierefreiheitsstärkungsgesetz (die Anwendung fällt unter keine der dort
erfassten Produkt- oder Dienstekategorien), KI-Verordnung (kein KI-System).

### 18.2 Umzusetzende Artefakte

| Artefakt | Ort | Inhalt |
|---|---|---|
| Über-Panel | Control-Fenster | Herausgeber mit Anschrift, Kontakt, Version, Lizenz, Verweis auf die übrigen Angaben |
| Datenschutzhinweise | `PRIVACY.md` und Panel im Control-Fenster | Welche Daten verarbeitet werden, dass sie ausschließlich lokal in `%APPDATA%` liegen, welche Daten an die Autodarts-API gehen, Rechtsgrundlage, Betroffenenrechte |
| Schwachstellenmeldung | `SECURITY.md` | Kontaktadresse, erwartete Reaktionszeit, Verfahren der koordinierten Offenlegung |
| Lizenz | `LICENSE` | MIT mit Copyright-Zeile des Herausgebers |
| Fremdlizenzen | `THIRD-PARTY-LICENSES.md` und Panel | Automatisch aus den Abhängigkeiten erzeugt, im Release-Workflow aktualisiert |
| Stückliste | Release-Anhang | CycloneDX über `npm sbom --sbom-format cyclonedx`, je Release erzeugt |
| Support-Zeitraum | `README.md` und Über-Panel | Zeitraum, in dem Sicherheitsaktualisierungen bereitgestellt werden |

### 18.3 Datenverarbeitung im Detail

Damit die Datenschutzhinweise belegbar sind, gilt für die Umsetzung:

- Zugangsdaten werden nie von der Anwendung entgegengenommen; die Anmeldung
  läuft auf der Autodarts-Seite im eingebetteten Fenster
- Gespeichert werden ausschließlich lokal: Aktualisierungs-Token in
  `safeStorage`, Spielerprofile in `players.json`, Fotos im Bilderordner,
  Aufzeichnungen in `recordings/`
- Es findet keine Übertragung an Dritte statt außer an die Autodarts-API und
  an GitHub beim Prüfen auf Aktualisierungen
- Keine Telemetrie, keine Absturzberichte an Dritte
- Das Control-Fenster bietet eine Funktion, die alle lokalen Daten löscht

### 18.4 Angaben des Herausgebers

| Feld | Wert |
|---|---|
| Diensteanbieter | Jan Geiger Networking |
| Inhaber | Jan Geiger |
| Anschrift | Dorfstr. 10A, 32107 Bad Salzuflen, Nordrhein-Westfalen, Deutschland |
| E-Mail | hey@bsbnet.eu |
| Telefon | +49 5222 9179070 |
| Web | https://jgnet.eu |
| Rechtsform | Einzelunternehmen / Kleingewerbe |
| Umsatzsteuer | Kleinunternehmer nach § 19 UStG, keine Umsatzsteuer-Identifikationsnummer |
| Aufsichtsbehörde | Gewerbeamt der Stadt Bad Salzuflen, Rudolph-Brandes-Allee 19, 32105 Bad Salzuflen |
| Repository | https://github.com/Jan-Geiger-Networking/autodarts-screens |
| Sicherheitskontakt | hey@bsbnet.eu |
| Support-Zeitraum | 36 Monate ab dem jeweiligen Release |

Ergänzend in die Anbieterkennzeichnung aufzunehmen: der Hinweis auf die
Online-Streitbeilegungsplattform der Europäischen Kommission
(`https://ec.europa.eu/consumers/odr`) samt der Erklärung, dass keine
Bereitschaft zur Teilnahme an Verbraucherschlichtungsverfahren besteht.

Nicht übernommen werden die website-bezogenen Teile der bestehenden
Anbieterkennzeichnung von jgnet.eu — Hosting-Infrastruktur, Kundenportal und
die Haftung für externe Links betreffen den Webauftritt, nicht die Anwendung.
An deren Stelle tritt der Gewährleistungsausschluss der MIT-Lizenz.

## 19. Offener Punkt

Ob die Anwendung auf dem Entwicklungsrechner selbst läuft oder auf einem
separaten Darts-PC, ist noch nicht geklärt. Es ändert den Bauplan nicht,
verschiebt aber den Zeitpunkt des ersten Installer-Builds nach vorn.
