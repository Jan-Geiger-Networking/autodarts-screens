import { beforeEach, describe, expect, it, vi } from 'vitest'

// darfKanalNutzen() (ipc.test.ts) ist reine Logik. Diese Datei deckt den Weg
// davor ab: ein echtes ipcMain.handle()-Ereignis -> BrowserWindow.fromWebContents
// -> fensterArtVon() -> darfKanalNutzen() -> Erlauben oder Werfen. Dafuer
// werden 'electron' und die Nachbarmodule von ipc.ts gemockt, damit die
// eigentliche Verdrahtung in ipc.ts (kanalPruefen, ipcRegistrieren) unter
// einer normalen Node-Runtime laeuft und beobachtbar bleibt.
type Handler = (event: unknown, ...args: unknown[]) => unknown

const handlers = new Map<string, Handler>()
const handleMock = vi.fn((kanal: string, fn: Handler) => {
  handlers.set(kanal, fn)
})
const onMock = vi.fn()
const fromWebContentsMock = vi.fn()

const showItemInFolderMock = vi.fn()

vi.mock('electron', () => ({
  app: { getVersion: () => '0.0.0-test', getPath: () => '/fake/userData' },
  ipcMain: { handle: handleMock, on: onMock },
  BrowserWindow: { fromWebContents: fromWebContentsMock },
  shell: { showItemInFolder: showItemInFolderMock },
}))

const protokollierenMock = vi.fn().mockResolvedValue(undefined)
const diagnosePfadMock = vi.fn().mockResolvedValue('/fake/userData/diagnose.log')
vi.mock('../autodarts/diagnose', () => ({
  protokollieren: protokollierenMock,
  diagnosePfad: diagnosePfadMock,
}))

const fensterArtVonMock = vi.fn()
vi.mock('./fenster', () => ({
  fensterArtVon: fensterArtVonMock,
  fensterOeffnen: vi.fn(),
  fensterSchliessen: vi.fn(),
  konfigurationAktualisieren: vi.fn(),
  verbindungszustandVerteilen: vi.fn(),
}))

vi.mock('./verbindung', () => ({
  verbindungStarten: vi.fn().mockResolvedValue(undefined),
  verbindungBeenden: vi.fn().mockResolvedValue(undefined),
}))

const anmeldenMock = vi.fn().mockResolvedValue(undefined)
const abmeldenMock = vi.fn().mockResolvedValue(undefined)
const fehlerZuMeldungMock = vi.fn().mockReturnValue('Testmeldung')
const istAngemeldetMock = vi.fn().mockResolvedValue(false)
vi.mock('../autodarts/oauth', () => ({
  anmelden: anmeldenMock,
  abmelden: abmeldenMock,
  istAngemeldet: istAngemeldetMock,
  istAnmeldungAbbruch: (fehler: unknown) => fehler instanceof Error && fehler.message.startsWith('Anmeldung abgebrochen'),
  fehlerZuMeldung: fehlerZuMeldungMock,
}))

// Eigenes Modul (siehe src/autodarts/konto.ts) - gemockt statt echt geladen,
// damit dieser Test ausschliesslich die Verdrahtung in ipc.ts prueft (welche
// Funktion bei welchem Kanal/welcher Fensterart aufgerufen wird), nicht die
// Cache- oder Netzwerklogik von kontoNameLaden() selbst.
const kontoNameLadenMock = vi.fn().mockResolvedValue(null)
const kontoNameVerwerfenMock = vi.fn()
vi.mock('../autodarts/konto', () => ({
  kontoNameLaden: kontoNameLadenMock,
  kontoNameVerwerfen: kontoNameVerwerfenMock,
}))

const konfigurationLesenMock = vi.fn().mockResolvedValue({ boardId: null })
vi.mock('./konfiguration', () => ({
  konfigurationLesen: konfigurationLesenMock,
  konfigurationSchreiben: vi.fn(),
  zusammenfuehren: vi.fn(),
}))

vi.mock('./monitore', () => ({
  monitoreAuflisten: vi.fn(() => []),
  monitoreIdentifizieren: vi.fn(),
}))

const alleDatenLoeschenMock = vi.fn().mockResolvedValue([])
vi.mock('./datenLoeschen', () => ({ alleDatenLoeschen: alleDatenLoeschenMock }))

const { ipcRegistrieren } = await import('./ipc')

// Der Inhalt von event.sender ist irrelevant - BrowserWindow.fromWebContents
// ist gemockt und entscheidet, "welches Fenster" gemeldet wird, unabhaengig
// vom tatsaechlichen Objekt.
const fakeEvent = { sender: {} }

