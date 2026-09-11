import { beforeEach, describe, expect, it, vi } from 'vitest'

// protokollieren() wird gemockt, um die "einmalig warnen"-Eigenschaft exakt
// pruefen zu koennen (Aufrufzahl), statt sie ueber console.error-Rauschen zu
// erraten - echte Dateischreibvorgaenge sind fuer diese Tests ohnehin
// irrelevant. vi.hoisted() noetig, weil vi.mock()-Aufrufe an den
// Dateianfang gehoben werden - eine normale const-Deklaration waere zu dem
// Zeitpunkt noch nicht initialisiert (siehe Vitest-Doku zu vi.mock).
const { mockProtokollieren } = vi.hoisted(() => ({ mockProtokollieren: vi.fn() }))
vi.mock('./diagnose', () => ({ protokollieren: mockProtokollieren }))

import {
  anwenden,
  dartsAusZug,
  diagnoseWarnungenZuruecksetzen,
  ersteZahl,
  ersterText,
  nachIndex,
  RUHEZUSTAND,
  segmentAusName,
} from './adapter'
import type { MatchState } from '../shared/typen'

beforeEach(() => {
  vi.clearAllMocks()
  diagnoseWarnungenZuruecksetzen()
})

// ---------------------------------------------------------------------
// Kleine Zugriffsfunktionen einzeln getestet
// ---------------------------------------------------------------------

describe('nachIndex', () => {
  it('gibt ein Array unveraendert zurueck', () => {
    expect(nachIndex(['a', 'b'])).toEqual(['a', 'b'])
  })

  it('sortiert ein Objekt mit numerischen Schluesseln nach Index', () => {
    expect(nachIndex({ '1': 'b', '0': 'a', '2': 'c' })).toEqual(['a', 'b', 'c'])
  })

  it('ignoriert nicht-numerische Schluessel', () => {
    expect(nachIndex({ '0': 'a', irgendwas: 'x' })).toEqual(['a'])
  })

  it('liefert [] fuer null, undefined oder Primitive', () => {
    expect(nachIndex(null)).toEqual([])
    expect(nachIndex(undefined)).toEqual([])
    expect(nachIndex(42)).toEqual([])
  })
})

describe('ersteZahl', () => {
  it('liefert eine direkte Zahl unveraendert', () => {
    expect(ersteZahl(501, [], 'k')).toBe(501)
  })

  it('findet das erste passende Kandidatenfeld', () => {
    expect(ersteZahl({ score: 42 }, ['remaining', 'score'], 'k')).toBe(42)
  })

  it('liefert null und warnt einmalig, wenn kein Kandidatenfeld passt', () => {
    expect(ersteZahl({ irgendwas: 1 }, ['remaining', 'score'], 'testschluessel')).toBeNull()
    expect(ersteZahl({ irgendwas: 1 }, ['remaining', 'score'], 'testschluessel')).toBeNull()
    expect(mockProtokollieren).toHaveBeenCalledTimes(1)
    expect(String(mockProtokollieren.mock.calls[0]![0])).toContain('testschluessel')
  })

  it('liefert null ohne Warnung, wenn der Wert kein Objekt ist', () => {
    expect(ersteZahl(undefined, ['x'], 'k')).toBeNull()
    expect(ersteZahl('text', ['x'], 'k')).toBeNull()
    expect(mockProtokollieren).not.toHaveBeenCalled()
  })
})

describe('ersterText', () => {
  it('liefert eine direkte, nichtleere Zeichenkette unveraendert', () => {
    expect(ersterText('Jan', ['name'], 'k')).toBe('Jan')
  })

  it('findet das erste passende Kandidatenfeld', () => {
    expect(ersterText({ displayName: 'Markus' }, ['name', 'displayName'], 'k')).toBe('Markus')
  })

  it('liefert null, wenn kein Kandidatenfeld passt', () => {
    expect(ersterText({ irgendwas: 1 }, ['name'], 'k')).toBeNull()
  })
})

describe('segmentAusName', () => {
  it('leitet Treble, Doppel und Single korrekt ab', () => {
    expect(segmentAusName('T20')).toEqual({ name: 'T20', value: 20, multiplier: 3 })
    expect(segmentAusName('D16')).toEqual({ name: 'D16', value: 16, multiplier: 2 })
    expect(segmentAusName('5')).toEqual({ name: '5', value: 5, multiplier: 1 })
    expect(segmentAusName('BULL')).toEqual({ name: 'BULL', value: 25, multiplier: 2 })
  })
})

