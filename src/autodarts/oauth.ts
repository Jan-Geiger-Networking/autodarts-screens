// Anmeldung bei Autodarts per OAuth Authorization Code + PKCE im eingebetteten
// Fenster. Werte aus docs/autodarts-api.md (Stand nach der Migration vom
// 28.06.2026 auf den eigenen OAuth-Server unter api.autodarts.com). Der
// Device Authorization Grant ist fuer die Client-Kennung "autodarts-play"
// gesperrt (eigener Test, siehe docs/autodarts-api.md) - deshalb der Weg
// ueber das eingebettete Fenster mit abgefangener Umleitung, nicht ueber
// einen lokalen Server (nur https://play.autodarts.com/auth/google/callback
// ist als Umleitungsziel registriert, localhost wird abgelehnt).
//
// Kein Top-Level-Import von 'electron': oauth.test.ts prueft die reinen
// Funktionen (pkcePaar, tokenNochGueltig, codeAusUmleitung) unter Vitest ohne
// laufende Electron-Runtime. Alles, was Electron-APIs braucht, holt sie sich
// per dynamischem import('electron'), sobald es tatsaechlich aufgerufen wird
// (gleiches Muster wie in src/main/konfiguration.ts).

import { createHash, randomBytes } from 'node:crypto'
import { readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'

const AUTORISIERUNG = 'https://api.autodarts.com/auth/v1/oauth/authorize'
const AUSTAUSCH = 'https://api.autodarts.com/auth/v1/exchange'
const ERNEUERUNG = 'https://api.autodarts.com/auth/v1/refresh'
const ABMELDUNG_ENDPUNKT = 'https://api.autodarts.com/auth/v1/logout'
const CLIENT_ID = 'autodarts-play'
const UMLEITUNG = 'https://play.autodarts.com/auth/google/callback'
const SCOPE = 'openid profile email'
const SITZUNGSPARTITION = 'persist:autodarts-anmeldung'
const PUFFER_SEKUNDEN = 60

// Google verweigert OAuth-Anmeldungen aus erkennbaren Webviews. Das Konto des
// Herausgebers hat ein Passwort und traegt den Weg auch bei einer
// Google-Sperre (siehe Design-Dokument, Abschnitt 5.2) - ohne Not soll sie
// aber nicht ausgeloest werden.
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

/** Erzeugt ein PKCE-Paar: 64 Zeichen aus dem erlaubten Alphabet, S256-Challenge. */
export function pkcePaar(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

/**
 * Reine Pruefung, ob ein Zugriffstoken noch mindestens pufferSekunden gueltig
 * ist. laeuftAbUm und jetzt sind Unix-Zeitstempel in Sekunden. Ein Token ohne
 * bekannte Ablaufzeit wird als NaN uebergeben - NaN-Vergleiche sind immer
 * false, das Token gilt dann folgerichtig als nicht mehr gueltig, ohne dass
 * es dafuer einen eigenen Sonderfall braucht.
 */
export function tokenNochGueltig(laeuftAbUm: number, jetzt: number, pufferSekunden: number): boolean {
  return laeuftAbUm - jetzt >= pufferSekunden
}

/**
 * Entnimmt den Autorisierungscode oder den Fehler aus einer Umleitungsadresse.
 * Reine Funktion: prueft selbst, ob url ueberhaupt mit dem Umleitungsziel
 * beginnt, damit sie auch mit einer voellig anderen Adresse (Zwischenseite,
 * Google-Login) sinnvoll und ohne Ausnahme antwortet.
 */
export function codeAusUmleitung(url: string): { code: string } | { fehler: string } {
  if (!url.startsWith(UMLEITUNG)) {
    return { fehler: `Unerwartete Adresse: ${url}` }
  }

  const parameter = new URL(url).searchParams
  const code = parameter.get('code')
  if (code) return { code }

  const fehlerCode = parameter.get('error')
  if (fehlerCode) {
    const beschreibung = parameter.get('error_description')
    return { fehler: beschreibung ? `${fehlerCode}: ${beschreibung}` : fehlerCode }
  }

  return { fehler: 'Umleitung enthielt weder code noch error' }
}

function autorisierungsAdresse(challenge: string): string {
  const parameter = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: UMLEITUNG,
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  return `${AUTORISIERUNG}?${parameter.toString()}`
}

type TokenAntwort = {
  access_token: string
  refresh_token?: string
  expires_in?: number
}

// Der Server nimmt JSON-Ruempfe, nicht application/x-www-form-urlencoded -
// mit Form-Encoding antwortet er 400 "invalid request body" (eigener Test,
// siehe docs/autodarts-api.md).
async function postJson(url: string, rumpf: Record<string, string>): Promise<Response> {
  const antwort = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(rumpf),
  })
  if (!antwort.ok) {
    const text = await antwort.text().catch(() => '')
    throw new Error(`Autodarts-Anfrage an ${url} fehlgeschlagen (${antwort.status}): ${text}`)
  }
  return antwort
}

