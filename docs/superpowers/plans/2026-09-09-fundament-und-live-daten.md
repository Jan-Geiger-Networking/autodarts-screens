# Fundament und Live-Daten — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Ziel:** Eine startfähige Electron-Anwendung, die sich bei Autodarts anmeldet, ein laufendes Match live mitliest und auf einem frei gewählten Monitor im Vollbild Rest-Score, Checkout-Empfehlung und den aktuellen Wurf anzeigt.

**Architektur:** Der Hauptprozess erledigt Anmeldung, REST und WebSocket, normalisiert alles zu einem `MatchState` und schickt diesen per IPC an die Renderer. Die Renderer zeigen nur an. Eine Aufzeichnungs- und Wiedergabefunktion erlaubt Entwicklung und Tests ohne Dartscheibe.

**Tech-Stack:** Electron, electron-vite, React, TypeScript, Vitest. Keine weiteren Laufzeitabhängigkeiten in diesem Plan.

**Spec:** `docs/superpowers/specs/2026-09-09-autodarts-dual-screen-design.md`

## Globale Vorgaben

Diese gelten für jede Aufgabe, ohne dass sie dort wiederholt werden.

- Arbeitsverzeichnis: `F:\DEV\autodarts-screens`. Niemals auf `Z:` arbeiten.
- Entwicklungsrechner: Node 24.15.0, npm 11.12.1, Git 2.54.0. Der Zielrechner braucht nichts davon.
- Git-Identität ist im Repository gesetzt (`hey@bsbnet.eu`). Nicht überschreiben.
- Lizenz: MIT, Copyright `Jan Geiger Networking`.
- Repository: `https://github.com/Jan-Geiger-Networking/autodarts-screens`.
- Sprache der Oberfläche: Deutsch. Beschreibungen und Commit-Nachrichten deutsch, englische Fachbegriffe bleiben englisch.
- Renderer-Prozesse führen niemals Netzwerkaufrufe aus und sehen niemals ein Token. `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Keine Telemetrie, keine Absturzberichte an Dritte.
- Farbtokens, wörtlich aus der Spec: `--jg-bg: #020617`, `--jg-surface: #0a1324`, `--jg-surface-hi: #0f1a2e`, `--jg-accent: #04FC4C`, `--jg-warning: #ff4444`, `--jg-text: #e5ecf5`, `--jg-muted: #8a9db5`, Amber `#F5A623`.
- Schriften: Barlow Condensed (Anzeige), DM Sans (Fließtext), JetBrains Mono (technische Werte). Lokal eingebettet, niemals von Google Fonts geladen.
- Support-Zeitraum in allen Angaben: 36 Monate ab dem jeweiligen Release.
- Testwerkzeug: Vitest. Tests liegen als `*.test.ts` neben der getesteten Datei.
- Commits nach jeder Aufgabe, Präfixe `feat:`, `fix:`, `docs:`, `chore:`, `test:`.

## Dateistruktur

| Datei | Zuständigkeit |
|---|---|
| `package.json`, `electron.vite.config.ts`, `tsconfig.json` | Projektkonfiguration |
| `src/main/index.ts` | Anwendungsstart, Lebenszyklus |
| `src/main/fenster.ts` | Erzeugen und Platzieren der drei Fenster |
| `src/main/monitore.ts` | Monitore auflisten, Identify-Einblendung |
| `src/main/konfiguration.ts` | Lesen und Schreiben von `config.json` |
| `src/main/ipc.ts` | IPC-Kanäle, Verteilen des `MatchState` |
| `src/preload/index.ts` | `contextBridge`-Brücke, einzige Renderer-Schnittstelle |
| `src/autodarts/oauth.ts` | Anmeldung, Token-Erneuerung, Ablage |
| `src/autodarts/rest.ts` | REST-Aufrufe gegen `api.autodarts.com` |
| `src/autodarts/websocket.ts` | Ticket holen, Verbindung, Abonnements, Wiederverbindung |
| `src/autodarts/adapter.ts` | Rohereignisse zu `MatchState` |
| `src/autodarts/aufzeichnung.ts` | Record und Replay |
| `src/shared/typen.ts` | `MatchState` und verwandte Typen |
| `src/shared/checkout.ts` | Checkout-Tabelle und Setup-Empfehlung |
| `src/renderer/shared/tokens.css` | Farb- und Schrifttokens |
| `src/renderer/control/*` | Control-Fenster |
| `src/renderer/player/*` | Player-Screen |
| `LICENSE`, `SECURITY.md`, `PRIVACY.md`, `README.md`, `CHANGELOG.md` | Rechtliche Pflichtangaben |
| `docs/autodarts-api.md` | Ergebnis der API-Erkundung, Quelle der Wahrheit für den Adapter |

---

### Task 1: Projektgerüst

**Files:**
- Create: `package.json`, `tsconfig.json`, `electron.vite.config.ts`, `.gitattributes`
- Create: `src/main/index.ts`, `src/preload/index.ts`
- Create: `src/renderer/control/index.html`, `src/renderer/control/main.tsx`, `src/renderer/control/App.tsx`

**Interfaces:**
- Consumes: nichts
- Produces: npm-Skripte `dev`, `build`, `test`, `typecheck`. Ein Electron-Fenster, das `src/renderer/control/index.html` lädt.

- [ ] **Step 1: Abhängigkeiten installieren**

```bash
cd /f/DEV/autodarts-screens
npm init -y
npm install --save-dev electron electron-vite vite typescript vitest @types/node @vitejs/plugin-react @types/react @types/react-dom
npm install react react-dom
```

Keine Versionen festnageln. Was npm auflöst, landet in `package-lock.json` und ist damit reproduzierbar.

- [ ] **Step 2: `.gitattributes` anlegen**

Git hat beim Anlegen der Spec über Zeilenenden gewarnt. Das hier beendet das.

```
* text=auto eol=lf
*.png binary
*.jpg binary
*.ico binary
*.woff2 binary
```

- [ ] **Step 3: `package.json` auf die Projektwerte setzen**

```json
{
  "name": "autodarts-screens",
  "version": "0.1.0",
  "description": "Zwei Vollbildschirme fuer Autodarts-Matches: Spielerinfo neben der Scheibe, Broadcast-Ansicht fuer Zuschauer",
  "author": "Jan Geiger Networking <hey@bsbnet.eu>",
  "license": "MIT",
  "repository": "github:Jan-Geiger-Networking/autodarts-screens",
  "main": "./out/main/index.js",
  "type": "module",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: `electron.vite.config.ts` anlegen**

```ts
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: { build: { rollupOptions: { input: resolve('src/main/index.ts') } } },
  preload: { build: { rollupOptions: { input: resolve('src/preload/index.ts') } } },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          control: resolve('src/renderer/control/index.html'),
        },
      },
    },
  },
})
```

Die Einträge `player` und `spectator` kommen in Task 10 und in Plan 2 dazu.

- [ ] **Step 5: `tsconfig.json` anlegen**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

`noUncheckedIndexedAccess` ist Absicht: der Adapter greift laufend in Arrays, die aus fremden Daten stammen.

- [ ] **Step 6: Minimalen Hauptprozess anlegen**

`src/main/index.ts`:

```ts
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