describe('dartsAusZug', () => {
  // Form belegt aus dem Quelltext des offiziellen Autodarts-Web-Clients
  // (use-game-*.js): turns ist eine FLACHE Liste der Zuege dieses Legs, der
  // laufende ist der letzte, und jeder Zug traegt throws[] mit
  // { segment: { number, bed }, coords: { x, y } }.
  it('liefert [] fuer eine leere oder fehlende Liste', () => {
    expect(dartsAusZug(undefined, 'k')).toEqual([])
    expect(dartsAusZug([], 'k')).toEqual([])
  })

  it('nimmt den LETZTEN Zug, nicht den ersten', () => {
    const turns = [
      { throws: [{ segment: { number: 20, bed: 'Triple' } }] },
      { throws: [{ segment: { number: 10, bed: 'Double' } }] },
    ]
    expect(dartsAusZug(turns, 'k')).toEqual([{ name: 'D10', value: 10, multiplier: 2 }])
  })

  it('liest Zahl und Ring aus dem Segment', () => {
    const turns = [
      {
        throws: [
          { segment: { number: 20, bed: 'Triple' } },
          { segment: { number: 5, bed: 'SingleOuter' } },
          { segment: { number: 25, bed: 'Double' } },
        ],
      },
    ]
    expect(dartsAusZug(turns, 'k')).toEqual([
      { name: 'T20', value: 20, multiplier: 3 },
      { name: '5', value: 5, multiplier: 1 },
      { name: 'BULL', value: 25, multiplier: 2 },
    ])
  })

  it('uebernimmt den gemessenen Auftreffpunkt, wenn er dabei ist', () => {
    const turns = [{ throws: [{ segment: { number: 20, bed: 'Single' }, coords: { x: 0.0287, y: 0.7155 } }] }]
    expect(dartsAusZug(turns, 'k')[0]!.koordinaten).toEqual({ x: 0.0287, y: 0.7155 })
  })

  it('macht aus einem Wurf neben die Scheibe einen Miss mit null Punkten', () => {
    const turns = [{ throws: [{ segment: { number: 0, bed: 'Outside' }, coords: { x: -0.9, y: 0.1 } }] }]
    expect(dartsAusZug(turns, 'k')[0]).toEqual({
      name: 'Miss',
      value: 0,
      multiplier: 1,
      koordinaten: { x: -0.9, y: 0.1 },
    })
  })

  it('faellt auf einen Feldnamen zurueck, wenn Zahl und Ring fehlen', () => {
    const turns = [{ throws: [{ name: 'T20' }] }]
    expect(dartsAusZug(turns, 'k')).toEqual([{ name: 'T20', value: 20, multiplier: 3 }])
  })

  it('nimmt hoechstens drei Darts', () => {
    const throws = [1, 2, 3, 4].map(() => ({ segment: { number: 20, bed: 'Triple' } }))
    expect(dartsAusZug([{ throws }], 'k')).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------
// anwenden() - Hauptlogik, gegen von Hand gebaute Ereignisse nach dem
// belegten obersten Schema (siehe adapter-report.md fuer die Liste der
// geratenen verschachtelten Formen: players[i].name/id/setsWon,
// gameScores[i], stats[i].*, turns[i], settings.baseScore).
// ---------------------------------------------------------------------

type Ueberschreibung = Record<string, unknown>

/** Baut ein vollstaendiges, belegtes .state-Rohereignis mit Ueberschreibungen. */
function stateEreignis(matchId: string, ueberschreibung: Ueberschreibung = {}): unknown {
  const nutz: Ueberschreibung = {
    id: matchId,
    type: 'state',
    variant: 'X01',
    createdAt: '2026-09-10T12:00:00.000Z',
    finished: false,
    gameFinished: false,
    gameScores: { '0': 501, '1': 501 },
    gameWinner: -1,
    hasReferee: false,
    host: {},
    leg: 1,
    legs: 11,
    player: 0,
    players: { '0': { name: 'Jan' }, '1': { name: 'Markus' } },
    round: 1,
    scores: null,
    set: 1,
    settings: { baseScore: 501 },
    skippedPlayers: {},
    state: {},
    stats: { '0': {}, '1': {} },
    turnBusted: false,
    turnScore: 0,
    turns: { '0': [], '1': [] },
    winner: -1,
    ...ueberschreibung,
  }
  return { channel: 'autodarts.matches', topic: `${matchId}.state`, data: nutz }
}

describe('anwenden: Ruhezustand zu Spiel', () => {
  it('erkennt beide Spieler und verlaesst den Ruhezustand beim ersten Ereignis eines Matches', () => {
    const ergebnis = anwenden(RUHEZUSTAND, stateEreignis('match-1'))

    expect(ergebnis.phase).not.toBe('idle')
    expect(ergebnis.matchId).toBe('match-1')
    expect(ergebnis.players).toHaveLength(2)
    expect(ergebnis.players.map((p) => p.displayName)).toEqual(['Jan', 'Markus'])
    expect(ergebnis.activePlayerId).toBe(ergebnis.players[0]!.id)
    expect(ergebnis.scores.map((s) => s.remaining)).toEqual([501, 501])
  })

  it('geht nach dem ersten Ereignis eines Matches in "playing" ueber', () => {
    const erstes = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const zweites = anwenden(erstes, stateEreignis('match-1', { player: 0, gameScores: { '0': 441, '1': 501 } }))

    expect(erstes.phase).toBe('intro')
    expect(zweites.phase).toBe('playing')
  })
})

describe('anwenden: unveraendert durchgereichte Themen', () => {
  // Das erste anwenden() je Test baut ueberhaupt erst einen Match-Zustand
  // auf und warnt dabei bereits ueber die in der Hand-Fixture bewusst
  // fehlenden geratenen Felder (setsWon, average, ...) - fuer diese Tests
  // interessant ist nur, ob der DANACH folgende Aufruf (das eigentlich zu
  // pruefende Thema) zusaetzlich warnt, deshalb wird davor zurueckgesetzt.
  it('laesst den Zustand bei einem .game-events-Ereignis unangetastet, ohne zu warnen', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    mockProtokollieren.mockClear()
    const ergebnis = anwenden(start, { channel: 'autodarts.matches', topic: 'match-1.game-events', data: { type: 'throw' } })

    expect(ergebnis).toBe(start)
    expect(mockProtokollieren).not.toHaveBeenCalled()
  })

  it('laesst den Zustand bei einem Board-Heartbeat (.matches) unangetastet, ohne zu warnen', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    mockProtokollieren.mockClear()
    const ergebnis = anwenden(start, { channel: 'autodarts.boards', topic: 'board-1.matches', data: { id: 'match-2' } })

    expect(ergebnis).toBe(start)
    expect(mockProtokollieren).not.toHaveBeenCalled()
  })

  it('behaelt den letzten Zustand bei einem wirklich unbekannten Ereignis und warnt genau einmal', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    mockProtokollieren.mockClear()

    const ergebnis1 = anwenden(start, { irgendwas: 'unbekannt' })
    const ergebnis2 = anwenden(start, { anderesUnbekanntes: true })

    expect(ergebnis1).toBe(start)
    expect(ergebnis2).toBe(start)
    expect(mockProtokollieren).toHaveBeenCalledTimes(1)
  })
})

describe('anwenden: Rest nie negativ', () => {
  it('kappt einen (fehlerhaften) negativen gameScores-Wert bei 0', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const ergebnis = anwenden(start, stateEreignis('match-1', { gameScores: { '0': -5, '1': 501 } }))

    expect(ergebnis.scores[0]!.remaining).toBe(0)
  })
})

