import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  AutodartsHttpFehler,
  anmelden,
  codeAusUmleitung,
  fehlerZuMeldung,
  istAblageNichtVerfuegbar,
  istAnmeldungAbbruch,
  istAnmeldungZeitlimit,
  istKeinAktualisierungsToken,
  pkcePaar,
  tokenNochGueltig,
  zugriffsToken,
} from './oauth'
import { NichtAngemeldetFehler } from './fehler'

// Attrappe fuer das Anmeldefenster, das anmelden() (genauer:
// anmeldungDurchfuehren()) per `new BrowserWindow(...)` oeffnet. Nur die
// Instanzen zaehlen und der 'closed'-Zuhoerer werden gebraucht: der Test
// unten simuliert einen Nutzer, der das Fenster schliesst, ohne den echten
// OAuth-Ablauf (Umleitung, Code-Tausch) nachzubilden - das genuegt, um die
// Single-Flight-Sperre laufendeAnmeldung zu pruefen, ohne fetch() mocken zu
// muessen.
class FakeAnmeldeFenster {
  static instanzen: FakeAnmeldeFenster[] = []
  webContents = { setWindowOpenHandler: vi.fn(), on: vi.fn() }
  closedZuhoerer: (() => void) | null = null
  geschlossen = false

  constructor() {
    FakeAnmeldeFenster.instanzen.push(this)
  }

  on(ereignis: string, zuhoerer: () => void): void {
    if (ereignis === 'closed') this.closedZuhoerer = zuhoerer
  }

  loadURL(): Promise<void> {
    return Promise.resolve()
  }

  close(): void {
    // Reine Attrappe: ein echtes BrowserWindow riefe seinen eigenen
    // 'closed'-Zuhoerer beim tatsaechlichen Schliessen auf - hier reicht es,
    // dass isDestroyed() danach wahr ist, falls anmeldungDurchfuehren() es
    // abfragt (fenster.close() im Erfolgsfall).
    this.geschlossen = true
  }

