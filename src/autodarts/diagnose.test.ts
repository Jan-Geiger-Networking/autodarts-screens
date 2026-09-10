import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { adresseOhneAbfrage, feldUebersicht, geheimnisseFiltern } from './diagnose'

describe('geheimnisseFiltern', () => {
  it('entfernt code und state aus den Abfrageparametern einer Adresse', () => {
    const adresse = 'https://play.autodarts.com/auth/google/callback?code=abcDEF123geheim&state=xyz789geheim'
    const ergebnis = geheimnisseFiltern(adresse)
    expect(ergebnis).not.toContain('abcDEF123geheim')
    expect(ergebnis).not.toContain('xyz789geheim')
    expect(ergebnis).toContain('code=[ENTFERNT]')
    expect(ergebnis).toContain('state=[ENTFERNT]')
  })

  it('entfernt access_token und refresh_token aus einem Objekt', () => {
    const objekt = {
      access_token: 'geheimer-zugriffstoken-wert',
      refresh_token: 'geheimer-erneuerungstoken-wert',
      expires_in: 3600,
    }
    const ergebnis = geheimnisseFiltern(objekt)
    expect(ergebnis).not.toContain('geheimer-zugriffstoken-wert')
    expect(ergebnis).not.toContain('geheimer-erneuerungstoken-wert')
    expect(ergebnis).toContain('access_token')
    expect(ergebnis).toContain('refresh_token')
    // Unbedenkliche Felder (kein bekannter Geheimnisname) bleiben lesbar.
    expect(ergebnis).toContain('3600')
  })

  it('entfernt ein Token aus einem Fehlertext ohne erkennbaren Feldnamen (JWT-Form)', () => {
    const fehlertext =
      'Erneuerung fehlgeschlagen: token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U ist ungueltig'
    const ergebnis = geheimnisseFiltern(fehlertext)
    expect(ergebnis).not.toContain('eyJhbGciOiJIUzI1NiJ9')
    expect(ergebnis).toContain('[ENTFERNT]')
  })

  it('laesst einen harmlosen Text unveraendert', () => {
    const text = 'WebSocket offen, Ticket geholt, Abonnement gesendet'
    expect(geheimnisseFiltern(text)).toBe(text)
  })

  it('laesst das JSON-Feld "code" als Fehlerklassifizierung lesbar - kein Autorisierungscode', () => {
    // Regressionstest (neuer Befund des Herausgebers): der Server antwortet
    // auf einen abgelehnten Code-Tausch mit diesem Rumpf. "code" ist hier
    // eine Fehlerkategorie ("invalid_code"), kein Geheimnis - anders als der
    // "code"-Abfrageparameter der Umleitungsadresse (siehe Test oben), der
    // den tatsaechlichen Autorisierungscode traegt und entfernt werden muss.
    const fehlerRumpf =
      '{"statusCode":400,"error":{"status":400,"code":"invalid_code","message":"invalid or expired code"}}'
    expect(geheimnisseFiltern(fehlerRumpf)).toBe(fehlerRumpf)
  })
})

describe('adresseOhneAbfrage', () => {
  it('behaelt nur Schema, Host und Pfad, nie die Abfrageparameter', () => {
    expect(adresseOhneAbfrage('https://play.autodarts.com/auth/google/callback?code=abc&state=xyz')).toBe(
      'https://play.autodarts.com/auth/google/callback',
    )
  })

  it('faellt bei einer unlesbaren Adresse auf einen Platzhalter zurueck statt zu werfen', () => {
    expect(adresseOhneAbfrage('keine-gueltige-url')).toBe('(unlesbare Adresse)')
  })
})

describe('feldUebersicht', () => {
  it('listet Feldnamen und Werttypen, nie die Werte', () => {
    const ergebnis = feldUebersicht({ access_token: 'geheimer-wert', expires_in: 3600, aktiv: true })
    expect(ergebnis).toBe('access_token:string, expires_in:number, aktiv:boolean')
    expect(ergebnis).not.toContain('geheimer-wert')
  })

  it('beschreibt einen Nicht-Objekt-Wert ohne Absturz', () => {
    expect(feldUebersicht('text')).toContain('string')
    expect(feldUebersicht(null)).toContain('object')
  })
})

// protokollieren()/diagnosePfad() brauchen app.getPath('userData') - 'electron'
// wird deshalb gemockt (gleiches Muster wie in oauth.test.ts und
// konfiguration.test.ts). vi.mock wird von Vitest an den Dateianfang gehoben,
// die Platzierung hier aendert daran nichts.
const userDataDir = mkdtempSync(join(tmpdir(), 'ad-diagnose-'))
const diagnoseDatei = join(userDataDir, 'diagnose.log')

vi.mock('electron', () => ({ app: { getPath: () => userDataDir } }))

describe('protokollieren', () => {
  beforeEach(() => {
    rmSync(diagnoseDatei, { force: true })
  })

  afterAll(() => {
    rmSync(userDataDir, { recursive: true, force: true })
  })

  it('schreibt eine zeitgestempelte, gefilterte Zeile in die Datei unter userData', async () => {
    const { protokollieren } = await import('./diagnose')
    await protokollieren('Umleitung abgefangen: https://play.autodarts.com/auth/google/callback?code=geheim123&state=xyz')
    const inhalt = readFileSync(diagnoseDatei, 'utf-8')
    expect(inhalt).toMatch(/^\[\d{4}-\d{2}-\d{2}T.*Z\] Umleitung abgefangen:/)
    expect(inhalt).not.toContain('geheim123')
  })

  it('schreibt mehrere gleichzeitig ausgeloeste Aufrufe in Aufrufreihenfolge, nie durcheinander', async () => {
    // Regressionstest: beim echten Programmstart (siehe Diagnose-Report)
    // erschien "Anmeldefenster geoeffnet" vor "Anmeldung gestartet" in der
    // Datei, obwohl "Anmeldung gestartet" zuerst aufgerufen wurde - zwei
    // parallele, nicht verkettete Schreibvorgaenge liefen um die Wette.
    const { protokollieren } = await import('./diagnose')
    // Bewusst nicht await zwischen den Aufrufen - genau das simuliert die
    // "void protokollieren(...)"-Aufrufe in oauth.ts/websocket.ts.
    const p1 = protokollieren('erste Zeile')
    const p2 = protokollieren('zweite Zeile')
    const p3 = protokollieren('dritte Zeile')
    await Promise.all([p1, p2, p3])
    const zeilen = readFileSync(diagnoseDatei, 'utf-8').trim().split('\n')
    expect(zeilen.map((z) => z.split('] ')[1])).toEqual(['erste Zeile', 'zweite Zeile', 'dritte Zeile'])
  })

  it('kuerzt die Datei, sobald sie die Groessengrenze ueberschreitet, statt unbegrenzt zu wachsen', async () => {
    const { protokollieren } = await import('./diagnose')
    writeFileSync(diagnoseDatei, 'alte-zeile-alte-zeile-alte-zeile\n'.repeat(20000)) // deutlich ueber 300 KB
    await protokollieren('neue Zeile nach dem Kuerzen')
    const inhaltNachher = readFileSync(diagnoseDatei, 'utf-8')
    expect(inhaltNachher.length).toBeLessThan(20000 * 'alte-zeile-alte-zeile-alte-zeile\n'.length)
    expect(inhaltNachher).toContain('neue Zeile nach dem Kuerzen')
  })
})
