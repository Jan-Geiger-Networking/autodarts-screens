# Autodarts API und OAuth

Diese Datei hält fest, was über die Anmeldung und die REST/WebSocket-Schnittstellen
von Autodarts tatsächlich bekannt ist. Ermittelt für Task 3 des Plans
`2026-09-09-fundament-und-live-daten`. Grundlage für Task 4 (Anmeldung im
eingebetteten Fenster).

Wichtig: Autodarts hat laut mehreren unabhängigen Quellen (eigene Live-Abfrage
und ein Community-Projekt mit datiertem Changelog) am **28.06.2026** von einem
Keycloak-Server (`login.autodarts.io`) auf einen neuen, selbst gehosteten
OAuth-2.0-Server unter `api.autodarts.com` umgestellt. Alle Werte, die sich auf
`login.autodarts.io/realms/autodarts/...` beziehen, sind seitdem veraltet.

## OAuth

| Feld | Wert | Quelle | Vertrauensgrad |
|---|---|---|---|
| Aussteller (issuer) | `https://api.autodarts.com/auth` | `GET https://api.autodarts.com/.well-known/openid-configuration` (identischer Inhalt auch unter `https://api.autodarts.io/.well-known/openid-configuration`), abgerufen 2026-09-09 | selbst abgerufen |
| Autorisierungs-Endpunkt | `https://api.autodarts.com/auth/v1/oauth/authorize` | wie oben; zusätzlich per eigenem `GET`-Test bestätigt (siehe unten) | selbst abgerufen |
| Token-Endpunkt (Code-Tausch) | `https://api.autodarts.com/auth/v1/exchange` | wie oben; Feldname in der Discovery-Antwort ist `token_endpoint`. Im Frontend-Bundle (`play.autodarts.com`) heißt die Funktion `exchange` und ruft exakt diesen Pfad mit `{code, client_id, redirect_uri}` auf | selbst abgerufen |
| Token-Refresh | `https://api.autodarts.com/auth/v1/refresh` | aus dem Frontend-Bundle `src-CUjZg3wP.js` (Funktion `g`, Body `{refresh_token, client_id}`); steht nicht in der Discovery-Antwort, ist aber die im Web-Client tatsächlich verwendete Adresse | selbst abgerufen |
| Abmelde-Endpunkt | `https://api.autodarts.com/auth/v1/logout` | Discovery-Antwort nennt dies `revocation_endpoint` (kein `end_session_endpoint` vorhanden); Frontend-Bundle ruft denselben Pfad mit `{refresh_token}` per `POST` auf | selbst abgerufen |
| Geräte-Autorisierung | `https://api.autodarts.com/auth/v1/device/code` | Discovery-Antwort, Feld `device_authorization_endpoint` | selbst abgerufen |
| Client-Kennung (Web-App) | `autodarts-play` | Konstante `s` in `https://play.autodarts.com/assets/src-CUjZg3wP.js` (Stand 2026-09-09, Datei-Hash im Namen kann sich bei jedem Deploy ändern), wird dort in allen Aufrufen (`/login`, `/exchange`, `/refresh`, `/providers/{provider}/authorize`) mitgeschickt | selbst abgerufen (aus veröffentlichtem, unauthentifiziertem JS-Bundle der offiziellen Web-App) |
| Unterstützte Ablaufarten | `authorization_code`, `client_credentials`, `urn:ietf:params:oauth:grant-type:device_code`, `password`, `otp`, `refresh_token` | Discovery-Antwort, Feld `grant_types_supported` | selbst abgerufen |
| Unterstützte Scopes | `openid`, `profile`, `email` | Discovery-Antwort, Feld `scopes_supported` | selbst abgerufen |
| PKCE-Methoden | `S256` | Discovery-Antwort, Feld `code_challenge_methods_supported` | selbst abgerufen |
| Token-Auth-Methoden des Clients | `none`, `client_secret_post` | Discovery-Antwort, Feld `token_endpoint_auth_methods_supported`; `none` bedeutet: öffentlicher Client ohne Secret ist zulässig (passt zu PKCE) | selbst abgerufen |
| Social-Login-Anbieter | `google`, `apple` | Discovery-Antwort, Feld `providers_supported` | selbst abgerufen |
| Umleitungsziel (bestätigt gültig) | `https://play.autodarts.com/auth/google/callback` | Eigener `GET`-Test gegen den Autorisierungs-Endpunkt (siehe unten): mit diesem `redirect_uri` antwortet der Server mit `302` auf `https://auth.autodarts.com/authorize?request_id=...`; jede andere getestete Adresse (u. a. `http://localhost:<port>/callback`, `https://play.autodarts.com/auth/callback`, `https://autodarts.com/auth/google/callback`) ergab `400 invalid_redirect_uri: "redirect_uri is not registered for this client"` | selbst abgerufen |
| Umleitungsziel außerhalb autodarts.io/.com möglich? | Nein, bestätigt | siehe Zeile oben: die Client-Kennung `autodarts-play` lässt laut eigenem Test **kein** selbst gewähltes Umleitungsziel (kein `localhost`, kein Custom-Scheme) zu. Die Anwendung muss die Umleitung daher im eingebetteten Fenster abfangen, sobald die Navigation `https://play.autodarts.com/auth/google/callback?code=...` erreicht, statt einen lokalen Server zu betreiben | selbst abgerufen (Schlussfolgerung aus obigem Test) |
| Datum der Feststellung | 2026-09-09 | — | — |

