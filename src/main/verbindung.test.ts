import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolve } from 'node:path'

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
vi.mock('../autodarts/websocket', async (importOriginal) => {
  // boardThema/KANAL_BOARDS sind reine Werte/Funktionen - die echten reichen
  // hier, nur verbinden() selbst muss gemockt werden (echte Netzwerkanfragen
  // waeren sonst unvermeidlich).
  const echte = await importOriginal<typeof import('../autodarts/websocket')>()
  return { ...echte, verbinden: verbindenMock }
})

// standardAufzeichnungspfad() braucht app.getPath('userData') (dynamischer
// import('electron') in aufzeichnung.ts) - komplett gemockt, damit dieser
// Test unter einer normalen Node-Runtime laeuft, ohne selbst 'electron' zu
// mocken.
const standardAufzeichnungspfadMock = vi.fn()
vi.mock('../autodarts/aufzeichnung', () => ({
  standardAufzeichnungspfad: standardAufzeichnungspfadMock,
}))

const verbindungszustandVerteilenMock = vi.fn()
const zustandVerteilenMock = vi.fn()
vi.mock('./fenster', () => ({
  verbindungszustandVerteilen: verbindungszustandVerteilenMock,
  zustandVerteilen: zustandVerteilenMock,
}))

// anwenden() bleibt standardmaessig die echte Implementierung (siehe
// importOriginal unten) - nur der eine Fehler-Resilienz-Test unten ersetzt
// sie gezielt mit einer werfenden Attrappe. Gleiches Muster wie beim
// verbinden()-Mock oben.
const anwendenMock = vi.fn()
vi.mock('../autodarts/adapter', async (importOriginal) => {
  const echte = await importOriginal<typeof import('../autodarts/adapter')>()
  anwendenMock.mockImplementation(echte.anwenden)
  return { ...echte, anwenden: anwendenMock }
})

const konfigurationLesenMock = vi.fn()
vi.mock('./konfiguration', () => ({
  konfigurationLesen: konfigurationLesenMock,
}))

const { verbindungBeenden, verbindungStarten } = await import('./verbindung')