describe('anwenden: Bust setzt zurueck', () => {
  it('setzt bust und behaelt den vom Server unveraendert gemeldeten Rest', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1', { gameScores: { '0': 501, '1': 501 } }))
    const ergebnis = anwenden(
      start,
      stateEreignis('match-1', { player: 0, turnBusted: true, turnScore: 45, gameScores: { '0': 501, '1': 501 } }),
    )

    expect(ergebnis.bust).toBe(true)
    expect(ergebnis.scores[0]!.remaining).toBe(501)
    expect(ergebnis.checkout).toBeNull()
  })
})

describe('anwenden: Legs zaehlen nur aufwaerts', () => {
  it('erhoeht Legs des Leg-Gewinners genau einmal je Leg-Ende-Uebergang', () => {
    let zustand = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    expect(zustand.scores[0]!.legs).toBe(0)

    // Spieler 0 gewinnt Leg 1.
    zustand = anwenden(zustand, stateEreignis('match-1', { gameFinished: true, gameWinner: 0, player: 0, turnScore: 40 }))
    expect(zustand.scores[0]!.legs).toBe(1)
    expect(zustand.scores[1]!.legs).toBe(0)

    // Leg-Pause haelt an (mehrere Momentaufnahmen mit gameFinished weiterhin
    // true) - darf NICHT erneut erhoehen.
    zustand = anwenden(zustand, stateEreignis('match-1', { gameFinished: true, gameWinner: 0, player: 0, turnScore: 40 }))
    expect(zustand.scores[0]!.legs).toBe(1)

    // Naechstes Leg beginnt.
    zustand = anwenden(zustand, stateEreignis('match-1', { gameFinished: false, gameScores: { '0': 501, '1': 501 }, player: 1 }))
    expect(zustand.scores[0]!.legs).toBe(1)

    // Spieler 1 gewinnt Leg 2.
    zustand = anwenden(zustand, stateEreignis('match-1', { gameFinished: true, gameWinner: 1, player: 1, turnScore: 32 }))
    expect(zustand.scores[0]!.legs).toBe(1)
    expect(zustand.scores[1]!.legs).toBe(1)
  })

  it('setzt Legs bei einem neuen Match auf 0 zurueck', () => {
    let zustand = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    zustand = anwenden(zustand, stateEreignis('match-1', { gameFinished: true, gameWinner: 0, player: 0, turnScore: 40 }))
    expect(zustand.scores[0]!.legs).toBe(1)

    const neuesMatch = anwenden(zustand, stateEreignis('match-2'))
    expect(neuesMatch.scores[0]!.legs).toBe(0)
  })
})

describe('anwenden: Sequenznummern steigen', () => {
  it('erhoeht lastEvent.seq bei jedem .state-Ereignis um genau 1', () => {
    let zustand = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    expect(zustand.lastEvent?.seq).toBe(1)

    for (let i = 2; i <= 5; i++) {
      zustand = anwenden(zustand, stateEreignis('match-1', { player: i % 2, turnScore: i }))
      expect(zustand.lastEvent?.seq).toBe(i)
    }
  })

  it('erhoeht seq NICHT bei einem durchgereichten, ignorierten Thema', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const seqVorher = start.lastEvent?.seq
    const ergebnis = anwenden(start, { channel: 'autodarts.matches', topic: 'match-1.game-events', data: {} })
    expect(ergebnis.lastEvent?.seq).toBe(seqVorher)
  })
})