function control() {
  const fenster = new BrowserWindow({
    width: 1100,
    height: 800,
    backgroundColor: '#020617',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  if (process.env.ELECTRON_RENDERER_URL) {
    fenster.loadURL(`${process.env.ELECTRON_RENDERER_URL}/control/index.html`)
  } else {
    fenster.loadFile(join(import.meta.dirname, '../renderer/control/index.html'))
  }
}

app.whenReady().then(control)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 7: Preload-Brücke anlegen**

`src/preload/index.ts`:

```ts
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('app', {
  version: process.env.npm_package_version ?? '0.1.0',
})
```

- [ ] **Step 8: Control-Renderer anlegen**

`src/renderer/control/index.html`:

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <title>Autodarts Screens</title>
  </head>
  <body>
    <div id="wurzel"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`src/renderer/control/main.tsx`:

```tsx
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('wurzel')!).render(<App />)
```

`src/renderer/control/App.tsx`:

```tsx
export function App() {
  return <h1>Autodarts Screens</h1>
}
```

- [ ] **Step 9: Prüfen, dass die Anwendung startet**

Run: `npm run dev`
Expected: Ein Fenster öffnet sich mit der Überschrift „Autodarts Screens". Keine Fehler in der Konsole.

Run: `npm run typecheck`
Expected: keine Ausgabe, Exit-Code 0.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: Projektgeruest mit Electron, Vite, React und TypeScript"
```

---

### Task 2: Rechtliche Pflichtangaben als Dateien

Steht bewusst früh. Die Angaben stammen aus Abschnitt 18.4 der Spec und werden von dort übernommen, nicht neu erfunden.

**Files:**
- Create: `LICENSE`, `SECURITY.md`, `PRIVACY.md`, `README.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: Abschnitt 18.4 der Spec
- Produces: Textbausteine, die Task 11 im Über-Panel anzeigt

- [ ] **Step 1: `LICENSE` anlegen**

Unveränderter MIT-Wortlaut mit der Copyright-Zeile:

```
MIT License

Copyright (c) 2026 Jan Geiger Networking
```

- [ ] **Step 2: `SECURITY.md` anlegen**

```markdown
# Sicherheitshinweise

## Schwachstellen melden

Melde Schwachstellen bitte per E-Mail an hey@bsbnet.eu, nicht als
oeffentliches GitHub-Issue.

Bitte angeben: betroffene Version, Beschreibung, Schritte zur
Nachvollziehbarkeit und moegliche Auswirkungen.

## Was du erwarten kannst

- Empfangsbestaetigung innerhalb von 5 Werktagen
- Erste Einschaetzung innerhalb von 10 Werktagen
- Wir informieren dich, bevor wir eine Behebung veroeffentlichen

Wir bitten darum, eine gemeldete Schwachstelle erst oeffentlich zu machen,
nachdem eine Behebung verfuegbar ist oder 90 Tage vergangen sind.

## Unterstuetzungszeitraum

Sicherheitsaktualisierungen werden fuer 36 Monate ab dem jeweiligen Release
bereitgestellt.

## Verantwortliche Stelle

Jan Geiger Networking, Inhaber Jan Geiger
Dorfstr. 10A, 32107 Bad Salzuflen, Deutschland
hey@bsbnet.eu
```

Umlaute im fertigen Repository ausschreiben; die Umschrift hier vermeidet nur Kodierungsprobleme beim Übertragen.

- [ ] **Step 3: `PRIVACY.md` anlegen**

Inhalt, Abschnitt für Abschnitt:

1. **Verantwortliche Stelle** — Jan Geiger Networking, Inhaber Jan Geiger, Dorfstr. 10A, 32107 Bad Salzuflen, Deutschland, hey@bsbnet.eu, +49 5222 9179070
2. **Welche Daten verarbeitet werden** — Zugangsdaten nimmt die Anwendung nicht entgegen, die Anmeldung erfolgt auf der Autodarts-Seite im eingebetteten Fenster; der Aktualisierungs-Token liegt lokal und verschlüsselt; Spielernamen, Anzeigenamen, Fotos und Ländercodes nur, soweit selbst eingetragen; Match-Ereignisse während des Spiels, gespeichert nur bei eingeschalteter Aufzeichnung
3. **Wo die Daten liegen** — ausschließlich lokal unter `%APPDATA%\autodarts-screens`, es gibt keinen Server dieser Anwendung
4. **Übermittlung an Dritte** — an Autodarts die zur Anmeldung und zum Abruf nötigen Anfragen, an GitHub die Prüfung auf neue Versionen; darüber hinaus nichts, keine Telemetrie
5. **Rechte** — Einsicht und Löschung jederzeit selbst möglich, Funktion „Alle lokalen Daten löschen" im Control-Fenster; Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch über die genannte Adresse; Beschwerderecht bei der Landesbeauftragten für Datenschutz und Informationsfreiheit Nordrhein-Westfalen

- [ ] **Step 4: `README.md` anlegen**

Enthält: Kurzbeschreibung, Installationshinweis mit dem Hinweis auf den unsignierten Installer und SmartScreen, Unterstützungszeitraum von 36 Monaten ab dem jeweiligen Release, Lizenz MIT, Verweise auf `SECURITY.md` und `PRIVACY.md`. Noch keine Überschrift für Screenshots — die kommt, wenn es welche gibt.

Dazu wörtlich:

```markdown
## Anbieterkennzeichnung

Angaben gemaess § 5 DDG

Jan Geiger Networking, Inhaber Jan Geiger
Dorfstr. 10A, 32107 Bad Salzuflen, Nordrhein-Westfalen, Deutschland

E-Mail: hey@bsbnet.eu
Telefon: +49 5222 9179070
Web: https://jgnet.eu

Rechtsform: Einzelunternehmen / Kleingewerbe
Kleinunternehmer nach § 19 UStG, keine Umsatzsteuer-Identifikationsnummer
Aufsichtsbehoerde: Gewerbeamt der Stadt Bad Salzuflen,
Rudolph-Brandes-Allee 19, 32105 Bad Salzuflen

## Streitbeilegung

Die Europaeische Kommission stellt eine Plattform zur Online-Streitbeilegung
bereit: https://ec.europa.eu/consumers/odr

Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor
einer Verbraucherschlichtungsstelle teilzunehmen.
```

- [ ] **Step 5: `CHANGELOG.md` anlegen**

```markdown
# Aenderungen

Das Format folgt Keep a Changelog, die Versionierung folgt Semantic Versioning.

## [Unveroeffentlicht]

### Hinzugefuegt
- Projektgeruest mit Electron, Vite, React und TypeScript
- Rechtliche Pflichtangaben
```

- [ ] **Step 6: Commit**

```bash
git add LICENSE SECURITY.md PRIVACY.md README.md CHANGELOG.md
git commit -m "docs: rechtliche Pflichtangaben nach EU-Vorgaben"
```

---

### Task 3: API-Erkundung — OAuth-Konfiguration ermitteln

Diese Aufgabe schreibt keinen Produktivcode. Sie stellt fest, wie die Anmeldung tatsächlich funktioniert. Ohne dieses Ergebnis sitzt jede spätere Aufgabe auf geratenen Werten.

**Files:**
- Create: `werkzeuge/erkundung-oauth.mjs`, `docs/autodarts-api.md`

**Interfaces:**
- Consumes: nichts
- Produces: `docs/autodarts-api.md` mit dem Abschnitt „OAuth", auf den Task 4 sich beruft

- [ ] **Step 1: Erkundungsskript schreiben**

`werkzeuge/erkundung-oauth.mjs`:

```js
// Liest die OpenID-Konfiguration von Autodarts und gibt sie lesbar aus.
// Aufruf: node werkzeuge/erkundung-oauth.mjs
const kandidaten = [
  'https://login.autodarts.com/realms/autodarts/.well-known/openid-configuration',
  'https://login.autodarts.io/realms/autodarts/.well-known/openid-configuration',
]

for (const url of kandidaten) {
  try {
    const antwort = await fetch(url)
    if (!antwort.ok) {
      console.log(`${url} -> HTTP ${antwort.status}`)
      continue
    }
    const k = await antwort.json()
    console.log(`\nGefunden: ${url}`)
    console.log('issuer:                ', k.issuer)
    console.log('authorization_endpoint:', k.authorization_endpoint)
    console.log('token_endpoint:        ', k.token_endpoint)
    console.log('end_session_endpoint:  ', k.end_session_endpoint)
    console.log('code_challenge_methods:', k.code_challenge_methods_supported)
    console.log('grant_types_supported: ', k.grant_types_supported)
  } catch (fehler) {
    console.log(`${url} -> ${fehler.message}`)
  }
}
```

- [ ] **Step 2: Skript ausführen**

Run: `node werkzeuge/erkundung-oauth.mjs`
Expected: Für mindestens eine Adresse erscheinen `authorization_endpoint` und `token_endpoint`, und `code_challenge_methods_supported` enthält `S256`.

Schlagen beide fehl, liefert Schritt 3 die richtige Adresse mit; dann Kandidatenliste ergänzen und erneut ausführen.

- [ ] **Step 3: Client-Kennung ablesen (manueller Schritt, Jan führt ihn aus)**

Die Client-Kennung steht in keiner öffentlichen Dokumentation und wird abgelesen, nicht geraten:

1. In Chrome oder Edge die Entwicklerwerkzeuge öffnen, Reiter „Netzwerk", Haken bei „Protokoll beibehalten"
2. `https://autodarts.io` aufrufen und auf Anmelden klicken
3. In der Anfrageliste die Weiterleitung auf den Anmeldeserver suchen. Deren Adresse enthält `client_id`, `redirect_uri`, `response_type`, `scope` und `code_challenge_method`
4. Diese Werte notieren

- [ ] **Step 4: Ergebnis festhalten**

`docs/autodarts-api.md` anlegen mit dem Abschnitt „OAuth": Aussteller, Autorisierungs-Endpunkt, Token-Endpunkt, Client-Kennung, unterstützte Ablaufarten, das für eine Desktop-Anwendung verwendete Umleitungsziel, Datum der Feststellung.

Erlaubt die Client-Kennung der Weboberfläche kein Umleitungsziel außerhalb von `autodarts.io`, ist das hier zu vermerken. Die Anwendung fängt die Umleitung dann im eingebetteten Fenster ab, statt einen lokalen Server zu betreiben — bei Electron der übliche Weg, und es braucht kein zusätzlich freigeschaltetes Ziel.

- [ ] **Step 5: Commit**

```bash
git add werkzeuge/erkundung-oauth.mjs docs/autodarts-api.md
git commit -m "docs: OAuth-Konfiguration von Autodarts ermittelt und festgehalten"
```

---

### Task 4: Anmeldung im eingebetteten Fenster

**Files:**
- Create: `src/autodarts/oauth.ts`, `src/autodarts/oauth.test.ts`
- Modify: `src/main/index.ts`

**Interfaces:**
- Consumes: die in `docs/autodarts-api.md` festgehaltenen Werte
- Produces:
  - `pkcePaar(): { verifier: string; challenge: string }`
  - `anmelden(): Promise<void>`
  - `zugriffsToken(): Promise<string>`
  - `abmelden(): Promise<void>`
  - `istAngemeldet(): Promise<boolean>`

- [ ] **Step 1: Test für die PKCE-Erzeugung schreiben**

`src/autodarts/oauth.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { pkcePaar } from './oauth'

describe('pkcePaar', () => {
  it('erzeugt einen Verifier zwischen 43 und 128 Zeichen', () => {
    const { verifier } = pkcePaar()
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier.length).toBeLessThanOrEqual(128)
  })

  it('verwendet nur erlaubte Zeichen', () => {
    expect(pkcePaar().verifier).toMatch(/^[A-Za-z0-9\-._~]+$/)
  })

  it('challenge ist der base64url-kodierte SHA-256 des Verifiers', () => {
    const { verifier, challenge } = pkcePaar()
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'))
  })

  it('erzeugt bei jedem Aufruf ein anderes Paar', () => {
    expect(pkcePaar().verifier).not.toBe(pkcePaar().verifier)
  })
})
```

- [ ] **Step 2: Test ausführen und Fehlschlag bestätigen**

Run: `npx vitest run src/autodarts/oauth.test.ts`
Expected: FAIL, `Failed to resolve import "./oauth"`

- [ ] **Step 3: PKCE-Erzeugung implementieren**

Erster Teil von `src/autodarts/oauth.ts`:

```ts
import { createHash, randomBytes } from 'node:crypto'

export function pkcePaar(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}
```

`randomBytes(48).toString('base64url')` liefert 64 Zeichen aus dem erlaubten Alphabet.

- [ ] **Step 4: Test ausführen und Erfolg bestätigen**

Run: `npx vitest run src/autodarts/oauth.test.ts`
Expected: 4 Tests bestanden

- [ ] **Step 5: Anmeldeablauf implementieren**

Weiter in `src/autodarts/oauth.ts`. `AUTORISIERUNG`, `TOKEN`, `CLIENT_ID` und `UMLEITUNG` werden aus `docs/autodarts-api.md` abgeschrieben.

```ts
import { app, BrowserWindow, safeStorage, session } from 'electron'
import { readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'

const ABLAGE = () => join(app.getPath('userData'), 'anmeldung.bin')

type Ablage = { refreshToken: string }

let zugriff: { token: string; laeuftAbUm: number } | null = null

async function ablageSchreiben(daten: Ablage): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Verschluesselte Ablage steht auf diesem System nicht zur Verfuegung')
  }
  await writeFile(ABLAGE(), safeStorage.encryptString(JSON.stringify(daten)))
}

async function ablageLesen(): Promise<Ablage | null> {
  try {
    return JSON.parse(safeStorage.decryptString(await readFile(ABLAGE()))) as Ablage
  } catch {
    return null
  }
}

export async function abmelden(): Promise<void> {
  zugriff = null
  await rm(ABLAGE(), { force: true })
}
```

`anmelden()` öffnet ein modales `BrowserWindow` in eigener Sitzung (`session.fromPartition('persist:autodarts-anmeldung')`) auf den Autorisierungs-Endpunkt mit `code_challenge`, hört auf `will-redirect` und `will-navigate`, bricht ab, sobald die Zieladresse mit dem Umleitungsziel beginnt, entnimmt den Parameter `code`, tauscht ihn am Token-Endpunkt gegen Zugriffs- und Aktualisierungs-Token, schreibt den Aktualisierungs-Token in die Ablage und schließt das Fenster. Bricht der Nutzer ab, wird ein Fehler mit der Meldung `Anmeldung abgebrochen` geworfen.

`zugriffsToken()` liefert den zwischengespeicherten Token, solange er noch mindestens 60 Sekunden gültig ist, und erneuert ihn sonst. Schlägt die Erneuerung fehl, wird die Ablage verworfen und ein Fehler geworfen, den das Control-Fenster in „Bitte erneut anmelden" übersetzt.

- [ ] **Step 6: Anmeldung von Hand prüfen**

`src/main/index.ts` vorübergehend so erweitern, dass beim Start `anmelden()` läuft und das Token gekürzt in die Konsole geht.

Run: `npm run dev`
Expected: Das Anmeldefenster öffnet sich auf der Autodarts-Anmeldeseite. Anmeldung mit dem Google-Konto funktioniert. Danach schließt sich das Fenster, in der Konsole steht ein Token. Beim zweiten Start erscheint kein Anmeldefenster mehr.

Den vorübergehenden Aufruf danach entfernen.

- [ ] **Step 7: Commit**

```bash
git add src/autodarts/oauth.ts src/autodarts/oauth.test.ts src/main/index.ts
git commit -m "feat: Anmeldung bei Autodarts per OAuth mit PKCE im eingebetteten Fenster"
```

---

### Task 5: API-Erkundung — Ereignisse aufzeichnen

**Files:**
- Create: `src/autodarts/rest.ts`, `src/autodarts/websocket.ts`, `werkzeuge/erkundung-mitschnitt.ts`
- Create: `docs/fixtures/match.jsonl`
- Modify: `docs/autodarts-api.md`

**Interfaces:**
- Consumes: `zugriffsToken()` aus Task 4
- Produces:
  - `holen<T>(pfad: string): Promise<T>`
  - `senden<T>(pfad: string, koerper: unknown): Promise<T>`
  - `verbinden(beiEreignis: (roh: unknown) => void): Promise<Verbindung>`
  - `Verbindung` mit `abonnieren(kanal: string, thema: string): void` und `schliessen(): void`
  - Eine Mitschnittdatei, die Task 7 als Testfixture verwendet

- [ ] **Step 1: REST-Grundlage implementieren**

`src/autodarts/rest.ts`:

```ts
import { zugriffsToken } from './oauth'

const BASIS = 'https://api.autodarts.com'

async function anfrage<T>(pfad: string, init: RequestInit = {}): Promise<T> {
  const token = await zugriffsToken()
  const antwort = await fetch(`${BASIS}${pfad}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  if (!antwort.ok) {
    throw new Error(`${init.method ?? 'GET'} ${pfad} -> HTTP ${antwort.status}`)
  }
  return (await antwort.json()) as T
}

export const holen = <T>(pfad: string) => anfrage<T>(pfad)
export const senden = <T>(pfad: string, koerper: unknown) =>
  anfrage<T>(pfad, { method: 'POST', body: JSON.stringify(koerper) })
```

- [ ] **Step 2: Boards abrufen und Struktur festhalten**

`werkzeuge/erkundung-mitschnitt.ts` beginnt mit `GET /bs/v0/boards` und gibt die Antwort vollständig aus.

Run: über einen vorübergehenden Aufruf in `src/main/index.ts` mit `npm run dev`
Expected: Eine Liste mit mindestens deinem Board. Board-Kennung und die tatsächlichen Feldnamen notieren.

- [ ] **Step 3: WebSocket-Verbindung herstellen**

`src/autodarts/websocket.ts`. Ablauf laut Community-Projekten, alle drei Punkte gelten als Annahme, bis sie hier bestätigt sind:

1. `POST /ms/v0/tickets` mit leerem Körper, liefert eine Zeichenkette als Ticket
2. Verbindung zu `wss://api.autodarts.com/ms/v0/subscribe?ticket=<ticket>`
3. Nach dem Öffnen Abonnements senden, Form `{"channel": "...", "type": "subscribe", "topic": "..."}`

Das Skript gibt jede empfangene Nachricht unverändert aus, damit Abweichungen sofort auffallen. Kein zusätzliches Paket: Electron liefert im Hauptprozess eine `WebSocket`-Implementierung mit.

Wiederverbindung mit wachsendem Abstand (1 s, 2 s, 4 s, … höchstens 30 s). Nach jeder Wiederverbindung wird der Match-Zustand per `GET /gs/v0/matches/{matchId}/state` neu geladen, statt Ereignisse zu raten.

- [ ] **Step 4: Board-Kanal abonnieren und ein Match spielen (manueller Schritt, Jan führt ihn aus)**

Run: `npm run dev` mit aktivem Mitschnitt
Expected: Nach dem Start erscheinen Board-Ereignisse. Sobald auf autodarts.io ein X01-Match startet, erscheint eine Match-Kennung. Ein vollständiges Leg wird gespielt, dabei mindestens einmal ein Bust und einmal ein Spielerwechsel ausgelöst.

Alle Nachrichten werden mit Zeitstempel als JSON-Zeilen nach `docs/fixtures/match.jsonl` geschrieben.

- [ ] **Step 5: Schema aus dem Mitschnitt ableiten**

`docs/autodarts-api.md` um den Abschnitt „Live-Ereignisse" ergänzen: tatsächliche Kanal- und Themennamen, je ein gekürztes Beispiel pro Ereignisart, und eine Tabelle, die jedes Feld des `MatchState` aus Abschnitt 6 der Spec auf seine Herkunft im Rohereignis abbildet. Felder ohne Entsprechung werden ausdrücklich als „muss selbst berechnet werden" markiert.

Der Mitschnitt enthält den Anzeigenamen des Autodarts-Kontos — das ist gewollt, damit die Fixture realistisch ist. Vor dem Commit prüfen, dass keine Token und keine E-Mail-Adressen darin stehen; falls doch, diese Felder durch `"<entfernt>"` ersetzen.

- [ ] **Step 6: Commit**

```bash
git add src/autodarts/rest.ts src/autodarts/websocket.ts werkzeuge/ docs/
git commit -m "feat: REST- und WebSocket-Anbindung, Ereignisschema aus echtem Match dokumentiert"
```

---

### Task 6: Checkout-Tabelle

Hängt an keiner anderen Aufgabe und kann parallel zu Task 3 bis 5 laufen.

**Files:**
- Create: `src/shared/checkout.ts`, `src/shared/checkout.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `checkoutWeg(rest: number, dartsUebrig?: 1 | 2 | 3): string[] | null`
  - `setupWurf(rest: number): string | null`
  - `BOGEY_ZAHLEN: ReadonlySet<number>`

- [ ] **Step 1: Test schreiben**

`src/shared/checkout.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BOGEY_ZAHLEN, checkoutWeg, setupWurf } from './checkout'

