import { describe, expect, it } from 'vitest'
import { dartPosition, RADIUS, sektorWinkel, SEKTOREN } from './scheibengeometrie'
import type { Segment } from '../../shared/typen'

const seg = (name: string, value: number, multiplier: 1 | 2 | 3): Segment => ({ name, value, multiplier })

describe('sektorWinkel', () => {
  it('setzt die 20 nach oben', () => {
    expect(sektorWinkel(20)).toBe(-90)
  })

  it('setzt die 6 nach rechts, die 11 nach links und die 3 nach unten', () => {
    // Gegenprobe an einer echten Scheibe: der 20 gegenueber liegt die 3, die
    // 6 steht rechts, die 11 links. In SVG-Koordinaten zeigt +90 nach unten.
    expect(sektorWinkel(6)).toBe(0)
    expect(sektorWinkel(11)).toBe(180)
    expect(sektorWinkel(3)).toBe(90)
  })

  it('verteilt alle zwanzig Sektoren gleichmaessig', () => {
    const winkel = SEKTOREN.map(sektorWinkel)
    expect(new Set(winkel).size).toBe(20)
  })
})

describe('dartPosition', () => {
  it('legt die Triple 20 oberhalb der Mitte in den Triple-Ring', () => {
    const { x, y } = dartPosition(seg('T20', 20, 3), 1)
    expect(y).toBeLessThan(0)
    expect(Math.abs(x)).toBeLessThan(5)
    const abstand = Math.hypot(x, y)
    expect(abstand).toBeGreaterThan(RADIUS.tripleInnen - 5)
    expect(abstand).toBeLessThan(RADIUS.tripleAussen + 5)
  })

  it('legt ein Doppel in den aeusseren Ring', () => {
    const abstand = Math.hypot(...Object.values(dartPosition(seg('D3', 3, 2), 1)))
    expect(abstand).toBeGreaterThan(RADIUS.doppelInnen - 5)
    expect(abstand).toBeLessThanOrEqual(RADIUS.doppelAussen + 5)
  })

  it('legt das Bullseye in die Mitte', () => {
    const { x, y } = dartPosition(seg('BULL', 25, 2), 0)
    expect(Math.hypot(x, y)).toBeLessThan(RADIUS.bullAussen)
  })

  it('streut drei Darts desselben Feldes auseinander', () => {
    // Sonst laegen drei Treffer im selben Feld exakt uebereinander und man
    // saehe nur einen.
    const punkte = [0, 1, 2].map((i) => dartPosition(seg('T20', 20, 3), i))
    const paare = new Set(punkte.map((p) => `${p.x.toFixed(2)}|${p.y.toFixed(2)}`))
    expect(paare.size).toBe(3)
  })

  it('liefert fuer dieselbe Eingabe immer dieselbe Position', () => {
    expect(dartPosition(seg('T20', 20, 3), 2)).toEqual(dartPosition(seg('T20', 20, 3), 2))
  })
})