describe('anwenden: checkout und checkoutHint schliessen sich aus', () => {
  it.each([2, 32, 40, 100, 169 /* Bogey */, 171 /* ueber 170 */, 501])('bei Rest %d ist nie beides gesetzt', (rest) => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const ergebnis = anwenden(start, stateEreignis('match-1', { gameScores: { '0': rest, '1': 501 } }))

    expect(ergebnis.checkout === null || ergebnis.checkoutHint === null).toBe(true)
    expect(ergebnis.checkout !== null && ergebnis.checkoutHint !== null).toBe(false)
  })

  it('laesst bei variant "other" (kein X01) beide Felder leer', () => {
    const ergebnis = anwenden(RUHEZUSTAND, stateEreignis('match-1', { variant: 'Cricket', gameScores: { '0': 40, '1': 501 } }))

    expect(ergebnis.variant).toBe('other')
    expect(ergebnis.checkout).toBeNull()
    expect(ergebnis.checkoutHint).toBeNull()
  })
})

describe('anwenden: veraendert den uebergebenen Zustand nicht', () => {
  it('laesst das Eingabeobjekt (tief) unveraendert', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const kopieVorher = JSON.parse(JSON.stringify(start)) as MatchState

    const ergebnis = anwenden(start, stateEreignis('match-1', { player: 1, gameScores: { '0': 501, '1': 460 } }))

    expect(start).toEqual(kopieVorher)
    expect(ergebnis).not.toBe(start)
  })

  it('RUHEZUSTAND selbst bleibt unveraendert nach anwenden()', () => {
    const kopieVorher = JSON.parse(JSON.stringify(RUHEZUSTAND)) as MatchState
    anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    expect(RUHEZUSTAND).toEqual(kopieVorher)
  })
})

describe('anwenden: abgeleitete Ereignisse (kein Feld im Rohereignis, nur Vergleich mit dem Vorzustand)', () => {
  it('oneEighty bei genau 180 Punkten ohne Bust', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const ergebnis = anwenden(start, stateEreignis('match-1', { player: 0, turnScore: 180, gameScores: { '0': 321, '1': 501 } }))

    expect(ergebnis.lastEvent).toMatchObject({ kind: 'oneEighty', playerId: ergebnis.players[0]!.id })
  })

  it('playerChange, wenn der aktive Spieler wechselt', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1', { player: 0 }))
    const ergebnis = anwenden(start, stateEreignis('match-1', { player: 1 }))

    expect(ergebnis.lastEvent).toMatchObject({ kind: 'playerChange', toPlayerId: ergebnis.players[1]!.id })
  })

  it('legWon bei einem Finish unter 100', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1', { player: 0, gameScores: { '0': 40, '1': 501 } }))
    const ergebnis = anwenden(
      start,
      stateEreignis('match-1', { player: 0, gameFinished: true, gameWinner: 0, turnScore: 40, gameScores: { '0': 0, '1': 501 } }),
    )

    expect(ergebnis.lastEvent).toMatchObject({ kind: 'legWon', playerId: ergebnis.players[0]!.id })
  })

  it('highFinish statt legWon bei einem Finish ab 100', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1', { player: 0, gameScores: { '0': 121, '1': 501 } }))
    const ergebnis = anwenden(
      start,
      stateEreignis('match-1', { player: 0, gameFinished: true, gameWinner: 0, turnScore: 121, gameScores: { '0': 0, '1': 501 } }),
    )

    expect(ergebnis.lastEvent).toMatchObject({ kind: 'highFinish', playerId: ergebnis.players[0]!.id, score: 121 })
  })

  it('matchWon, wenn das Match beendet ist', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1', { player: 0, gameScores: { '0': 40, '1': 501 } }))
    const ergebnis = anwenden(
      start,
      stateEreignis('match-1', {
        player: 0,
        finished: true,
        gameFinished: true,
        gameWinner: 0,
        winner: 0,
        turnScore: 40,
        gameScores: { '0': 0, '1': 501 },
      }),
    )

    expect(ergebnis.phase).toBe('finished')
    expect(ergebnis.lastEvent).toMatchObject({ kind: 'matchWon', playerId: ergebnis.players[0]!.id })
  })
})

// ---------------------------------------------------------------------
// Match-Ende ueber den Board-Kanal und selbst gefuehrte Statistik
// ---------------------------------------------------------------------

