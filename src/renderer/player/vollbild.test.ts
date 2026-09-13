import { describe, expect, it } from 'vitest'
import type { MatchState, PlayerScore, Segment } from '../../shared/typen'
import { vollbildAus } from './vollbild'

const dart = (name: string, value: number): Segment => ({ name, value, multiplier: 1 })

const score = (playerId: string, remaining: number): PlayerScore => ({
  playerId,
  remaining,
  legs: 0,
  sets: 0,
  average3: null,
  checkoutAttempts: 0,
  checkoutHits: 0,
  count180: 0,
  highestFinish: null,
  legAverage: null,
  legDarts: null,
  bullAbstand: null,
  dartsGesamt: 0,
  punkteGesamt: 0,
  first9Average: null,
  plus60: 0,
  plus100: 0,
  plus140: 0,
  checkoutProzent: null,
})

function zustand(ueberschreibungen: Partial<MatchState> = {}): MatchState {
  return {
    phase: 'playing',
    matchId: 'm1',
    variant: 'x01',
    variantName: 'X01',
    startScore: 501,
    players: [
      { id: 'p1', autodartsName: 'jan', displayName: 'Jan' },
      { id: 'p2', autodartsName: 'markus', displayName: 'Markus' },
    ],
    scores: [score('p1', 301), score('p2', 301)],
    activePlayerId: 'p1',
    currentThrow: [],
    currentThrowTotal: 0,
    bust: false,
    checkout: null,
    checkoutHint: null,
    legHistory: [],
    lastEvent: null,
    ...ueberschreibungen,
  }
}

describe('vollbildAus', () => {
  it('zeigt nichts, solange die Aufnahme laeuft', () => {
    expect(vollbildAus(zustand())).toBeNull()
    expect(vollbildAus(zustand({ currentThrow: [dart('20', 20), dart('20', 20)], currentThrowTotal: 40 }))).toBeNull()
  })

  it('zeigt die Summe, sobald drei Pfeile stecken', () => {
    const z = zustand({ currentThrow: [dart('20', 20), dart('5', 5), dart('1', 1)], currentThrowTotal: 26 })
    expect(vollbildAus(z)).toEqual({ art: 'aufnahme', spielerId: 'p1', punkte: 26, bust: false })
  })

  it('zeigt Bust schon vor dem dritten Pfeil', () => {
    const z = zustand({ currentThrow: [dart('20', 20)], currentThrowTotal: 20, bust: true })
    expect(vollbildAus(z)).toEqual({ art: 'aufnahme', spielerId: 'p1', punkte: 0, bust: true })
  })

  it('zeigt den Leg-Sieger mit seinem Finish, auch wenn er nicht am Wurf steht', () => {
    const z = zustand({
      phase: 'legBreak',
      activePlayerId: 'p1',
      scores: [score('p1', 10), score('p2', 0)],
      currentThrow: [dart('D8', 16)],
      currentThrowTotal: 16,
    })
    expect(vollbildAus(z)).toEqual({ art: 'leg', spielerId: 'p2', finish: 16 })
  })

  it('zeigt den Match-Sieger', () => {
    const z = zustand({ phase: 'finished', scores: [score('p1', 0), score('p2', 40)], currentThrowTotal: 0 })
    expect(vollbildAus(z)).toEqual({ art: 'match', spielerId: 'p1', finish: null })
  })

  it('zeigt waehrend der Anfangsermittlung nichts', () => {
    const z = zustand({ phase: 'bullOff', currentThrow: [dart('25', 25), dart('1', 1), dart('1', 1)] })
    expect(vollbildAus(z)).toBeNull()
  })
})