describe('verbindungStarten: Single-Flight fuer gleichzeitige Verbindungsversuche', () => {
  beforeEach(async () => {
    // Reset des modulinternen aktiveVerbindung-Zustands vor jedem Test -
    // sonst wuerde ein Test, der wirklich verbindet (siehe Board-Abonnement-
    // Tests unten), jeden nachfolgenden Test verfaelschen: verbindungStarten()
    // uebersprringt bei bereits aktiver Verbindung sofort, ohne istAngemeldet()
    // erneut aufzurufen.
    await verbindungBeenden()
    vi.clearAllMocks()
    delete process.env.AD_WIEDERGABE
    delete process.env.AD_AUFZEICHNEN
    konfigurationLesenMock.mockResolvedValue({ boardId: null, playerDisplayId: null, spectatorDisplayId: null })
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

describe('verbindungStarten: Board-Abonnement nach erfolgreichem Verbindungsaufbau', () => {
  // Attrappe fuer die von verbinden() gelieferte Verbindung - nur abonnieren()
  // ist fuer diese Tests interessant.
  const abonnierenMock = vi.fn()

  beforeEach(async () => {
    await verbindungBeenden()
    vi.clearAllMocks()
    delete process.env.AD_WIEDERGABE
    delete process.env.AD_AUFZEICHNEN
    istAngemeldetMock.mockResolvedValue(true)
    verbindenMock.mockResolvedValue({ abonnieren: abonnierenMock, abbestellen: vi.fn(), schliessen: vi.fn() })
    standardAufzeichnungspfadMock.mockResolvedValue('/mock-userdata/mitschnitte/irgendein-zeitstempel.jsonl')
  })

  it('abonniert autodarts.boards/<boardId>.matches, wenn die Konfiguration eine Board-Kennung hat', async () => {
    konfigurationLesenMock.mockResolvedValue({ boardId: 'board-1', playerDisplayId: null, spectatorDisplayId: null })

    await verbindungStarten()

    expect(abonnierenMock).toHaveBeenCalledWith('autodarts.boards', 'board-1.matches')
  })

  it('abonniert nichts, wenn keine Board-Kennung in der Konfiguration steht', async () => {
    konfigurationLesenMock.mockResolvedValue({ boardId: null, playerDisplayId: null, spectatorDisplayId: null })

    await verbindungStarten()

    expect(abonnierenMock).not.toHaveBeenCalled()
  })
})

describe('verbindungStarten: Aufzeichnung standardmaessig eingeschaltet', () => {
  beforeEach(async () => {
    await verbindungBeenden()
    vi.clearAllMocks()
    delete process.env.AD_WIEDERGABE
    delete process.env.AD_AUFZEICHNEN
    istAngemeldetMock.mockResolvedValue(true)
    konfigurationLesenMock.mockResolvedValue({ boardId: null, playerDisplayId: null, spectatorDisplayId: null })
    verbindenMock.mockResolvedValue({ abonnieren: vi.fn(), abbestellen: vi.fn(), schliessen: vi.fn() })
  })

  // Der Herausgeber startet ueber die Verknuepfung, ohne Umgebungsvariablen -
  // ohne diesen Fallback bliebe AD_AUFZEICHNEN dann fuer immer leer und es
  // entstuende nie ein Mitschnitt.
  it('belegt AD_AUFZEICHNEN mit dem Standardpfad, wenn der Herausgeber nichts gesetzt hat', async () => {
    standardAufzeichnungspfadMock.mockResolvedValue('/userdata/mitschnitte/2026-09-10T12-00-00-000Z.jsonl')

    await verbindungStarten()

    expect(process.env.AD_AUFZEICHNEN).toBe('/userdata/mitschnitte/2026-09-10T12-00-00-000Z.jsonl')
    expect(standardAufzeichnungspfadMock).toHaveBeenCalledTimes(1)
  })

  // AD_AUFZEICHNEN bleibt eine ausdrueckliche Wahl mit Vorrang - eine schon
  // gesetzte, absolute Variable darf nicht durch den Standardpfad ersetzt
  // werden.
  it('laesst eine ausdruecklich gesetzte, absolute AD_AUFZEICHNEN unangetastet', async () => {
    process.env.AD_AUFZEICHNEN = '/schon/gesetzt/mitschnitt.jsonl'

    await verbindungStarten()

    expect(process.env.AD_AUFZEICHNEN).toBe('/schon/gesetzt/mitschnitt.jsonl')
    expect(standardAufzeichnungspfadMock).not.toHaveBeenCalled()
  })

  it('normalisiert eine ausdruecklich gesetzte, relative AD_AUFZEICHNEN weiterhin gegen das Arbeitsverzeichnis', async () => {
    process.env.AD_AUFZEICHNEN = 'docs/fixtures/match.jsonl'

    await verbindungStarten()

    expect(process.env.AD_AUFZEICHNEN).toBe(resolve(process.cwd(), 'docs/fixtures/match.jsonl'))
    expect(standardAufzeichnungspfadMock).not.toHaveBeenCalled()
  })
})

describe('verbindungStarten: Adapter-Anbindung (die Naht, die in Task 5/8/10 niemandem gehoerte)', () => {
  beforeEach(async () => {
    await verbindungBeenden()
    vi.clearAllMocks()
    delete process.env.AD_WIEDERGABE
    delete process.env.AD_AUFZEICHNEN
    istAngemeldetMock.mockResolvedValue(true)
    konfigurationLesenMock.mockResolvedValue({ boardId: null, playerDisplayId: null, spectatorDisplayId: null })
    standardAufzeichnungspfadMock.mockResolvedValue('/mock-userdata/mitschnitte/irgendein-zeitstempel.jsonl')
    verbindenMock.mockResolvedValue({ abonnieren: vi.fn(), abbestellen: vi.fn(), schliessen: vi.fn() })
  })

  // Holt den beiEreignis-Rueckruf, den verbindungAufbauen() an verbinden()
  // uebergibt - der einzige Weg, ein Rohereignis in diesem Test "ankommen"
  // zu lassen, ohne den echten websocket.ts-Mechanismus nachzubauen.
  const beiEreignisAus = () => verbindenMock.mock.calls[0]![0] as (roh: unknown) => void

  it('wendet ein empfangenes .state-Ereignis ueber anwenden() an und verteilt das Ergebnis ueber zustandVerteilen', async () => {
    await verbindungStarten()

    beiEreignisAus()({
      channel: 'autodarts.matches',
      topic: 'match-1.state',
      data: {
        id: 'match-1',
        type: 'state',
        variant: 'X01',
        player: 0,
        players: { '0': { name: 'Jan' }, '1': { name: 'Markus' } },
        gameScores: { '0': 501, '1': 501 },
        turns: {},
        turnScore: 0,
        turnBusted: false,
        finished: false,
        gameFinished: false,
        settings: {},
        stats: {},
      },
    })

    expect(anwendenMock).toHaveBeenCalledTimes(1)
    expect(zustandVerteilenMock).toHaveBeenCalledTimes(1)
    const verteilterZustand = zustandVerteilenMock.mock.calls[0]![0]
    expect(verteilterZustand.matchId).toBe('match-1')
    expect(verteilterZustand.players).toHaveLength(2)
  })

  // Deckt Spec Abschnitt 14 ("Ein Anzeigefehler darf ein laufendes Match nie
  // unterbrechen") direkt an der Einhaengestelle ab - unabhaengig davon, dass
  // anwenden() selbst nach eigenem Anspruch nie wirft.
  it('ein Fehler im Adapter reisst die Verbindung nicht ab und verteilt keinen kaputten Zustand', async () => {
    anwendenMock.mockImplementationOnce(() => {
      throw new Error('kaputt')
    })

    await verbindungStarten()

    expect(() => beiEreignisAus()({ irgendwas: true })).not.toThrow()
    expect(zustandVerteilenMock).not.toHaveBeenCalled()
  })
})