describe('anwenden: Match-Ende ueber den Board-Kanal', () => {
  it('geht in den Ruhezustand, wenn das Board ein Ende meldet', () => {
    // Gemeldeter Fall: auf der Scheibe "Exit" geklickt. Der Zustandskanal
    // verstummt dann einfach - ohne dieses Ereignis bliebe der Endstand bis
    // zum naechsten Match stehen.
    const laufend = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const ergebnis = anwenden(laufend, {
      channel: 'autodarts.boards',
      topic: 'board-1.matches',
      data: { event: 'finish', id: 'match-1' },
    })

    expect(ergebnis).toBe(RUHEZUSTAND)
  })

  it('wertet einen unbekannten Ereignisnamen als Ende', () => {
    // Sichere Richtung: lieber die Spielpause zeigen als einen Endstand
    // endlos stehen lassen. Ein weiterlaufendes Match baut sich mit der
    // naechsten Momentaufnahme sofort wieder auf.
    const laufend = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    expect(anwenden(laufend, { channel: 'autodarts.boards', topic: 'b.matches', data: { event: 'irgendwas' } })).toBe(
      RUHEZUSTAND,
    )
  })

  it('laesst den Zustand bei einem Beginn unangetastet', () => {
    const laufend = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    expect(anwenden(laufend, { channel: 'autodarts.boards', topic: 'b.matches', data: { event: 'start', id: 'm' } })).toBe(
      laufend,
    )
  })

  it('ignoriert ein Ende, das einem ANDEREN Match gilt', () => {
    // Aus dem Protokoll vom 10.09.2026: waehrend Match 01a08cfc lief, kam
    // ein "delete" fuer das 24 Minuten alte Match 01a08ce8. Ohne diese
    // Pruefung schaltete das die Anzeige des laufenden Matches ab.
    const laufend = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    expect(
      anwenden(laufend, {
        channel: 'autodarts.boards',
        topic: 'b.matches',
        data: { event: 'delete', id: 'match-alt' },
      }),
    ).toBe(laufend)
  })

  it('laesst den Zustand unangetastet, wenn das Ereignis gar kein event-Feld hat', () => {
    const laufend = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    expect(anwenden(laufend, { channel: 'autodarts.boards', topic: 'b.matches', data: { id: 'match-2' } })).toBe(laufend)
  })
})

describe('anwenden: selbst gefuehrte Statistik', () => {
  // Grund: stats[i] war im Protokoll eines echten Matches ein LEERES Objekt,
  // alle Werte standen deshalb dauerhaft auf 0.
  //
  // Eine Aufnahme gilt als fertig, wenn der naechste Spieler an der Reihe ist
  // (oder das Leg endet) - NICHT daran, wie viele Darts in turns[] stehen.
  // Diese Liste liess sich in echten Matches nicht lesen; solange die
  // Zaehlung daran hing, blieb die ganze Statistik auf 0 stehen
  // ("ich hatte 2 180er und er hat 0 gezeigt").
  const dreiDarts = { '0': [{ name: 'T20' }, { name: 'T20' }, { name: 'T20' }], '1': [] }

  it('rechnet den Average aus Punkten und Darts, wenn der Server keinen liefert', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const wurf = anwenden(
      start,
      stateEreignis('match-1', { player: 0, turnScore: 180, turns: dreiDarts, gameScores: { '0': 321, '1': 501 } }),
    )
    // Erst der Wechsel auf Spieler 2 schliesst die Aufnahme ab.
    const nachWechsel = anwenden(wurf, stateEreignis('match-1', { player: 1, turnScore: 0, gameScores: { '0': 321, '1': 501 } }))

    expect(nachWechsel.scores[0]!.dartsGesamt).toBe(3)
    expect(nachWechsel.scores[0]!.punkteGesamt).toBe(180)
    expect(nachWechsel.scores[0]!.average3).toBe(180)
  })

  it('zaehlt einen 180er mit', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const wurf = anwenden(
      start,
      stateEreignis('match-1', { player: 0, turnScore: 180, turns: dreiDarts, gameScores: { '0': 321, '1': 501 } }),
    )
    const nachWechsel = anwenden(wurf, stateEreignis('match-1', { player: 1, turnScore: 0, gameScores: { '0': 321, '1': 501 } }))

    expect(nachWechsel.scores[0]!.count180).toBe(1)
  })

  it('zaehlt eine Aufnahme genau einmal, auch wenn dieselbe Momentaufnahme mehrfach ankommt', () => {
    // Nach einer Wiederverbindung schickt der Server den Zustand erneut.
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const wurf = anwenden(start, stateEreignis('match-1', { player: 0, turnScore: 180, turns: dreiDarts }))
    const wechsel = stateEreignis('match-1', { player: 1, turnScore: 0 })
    const einmal = anwenden(wurf, wechsel)
    const zweimal = anwenden(einmal, wechsel)

    expect(zweimal.scores[0]!.count180).toBe(1)
    expect(zweimal.scores[0]!.dartsGesamt).toBe(3)
  })

  it('zaehlt eine Bust-Aufnahme mit Darts, aber ohne Punkte', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const bust = anwenden(start, stateEreignis('match-1', { player: 0, turnScore: 60, turnBusted: true, turns: dreiDarts }))
    const nachWechsel = anwenden(bust, stateEreignis('match-1', { player: 1, turnScore: 0 }))

    expect(nachWechsel.scores[0]!.dartsGesamt).toBe(3)
    expect(nachWechsel.scores[0]!.punkteGesamt).toBe(0)
  })

  it('rechnet mit drei Darts, wenn sich die Wurfliste nicht lesen liess', () => {
    // Der Normalfall in echten Matches: turns[] ist unlesbar, turnScore aber
    // bekannt. Ohne diese Annahme bliebe der Average leer.
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const wurf = anwenden(start, stateEreignis('match-1', { player: 0, turnScore: 60, turns: {} }))
    const nachWechsel = anwenden(wurf, stateEreignis('match-1', { player: 1, turnScore: 0, turns: {} }))

    expect(nachWechsel.scores[0]!.dartsGesamt).toBe(3)
    expect(nachWechsel.scores[0]!.punkteGesamt).toBe(60)
  })

  it('schreibt die abgeschlossene Aufnahme in den Leg-Verlauf', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const wurf = anwenden(
      start,
      stateEreignis('match-1', { player: 0, turnScore: 180, turns: dreiDarts, gameScores: { '0': 321, '1': 501 } }),
    )
    const nachWechsel = anwenden(wurf, stateEreignis('match-1', { player: 1, turnScore: 0, gameScores: { '0': 321, '1': 501 } }))

    expect(nachWechsel.legHistory).toHaveLength(1)
    expect(nachWechsel.legHistory[0]!.scored).toBe(180)
    expect(nachWechsel.legHistory[0]!.remainingAfter).toBe(321)
  })

  it('zaehlt Finishversuch und Treffer, wenn ein Leg ausgemacht wird', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const beiRest40 = anwenden(
      start,
      stateEreignis('match-1', { player: 0, turnScore: 461, turns: dreiDarts, gameScores: { '0': 40, '1': 501 } }),
    )
    const nachWechsel = anwenden(beiRest40, stateEreignis('match-1', { player: 1, turnScore: 0, gameScores: { '0': 40, '1': 501 } }))
    const zurueck = anwenden(nachWechsel, stateEreignis('match-1', { player: 0, turnScore: 0, gameScores: { '0': 40, '1': 501 } }))
    const ausgemacht = anwenden(
      zurueck,
      stateEreignis('match-1', {
        player: 0,
        turnScore: 40,
        turns: { '0': [{ name: 'D20' }], '1': [] },
        gameScores: { '0': 0, '1': 501 },
        gameFinished: true,
        gameWinner: 0,
      }),
    )

    expect(ausgemacht.scores[0]!.checkoutAttempts).toBe(1)
    expect(ausgemacht.scores[0]!.checkoutHits).toBe(1)
    expect(ausgemacht.scores[0]!.highestFinish).toBe(40)
  })
})

