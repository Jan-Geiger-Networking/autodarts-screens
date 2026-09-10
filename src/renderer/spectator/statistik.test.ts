import { describe, expect, it } from 'vitest'
import { LEER, legStatistik } from './statistik'
import type { LegEntry, Segment } from '../../shared/typen'

const dart = (name: string, value: number, multiplier: 1 | 2 | 3): Segment => ({ name, value, multiplier })
const t20 = dart('T20', 20, 3)

function aufnahme(playerId: string, scored: number, bust = false, anzahlDarts = 3): LegEntry {
  return {
    playerId,
    darts: Array.from({ length: anzahlDarts }, () => t20),
    scored,
    remainingAfter: 501 - scored,
    bust,
  }
}

describe('legStatistik', () => {
  it('liefert leere Werte ohne Spieler oder ohne Verlauf', () => {
    expect(legStatistik([], 'p0')).toEqual(LEER)
    expect(legStatistik([aufnahme('p0', 60)], null)).toEqual(LEER)
  })

  it('zaehlt nur die Aufnahmen des gefragten Spielers', () => {
    const verlauf = [aufnahme('p0', 60), aufnahme('p1', 180), aufnahme('p0', 100)]
    const s = legStatistik(verlauf, 'p0')
    expect(s.aufnahmen).toBe(2)
    expect(s.darts).toBe(6)
    expect(s.schnitt).toBe(80)
    expect(s.beste).toBe(100)
  })

  it('zaehlt hohe Aufnahmen gestaffelt', () => {
    // 140 zaehlt in beiden Stufen - "ueber 100" schliesst "ueber 140" ein.
    const s = legStatistik([aufnahme('p0', 99), aufnahme('p0', 100), aufnahme('p0', 140), aufnahme('p0', 180)], 'p0')
    expect(s.ueber100).toBe(3)
    expect(s.ueber140).toBe(2)
  })

  it('rechnet einen Bust als Aufnahme mit null Punkten', () => {
    // Die Darts sind geworfen, die Punkte zaehlen nicht - genau so faellt der
    // Schnitt an einer echten Anzeigetafel auch aus.
    const s = legStatistik([aufnahme('p0', 180), aufnahme('p0', 0, true)], 'p0')
    expect(s.busts).toBe(1)
    expect(s.aufnahmen).toBe(2)
    expect(s.schnitt).toBe(90)
  })

  it('zaehlt auch eine Aufnahme mit weniger als drei Darts', () => {
    const s = legStatistik([aufnahme('p0', 40, false, 1)], 'p0')
    expect(s.darts).toBe(1)
    expect(s.aufnahmen).toBe(1)
  })
})