async function tokenAnfragen(url: string, rumpf: Record<string, string>): Promise<TokenAntwort> {
  return (await postJson(url, rumpf)).json() as Promise<TokenAntwort>
}

type Ablage = { refreshToken: string }

async function ablagePfad(): Promise<string> {
  const { app } = await import('electron')
  return join(app.getPath('userData'), 'anmeldung.bin')
}

async function ablageSchreiben(daten: Ablage): Promise<void> {
  const { safeStorage } = await import('electron')
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Verschluesselte Ablage steht auf diesem System nicht zur Verfuegung')
  }
  await writeFile(await ablagePfad(), safeStorage.encryptString(JSON.stringify(daten)))
}

async function ablageLesen(): Promise<Ablage | null> {
  try {
    const { safeStorage } = await import('electron')
    const roh = await readFile(await ablagePfad())
    return JSON.parse(safeStorage.decryptString(roh)) as Ablage
  } catch {
    // Datei fehlt, ist nicht lesbar oder laesst sich nicht entschluesseln
    // (z.B. nach einem Umzug auf einen anderen Rechner): kein Absturz, die
    // Anwendung verhaelt sich wie ein Nutzer, der noch nie angemeldet war.
    return null
  }
}

async function ablageVerwerfen(): Promise<void> {
  await rm(await ablagePfad(), { force: true })
}

// Im Speicher gehaltener Zugriffstoken. Nie in der Ablage, nie im Renderer -
// er lebt ausschliesslich hier im Main-Prozess und wird bei jedem
// Anwendungsstart neu ueber das Aktualisierungs-Token beschafft.
let zugriff: { token: string; laeuftAbUm: number } | null = null

/**
 * Oeffnet das Autodarts-Anmeldefenster in eigener Sitzungspartition, fuehrt
 * den Authorization-Code-Ablauf mit PKCE durch und legt das Aktualisierungs-
 * Token verschluesselt ab. Bricht der Nutzer ab (Fenster geschlossen ohne
 * Code), wirft "Anmeldung abgebrochen". Enthaelt die Umleitung einen Fehler
 * statt eines Codes, wirft die Serverantwort.
 */