describe('anwenden: Statistik vom Server', () => {
  // Belegt im Quelltext des Autodarts-Web-Clients: stats[i] traegt legStats
  // und matchStats. Bis 0.1.0-beta.9 wurde eine Ebene zu flach gesucht,
  // deshalb hinkte die eigene Rechnung der Anzeige eine Aufnahme hinterher.
  const mitStats = {
    '0': { legStats: { average: 82.5, dartsThrown: 6 }, matchStats: { average: 79.1, dartsThrown: 12, total180: 2 } },
    '1': { legStats: {}, matchStats: {} },
  }

  it('nimmt Average und Darts aus matchStats, nicht die eigene Rechnung', () => {
    const ergebnis = anwenden(RUHEZUSTAND, stateEreignis('match-1', { stats: mitStats }))

    expect(ergebnis.scores[0]!.average3).toBe(79.1)
    expect(ergebnis.scores[0]!.dartsGesamt).toBe(12)
    expect(ergebnis.scores[0]!.count180).toBe(2)
  })

  it('nimmt Leg-Average und Leg-Darts aus legStats', () => {
    const ergebnis = anwenden(RUHEZUSTAND, stateEreignis('match-1', { stats: mitStats }))

    expect(ergebnis.scores[0]!.legAverage).toBe(82.5)
    expect(ergebnis.scores[0]!.legDarts).toBe(6)
  })

  it('faellt auf die eigene Rechnung zurueck, wenn der Server nichts liefert', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const wurf = anwenden(start, stateEreignis('match-1', { player: 0, turnScore: 180 }))
    const nachWechsel = anwenden(wurf, stateEreignis('match-1', { player: 1, turnScore: 0 }))

    expect(nachWechsel.scores[0]!.average3).toBe(180)
    expect(nachWechsel.scores[0]!.legAverage).toBeNull()
  })
})

describe('anwenden: Anfangsermittlung', () => {
  it('erkennt die Variante "Bull-off" als eigene Phase', () => {
    const ergebnis = anwenden(RUHEZUSTAND, stateEreignis('match-1', { variant: 'Bull-off' }))

    expect(ergebnis.phase).toBe('bullOff')
    expect(ergebnis.variantName).toBe('Bull-off')
  })

  it('uebernimmt den Abstand zum Bull je Spieler', () => {
    const ergebnis = anwenden(
      RUHEZUSTAND,
      stateEreignis('match-1', {
        variant: 'Bull-off',
        stats: {
          '0': { legStats: { bullDistance: 12.4, coords: { x: 0.01, y: 0.02 }, segment: { number: 25, bed: 'Double' } } },
          '1': { legStats: { bullDistance: 41.9 } },
        },
      }),
    )

    expect(ergebnis.scores[0]!.bullAbstand).toBe(12.4)
    expect(ergebnis.scores[1]!.bullAbstand).toBe(41.9)
    expect(ergebnis.scores[0]!.bullWurf?.koordinaten).toEqual({ x: 0.01, y: 0.02 })
  })

  it('ist nach dem Ende der Ermittlung keine Bull-off-Phase mehr', () => {
    const ergebnis = anwenden(RUHEZUSTAND, stateEreignis('match-1', { variant: 'X01' }))
    expect(ergebnis.phase).not.toBe('bullOff')
  })
})