  isDestroyed(): boolean {
    return this.geschlossen
  }
}

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

  // Diagnose-Befund: unklar, ob der Server nach einer Passwort-Anmeldung auf
  // einen anderen Pfad unter /auth/ umleitet als ".../auth/google/callback".
  // Das Abfangen prueft deshalb gegen das ganze /auth/-Verzeichnis, nicht nur
  // den einen erwarteten Pfad - dieser Test bildet genau das ab.
  it('entnimmt den Code auch von einem anderen Pfad unter demselben /auth/-Verzeichnis', () => {
    const ergebnis = codeAusUmleitung(
      `https://play.autodarts.com/auth/anderer-pfad?code=abc123&state=${STATE}`,
      STATE,
    )
    expect(ergebnis).toEqual({ code: 'abc123' })
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
  // Fuer anmelden()/anmeldungDurchfuehren() unten (Single-Flight-Test) -
  // FakeAnmeldeFenster steht schon, wenn diese Factory tatsaechlich laeuft:
  // oauth.ts importiert 'electron' nur dynamisch (await import('electron'))
  // zur Laufzeit innerhalb der Testfunktionen, also lange nach dem
  // synchronen Auswerten dieser Datei.
  BrowserWindow: FakeAnmeldeFenster,
  session: { fromPartition: () => ({ setUserAgent: vi.fn() }) },
  shell: { openExternal: vi.fn() },
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

// Deckt laufendeAnmeldung ab (Nachtrag zur Anmelden/Abmelden-Aufgabe): ohne
// diese Sperre wuerde ein Doppelklick auf den Anmelden-Knopf zwei
// Anmeldefenster gleichzeitig oeffnen. Gleicher Massstab wie beim
// Erneuerungs-Single-Flight oben: zwei WIRKLICH gleichzeitige Aufrufe
// (ausgewertet, bevor irgendein await dazwischenkommt) duerfen nur einen
// Vorgang ausloesen, und nach dessen Abschluss muss ein dritter Aufruf einen
// neuen Vorgang starten - eine haengengebliebene Sperre waere schlimmer als
// gar keine.
describe('anmelden: Single-Flight fuer gleichzeitige Anmeldeversuche', () => {
  beforeEach(() => {
    FakeAnmeldeFenster.instanzen = []
  })

  // anmeldungDurchfuehren() haengt zwischen dem synchronen anmelden()-Aufruf
  // und dem tatsaechlichen `new BrowserWindow(...)` noch am dynamischen
  // `await import('electron')` - eine Handvoll Mikrotasks reichen nicht
  // sicher, ein echter Tick (setTimeout) schon.
  const bisFensterOffen = () => new Promise((resolve) => setTimeout(resolve, 0))

  it('buendelt zwei gleichzeitige Aufrufe zu genau einem Anmeldeversuch (nur ein Fenster geoeffnet)', async () => {
    // Wie beim Erneuerungs-Test: beide Aufrufe stehen im selben Ausdruck,
    // damit anmelden() sie synchron nacheinander auswertet, bevor der erste
    // ueberhaupt beim ersten await angekommen ist - erst so trifft der
    // zweite Aufruf wirklich auf ein bereits gesetztes laufendeAnmeldung.
    const [p1, p2] = [anmelden(), anmelden()]

    await bisFensterOffen()
    expect(FakeAnmeldeFenster.instanzen).toHaveLength(1)

    // Nutzer schliesst das (einzige) Anmeldefenster - beide Aufrufe haengen
    // an derselben laufendeAnmeldung-Promise und lehnen deshalb gemeinsam ab.
    FakeAnmeldeFenster.instanzen[0]!.closedZuhoerer?.()

    await expect(p1).rejects.toThrow('Anmeldung abgebrochen')
    await expect(p2).rejects.toThrow('Anmeldung abgebrochen')
    expect(FakeAnmeldeFenster.instanzen).toHaveLength(1)
  })

  it('loest die Sperre nach Abschluss wieder: ein dritter Aufruf startet einen neuen Anmeldeversuch', async () => {
    const ersterVersuch = anmelden()
    await bisFensterOffen()
    expect(FakeAnmeldeFenster.instanzen).toHaveLength(1)
    FakeAnmeldeFenster.instanzen[0]!.closedZuhoerer?.()
    await expect(ersterVersuch).rejects.toThrow('Anmeldung abgebrochen')

    // Waere laufendeAnmeldung nicht zurueckgesetzt worden, bliebe dieser
    // dritte Aufruf für immer an der ersten (bereits abgeschlossenen)
    // Promise haengen, statt ein zweites Fenster zu oeffnen.
    const zweiterVersuch = anmelden()
    await bisFensterOffen()
    expect(FakeAnmeldeFenster.instanzen).toHaveLength(2)
    FakeAnmeldeFenster.instanzen[1]!.closedZuhoerer?.()
    await expect(zweiterVersuch).rejects.toThrow('Anmeldung abgebrochen')
  })
})

describe('istAnmeldungZeitlimit: grenzt die speziellere Zeitlimit-Ursache von einem geschlossenen Fenster ab', () => {
  it('erkennt das Zeitlimit', () => {
    expect(istAnmeldungZeitlimit(new Error('Anmeldung abgebrochen: 5 Minuten ohne Rueckmeldung'))).toBe(true)
  })

  it('erkennt ein vom Nutzer geschlossenes Fenster nicht als Zeitlimit', () => {
    expect(istAnmeldungZeitlimit(new Error('Anmeldung abgebrochen'))).toBe(false)
  })

  // Beide Faelle bleiben trotzdem "ein Abbruch" (istAnmeldungAbbruch),
  // istAnmeldungZeitlimit grenzt nur die speziellere Ursache ab.
  it('istAnmeldungAbbruch erkennt weiterhin beide Faelle', () => {
    expect(istAnmeldungAbbruch(new Error('Anmeldung abgebrochen'))).toBe(true)
    expect(istAnmeldungAbbruch(new Error('Anmeldung abgebrochen: 5 Minuten ohne Rueckmeldung'))).toBe(true)
  })
})

describe('istKeinAktualisierungsToken und istAblageNichtVerfuegbar', () => {
  it('erkennt die fehlende Aktualisierungs-Token-Meldung', () => {
    expect(
      istKeinAktualisierungsToken(
        new Error('Autodarts-Antwort auf den Code-Tausch enthielt kein Aktualisierungs-Token'),
      ),
    ).toBe(true)
    expect(istKeinAktualisierungsToken(new Error('etwas anderes'))).toBe(false)
  })

  it('erkennt die nicht verfuegbare verschluesselte Ablage', () => {
    expect(
      istAblageNichtVerfuegbar(new Error('Verschluesselte Ablage steht auf diesem System nicht zur Verfuegung')),
    ).toBe(true)
    expect(istAblageNichtVerfuegbar(new Error('etwas anderes'))).toBe(false)
  })
})

describe('fehlerZuMeldung: ordnet jeden bekannten Fall einem ruhigen deutschen Satz zu', () => {
  const PFAD = 'C:\\fake\\userData\\diagnose.log'

  it('Nutzer hat abgebrochen', () => {
    expect(fehlerZuMeldung(new Error('Anmeldung abgebrochen'), PFAD)).toBe('Anmeldung abgebrochen.')
  })

  it('Zeitlimit erreicht', () => {
    const meldung = fehlerZuMeldung(new Error('Anmeldung abgebrochen: 5 Minuten ohne Rueckmeldung'), PFAD)
    expect(meldung).toMatch(/Zeitlimit erreicht/)
  })

  it('der Server hat den Code abgelehnt (4xx von AUSTAUSCH)', () => {
    const fehler = new AutodartsHttpFehler(400, 'Autodarts-Anfrage an .../exchange fehlgeschlagen (400): ...')
    const meldung = fehlerZuMeldung(fehler, PFAD)
    expect(meldung).toMatch(/Anmeldecode abgelehnt/)
    // Ein zweiter Versuch mit demselben Code hilft nie - die Meldung soll
    // zu einem ganz neuen Anmeldeversuch auffordern, nicht nur zu "erneut
    // versuchen" (Diagnose-Befund).
    expect(meldung).toMatch(/neu starten/)
  })

  it('ein 5xx-Fehler von AUSTAUSCH faellt NICHT unter "Code abgelehnt" (Serverfehler, kein Client-Fehler)', () => {
    const fehler = new AutodartsHttpFehler(500, 'Autodarts-Anfrage an .../exchange fehlgeschlagen (500): ...')
    expect(fehlerZuMeldung(fehler, PFAD)).toContain(PFAD)
  })

  it('die Antwort enthielt kein Aktualisierungs-Token', () => {
    const meldung = fehlerZuMeldung(
      new Error('Autodarts-Antwort auf den Code-Tausch enthielt kein Aktualisierungs-Token'),
      PFAD,
    )
    expect(meldung).toMatch(/kein Aktualisierungs-Token/)
  })

  it('die verschluesselte Ablage steht nicht zur Verfuegung', () => {
    const meldung = fehlerZuMeldung(
      new Error('Verschluesselte Ablage steht auf diesem System nicht zur Verfuegung'),
      PFAD,
    )
    expect(meldung).toMatch(/verschluesselte Ablage/)
  })

  it('keine Netzverbindung (TypeError, wie es Node fetch bei Netzwerkfehlern wirft)', () => {
    const meldung = fehlerZuMeldung(new TypeError('fetch failed'), PFAD)
    expect(meldung).toMatch(/Netzverbindung/)
  })

  it('ein unbekannter Fehler bekommt eine allgemeine Meldung mit Verweis auf das Diagnoseprotokoll, nie den rohen Text', () => {
    const fehler = new Error('Unerwartete Adresse: https://irgendwas?code=geheim&state=geheim')
    const meldung = fehlerZuMeldung(fehler, PFAD)
    expect(meldung).toContain(PFAD)
    expect(meldung).not.toContain('geheim')
  })
})