### Eigener Test des Autorisierungs-Endpunkts

Reiner, unauthentifizierter `GET`-Aufruf (kein Login, keine Zugangsdaten
verwendet), um zu prüfen, welches Umleitungsziel für `client_id=autodarts-play`
tatsächlich hinterlegt ist:

```
GET https://api.autodarts.com/auth/v1/oauth/authorize
    ?client_id=autodarts-play
    &redirect_uri=<getestete Adresse>
    &response_type=code
    &scope=openid+profile+email
    &code_challenge=<Testwert>
    &code_challenge_method=S256
```

Ergebnisse:

| `redirect_uri` | Ergebnis |
|---|---|
| `https://play.autodarts.com/auth/google/callback` | `302` -> `https://auth.autodarts.com/authorize?request_id=...` (gültig) |
| `http://localhost:53219/callback` | `400 invalid_redirect_uri` |
| `https://play.autodarts.com/auth/callback` | `400 invalid_redirect_uri` |
| `https://autodarts.com/auth/google/callback` | `400 invalid_redirect_uri` |

Zusätzlich getestet: `client_id=autodarts-app` (die alte, aus einem
Community-Projekt bekannte Kennung, siehe unten) liefert auf dem neuen Server
`400 invalid_client: "unknown client_id"` — der alte Client existiert dort
nicht mehr.

Die Zwischenseite `https://auth.autodarts.com/` ist eine eigene kleine
Single-Page-App ("Autodarts – Sign in") mit eigenem `forgot-password`-Ablauf;
sie bietet nach eigenem Augenschein sowohl E-Mail/Passwort-Anmeldung als auch
die Social-Login-Knöpfe an (nicht bis ins letzte Detail durchleuchtet — das
gehört nicht mehr zur Bestandsaufnahme, sondern zur Umsetzung in Task 4).

### Veraltet: Keycloak-Ära (vor 28.06.2026)

Diese Werte stammen aus Community-Projekten, die noch den alten Keycloak-Server
beschreiben. Eigene Tests zeigen, dass sie auf dem aktuellen Server nicht mehr
funktionieren (siehe oben). Aufgeführt nur zur Einordnung, falls Dokumentation
oder ältere Tools darauf verweisen:

| Feld | Alter Wert | Fundstelle | Vertrauensgrad |
|---|---|---|---|
| Alter Keycloak-Server | `https://login.autodarts.io/` | `src/autodarts/session.py`, Zeile 24, Repo `belese/python-autodarts` | aus Gemeinschaftsprojekt, veraltet |
| Alter Token-Endpunkt | `https://login.autodarts.io/realms/autodarts/protocol/openid-connect/token` | `AutodartsDefines.h`, Zeile 164, Repo `Chade/AutodartsClient` | aus Gemeinschaftsprojekt, veraltet |
| Alte Client-Kennung | `autodarts-app` | `AutodartsDefines.h`, Zeile 165 (`client_id=autodarts-app&scope=openid&grant_type=password&...`), Repo `Chade/AutodartsClient` | aus Gemeinschaftsprojekt, veraltet (liefert auf dem neuen Server `unknown client_id`, eigener Test) |
| Alter Realm-Name | `autodarts` | `assets/autodarts_keycloak_client.py`, Zeile 27, Repo `lbormann/darts-caller` | aus Gemeinschaftsprojekt, veraltet |
| Migrationsdatum | 28.06.2026, Ablösung durch Authorization Code + PKCE, `grant_type=password` entfällt | `AUTH_CHANGES.md`, Abschnitt "OAuth-2.0-Migration (Juni 2026)", Repo `creazy231/tools-for-autodarts` | aus Gemeinschaftsprojekt, deckt sich mit eigener Live-Abfrage |