describe('dartsAusZug: fertige Aufnahme bleibt stehen', () => {
  it('nimmt den vorletzten Zug, wenn der letzte noch leer ist', () => {
    // Sobald eine Aufnahme fertig ist, haengt Autodarts den naechsten, noch
    // leeren Zug an. Ohne diesen Rueckgriff waere die Scheibe schlagartig
    // leer, obwohl die drei Darts noch stecken - gemeldet als "es wird nur
    // ein Pfeil angezeigt".
    const turns = [
      { throws: [{ segment: { number: 16, bed: 'SingleInner' } }, { segment: { number: 19, bed: 'Double' } }] },
      { throws: [] },
    ]
    expect(dartsAusZug(turns, 'k')).toHaveLength(2)
  })

  it('nimmt den letzten Zug, sobald dort etwas steht', () => {
    const turns = [
      { throws: [{ segment: { number: 16, bed: 'SingleInner' } }] },
      { throws: [{ segment: { number: 20, bed: 'Triple' } }] },
    ]
    expect(dartsAusZug(turns, 'k')).toEqual([{ name: 'T20', value: 20, multiplier: 3 }])
  })

  it('liefert [] wenn beide leer sind', () => {
    expect(dartsAusZug([{ throws: [] }, { throws: [] }], 'k')).toEqual([])
  })
})

describe('anwenden: Miss-Ereignis', () => {
  /** Eine Momentaufnahme mit genau diesen Feldern im laufenden Zug. */
  const mitWuerfen = (felder: { number: number; bed: string }[]) =>
    stateEreignis('match-1', {
      turns: [{ throws: felder.map((segment) => ({ segment })) }],
      turnScore: 0,
    })

  it('meldet einen Dart ausserhalb der Scheibe', () => {
    const laufend = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const danach = anwenden(laufend, mitWuerfen([{ number: 0, bed: 'Outside' }]))
    expect(danach.lastEvent?.kind).toBe('miss')
  })

  it('meldet denselben Dart nicht zweimal', () => {
    // Autodarts schickt zu einem Wurf mehrere Momentaufnahmen kurz
    // hintereinander - ohne den Vergleich der Wurfliste liefe die
    // Einblendung mehrfach fuer denselben Dart.
    const laufend = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const einmal = anwenden(laufend, mitWuerfen([{ number: 0, bed: 'Outside' }]))
    const nochmal = anwenden(einmal, mitWuerfen([{ number: 0, bed: 'Outside' }]))
    expect(nochmal.lastEvent?.kind).not.toBe('miss')
  })

  it('meldet nichts, solange der letzte Dart getroffen hat', () => {
    const laufend = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const danach = anwenden(laufend, mitWuerfen([{ number: 20, bed: 'Triple' }]))
    expect(danach.lastEvent?.kind).not.toBe('miss')
  })

  it('meldet auch den ERSTEN Dart einer neuen Aufnahme, obwohl die Liste dabei kuerzer wird', () => {
    // 3 Darts -> 1 Dart: ueber die Laenge allein waere das kein neuer Wurf.
    const laufend = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const volleAufnahme = anwenden(
      laufend,
      mitWuerfen([
        { number: 20, bed: 'Triple' },
        { number: 20, bed: 'Triple' },
        { number: 20, bed: 'Triple' },
      ]),
    )
    const neueAufnahme = anwenden(volleAufnahme, mitWuerfen([{ number: 0, bed: 'Outside' }]))
    expect(neueAufnahme.lastEvent?.kind).toBe('miss')
  })
})

