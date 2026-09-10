import { beforeEach, describe, expect, it, vi } from 'vitest'

// verbindung.ts importiert './fenster' (top-level 'electron'-Import) und
// '../autodarts/websocket'/'../autodarts/oauth' - alle drei gemockt, damit
// dieser Test unter einer normalen Node-Runtime laeuft und istAngemeldet()
// gezielt haengen gelassen werden kann, um echte Gleichzeitigkeit zu
// erzwingen (siehe erster Test unten).
const istAngemeldetMock = vi.fn()
vi.mock('../autodarts/oauth', () => ({
  istAngemeldet: istAngemeldetMock,
}))

const verbindenMock = vi.fn()
vi.mock('../autodarts/websocket', () => ({
  verbinden: verbindenMock,
}))

const verbindungszustandVerteilenMock = vi.fn()
vi.mock('./fenster', () => ({
  verbindungszustandVerteilen: verbindungszustandVerteilenMock,
}))

const { verbindungStarten } = await import('./verbindung')

describe('verbindungStarten: Single-Flight fuer gleichzeitige Verbindungsversuche', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.AD_WIEDERGABE
    delete process.env.AD_AUFZEICHNEN
  })

  it('buendelt zwei gleichzeitige Aufrufe zu genau einem Verbindungsversuch (istAngemeldet nur einmal aufgerufen)', async () => {
    // istAngemeldet() haengt bewusst, bis wir es freigeben - so ist
    // sichergestellt, dass der zweite verbindungStarten()-Aufruf unten
    // wirklich waehrend eines laufenden ersten Versuchs ankommt, statt nur
    // zufaellig danach.
    let freigeben!: (wert: boolean) => void
    const wartend = new Promise<boolean>((resolve) => {
      freigeben = resolve
    })
    istAngemeldetMock.mockReturnValueOnce(wartend)

    // Wie beim Erneuerungs- und Anmelde-Single-Flight-Test: beide Aufrufe
    // stehen im selben Ausdruck, damit verbindungStarten() sie synchron
    // nacheinander auswertet, bevor der erste beim ersten await auf
    // istAngemeldet() angekommen ist.
    const [p1, p2] = [verbindungStarten(), verbindungStarten()]

    // istAngemeldet() ist synchron (keine Datei-IO noetig, um gemockt zu
    // werden) bereits aufgerufen, sobald der erste Aufruf beim await
    // ankommt - das passiert noch bevor der zweite Aufruf ausgewertet wird.
    expect(istAngemeldetMock).toHaveBeenCalledTimes(1)

    freigeben(false)
    await p1
    await p2

    expect(istAngemeldetMock).toHaveBeenCalledTimes(1)
    expect(verbindenMock).not.toHaveBeenCalled()
  })

  it('loest die Sperre nach Abschluss wieder: ein dritter Aufruf startet einen neuen Verbindungsversuch', async () => {
    istAngemeldetMock.mockResolvedValueOnce(false)
    await verbindungStarten()
    expect(istAngemeldetMock).toHaveBeenCalledTimes(1)

    // Waere laufenderVerbindungsversuch nicht zurueckgesetzt worden, bliebe
    // dieser Aufruf fuer immer an der ersten, bereits abgeschlossenen
    // Promise haengen statt istAngemeldet() erneut aufzurufen.
    istAngemeldetMock.mockResolvedValueOnce(false)
    await verbindungStarten()
    expect(istAngemeldetMock).toHaveBeenCalledTimes(2)
  })
})
