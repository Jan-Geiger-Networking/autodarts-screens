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

vi.mock('electron', () => ({
  app: { getVersion: () => '0.0.0-test' },
  ipcMain: { handle: handleMock, on: onMock },
  BrowserWindow: { fromWebContents: fromWebContentsMock },
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
vi.mock('../autodarts/oauth', () => ({
  anmelden: anmeldenMock,
  abmelden: abmeldenMock,
  istAngemeldet: vi.fn().mockResolvedValue(false),
  istAnmeldungAbbruch: (fehler: unknown) => fehler instanceof Error && fehler.message.startsWith('Anmeldung abgebrochen'),
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

  it('verweigert dem Player-Fenster anmeldung:status', () => {
    fensterArtVonMock.mockReturnValue('player')
    fromWebContentsMock.mockReturnValue({})

    const handler = handlers.get('anmeldung:status')!
    expect(() => handler(fakeEvent)).toThrow(/Control-Fenster vorbehalten/)
  })

  it('erlaubt dem Control-Fenster anmeldung:starten und ruft anmelden() auf', async () => {
    fensterArtVonMock.mockReturnValue('control')
    fromWebContentsMock.mockReturnValue({})

    const handler = handlers.get('anmeldung:starten')!
    await expect(handler(fakeEvent)).resolves.toEqual({ erfolg: true })
    expect(anmeldenMock).toHaveBeenCalledTimes(1)
  })

  it('meldet einen Abbruch als erfolg:false, abgebrochen:true statt als Fehler', async () => {
    fensterArtVonMock.mockReturnValue('control')
    fromWebContentsMock.mockReturnValue({})
    anmeldenMock.mockRejectedValueOnce(new Error('Anmeldung abgebrochen'))

    const handler = handlers.get('anmeldung:starten')!
    await expect(handler(fakeEvent)).resolves.toEqual({ erfolg: false, abgebrochen: true })
  })

  it('meldet einen echten Fehler als erfolg:false, abgebrochen:false', async () => {
    fensterArtVonMock.mockReturnValue('control')
    fromWebContentsMock.mockReturnValue({})
    anmeldenMock.mockRejectedValueOnce(new Error('Netzwerkfehler'))

    const handler = handlers.get('anmeldung:starten')!
    await expect(handler(fakeEvent)).resolves.toEqual({ erfolg: false, abgebrochen: false })
  })

  it('erlaubt dem Control-Fenster anmeldung:beenden und ruft abmelden() auf', async () => {
    fensterArtVonMock.mockReturnValue('control')
    fromWebContentsMock.mockReturnValue({})

    const handler = handlers.get('anmeldung:beenden')!
    await handler(fakeEvent)
    expect(abmeldenMock).toHaveBeenCalledTimes(1)
  })
})