describe('IPC-Waechter-Verdrahtung: Ereignis -> Fensterart -> Erlauben/Werfen', () => {
  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
    ipcRegistrieren()
  })

  it('erlaubt dem Control-Fenster einen eingeschraenkten Kanal', async () => {
    fensterArtVonMock.mockReturnValue('control')
    fromWebContentsMock.mockReturnValue({})

    const handler = handlers.get('konfiguration:lesen')!
    await expect(handler(fakeEvent)).resolves.toEqual({ boardId: null })
    expect(konfigurationLesenMock).toHaveBeenCalledTimes(1)
  })

  it('verweigert einem als "player" erkannten Aufrufer denselben Kanal', () => {
    fensterArtVonMock.mockReturnValue('player')
    fromWebContentsMock.mockReturnValue({})

    const handler = handlers.get('konfiguration:lesen')!
    expect(() => handler(fakeEvent)).toThrow(/Control-Fenster vorbehalten/)
    expect(konfigurationLesenMock).not.toHaveBeenCalled()
  })

  it('verweigert, wenn BrowserWindow.fromWebContents kein Fenster findet (unbekannter Aufrufer)', () => {
    fromWebContentsMock.mockReturnValue(null)

    const handler = handlers.get('daten:loeschen')!
    expect(() => handler(fakeEvent)).toThrow(/unbekannt/)
    expect(alleDatenLoeschenMock).not.toHaveBeenCalled()
  })

  it('verweigert dem Player-Fenster monitore:identifizieren, weil es handelt (Befund 5)', () => {
    fensterArtVonMock.mockReturnValue('player')
    fromWebContentsMock.mockReturnValue({})

    const handler = handlers.get('monitore:identifizieren')!
    expect(() => handler(fakeEvent)).toThrow(/Control-Fenster vorbehalten/)
  })

  it('laesst einen uneingeschraenkten Kanal unabhaengig von der Fensterart durch', () => {
    fensterArtVonMock.mockReturnValue('player')
    fromWebContentsMock.mockReturnValue({})

    const handler = handlers.get('monitore:auflisten')!
    expect(() => handler(fakeEvent)).not.toThrow()
  })

  // Anmelden/Abmelden gehoeren dem Control-Fenster - Player und Spectator
  // haben mit der Kontoverwaltung nichts zu tun. Beide Handler sind async,
  // ein kanalPruefen()-Wurf darin wird deshalb zu einer abgelehnten Promise,
  // nicht zu einem synchronen Wurf.
  it.each(['anmeldung:starten', 'anmeldung:beenden'])('verweigert dem Player-Fenster %s', async (kanal) => {
    fensterArtVonMock.mockReturnValue('player')
    fromWebContentsMock.mockReturnValue({})

    const handler = handlers.get(kanal)!
    await expect(handler(fakeEvent)).rejects.toThrow(/Control-Fenster vorbehalten/)
  })

  // anmeldung:status ist inzwischen async (der Kontoname wird bei Bedarf
  // nachgeladen, siehe kontoNameLaden) - ein kanalPruefen()-Wurf darin wird
  // deshalb zu einer abgelehnten Promise, nicht mehr zu einem synchronen Wurf
  // (gleiches Muster wie bei anmeldung:starten/anmeldung:beenden oben).
  it('verweigert dem Player-Fenster anmeldung:status', async () => {
    fensterArtVonMock.mockReturnValue('player')
    fromWebContentsMock.mockReturnValue({})

    const handler = handlers.get('anmeldung:status')!
    await expect(handler(fakeEvent)).rejects.toThrow(/Control-Fenster vorbehalten/)
  })

  it('erlaubt dem Control-Fenster anmeldung:starten, ruft anmelden() auf und verwirft einen alten Kontonamen', async () => {
    fensterArtVonMock.mockReturnValue('control')
    fromWebContentsMock.mockReturnValue({})

    const handler = handlers.get('anmeldung:starten')!
    await expect(handler(fakeEvent)).resolves.toEqual({ erfolg: true })
    expect(anmeldenMock).toHaveBeenCalledTimes(1)
    // Ein neuer Anmeldeversuch koennte zu einem anderen Konto gehoeren als
    // ein zuvor zwischengespeicherter Name - der naechste anmeldung:status-
    // Aufruf soll frisch abfragen (siehe Kommentar an kontoNameVerwerfen).
    expect(kontoNameVerwerfenMock).toHaveBeenCalledTimes(1)
  })

  it('meldet einen Abbruch als erfolg:false, abgebrochen:true statt als Fehler und verwirft keinen Kontonamen', async () => {
    fensterArtVonMock.mockReturnValue('control')
    fromWebContentsMock.mockReturnValue({})
    anmeldenMock.mockRejectedValueOnce(new Error('Anmeldung abgebrochen'))

    const handler = handlers.get('anmeldung:starten')!
    await expect(handler(fakeEvent)).resolves.toEqual({ erfolg: false, abgebrochen: true, meldung: 'Testmeldung' })
    expect(kontoNameVerwerfenMock).not.toHaveBeenCalled()
  })

  it('meldet einen echten Fehler als erfolg:false, abgebrochen:false', async () => {
    fensterArtVonMock.mockReturnValue('control')
    fromWebContentsMock.mockReturnValue({})
    anmeldenMock.mockRejectedValueOnce(new Error('Netzwerkfehler'))

    const handler = handlers.get('anmeldung:starten')!
    await expect(handler(fakeEvent)).resolves.toEqual({ erfolg: false, abgebrochen: false, meldung: 'Testmeldung' })
  })

  it('erlaubt dem Control-Fenster anmeldung:beenden, ruft abmelden() auf und verwirft den Kontonamen', async () => {
    fensterArtVonMock.mockReturnValue('control')
    fromWebContentsMock.mockReturnValue({})

    const handler = handlers.get('anmeldung:beenden')!
    await handler(fakeEvent)
    expect(abmeldenMock).toHaveBeenCalledTimes(1)
    expect(kontoNameVerwerfenMock).toHaveBeenCalledTimes(1)
  })

  it('erlaubt dem Control-Fenster anmeldung:status und liefert nichtAngemeldet ohne Kontonamen abzufragen', async () => {
    fensterArtVonMock.mockReturnValue('control')
    fromWebContentsMock.mockReturnValue({})
    istAngemeldetMock.mockResolvedValueOnce(false)

    const handler = handlers.get('anmeldung:status')!
    await expect(handler(fakeEvent)).resolves.toEqual({ angemeldet: false, kontoName: null })
    // "Nicht bei jedem Rendern" (Spezifikation): ohne Anmeldung lohnt sich
    // der Netzaufruf nicht, kontoNameLaden() soll dann gar nicht erst laufen.
    expect(kontoNameLadenMock).not.toHaveBeenCalled()
  })

  it('erlaubt dem Control-Fenster anmeldung:status und liefert Anmeldezustand samt Kontoname', async () => {
    fensterArtVonMock.mockReturnValue('control')
    fromWebContentsMock.mockReturnValue({})
    istAngemeldetMock.mockResolvedValueOnce(true)
    kontoNameLadenMock.mockResolvedValueOnce('Anna')

    const handler = handlers.get('anmeldung:status')!
    await expect(handler(fakeEvent)).resolves.toEqual({ angemeldet: true, kontoName: 'Anna' })
  })

  it('verweigert dem Player-Fenster diagnose:pfad und diagnose:oeffnen', async () => {
    fensterArtVonMock.mockReturnValue('player')
    fromWebContentsMock.mockReturnValue({})

    // diagnose:pfad ist nicht async (gleiches Muster wie konfiguration:lesen) -
    // kanalPruefen() wirft dort synchron, nicht als abgelehnte Promise.
    expect(() => handlers.get('diagnose:pfad')!(fakeEvent)).toThrow(/Control-Fenster vorbehalten/)
    await expect(handlers.get('diagnose:oeffnen')!(fakeEvent)).rejects.toThrow(/Control-Fenster vorbehalten/)
    expect(showItemInFolderMock).not.toHaveBeenCalled()
  })

  it('erlaubt dem Control-Fenster diagnose:pfad und liefert den Pfad', async () => {
    fensterArtVonMock.mockReturnValue('control')
    fromWebContentsMock.mockReturnValue({})

    await expect(handlers.get('diagnose:pfad')!(fakeEvent)).resolves.toBe('/fake/userData/diagnose.log')
  })

  it('erlaubt dem Control-Fenster diagnose:oeffnen und ruft shell.showItemInFolder mit dem Pfad auf', async () => {
    fensterArtVonMock.mockReturnValue('control')
    fromWebContentsMock.mockReturnValue({})

    await handlers.get('diagnose:oeffnen')!(fakeEvent)
    expect(showItemInFolderMock).toHaveBeenCalledWith('/fake/userData/diagnose.log')
  })
})