describe('anwenden: wer gewonnen hat', () => {
  it('nennt den Spieler mit Rest 0, wenn Autodarts noch keinen Sieger meldet', () => {
    // Gemeldet: "ich habe das match gewonnen aber da im screen stand bot1 hat
    // das match gewonnen". winner stand noch auf -1, und der aktive Spieler
    // war nach dem entscheidenden Wurf schon der naechste.
    const laufend = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const ende = anwenden(
      laufend,
      stateEreignis('match-1', {
        finished: true,
        winner: -1,
        gameFinished: true,
        gameWinner: -1,
        player: 1,
        gameScores: { '0': 0, '1': 130 },
      }),
    )
    expect(ende.lastEvent?.kind).toBe('matchWon')
    expect(ende.lastEvent).toMatchObject({ playerId: ende.players[0]!.id })
  })

  it('nimmt den gemeldeten Index, wenn er auf einen Spieler zeigt', () => {
    const laufend = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const ende = anwenden(
      laufend,
      stateEreignis('match-1', { finished: true, winner: 1, player: 0, gameScores: { '0': 40, '1': 0 } }),
    )
    expect(ende.lastEvent).toMatchObject({ playerId: ende.players[1]!.id })
  })

  it('faellt auf den aktiven Spieler zurueck, wenn niemand ausgespielt hat', () => {
    // Abbruch: kein Index, keine Null im Rest - dann bleibt nur der aktive
    // Spieler, und das ist ehrlicher als zu raten.
    const laufend = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const ende = anwenden(
      laufend,
      stateEreignis('match-1', { finished: true, winner: -1, player: 1, gameScores: { '0': 40, '1': 130 } }),
    )
    expect(ende.lastEvent).toMatchObject({ playerId: ende.players[1]!.id })
  })

  it('laesst die gewonnenen Legs entscheiden, nicht den gemeldeten Index', () => {
    // Abend des 2026-09-11: der Zuschauer-Screen nannte sechsmal den
    // Verlierer ("frank spielt gegen michael frank gewinnt aber im
    // zuscherscreen steht michael hat gewonnen"), waehrend die
    // Matchtag-Wertung aus denselben Momentaufnahmen jedes Mal richtig lag -
    // die rechnet aus den Legs.
    const laufend = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const ende = anwenden(
      laufend,
      stateEreignis('match-1', {
        finished: true,
        winner: 0,
        player: 0,
        scores: { '0': { legs: 1 }, '1': { legs: 3 } },
        gameScores: { '0': 40, '1': 120 },
      }),
    )
    expect(ende.lastEvent).toMatchObject({ kind: 'matchWon', playerId: ende.players[1]!.id })
  })

  it('schreibt eine Abweichung zwischen Index und Daten einmalig ins Protokoll', () => {
    const laufend = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    anwenden(
      laufend,
      stateEreignis('match-1', {
        finished: true,
        winner: 0,
        player: 0,
        scores: { '0': { legs: 1 }, '1': { legs: 3 } },
      }),
    )
    const zeilen = mockProtokollieren.mock.calls.map((c) => String(c[0]))
    expect(zeilen.filter((z) => z.includes('Gewinner match'))).toHaveLength(1)
  })

  it('nennt beim Leg den Spieler mit Rest 0, auch wenn gameWinner daneben liegt', () => {
    const laufend = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const ende = anwenden(
      laufend,
      stateEreignis('match-1', {
        gameFinished: true,
        gameWinner: 0,
        player: 0,
        gameScores: { '0': 88, '1': 0 },
      }),
    )
    expect(ende.lastEvent).toMatchObject({ kind: 'legWon', playerId: ende.players[1]!.id })
  })
})

describe('anwenden: Start der Runde', () => {
  const brett = (event: string, id: string) => ({
    channel: 'autodarts.boards',
    topic: 'b.matches',
    data: { event, id },
  })

  it('verlaesst die Spielpause schon bei der Startmeldung des Bretts', () => {
    // Bei einer Anfangsermittlung kommt die erste Zustandsmeldung erst mit
    // dem ersten Dart ("ich muss den ersten immer schmeissen damit es los
    // geht") - bis dahin stand die Werbeschleife, obwohl die Runde lief.
    const nachStart = anwenden(RUHEZUSTAND, brett('start', 'match-9'))
    expect(nachStart.phase).toBe('starting')
    expect(nachStart.matchId).toBe('match-9')
  })

  it('wirft ein laufendes Match nicht weg, wenn noch eine Startmeldung kommt', () => {
    const laufend = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    expect(anwenden(laufend, brett('start', 'match-1'))).toBe(laufend)
  })

  it('schaltet um, wenn waehrend des stehenden Endstands die naechste Runde beginnt', () => {
    // Der Endstand bleibt nach dem Match eine halbe Minute stehen
    // (ENDSTAND_STEHEN_LASSEN_MS). Wer in dieser Zeit die naechste Runde
    // einrichtet, sah bis dahin bis zum ersten Dart den alten Endstand.
    const laufend = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const beendet = anwenden(laufend, stateEreignis('match-1', { finished: true, winner: 0 }))
    expect(beendet.phase).toBe('finished')
    const naechste = anwenden(beendet, brett('start', 'match-2'))
    expect(naechste.phase).toBe('starting')
    expect(naechste.matchId).toBe('match-2')
  })

  it('wird von der ersten Zustandsmeldung abgeloest', () => {
    const gestartet = anwenden(RUHEZUSTAND, brett('start', 'match-1'))
    const mitZustand = anwenden(gestartet, stateEreignis('match-1'))
    expect(mitZustand.phase).not.toBe('starting')
    expect(mitZustand.players.length).toBe(2)
  })

  it('geht bei einem Ende aus dem Startzustand zurueck in die Spielpause', () => {
    const gestartet = anwenden(RUHEZUSTAND, brett('start', 'match-1'))
    expect(anwenden(gestartet, brett('delete', 'match-1'))).toBe(RUHEZUSTAND)
  })
})