export async function anmelden(): Promise<void> {
  const { verifier, challenge } = pkcePaar()
  const { BrowserWindow, session } = await import('electron')

  const sitzung = session.fromPartition(SITZUNGSPARTITION)
  sitzung.setUserAgent(DESKTOP_USER_AGENT)

  const fenster = new BrowserWindow({
    width: 480,
    height: 720,
    autoHideMenuBar: true,
    webPreferences: {
      session: sitzung,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const code = await new Promise<string>((resolve, reject) => {
    let erledigt = false

    const pruefeUndBeenden = (url: string, verhindern: () => void): void => {
      if (erledigt || !url.startsWith(UMLEITUNG)) return
      erledigt = true
      verhindern()
      const ergebnis = codeAusUmleitung(url)
      fenster.close()
      if ('code' in ergebnis) resolve(ergebnis.code)
      else reject(new Error(ergebnis.fehler))
    }

    fenster.webContents.on('will-redirect', (event, url) => pruefeUndBeenden(url, () => event.preventDefault()))
    fenster.webContents.on('will-navigate', (event, url) => pruefeUndBeenden(url, () => event.preventDefault()))

    // Schliesst der Nutzer das Fenster selbst (Alt+F4, Klick auf X), ohne
    // dass eine der beiden Navigationspruefungen oben bereits ausgeloest hat.
    fenster.on('closed', () => {
      if (!erledigt) {
        erledigt = true
        reject(new Error('Anmeldung abgebrochen'))
      }
    })

    fenster.loadURL(autorisierungsAdresse(challenge))
  })

  const antwort = await tokenAnfragen(AUSTAUSCH, {
    code,
    client_id: CLIENT_ID,
    redirect_uri: UMLEITUNG,
    code_verifier: verifier,
  })

  if (!antwort.refresh_token) {
    throw new Error('Autodarts-Antwort auf den Code-Tausch enthielt kein Aktualisierungs-Token')
  }

  zugriff = { token: antwort.access_token, laeuftAbUm: Date.now() / 1000 + (antwort.expires_in ?? Number.NaN) }
  await ablageSchreiben({ refreshToken: antwort.refresh_token })
}

/**
 * Liefert den zwischengespeicherten Zugriffstoken, solange er noch
 * mindestens 60 Sekunden gueltig ist, sonst erneuert sie ihn ueber das
 * Aktualisierungs-Token. Schlaegt die Erneuerung fehl (oder ist noch nie
 * angemeldet worden), wird die Ablage verworfen und "Bitte erneut anmelden"
 * geworfen - das Control-Fenster kann diese Meldung direkt anzeigen.
 */
export async function zugriffsToken(): Promise<string> {
  const jetzt = Date.now() / 1000
  if (zugriff && tokenNochGueltig(zugriff.laeuftAbUm, jetzt, PUFFER_SEKUNDEN)) {
    return zugriff.token
  }

  const ablage = await ablageLesen()
  if (!ablage) {
    throw new Error('Bitte erneut anmelden')
  }

  try {
    const antwort = await tokenAnfragen(ERNEUERUNG, {
      refresh_token: ablage.refreshToken,
      client_id: CLIENT_ID,
    })
    zugriff = { token: antwort.access_token, laeuftAbUm: Date.now() / 1000 + (antwort.expires_in ?? Number.NaN) }
    await ablageSchreiben({ refreshToken: antwort.refresh_token ?? ablage.refreshToken })
    return zugriff.token
  } catch {
    zugriff = null
    await ablageVerwerfen()
    throw new Error('Bitte erneut anmelden')
  }
}

/** Meldet ab: widerruft das Aktualisierungs-Token, verwirft die Ablage und leert die Sitzungspartition. */
export async function abmelden(): Promise<void> {
  const ablage = await ablageLesen()
  if (ablage) {
    // Serverseitiger Widerruf ist best effort - schlaegt er fehl (z.B. keine
    // Netzverbindung), soll die lokale Abmeldung trotzdem gelingen.
    await postJson(ABMELDUNG_ENDPUNKT, { refresh_token: ablage.refreshToken }).catch(() => {})
  }

  zugriff = null
  await ablageVerwerfen()

  const { session } = await import('electron')
  await session.fromPartition(SITZUNGSPARTITION).clearStorageData()
}

/** Ob eine Anmeldung vorliegt: ein zwischengespeicherter Token oder ein gespeichertes Aktualisierungs-Token. */
export async function istAngemeldet(): Promise<boolean> {
  if (zugriff) return true
  return (await ablageLesen()) !== null
}
