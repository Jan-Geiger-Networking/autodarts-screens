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
  dartsAusTurns,
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

describe('dartsAusTurns', () => {
  it('liefert [] fuer eine leere oder fehlende Liste', () => {
    expect(dartsAusTurns(undefined, 'k')).toEqual([])
    expect(dartsAusTurns([], 'k')).toEqual([])
  })

  it('liest eine flache Liste von Darts des aktuellen Zugs', () => {
    expect(dartsAusTurns([{ name: 'T20' }, { name: '5' }], 'k')).toEqual([
      { name: 'T20', value: 20, multiplier: 3 },
      { name: '5', value: 5, multiplier: 1 },
    ])
  })

  it('liest eine verschachtelte Liste (Zuege je Leg, letzter Zug aktuell)', () => {
    const turns = [[{ name: 'T20' }, { name: 'T20' }, { name: 'T20' }], [{ name: 'D10' }]]
    expect(dartsAusTurns(turns, 'k')).toEqual([{ name: 'D10', value: 10, multiplier: 2 }])
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

  it('laesst den Zustand unangetastet, wenn das Ereignis gar kein event-Feld hat', () => {
    const laufend = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    expect(anwenden(laufend, { channel: 'autodarts.boards', topic: 'b.matches', data: { id: 'match-2' } })).toBe(laufend)
  })
})

describe('anwenden: selbst gefuehrte Statistik', () => {
  // Grund: stats[i] war im Protokoll eines echten Matches ein LEERES Objekt,
  // alle Werte standen deshalb dauerhaft auf 0.
  const dreiDarts = { '0': [{ name: 'T20' }, { name: 'T20' }, { name: 'T20' }], '1': [] }

  it('rechnet den Average aus Punkten und Darts, wenn der Server keinen liefert', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const nachWurf = anwenden(
      start,
      stateEreignis('match-1', { player: 0, turnScore: 180, turns: dreiDarts, gameScores: { '0': 321, '1': 501 } }),
    )

    expect(nachWurf.scores[0]!.dartsGesamt).toBe(3)
    expect(nachWurf.scores[0]!.punkteGesamt).toBe(180)
    expect(nachWurf.scores[0]!.average3).toBe(180)
  })

  it('zaehlt einen 180er mit', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const nachWurf = anwenden(
      start,
      stateEreignis('match-1', { player: 0, turnScore: 180, turns: dreiDarts, gameScores: { '0': 321, '1': 501 } }),
    )

    expect(nachWurf.scores[0]!.count180).toBe(1)
  })

  it('zaehlt eine Bust-Aufnahme mit Darts, aber ohne Punkte', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const nachBust = anwenden(
      start,
      stateEreignis('match-1', { player: 0, turnScore: 60, turnBusted: true, turns: dreiDarts }),
    )

    expect(nachBust.scores[0]!.dartsGesamt).toBe(3)
    expect(nachBust.scores[0]!.punkteGesamt).toBe(0)
  })

  it('rechnet mit drei Darts, wenn sich die Wurfliste nicht lesen liess', () => {
    // Sonst bliebe der Average dauerhaft leer, obwohl turnScore bekannt ist.
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const nachWurf = anwenden(start, stateEreignis('match-1', { player: 0, turnScore: 60, turnBusted: true, turns: {} }))

    expect(nachWurf.scores[0]!.dartsGesamt).toBe(3)
  })

  it('zaehlt Finishversuch und Treffer, wenn ein Leg ausgemacht wird', () => {
    const start = anwenden(RUHEZUSTAND, stateEreignis('match-1'))
    const beiRest40 = anwenden(
      start,
      stateEreignis('match-1', { player: 0, turnScore: 461, turns: dreiDarts, gameScores: { '0': 40, '1': 501 } }),
    )
    const ausgemacht = anwenden(
      beiRest40,
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
