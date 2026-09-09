import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { codeAusUmleitung, pkcePaar, tokenNochGueltig, zugriffsToken } from './oauth'
import { NichtAngemeldetFehler } from './fehler'

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

describe('tokenNochGueltig', () => {
  const PUFFER = 60

  it('ist genau am Puffer noch gueltig ("mindestens 60 Sekunden")', () => {
    // Ablauf in 60 Sekunden, jetzt = 0: verbleibende Zeit ist exakt der Puffer.
    expect(tokenNochGueltig(60, 0, PUFFER)).toBe(true)
  })

  it('ist eine Sekunde vor dem Puffer-Zeitpunkt noch gueltig', () => {
    // Verbleibende Zeit 61 Sekunden, also einen Schritt vor Erreichen des Puffers.
    expect(tokenNochGueltig(61, 0, PUFFER)).toBe(true)
  })

  it('ist eine Sekunde nach dem Puffer-Zeitpunkt nicht mehr gueltig', () => {
    // Verbleibende Zeit 59 Sekunden, also einen Schritt hinter dem Puffer.
    expect(tokenNochGueltig(59, 0, PUFFER)).toBe(false)
  })

  it('ein Token ohne bekannte Ablaufzeit (NaN) gilt als nicht mehr gueltig', () => {
    expect(tokenNochGueltig(Number.NaN, 0, PUFFER)).toBe(false)
  })
})

describe('codeAusUmleitung', () => {
  const UMLEITUNG = 'https://play.autodarts.com/auth/google/callback'
  const STATE = 'erwarteter-state-123'

  it('entnimmt den Code aus einer Umleitungsadresse mit code und passendem state', () => {
    expect(codeAusUmleitung(`${UMLEITUNG}?code=abc123&state=${STATE}`, STATE)).toEqual({ code: 'abc123' })
  })

  it('entnimmt error und error_description als Fehler', () => {
    const ergebnis = codeAusUmleitung(
      `${UMLEITUNG}?error=access_denied&error_description=Nutzer%20hat%20abgelehnt&state=${STATE}`,
      STATE,
    )
    expect(ergebnis).toEqual({ fehler: 'access_denied: Nutzer hat abgelehnt' })
  })

  it('liefert einen Fehler, wenn die Umleitung weder code noch error enthaelt', () => {
    const ergebnis = codeAusUmleitung(`${UMLEITUNG}?state=${STATE}`, STATE)
    expect('fehler' in ergebnis).toBe(true)
  })

  it('liefert einen Fehler fuer eine Adresse, die gar nicht das Umleitungsziel ist', () => {
    const ergebnis = codeAusUmleitung('https://auth.autodarts.com/authorize?request_id=abc', STATE)
    expect('fehler' in ergebnis).toBe(true)
  })

  it('gibt den Code nicht heraus, wenn der state-Parameter abweicht', () => {
    const ergebnis = codeAusUmleitung(`${UMLEITUNG}?code=abc123&state=anderer-state`, STATE)
    expect('code' in ergebnis).toBe(false)
    expect('fehler' in ergebnis).toBe(true)
  })
})

// Die folgenden Tests brauchen zugriffsToken() mit echten Main-Prozess-APIs
// (app.getPath, safeStorage) - 'electron' wird deshalb gemockt: der
// Node-Paketeintrag 'electron' liefert unter einer normalen Node-Runtime
// (wie hier unter Vitest) nur einen Pfadstring, keine der Main-Prozess-APIs.
// app.getPath liefert ein echtes temporaeres Verzeichnis, safeStorage ist als
// Identitaetsfunktion gemockt (kein echtes Verschluesseln noetig, nur die
// Ablage-Rundreise soll funktionieren).
const userDataDir = mkdtempSync(join(tmpdir(), 'ad-oauth-'))
const ablageDatei = join(userDataDir, 'anmeldung.bin')

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(s, 'utf8'),
    decryptString: (b: Buffer) => b.toString('utf8'),
  },
}))

describe('zugriffsToken: Single-Flight und Fehlerklassifizierung', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  // Jede erfolgreiche Erneuerungs-Antwort in diesen Tests meldet eine bereits
  // abgelaufene Gueltigkeit (expires_in negativ), damit jeder Test - egal in
  // welcher Reihenfolge er laeuft - beim naechsten zugriffsToken()-Aufruf
  // wieder eine echte Erneuerung ausloest, statt aus dem Modul-Cache zu
  // antworten.
  const erfolgsAntwort = (rumpf: Record<string, unknown>) =>
    new Response(JSON.stringify({ access_token: 'a-neu', expires_in: -1000, ...rumpf }), { status: 200 })

  beforeEach(() => {
    rmSync(ablageDatei, { force: true })
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Das per mkdtempSync erzeugte Verzeichnis (siehe oben) blieb bisher ohne
  // Aufraeumen liegen (Befund 12) - afterAll statt afterEach, weil userDataDir
  // fuer alle Tests in diesem describe-Block gemeinsam gilt.
  afterAll(() => {
    rmSync(userDataDir, { recursive: true, force: true })
  })

  it('buendelt zwei gleichzeitige Aufrufe bei abgelaufenem Token zu genau einer Erneuerungsanfrage', async () => {
    writeFileSync(ablageDatei, JSON.stringify({ refreshToken: 'r-single-flight' }))
    fetchMock.mockResolvedValueOnce(erfolgsAntwort({}))

    const [t1, t2] = await Promise.all([zugriffsToken(), zugriffsToken()])

    expect(t1).toBe('a-neu')
    expect(t2).toBe('a-neu')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('verwirft die Ablage nicht bei einem Netzwerkfehler', async () => {
    writeFileSync(ablageDatei, JSON.stringify({ refreshToken: 'r-network' }))
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))

    await expect(zugriffsToken()).rejects.toThrow()

    expect(existsSync(ablageDatei)).toBe(true)
  })

  it('verwirft die Ablage bei einer Ablehnung durch den Server (Status 400, invalid_grant)', async () => {
    writeFileSync(ablageDatei, JSON.stringify({ refreshToken: 'r-invalid-grant' }))
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }))

    // Auf den Typ pruefen, nicht auf den Nachrichtentext (Fix-Runde 2,
    // Task 5) - Aufrufer wie websocket.ts erkennen "nicht angemeldet" per
    // instanceof, der Text ist nur fuer die Anzeige gedacht.
    await expect(zugriffsToken()).rejects.toBeInstanceOf(NichtAngemeldetFehler)

    expect(existsSync(ablageDatei)).toBe(false)
  })

  it('wirft NichtAngemeldetFehler ohne Netzaufruf, wenn noch nie ein Aktualisierungs-Token gespeichert wurde', async () => {
    await expect(zugriffsToken()).rejects.toBeInstanceOf(NichtAngemeldetFehler)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