const WERT: Record<string, number> = (() => {
  const w: Record<string, number> = { '25': 25, BULL: 50 }
  for (let n = 1; n <= 20; n++) {
    w[`${n}`] = n
    w[`D${n}`] = n * 2
    w[`T${n}`] = n * 3
  }
  return w
})()

const istDoppel = (name: string) => name === 'BULL' || name.startsWith('D')

describe('checkoutWeg', () => {
  it('liefert die gaengigen Wege', () => {
    expect(checkoutWeg(170)).toEqual(['T20', 'T20', 'BULL'])
    expect(checkoutWeg(167)).toEqual(['T20', 'T19', 'BULL'])
    expect(checkoutWeg(141)).toEqual(['T20', 'T19', 'D12'])
    expect(checkoutWeg(100)).toEqual(['T20', 'D20'])
    expect(checkoutWeg(81)).toEqual(['T19', 'D12'])
    expect(checkoutWeg(60)).toEqual(['20', 'D20'])
    expect(checkoutWeg(50)).toEqual(['BULL'])
    expect(checkoutWeg(40)).toEqual(['D20'])
    expect(checkoutWeg(32)).toEqual(['D16'])
    expect(checkoutWeg(2)).toEqual(['D1'])
  })

  it('jeder gelieferte Weg ist gueltig', () => {
    for (let rest = 2; rest <= 170; rest++) {
      const weg = checkoutWeg(rest)
      if (weg === null) continue
      expect(weg.length, `Rest ${rest}`).toBeLessThanOrEqual(3)
      expect(weg.reduce((s, d) => s + WERT[d]!, 0), `Rest ${rest}`).toBe(rest)
      expect(istDoppel(weg[weg.length - 1]!), `Rest ${rest}`).toBe(true)
    }
  })

  it('genau die Bogey-Zahlen haben keinen Weg', () => {
    const ohneWeg: number[] = []
    for (let rest = 2; rest <= 170; rest++) {
      if (checkoutWeg(rest) === null) ohneWeg.push(rest)
    }
    expect(ohneWeg).toEqual([159, 162, 163, 165, 166, 168, 169])
    expect([...BOGEY_ZAHLEN].sort((a, b) => a - b)).toEqual(ohneWeg)
  })

  it('liefert nichts fuer 1 und fuer mehr als 170', () => {
    expect(checkoutWeg(1)).toBeNull()
    expect(checkoutWeg(171)).toBeNull()
    expect(checkoutWeg(501)).toBeNull()
  })

  it('beruecksichtigt die Anzahl der verbleibenden Darts', () => {
    expect(checkoutWeg(40, 1)).toEqual(['D20'])
    expect(checkoutWeg(100, 1)).toBeNull()
    expect(checkoutWeg(100, 2)).toEqual(['T20', 'D20'])
    expect(checkoutWeg(141, 2)).toBeNull()
  })
})

