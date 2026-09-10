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
// laufende Electron-Runtime, und mockt 'electron' fuer die Tests der
// Erneuerung. Alles, was Electron-APIs braucht, holt sie sich per
// dynamischem import('electron'), sobald es tatsaechlich aufgerufen wird
// (gleiches Muster wie in src/main/konfiguration.ts).

import { createHash, randomBytes } from 'node:crypto'
import { readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { NichtAngemeldetFehler } from './fehler'

const AUTORISIERUNG = 'https://api.autodarts.com/auth/v1/oauth/authorize'
const AUSTAUSCH = 'https://api.autodarts.com/auth/v1/exchange'
const ERNEUERUNG = 'https://api.autodarts.com/auth/v1/refresh'
const ABMELDUNG_ENDPUNKT = 'https://api.autodarts.com/auth/v1/logout'
const CLIENT_ID = 'autodarts-play'
const UMLEITUNG = 'https://play.autodarts.com/auth/google/callback'
const SCOPE = 'openid profile email'
// Exportiert, damit src/main/datenLoeschen.ts dieselbe Partition raeumen
// kann wie abmelden() unten, ohne den String ein zweites Mal zu tippen und
// dabei zu riskieren, dass beide Stellen einmal auseinanderlaufen.
export const SITZUNGSPARTITION = 'persist:autodarts-anmeldung'
const PUFFER_SEKUNDEN = 60

// Fuenf Minuten sind reichlich fuer eine Anmeldung inklusive Zwei-Faktor.
// Ohne diese Grenze wuerde ein Nutzer, der das Anmeldefenster offen laesst,
// ohne zu navigieren und ohne es zu schliessen, anmelden() fuer immer haengen
// lassen - weder will-redirect noch will-navigate noch closed feuern dann.
const ANMELDE_ZEITLIMIT_MS = 5 * 60 * 1000

// Google verweigert OAuth-Anmeldungen aus erkennbaren Webviews. Das Konto des
// Herausgebers hat ein Passwort und traegt den Weg auch bei einer
// Google-Sperre (siehe Design-Dokument, Abschnitt 5.2) - ohne Not soll sie
// aber nicht ausgeloest werden.
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

function zufallswert(bytesLaenge: number): string {
  return randomBytes(bytesLaenge).toString('base64url')
}

/** Erzeugt ein PKCE-Paar: 64 Zeichen aus dem erlaubten Alphabet, S256-Challenge. */
export function pkcePaar(): { verifier: string; challenge: string } {
  const verifier = zufallswert(48)
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
 * Entnimmt den Autorisierungscode oder den Fehler aus einer Umleitungsadresse
 * und prueft dabei den state-Parameter gegen den erwarteten Wert (CSRF-Schutz
 * in der Tiefe - der Ablauf hat keinen von aussen erreichbaren Callback und
 * PKCE bindet den Code bereits an den lokalen Verifier, trotzdem gehoert die
 * Pruefung hin). Stimmt der state nicht, wird der Code bewusst nicht
 * herausgegeben, selbst wenn er in der Adresse steht - der Aufrufer tauscht
 * ihn dann nicht ein. Reine Funktion: prueft selbst, ob url ueberhaupt mit
 * dem Umleitungsziel beginnt, damit sie auch mit einer voellig anderen
 * Adresse (Zwischenseite, Google-Login) sinnvoll und ohne Ausnahme antwortet.
 */
export function codeAusUmleitung(url: string, erwarteterState: string): { code: string } | { fehler: string } {
  if (!url.startsWith(UMLEITUNG)) {
    return { fehler: `Unerwartete Adresse: ${url}` }
  }

  const parameter = new URL(url).searchParams

  if (parameter.get('state') !== erwarteterState) {
    return { fehler: 'Umleitung enthielt einen unerwarteten state-Parameter' }
  }

  const code = parameter.get('code')
  if (code) return { code }

  const fehlerCode = parameter.get('error')
  if (fehlerCode) {
    const beschreibung = parameter.get('error_description')
    return { fehler: beschreibung ? `${fehlerCode}: ${beschreibung}` : fehlerCode }
  }

  return { fehler: 'Umleitung enthielt weder code noch error' }
}

function autorisierungsAdresse(challenge: string, state: string): string {
  const parameter = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: UMLEITUNG,
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  })
  return `${AUTORISIERUNG}?${parameter.toString()}`
}

type TokenAntwort = {
  access_token: string
  refresh_token?: string
  expires_in?: number
}

// Traegt den HTTP-Status der abgelehnten Anfrage, damit die Aufrufer
// unterscheiden koennen: eine echte Ablehnung durch den Server (ungueltiges/
// widerrufenes/rotiertes Aktualisierungs-Token, Status 400/401) ist etwas
// anderes als ein Netzwerkausfall oder ein serverseitiger 5xx-Fehler.
class AutodartsHttpFehler extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'AutodartsHttpFehler'
    this.status = status
  }
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
    throw new AutodartsHttpFehler(
      antwort.status,
      `Autodarts-Anfrage an ${url} fehlgeschlagen (${antwort.status}): ${text}`,
    )
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