Die Client-Kennung des alten, aus `lbormann/darts-caller` bekannten
*vertraulichen* Clients (mit `client_secret`) wird dort bewusst nicht im Code
hinterlegt, sondern zur Laufzeit von einem eigenen Server des Projektautors
bezogen (`assets/get_cred.py`, Zeile 15 `DEFAULT_NODEJS_SERVER_URL`). Sie ist
also auch aus dieser Quelle nicht ablesbar und ohnehin durch die Migration
hinfällig.

## Offen — von Jan zu erledigen

Die selbst abgerufenen Werte oben sind durch direkte, unauthentifizierte
HTTP-Aufrufe gegen die echten Autodarts-Server abgesichert (siehe Tabelle
"Eigener Test des Autorisierungs-Endpunkts"). Trotzdem lohnt sich ein Blick in
die echten Entwicklerwerkzeuge beim tatsächlichen Einloggen, weil dabei
sichtbar wird, welche Werte der Browser im konkreten Moment wirklich sendet
(z. B. der tatsächlich verwendete `scope`-Wert oder ob zusätzliche Parameter
mitgeschickt werden, die in den obigen Tests nicht abgedeckt sind). So gehst du
vor:

1. Chrome oder Edge öffnen und die Entwicklerwerkzeuge aufrufen (Taste F12
   oder Rechtsklick auf die Seite -> „Untersuchen"). Zum Reiter „Netzwerk"
   („Network") wechseln.
2. Im Netzwerk-Reiter den Haken bei „Protokoll beibehalten" („Preserve log")
   setzen. Das verhindert, dass die Liste beim Weiterleiten auf eine andere
   Seite geleert wird.
3. Im Adressfeld des Browsers `https://play.autodarts.com` aufrufen (die alte
   Adresse `https://autodarts.io` leitet automatisch dorthin um) und auf
   „Login" bzw. „Anmelden" klicken.
4. In der Netzwerk-Liste nach einer Anfrage suchen, deren Adresse mit
   `https://api.autodarts.com/auth/v1/oauth/authorize` beginnt (bei Anmeldung
   über Google oder Apple) oder direkt nach der Weiterleitung auf
   `https://auth.autodarts.com/authorize?...`. Mit der rechten Maustaste auf
   den Eintrag klicken und „Copy -> Copy URL" wählen.
5. Die kopierte Adresse in einen Texteditor einfügen und die Parameter nach
   dem `?`-Zeichen einzeln notieren, insbesondere:
   - `client_id` — sollte `autodarts-play` sein; falls abweichend, den
     tatsächlichen Wert hier in der Tabelle oben nachtragen.
   - `redirect_uri` — sollte `https://play.autodarts.com/auth/<anbieter>/callback`
     sein.
   - `response_type` — erwartet `code`.
   - `scope` — die tatsächlich angefragten Berechtigungen.
   - `code_challenge_method` — erwartet `S256`.
6. Falls die Anmeldung stattdessen über ein reines E-Mail/Passwort-Formular
   läuft (ohne sichtbare Weiterleitung auf `oauth/authorize`), stattdessen
   nach einer `POST`-Anfrage auf `https://api.autodarts.com/auth/v1/login`
   suchen und deren „Payload"/„Request"-Reiter prüfen — das ist der Weg, den
   die Web-App für normale Konten ohne Google/Apple nutzt, und braucht keinen
   Redirect-Flow.
7. Ergebnis in der Tabelle oben ergänzen oder bestätigen, Datum der eigenen
   Prüfung notieren.

## Endpunkte

Unbestätigt (aus dem Task-Brief übernommen, nicht selbst geprüft — die
eigene Erkundung dieser Aufgabe hat sich auf die Anmeldung konzentriert).
`api.autodarts.io` beantwortet zumindest den OpenID-Discovery-Aufruf
nachweislich (siehe oben), ob und wie die folgenden Pfade heute noch unter
`api.autodarts.com` erreichbar sind, wurde in dieser Aufgabe nicht getestet:

- Basis: `https://api.autodarts.com`
- Präfixe: `/gs/v0` (Spiele), `/bs/v0` (Boards), `/as/v0` (Statistiken),
  `/us/v0` (Nutzer), `/ms/v0` (Nachrichten)
- `GET /gs/v0/matches/{matchId}/state`
- WebSocket: `/ms/v0/subscribe`

Ergänzend aus einem Community-Projekt (ebenfalls unbestätigt durch eigenen
Test, aber mit konkreter Fundstelle): `src/autodarts/endpoint.py`, Repo
`belese/python-autodarts`, Zeile 38 (`API_URL = "https://api.autodarts.io"`)
und Zeile 119 (`WS_ENDPOINT = "wss://api.autodarts.io/ms/v0/subscribe"`) sowie
`AutodartsDefines.h`, Repo `Chade/AutodartsClient`, Zeilen 166-169:

```
AUTODARTS_API_MATCHES_URL = "https://api.autodarts.io/gs/v0/matches"
AUTODARTS_API_BOARDS_URL  = "https://api.autodarts.io/bs/v0/boards"
AUTODARTS_API_TICKET_URL  = "https://api.autodarts.io/ms/v0/ticket"
AUTODARTS_WS_SECURE_URL   = "ws://api.autodarts.io/ms/v0/subscribe?ticket="
```

Diese beiden Quellen stammen aus der Zeit vor der OAuth-Migration und
verwenden durchgängig `api.autodarts.io` statt `api.autodarts.com` als
API-Basis — beide Domains beantworteten in dieser Aufgabe den
Discovery-Aufruf identisch (siehe OAuth-Abschnitt), welche Domain für die
Spiel-/Board-Endpunkte künftig maßgeblich ist, ist unbekannt und in einer
späteren Aufgabe zu prüfen.

## Endpunkt-Existenz, eigener Test 2026-09-09

Ein unauthentifizierter Aufruf beweist die Existenz eines Pfades: `401
unauthorized` heißt „Pfad existiert, Token fehlt", `404 page not found` heißt
„Pfad existiert nicht". Damit ließ sich klären, was die Community-Quellen offen
gelassen hatten.

| Methode | Pfad | Antwort | Schluss |
|---|---|---|---|
| GET | `api.autodarts.com/bs/v0/boards` | 401 | existiert |
| GET | `api.autodarts.io/bs/v0/boards` | 401 | existiert ebenfalls, beide Domains sind aktiv |
| GET | `api.autodarts.com/us/v0/users/@me` | 401 | existiert |
| GET | `api.autodarts.com/gs/v0/matches` | 401 | existiert |
| POST | `api.autodarts.com/ms/v0/tickets` | 401 | existiert — **Plural ist richtig** |
| POST | `api.autodarts.com/ms/v0/ticket` | 404 | existiert nicht |

Zwei Folgerungen für die Umsetzung:

1. Der WebSocket-Ticket-Endpunkt heißt `POST /ms/v0/tickets`. Die Angabe
   `AUTODARTS_API_TICKET_URL = ".../ms/v0/ticket"` aus `AutodartsDefines.h`
   (Repo `Chade/AutodartsClient`) ist falsch oder veraltet.
2. `api.autodarts.com` beantwortet alle geprüften Spiel-, Board- und
   Nachrichten-Pfade. Es gibt keinen Grund, auf `api.autodarts.io`
   auszuweichen; beide sind erreichbar, `.com` bleibt die Basis.

Der Fehlerrumpf des Servers hat durchgängig die Form
`{"statusCode":401,"error":{"status":401,"code":"unauthorized","message":"unauthorized"}}`
— nützlich, um in der Anwendung zwischen „nicht angemeldet" und anderen
Fehlern zu unterscheiden.