describe('setupWurf', () => {
  it('empfiehlt einen Wurf, der eine ausmachbare Zahl uebrig laesst', () => {
    for (const rest of [...BOGEY_ZAHLEN, 171, 200, 301, 501]) {
      const wurf = setupWurf(rest)
      expect(wurf, `Rest ${rest}`).not.toBeNull()
      const uebrig = rest - WERT[wurf!]!
      expect(uebrig, `Rest ${rest}`).toBeGreaterThanOrEqual(2)
      expect(checkoutWeg(uebrig), `Rest ${rest} laesst ${uebrig}`).not.toBeNull()
    }
  })

  it('liefert nichts, wenn der Rest selbst ausmachbar ist', () => {
    expect(setupWurf(40)).toBeNull()
    expect(setupWurf(141)).toBeNull()
  })
})
```

- [ ] **Step 2: Test ausführen und Fehlschlag bestätigen**

Run: `npx vitest run src/shared/checkout.test.ts`
Expected: FAIL, `Failed to resolve import "./checkout"`

- [ ] **Step 3: Implementieren**

`src/shared/checkout.ts`:

```ts
type Feld = { name: string; wert: number; doppel: boolean }

// Reihenfolge steuert, welcher von mehreren gueltigen Wegen gewaehlt wird.
const FELDER: Feld[] = (() => {
  const zahlen = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
  const f: Feld[] = []
  for (const n of zahlen) f.push({ name: `T${n}`, wert: n * 3, doppel: false })
  for (const n of zahlen) f.push({ name: `${n}`, wert: n, doppel: false })
  f.push({ name: '25', wert: 25, doppel: false })
  for (const n of zahlen) f.push({ name: `D${n}`, wert: n * 2, doppel: true })
  f.push({ name: 'BULL', wert: 50, doppel: true })
  return f
})()