// Minimale, von Electrons konkreten Event-Typen entkoppelte Form dessen, was
// will-redirect/will-navigate liefern: die Zieladresse, ob es der Hauptrahmen
// ist (ein Unterrahmen, der zufaellig auf eine gleich beginnende Adresse
// navigiert, soll den Ablauf nicht vorzeitig beenden) und preventDefault.
type UmleitungsEreignis = { url: string; isMainFrame: boolean; preventDefault: () => void }

/**
 * Ergebnis eines Anmeldeversuchs ueber den IPC-Kanal anmeldung:starten
 * (siehe src/main/ipc.ts). Bewusst ohne Fehlertext: kein Token, keine
 * Adresse und kein Code sollen je den Hauptprozess verlassen. `abgebrochen`
 * unterscheidet eine bewusste Nutzerentscheidung (Fenster geschlossen,
 * Zeitlimit erreicht - siehe istAnmeldungAbbruch) von einem echten
 * Fehlerfall, den das Control-Fenster anzeigen soll.
 */
export type AnmeldungsErgebnis = { erfolg: true } | { erfolg: false; abgebrochen: boolean }

/**
 * Ob ein von anmelden() geworfener Fehler eine bewusste Nutzerentscheidung
 * ist (Anmeldefenster geschlossen, oder fuenf Minuten ohne Rueckmeldung)
 * statt ein echter Fehlerfall - Aufrufer wie ipc.ts sollen das ruhig
 * behandeln, nicht als Fehler im Control-Fenster anzeigen. Prueft den
 * Nachrichtentext, weil es dafuer keinen eigenen Fehlertyp gibt (anders als
 * NichtAngemeldetFehler); beide Nachrichten unten beginnen mit demselben
 * Praefix.
 */
export function istAnmeldungAbbruch(fehler: unknown): boolean {
  return fehler instanceof Error && fehler.message.startsWith('Anmeldung abgebrochen')
}

// Verhindert einen zweiten, gleichzeitigen Anmeldeversuch - ohne diese
// Sperre wuerde ein Doppelklick auf den Anmelden-Knopf im Control-Fenster
// zwei Anmeldefenster gleichzeitig oeffnen. Gleiches Muster wie
// laufendeErneuerung weiter unten fuer die Token-Erneuerung: in jedem
// Ausgang - Erfolg wie Fehler - wieder auf null gesetzt, damit ein
// spaeterer Versuch neu starten kann.
let laufendeAnmeldung: Promise<void> | null = null

/**
 * Oeffnet das Autodarts-Anmeldefenster in eigener Sitzungspartition, fuehrt
 * den Authorization-Code-Ablauf mit PKCE und state durch und legt das
 * Aktualisierungs-Token verschluesselt ab. Bricht der Nutzer ab (Fenster
 * geschlossen ohne Code, oder fuenf Minuten ohne jede Rueckmeldung), wirft
 * "Anmeldung abgebrochen" bzw. eine Zeitlimit-Meldung. Enthaelt die Umleitung
 * einen Fehler oder einen unerwarteten state statt eines Codes, wirft die
 * jeweilige Meldung, ohne den Code einzutauschen. Laeuft bereits ein
 * Anmeldeversuch, liefert ein zweiter Aufruf dieselbe Promise zurueck statt
 * ein zweites Anmeldefenster zu oeffnen.
 */
export async function anmelden(): Promise<void> {
  if (!laufendeAnmeldung) {
    laufendeAnmeldung = anmeldungDurchfuehren().finally(() => {
      laufendeAnmeldung = null
    })
  }
  return laufendeAnmeldung
}