const DOPPEL = FELDER.filter((f) => f.doppel)

// Doppel, die Spieler tatsaechlich anvisieren. Alles andere ist zweite Wahl.
const BEVORZUGTE_DOPPEL = new Set(['D20', 'D16', 'D18', 'D12', 'D10', 'D8', 'D4', 'D2'])

type Kandidat = { weg: string[]; stufe: number; aufbau: number }

function kandidaten(rest: number, darts: number): Kandidat[] {
  const gefunden: Kandidat[] = []

  const suchen = (offen: number, uebrig: number, weg: string[], aufbau: number) => {
    for (const d of DOPPEL) {
      if (d.wert === offen) {
        gefunden.push({
          weg: [...weg, d.name],
          stufe: BEVORZUGTE_DOPPEL.has(d.name) ? 0 : 1,
          aufbau,
        })
      }
    }
    if (uebrig <= 1) return
    for (const f of FELDER) {
      if (f.wert < offen) suchen(offen - f.wert, uebrig - 1, [...weg, f.name], aufbau + f.wert)
    }
  }

  suchen(rest, darts, [], 0)
  return gefunden
}

/**
 * Gaengiger Weg, den Rest mit hoechstens `dartsUebrig` Darts auf einem Doppel
 * zu beenden. `null`, wenn es keinen gibt.
 *
 * ponytail: erschoepfende Suche ueber hoechstens drei Darts, im schlimmsten
 * Fall rund 62^2 Kombinationen. Billiger als eine gepflegte Tabelle, und die
 * Vorlieben unten sind damit eine Stellschraube statt 170 Handeintraegen.
 */
export function checkoutWeg(rest: number, dartsUebrig: 1 | 2 | 3 = 3): string[] | null {
  if (!Number.isInteger(rest) || rest < 2 || rest > 170) return null
  const alle = kandidaten(rest, dartsUebrig)
  if (alle.length === 0) return null
  alle.sort(
    (a, b) => a.weg.length - b.weg.length || a.stufe - b.stufe || b.aufbau - a.aufbau,
  )
  return alle[0]!.weg
}

export const BOGEY_ZAHLEN: ReadonlySet<number> = new Set(
  Array.from({ length: 169 }, (_, i) => i + 2).filter((r) => checkoutWeg(r) === null),
)

/**
 * Wurf, der einen nicht ausmachbaren Rest in einen ausmachbaren verwandelt.
 * `null`, wenn der Rest bereits ausmachbar ist.
 */
export function setupWurf(rest: number): string | null {
  if (checkoutWeg(rest) !== null) return null
  for (const f of FELDER) {
    const uebrig = rest - f.wert
    if (uebrig >= 2 && checkoutWeg(uebrig) !== null) return f.name
  }
  return null
}
```

- [ ] **Step 4: Test ausführen und Erfolg bestätigen**

Run: `npx vitest run src/shared/checkout.test.ts`
Expected: alle Tests bestanden

Schlägt „liefert die gaengigen Wege" fehl, ist die Sortierung die Stellschraube, nicht der Test: erst Dartzahl, dann Stufe, dann höchster Aufbau. Die erwarteten Werte sind die Wege, die Spieler tatsächlich werfen, und bleiben stehen.

- [ ] **Step 5: Commit**

```bash
git add src/shared/checkout.ts src/shared/checkout.test.ts
git commit -m "feat: Checkout-Wege und Setup-Empfehlung mit Tests"
```

---

### Task 7: MatchState-Typen und Adapter

**Files:**
- Create: `src/shared/typen.ts`, `src/autodarts/adapter.ts`, `src/autodarts/adapter.test.ts`

**Interfaces:**
- Consumes: `docs/autodarts-api.md` Abschnitt „Live-Ereignisse", die Fixture aus Task 5, `checkoutWeg` und `setupWurf` aus Task 6
- Produces:
  - alle Typen aus Abschnitt 6 der Spec, wörtlich übernommen
  - `leererZustand(): MatchState`
  - `anwenden(zustand: MatchState, roh: unknown): MatchState` — rein, ohne Seiteneffekte

- [ ] **Step 1: Typen anlegen**

`src/shared/typen.ts` enthält `Segment`, `LegEntry`, `Player`, `PlayerScore`, `MatchState` und `MatchEvent` genau wie in Abschnitt 6 der Spec. Keine Abweichung, keine zusätzlichen Felder.

- [ ] **Step 2: Test gegen die echte Aufzeichnung schreiben**

`src/autodarts/adapter.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { anwenden, leererZustand } from './adapter'
import type { MatchState } from '../shared/typen'

const zeilen = readFileSync('docs/fixtures/match.jsonl', 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((z) => JSON.parse(z))

function abspielen(): MatchState[] {
  const verlauf: MatchState[] = []
  let zustand = leererZustand()
  for (const zeile of zeilen) {
    zustand = anwenden(zustand, zeile.daten)
    verlauf.push(zustand)
  }
  return verlauf
}

describe('anwenden', () => {
  it('kommt vom Ruhezustand ins Spiel', () => {
    const verlauf = abspielen()
    expect(verlauf[0]!.phase).toBe('idle')
    expect(verlauf.some((z) => z.phase === 'playing')).toBe(true)
  })

  it('erkennt beide Spieler', () => {
    const letzter = abspielen().at(-1)!
    expect(letzter.players.length).toBe(2)
    expect(letzter.players.every((s) => s.displayName.length > 0)).toBe(true)
  })

  it('laesst den Rest-Score nie unter null fallen', () => {
    for (const z of abspielen()) {
      for (const s of z.scores) expect(s.remaining).toBeGreaterThanOrEqual(0)
    }
  })

  it('setzt bei einem Bust den Rest-Score auf den Wert vor dem Wurf zurueck', () => {
    const verlauf = abspielen()
    const index = verlauf.findIndex((z) => z.bust)
    expect(index, 'Aufzeichnung enthaelt keinen Bust').toBeGreaterThan(0)
    const spieler = verlauf[index]!.activePlayerId
    const vorher = verlauf[index - 1]!.scores.find((s) => s.playerId === spieler)!.remaining
    const nachher = verlauf[index]!.scores.find((s) => s.playerId === spieler)!.remaining
    expect(nachher).toBe(vorher)
  })

  it('zaehlt Legs nur aufwaerts', () => {
    let vorher = 0
    for (const z of abspielen()) {
      const jetzt = z.scores.reduce((s, p) => s + p.legs, 0)
      expect(jetzt).toBeGreaterThanOrEqual(vorher)
      vorher = jetzt
    }
  })

  it('vergibt aufsteigende Sequenznummern', () => {
    const nummern = abspielen()
      .map((z) => z.lastEvent?.seq)
      .filter((n): n is number => n !== undefined)
    for (let i = 1; i < nummern.length; i++) {
      expect(nummern[i]!).toBeGreaterThanOrEqual(nummern[i - 1]!)
    }
  })

  it('setzt entweder checkout oder checkoutHint, nie beides', () => {
    for (const z of abspielen()) {
      expect(z.checkout !== null && z.checkoutHint !== null).toBe(false)
    }
  })

  it('aendert den uebergebenen Zustand nicht', () => {
    const start = leererZustand()
    const kopie = structuredClone(start)
    anwenden(start, zeilen[0]!.daten)
    expect(start).toEqual(kopie)
  })
})
```

Den Dateinamen der Fixture an den tatsächlichen aus Task 5 anpassen.

- [ ] **Step 3: Test ausführen und Fehlschlag bestätigen**

Run: `npx vitest run src/autodarts/adapter.test.ts`
Expected: FAIL, `Failed to resolve import "./adapter"`

- [ ] **Step 4: Adapter implementieren**

`src/autodarts/adapter.ts`. Die Feldzuordnung folgt der Tabelle aus `docs/autodarts-api.md`. Regeln, die unabhängig vom Schema gelten:

- `anwenden` gibt immer einen neuen Zustand zurück und verändert den übergebenen nie
- Ein Ereignis unbekannter Art wird über `console.warn` protokolliert und gibt den unveränderten Zustand zurück
- `checkout` und `checkoutHint` werden nach jedem Wurf neu aus dem Rest des aktiven Spielers und der Zahl verbleibender Darts berechnet; genau eins von beiden ist gesetzt
- `lastEvent.seq` zählt ein Zähler im Zustand hoch, nicht das Rohereignis
- Ein Wurf mit 180 Punkten erzeugt `oneEighty`; ein gewonnenes Leg mit einem Rest von mindestens 100 zusätzlich `highFinish`

- [ ] **Step 5: Test ausführen und Erfolg bestätigen**

Run: `npx vitest run src/autodarts/adapter.test.ts`
Expected: alle Tests bestanden

- [ ] **Step 6: Commit**

```bash
git add src/shared/typen.ts src/autodarts/adapter.ts src/autodarts/adapter.test.ts
git commit -m "feat: MatchState-Typen und Adapter gegen echte Match-Aufzeichnung"
```

---

### Task 8: Aufzeichnung und Wiedergabe

**Files:**
- Create: `src/autodarts/aufzeichnung.ts`, `src/autodarts/aufzeichnung.test.ts`
- Modify: `src/autodarts/websocket.ts`

**Interfaces:**
- Consumes: nichts außer den Typen
- Produces:
  - `aufzeichnungStarten(pfad: string): (roh: unknown) => void`
  - `aufzeichnungBeenden(): Promise<void>`
  - `wiedergeben(pfad: string, beiEreignis: (roh: unknown) => void, tempo?: number): Promise<void>`

- [ ] **Step 1: Test schreiben**

`src/autodarts/aufzeichnung.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { aufzeichnungBeenden, aufzeichnungStarten, wiedergeben } from './aufzeichnung'

const neuerPfad = () => join(mkdtempSync(join(tmpdir(), 'ad-')), 'mitschnitt.jsonl')

describe('Aufzeichnung und Wiedergabe', () => {
  it('schreibt eine JSON-Zeile je Ereignis, mit Zeitstempel', async () => {
    const pfad = neuerPfad()
    const schreiben = aufzeichnungStarten(pfad)
    schreiben({ a: 1 })
    schreiben({ b: 2 })
    await aufzeichnungBeenden()

    const zeilen = readFileSync(pfad, 'utf8').trim().split('\n').map((z) => JSON.parse(z))
    expect(zeilen.length).toBe(2)
    expect(zeilen[0]!.daten).toEqual({ a: 1 })
    expect(typeof zeilen[0]!.t).toBe('number')
    expect(zeilen[1]!.t).toBeGreaterThanOrEqual(zeilen[0]!.t)
  })

  it('gibt in derselben Reihenfolge wieder', async () => {
    const pfad = neuerPfad()
    const schreiben = aufzeichnungStarten(pfad)
    schreiben({ nr: 1 })
    schreiben({ nr: 2 })
    schreiben({ nr: 3 })
    await aufzeichnungBeenden()

    const gesehen: unknown[] = []
    await wiedergeben(pfad, (roh) => gesehen.push(roh), 0)
    expect(gesehen).toEqual([{ nr: 1 }, { nr: 2 }, { nr: 3 }])
  })

  it('haelt bei Tempo 1 die urspruenglichen Abstaende ein', async () => {
    const pfad = neuerPfad()
    const schreiben = aufzeichnungStarten(pfad)
    schreiben({ nr: 1 })
    await new Promise((r) => setTimeout(r, 60))
    schreiben({ nr: 2 })
    await aufzeichnungBeenden()

    const start = Date.now()
    await wiedergeben(pfad, () => {}, 1)
    expect(Date.now() - start).toBeGreaterThanOrEqual(50)
  })
})
```

- [ ] **Step 2: Test ausführen und Fehlschlag bestätigen**

Run: `npx vitest run src/autodarts/aufzeichnung.test.ts`
Expected: FAIL, `Failed to resolve import "./aufzeichnung"`

- [ ] **Step 3: Implementieren**

`src/autodarts/aufzeichnung.ts`. Jede Zeile ist `{"t": <Millisekunden seit Beginn>, "daten": <Rohereignis>}`. Geschrieben wird über einen `WriteStream`; `aufzeichnungBeenden` schließt ihn und wartet auf `finish`. `wiedergeben` liest zeilenweise und wartet zwischen zwei Zeilen `(t2 - t1) / tempo` Millisekunden, bei `tempo === 0` ohne Warten.

- [ ] **Step 4: Test ausführen und Erfolg bestätigen**

Run: `npx vitest run src/autodarts/aufzeichnung.test.ts`
Expected: 3 Tests bestanden

- [ ] **Step 5: In die WebSocket-Anbindung einhängen**

`src/autodarts/websocket.ts` so erweitern, dass `AD_AUFZEICHNEN=<pfad>` den Mitschnitt einschaltet und `AD_WIEDERGABE=<pfad>` die Verbindung ganz ersetzt. Im Wiedergabefall wird kein Token angefordert und keine Verbindung geöffnet — die Anwendung läuft dann vollständig ohne Netz.

- [ ] **Step 6: Wiedergabe von Hand prüfen**

Run: `AD_WIEDERGABE=docs/fixtures/beispiel-wiedergabe.jsonl npm run dev`
Expected: Die Anwendung startet ohne Anmeldefenster und verarbeitet die aufgezeichneten Ereignisse.

- [ ] **Step 7: Commit**

```bash
git add src/autodarts/aufzeichnung.ts src/autodarts/aufzeichnung.test.ts src/autodarts/websocket.ts
git commit -m "feat: Aufzeichnung und Wiedergabe von Match-Ereignissen"
```

---

### Task 9: Konfiguration und Monitor-Auswahl

**Files:**
- Create: `src/main/konfiguration.ts`, `src/main/konfiguration.test.ts`, `src/main/monitore.ts`
- Modify: `src/main/index.ts`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `Konfiguration = { boardId: string | null; playerDisplayId: number | null; spectatorDisplayId: number | null }`
  - `standardKonfiguration: Konfiguration`
  - `zusammenfuehren(roh: unknown): Konfiguration`
  - `konfigurationLesen(): Promise<Konfiguration>`, `konfigurationSchreiben(k: Konfiguration): Promise<void>`
  - `monitoreAuflisten(): { id: number; breite: number; hoehe: number; skalierung: number; primaer: boolean; beschriftung: string }[]`
  - `monitoreIdentifizieren(): void`
  - `monitorFuer(id: number | null): Electron.Display`

- [ ] **Step 1: Test für die Konfiguration schreiben**

`src/main/konfiguration.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { standardKonfiguration, zusammenfuehren } from './konfiguration'

describe('zusammenfuehren', () => {
  it('ergaenzt fehlende Felder aus der Standardkonfiguration', () => {
    expect(zusammenfuehren({ boardId: 'abc' })).toEqual({
      ...standardKonfiguration,
      boardId: 'abc',
    })
  })

  it('verwirft unbekannte Felder', () => {
    expect('unsinn' in zusammenfuehren({ boardId: 'abc', unsinn: 42 })).toBe(false)
  })

  it('verwirft Werte vom falschen Typ', () => {
    expect(zusammenfuehren({ playerDisplayId: 'nein' }).playerDisplayId).toBeNull()
  })

  it('liefert bei kaputtem Inhalt die Standardkonfiguration', () => {
    expect(zusammenfuehren(null)).toEqual(standardKonfiguration)
    expect(zusammenfuehren('unfug')).toEqual(standardKonfiguration)
    expect(zusammenfuehren([])).toEqual(standardKonfiguration)
  })
})
```

`zusammenfuehren` nimmt `unknown` entgegen, damit der Test keine Typumgehung braucht — das ist auch die ehrliche Signatur, weil der Inhalt aus einer Datei stammt.

- [ ] **Step 2: Test ausführen und Fehlschlag bestätigen**

Run: `npx vitest run src/main/konfiguration.test.ts`
Expected: FAIL, `Failed to resolve import "./konfiguration"`

- [ ] **Step 3: Konfiguration implementieren**

`src/main/konfiguration.ts` mit `standardKonfiguration`, `zusammenfuehren` als reiner Funktion ohne Electron-Import, und den beiden Dateifunktionen, die `config.json` unter `app.getPath('userData')` lesen und schreiben. Eine nicht lesbare oder kaputte Datei führt zur Standardkonfiguration, nicht zum Absturz.

Der Electron-Import gehört in eine eigene Datei oder hinter eine späte Einbindung, damit `konfiguration.test.ts` ohne laufendes Electron durchläuft.

- [ ] **Step 4: Test ausführen und Erfolg bestätigen**

Run: `npx vitest run src/main/konfiguration.test.ts`
Expected: 4 Tests bestanden

- [ ] **Step 5: Monitor-Verwaltung implementieren**

`src/main/monitore.ts`. `monitoreIdentifizieren` erzeugt je Monitor ein rahmenloses, klickdurchlässiges Fenster (`transparent: true`, `alwaysOnTop: true`, `setIgnoreMouseEvents(true)`) mit einer großen Ziffer auf dunklem Grund und schließt es nach 2 Sekunden. `beschriftung` lautet `"1 — 3840×2160 (primaer)"`, damit die Auswahl im Control-Fenster ohne weitere Logik lesbar ist. `monitorFuer` fällt auf den primären Monitor zurück, wenn die gespeicherte Kennung nicht mehr existiert.

- [ ] **Step 6: Von Hand prüfen**

Run: `npm run dev`, `monitoreIdentifizieren()` über einen vorübergehenden Knopf auslösen
Expected: Auf jedem angeschlossenen Monitor erscheint zwei Sekunden lang eine Ziffer, passend zur Reihenfolge aus `monitoreAuflisten()`.

- [ ] **Step 7: Commit**

```bash
git add src/main/konfiguration.ts src/main/konfiguration.test.ts src/main/monitore.ts src/main/index.ts
git commit -m "feat: Konfigurationsablage und Monitor-Auswahl mit Identify-Einblendung"
```

---

### Task 10: Fensterverwaltung und IPC

**Files:**
- Create: `src/main/fenster.ts`, `src/main/ipc.ts`
- Create: `src/renderer/player/index.html`, `src/renderer/player/main.tsx`
- Modify: `src/preload/index.ts`, `src/main/index.ts`, `electron.vite.config.ts`

**Interfaces:**
- Consumes: `monitorFuer` und die Konfiguration aus Task 9
- Produces:
  - `fensterOeffnen(art: 'control' | 'player' | 'spectator'): BrowserWindow`
  - `fensterSchliessen(art: 'control' | 'player' | 'spectator'): void`
  - `zustandVerteilen(z: MatchState): void`
  - im Renderer: `window.app.beiZustand(rueckruf: (z: MatchState) => void): () => void`
  - im Renderer: `window.app.monitore()`, `window.app.monitoreIdentifizieren()`, `window.app.konfigurationSetzen(teil)`, `window.app.anmelden()`, `window.app.abmelden()`

- [ ] **Step 1: Einstiegspunkt für den Player-Renderer ergänzen**

In `electron.vite.config.ts` `player: resolve('src/renderer/player/index.html')` ergänzen. `index.html` und `main.tsx` analog zum Control-Fenster anlegen, vorerst mit leerer Komponente.

- [ ] **Step 2: Fensterverwaltung implementieren**

`src/main/fenster.ts`. Player und Spectator werden mit `x` und `y` aus `monitorFuer(...).bounds` erzeugt, danach `setFullScreen(true)`. Beide rahmenlos, `backgroundColor: '#020617'`, `autoHideMenuBar: true`. Escape verlässt den Vollbildmodus über `before-input-event`. Ein Fenster wird nie doppelt geöffnet; ein erneuter Aufruf holt das vorhandene nach vorn.

- [ ] **Step 3: IPC implementieren**

`src/main/ipc.ts`. `zustandVerteilen` schickt den `MatchState` per `webContents.send('zustand', z)` an alle offenen Fenster. Anfragen aus dem Renderer laufen über `ipcMain.handle`. Es gibt keinen Kanal, über den ein Renderer ein Token oder eine Adresse erfragen könnte.

- [ ] **Step 4: Preload erweitern**

`src/preload/index.ts` stellt genau die unter „Produces" genannten Funktionen bereit, nichts darüber hinaus. `beiZustand` gibt eine Abmeldefunktion zurück, damit React den Zuhörer beim Aufräumen entfernen kann.

- [ ] **Step 5: Von Hand prüfen**

Run: `AD_WIEDERGABE=docs/fixtures/beispiel-wiedergabe.jsonl npm run dev`
Expected: Control- und Player-Fenster öffnen sich, das Player-Fenster im Vollbild auf dem eingestellten Monitor. Eine vorübergehende Ausgabe von `JSON.stringify(zustand)` im Player-Renderer zeigt eintreffende, sich ändernde Zustände. Escape verlässt den Vollbildmodus.

- [ ] **Step 6: Commit**

```bash
git add src/main/fenster.ts src/main/ipc.ts src/preload/index.ts src/main/index.ts electron.vite.config.ts src/renderer/player/
git commit -m "feat: Fensterverwaltung und IPC-Verteilung des MatchState"
```

---

### Task 11: Player-Screen und Control-Fenster

**Files:**
- Create: `assets/schriften/*.woff2`
- Create: `src/renderer/shared/tokens.css`
- Create: `src/renderer/player/App.tsx`, `src/renderer/player/App.css`
- Create: `src/renderer/control/UeberPanel.tsx`
- Modify: `src/renderer/control/App.tsx`, `CHANGELOG.md`

**Interfaces:**
- Consumes: `window.app.beiZustand`, `window.app.monitore`, `window.app.konfigurationSetzen`, `window.app.anmelden`
- Produces: nichts, was spätere Aufgaben verwenden

- [ ] **Step 1: Schriften einbetten**

Barlow Condensed (700, 800), DM Sans (400, 500, 700) und JetBrains Mono (400) als `woff2` nach `assets/schriften/`. Alle drei stehen unter der SIL Open Font License; deren Lizenztext kommt in Plan 2 nach `THIRD-PARTY-LICENSES.md`.

- [ ] **Step 2: Tokens übernehmen**

`src/renderer/shared/tokens.css` entsteht aus `Z:\SYNC\Dokumente\00-JGN--Prog\JGNet Design System\colors_and_type.css`. Die Zeile `@import url('https://fonts.googleapis.com/...')` wird ersatzlos gestrichen und durch `@font-face`-Regeln auf die Dateien aus Schritt 1 ersetzt. Die Werte der Tokens bleiben unverändert.

- [ ] **Step 3: Player-Screen bauen**

`src/renderer/player/App.tsx` nach Abschnitt 7 der Spec. Von oben nach unten: Statuszeile, Rest-Score, Checkout-Weg, Trennlinie, aktueller Wurf mit Summe.

Maße durchgehend relativ, damit die Darstellung auf jeder Auflösung trägt. `src/renderer/player/App.css`:

```css
.rest {
  font-family: var(--jg-font-display);
  font-size: 40vh;
  font-weight: 800;
  line-height: 0.9;
  color: var(--jg-text);
  font-variant-numeric: tabular-nums;
  transition: color 120ms var(--jg-ease);
}

.rest.bust {
  color: var(--jg-warning);
}

.checkout {
  font-family: var(--jg-font-display);
  font-size: 9vh;
  letter-spacing: 0.08em;
  color: var(--jg-accent);
  min-height: 1.2em;
}

.checkout.setup {
  color: var(--jg-muted);
}
```

`font-variant-numeric: tabular-nums` verhindert, dass die Zahl beim Herunterzählen springt. `min-height` auf der Checkout-Zeile hält das Layout ruhig, wenn weder Weg noch Empfehlung vorliegt.

Ist `checkout` gesetzt, erscheint der Weg in `--jg-accent`. Ist stattdessen `checkoutHint` gesetzt, erscheint dieser gedämpft mit vorangestelltem „Setup:". Ist keins von beidem gesetzt, bleibt die Zeile leer statt zu verschwinden.

Bei `phase === 'idle'` zeigt der Screen nur das Logo auf dunklem Grund.

- [ ] **Step 4: Control-Fenster ausbauen**

`src/renderer/control/App.tsx` bekommt vier Bereiche:

1. **Verbindung** — angemeldet als, Board-Auswahl, Verbindungszustand, Knöpfe „Anmelden" und „Abmelden"
2. **Monitore** — je eine Auswahlliste für Player und Spectator aus `window.app.monitore()`, daneben „Monitore anzeigen"
3. **Screens** — Knöpfe zum Öffnen und Schließen der Vollbildfenster
4. **Über** — `UeberPanel`

- [ ] **Step 5: Über-Panel bauen**

`src/renderer/control/UeberPanel.tsx` zeigt: Anwendungsname, Version aus `window.app.version`, Lizenz MIT, Unterstützungszeitraum von 36 Monaten ab dem jeweiligen Release, die vollständige Anbieterkennzeichnung aus Abschnitt 18.4 der Spec, den Hinweis auf `https://ec.europa.eu/consumers/odr` samt der Erklärung zur Nichtteilnahme, sowie die Datenschutz- und Sicherheitshinweise.

Die Texte werden im Renderer eingebettet, nicht zur Laufzeit aus den Markdown-Dateien gelesen — das Panel muss auch dann vollständig sein, wenn die Anwendung ohne Repository installiert ist.

- [ ] **Step 6: Von Hand prüfen**

Run: `AD_WIEDERGABE=docs/fixtures/beispiel-wiedergabe.jsonl npm run dev`
Expected:
- Der Player-Screen zeigt den Rest-Score des aktiven Spielers, aus mehreren Metern lesbar
- Bei einem Rest von 128 erscheint `T20 · T20 · D4`
- Bei einem Rest über 170 erscheint eine Setup-Empfehlung in gedämpftem Grau
- Ein Bust färbt die Zahl kurz rot
- Das Layout springt an keiner Stelle
- Das Über-Panel zeigt alle Pflichtangaben

Run: `npm run typecheck && npm test`
Expected: keine Fehler, alle Tests bestanden

- [ ] **Step 7: Changelog ergänzen und committen**

Unter „Unveroeffentlicht" ergänzen: Anmeldung bei Autodarts, Live-Anbindung, Aufzeichnung und Wiedergabe, Monitor-Auswahl, Player-Screen, Über-Panel.

```bash
git add -A
git commit -m "feat: Player-Screen und Control-Fenster mit Pflichtangaben"
```

---

## Nach diesem Plan

Die Anwendung startet, meldet sich an, erkennt das Match und zeigt neben der Scheibe live Rest-Score, Checkout und den aktuellen Wurf. Es gibt eine getestete Kernlogik und Aufzeichnungen, mit denen sich alles Weitere ohne Dartscheibe entwickeln lässt.

Plan 2 baut darauf auf: Spectator-Screen mit Szenen und Übergängen, Spieler-Verwaltung mit Fotos und Flaggen, Installer über electron-builder, Release-Workflow mit Stückliste und Fremdlizenzen, Auto-Update.

## Selbstprüfung

| Spec-Abschnitt | Aufgabe |
|---|---|
| 3 Technische Entscheidungen | Task 1 |
| 4 Architektur | Task 10 |
| 5.1–5.2 API-Stand und Erkundung | Task 3, Task 5 |
| 5.3 Record & Replay | Task 8 |
| 5.4 Adapter-Schicht | Task 7 |
| 5.5 Match-Erkennung | Task 5, Task 7 |
| 6 Datenmodell | Task 7 |
| 7 Player-Screen | Task 11 |
| 8 Spectator-Screen | Plan 2 |
| 9 Checkout-Logik | Task 6 |
| 10 Monitor-Auswahl | Task 9 |
| 11 Spieler-Verwaltung | Plan 2 |
| 12 Design-Tokens | Task 11 |
| 13 Release und Versionierung | Plan 2 |
| 14 Fehlerbehandlung | Task 4, 5, 7, 9 |
| 15 Testing | Task 6, 7, 8, 9 |
| 16 Projektstruktur | Task 1 |
| 18 Rechtliche Pflichtangaben | Task 2, Task 11; Fremdlizenzen und Stückliste in Plan 2 |