async function anmeldungDurchfuehren(): Promise<void> {
  const { verifier, challenge } = pkcePaar()
  const erwarteterState = zufallswert(24)
  const { BrowserWindow, session, shell } = await import('electron')

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

  // Echte Drittseiten (Google, Autodarts) koennen Popups oeffnen (z.B.
  // Konto-Auswahl) - die landen im Systembrowser statt in einem neuen
  // Electron-Fenster (Befund 4, gleiches Muster wie in fenster.ts).
  fenster.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  const code = await new Promise<string>((resolve, reject) => {
    let erledigt = false

    // Jeder Ausgang (Redirect mit Code/Fehler, Nutzerabbruch, Zeitlimit)
    // laeuft durch diese Stelle - sie sorgt dafuer, dass der Zeitgeber immer
    // aufgeraeumt wird und dass nie zweimal aufgeloest/abgelehnt wird.
    const abschliessen = (aktion: () => void): void => {
      if (erledigt) return
      erledigt = true
      clearTimeout(zeitlimit)
      aktion()
    }

    const zeitlimit = setTimeout(() => {
      abschliessen(() => {
        if (!fenster.isDestroyed()) fenster.close()
        reject(new Error('Anmeldung abgebrochen: 5 Minuten ohne Rueckmeldung'))
      })
    }, ANMELDE_ZEITLIMIT_MS)

    const pruefeUndBeenden = (ereignis: UmleitungsEreignis): void => {
      if (!ereignis.isMainFrame || !ereignis.url.startsWith(UMLEITUNG)) return
      ereignis.preventDefault()
      abschliessen(() => {
        fenster.close()
        const ergebnis = codeAusUmleitung(ereignis.url, erwarteterState)
        if ('code' in ergebnis) resolve(ergebnis.code)
        else reject(new Error(ergebnis.fehler))
      })
    }

    fenster.webContents.on('will-redirect', pruefeUndBeenden)
    fenster.webContents.on('will-navigate', pruefeUndBeenden)

    // Schliesst der Nutzer das Fenster selbst (Alt+F4, Klick auf X), ohne
    // dass eine der beiden Navigationspruefungen oben bereits ausgeloest hat.
    fenster.on('closed', () => {
      abschliessen(() => reject(new Error('Anmeldung abgebrochen')))
    })

    fenster.loadURL(autorisierungsAdresse(challenge, erwarteterState))
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

// Haelt eine laufende Erneuerung fest, damit zwei gleichzeitige
// zugriffsToken()-Aufrufe bei abgelaufenem Token nicht zwei parallele
// POST /auth/v1/refresh mit demselben Aktualisierungs-Token ausloesen
// (Single-Flight). Rotiert der Server das Aktualisierungs-Token bei jeder
// Erneuerung, wuerde der zweite, ueberfluessige Aufruf sonst mit
// invalid_grant scheitern und faelschlich die gerade erst gueltig
// beschriebene Ablage verwerfen. Wird in jedem Ausgang - Erfolg wie Fehler -
// wieder auf null gesetzt, damit der naechste, spaetere Aufruf einen neuen
// Versuch startet.
let laufendeErneuerung: Promise<string> | null = null

async function erneuerungDurchfuehren(): Promise<string> {
  const ablage = await ablageLesen()
  if (!ablage) {
    throw new NichtAngemeldetFehler()
  }

  try {
    const antwort = await tokenAnfragen(ERNEUERUNG, {
      refresh_token: ablage.refreshToken,
      client_id: CLIENT_ID,
    })
    zugriff = { token: antwort.access_token, laeuftAbUm: Date.now() / 1000 + (antwort.expires_in ?? Number.NaN) }
    await ablageSchreiben({ refreshToken: antwort.refresh_token ?? ablage.refreshToken })
    return zugriff.token
  } catch (fehler) {
    // Der Server lehnt die Berechtigung ausdruecklich ab (abgelaufenes,
    // widerrufenes oder rotiertes Aktualisierungs-Token: Status 400/401,
    // z.B. invalid_grant) - dann ist die Ablage tatsaechlich wertlos und
    // wird verworfen. Ein Netzwerkfehler oder ein serverseitiger 5xx-Fehler
    // ist dagegen kein Grund, den Nutzer abzumelden: die Ablage bleibt
    // unangetastet, ein erneuter Versuch soll wieder greifen - kein Grund,
    // jemanden abzumelden, weil das WLAN kurz weg war.
    if (fehler instanceof AutodartsHttpFehler && (fehler.status === 400 || fehler.status === 401)) {
      zugriff = null
      await ablageVerwerfen()
      throw new NichtAngemeldetFehler()
    }
    throw new Error('Erneuerung des Zugriffstokens fehlgeschlagen, bitte spaeter erneut versuchen', {
      cause: fehler,
    })
  }
}

/**
 * Liefert den zwischengespeicherten Zugriffstoken, solange er noch
 * mindestens 60 Sekunden gueltig ist, sonst erneuert sie ihn ueber das
 * Aktualisierungs-Token (gebuendelt per Single-Flight, siehe
 * laufendeErneuerung). Schlaegt die Erneuerung mit einer Ablehnung durch den
 * Server fehl (oder ist noch nie angemeldet worden), wird die Ablage
 * verworfen und ein NichtAngemeldetFehler geworfen (Nutzertext "Bitte
 * erneut anmelden", das Control-Fenster kann ihn direkt anzeigen) - Aufrufer
 * sollen per instanceof auf den Typ pruefen, nicht auf den Nachrichtentext,
 * der sich jederzeit aendern kann. Ein Netzwerkfehler wirft eine andere
 * Fehlerart und laesst die Ablage unangetastet.
 */
export async function zugriffsToken(): Promise<string> {
  const jetzt = Date.now() / 1000
  if (zugriff && tokenNochGueltig(zugriff.laeuftAbUm, jetzt, PUFFER_SEKUNDEN)) {
    return zugriff.token
  }

  if (!laufendeErneuerung) {
    laufendeErneuerung = erneuerungDurchfuehren().finally(() => {
      laufendeErneuerung = null
    })
  }
  return laufendeErneuerung
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
