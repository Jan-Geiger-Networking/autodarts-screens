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

describe('dartPosition mit gemessenem Auftreffpunkt', () => {
  it('nimmt den gemessenen Punkt, statt die Feldmitte zu schaetzen', () => {
    // Beispiel aus einem echten Autodarts-Bild: der Client zeichnet dafuer
    // einen Kreis bei cx=14.36, cy=-357.73 in einem SVG, dessen Doppelring
    // aussen bei 377,778 endet.
    const gemessen = { x: 14.36 / 377.778, y: 357.73 / 377.778 }
    const { x, y } = dartPosition({ name: '20', value: 20, multiplier: 1, koordinaten: gemessen }, 0)

    // Oberhalb der Mitte (SVG-y negativ), knapp innerhalb des Doppelrings.
    expect(y).toBeLessThan(0)
    const abstand = Math.hypot(x, y)
    expect(abstand).toBeGreaterThan(RADIUS.tripleAussen)
    expect(abstand).toBeLessThan(RADIUS.doppelInnen + 1)
  })

  it('streut gemessene Punkte NICHT - sie sind schon verschieden', () => {
    const seg = (x: number): Segment => ({ name: '20', value: 20, multiplier: 1, koordinaten: { x, y: 0.5 } })
    expect(dartPosition(seg(0.1), 0)).not.toEqual(dartPosition(seg(0.2), 1))
    // Derselbe Punkt bleibt derselbe, egal als wievielter Dart.
    expect(dartPosition(seg(0.1), 0)).toEqual(dartPosition(seg(0.1), 2))
  })

  it('spiegelt die y-Achse, weil Autodarts y nach oben zaehlt', () => {
    const oben = dartPosition({ name: '20', value: 20, multiplier: 1, koordinaten: { x: 0, y: 0.5 } }, 0)
    expect(oben.y).toBeLessThan(0)
  })
})

describe('dartPosition gegen echte Autodarts-Daten', () => {
  // Drei Wuerfe aus einem echten Match des Herausgebers (S16, D19, T15,
  // zusammen 99), samt der Kreise, die der Autodarts-Client dafuer zeichnet.
  // Umgerechnet muessen sie in genau diesen Feldern liegen - sonst stimmt der
  // Umrechnungsfaktor nicht.
  //
  // Der Nenner ist 377,778 - die Aussenkante des Doppelrings in jenem SVG -,
  // nicht 500. Mit 500 war die Kette SVG -> Koordinate -> Prozent zwar in
  // sich stimmig, die Zwischenwerte aber keine echten Autodarts-Koordinaten;
  // genau daran haing der falsche Faktor bis 0.1.0-beta.11.
  const ausSvg = (cx: number, cy: number) => ({ x: cx / 377.778, y: -cy / 377.778 })
  const seg = (koordinaten: { x: number; y: number }): Segment => ({
    name: '?',
    value: 0,
    multiplier: 1,
    koordinaten,
  })

  it('legt einen einfachen 16er ins innere Feld', () => {
    const { x, y } = dartPosition(seg(ausSvg(-131.723, 96.517)), 0)
    const abstand = Math.hypot(x, y)
    expect(abstand).toBeGreaterThan(RADIUS.bullAussen)
    expect(abstand).toBeLessThan(RADIUS.tripleInnen)
    expect(sektorFuer(x, y)).toBe(16)
  })

  it('legt ein Doppel 19 in den Doppelring', () => {
    const { x, y } = dartPosition(seg(ausSvg(-122.559, 346.235)), 1)
    const abstand = Math.hypot(x, y)
    expect(abstand).toBeGreaterThan(RADIUS.doppelInnen)
    expect(abstand).toBeLessThan(RADIUS.doppelAussen)
    expect(sektorFuer(x, y)).toBe(19)
  })

  it('legt ein Triple 15 in den Triple-Ring', () => {
    const { x, y } = dartPosition(seg(ausSvg(180.239, 130.718)), 2)
    const abstand = Math.hypot(x, y)
    expect(abstand).toBeGreaterThan(RADIUS.tripleInnen)
    expect(abstand).toBeLessThan(RADIUS.tripleAussen)
    expect(sektorFuer(x, y)).toBe(15)
  })
})

describe('dartPosition gegen echte Wuerfe mit gemeldetem Ring', () => {
  // Sechs Wuerfe aus Matches des Herausgebers vom 10.09.2026, wie sie im
  // Diagnoseprotokoll stehen: die rohen Koordinaten und der Ring, den der
  // Autodarts-Server selbst dazu gemeldet hat. Das ist die schaerfste
  // Probe, die es fuer den Umrechnungsfaktor gibt - hier muss jeder Wurf im
  // gemeldeten Ring landen.
  const wuerfe: ReadonlyArray<{ x: number; y: number; bed: string }> = [
    { x: -0.3486788143452377, y: -0.255486110484749, bed: 'SingleInner' },
    { x: -0.3381085775463524, y: -0.23403763608096725, bed: 'SingleInner' },
    { x: -0.42769201636022736, y: -0.1354953647050236, bed: 'SingleInner' },
    { x: -0.3911295643460648, y: -0.18271337802105184, bed: 'SingleInner' },
    { x: -0.628859278518037, y: -0.06215469613259669, bed: 'SingleOuter' },
    { x: -0.27201806565248465, y: -0.04460517950247038, bed: 'SingleInner' },
  ]

  /** Der Ring, in dem ein Abstand liegt - benannt wie bei Autodarts. */
  const ringFuer = (abstand: number): string => {
    if (abstand < RADIUS.bull) return 'Bull'
    if (abstand < RADIUS.bullAussen) return '25'
    if (abstand < RADIUS.tripleInnen) return 'SingleInner'
    if (abstand < RADIUS.tripleAussen) return 'Triple'
    if (abstand < RADIUS.doppelInnen) return 'SingleOuter'
    if (abstand <= RADIUS.doppelAussen) return 'Double'
    return 'Outside'
  }

  for (const [nummer, wurf] of wuerfe.entries()) {
    it(`legt Wurf ${nummer + 1} in den gemeldeten Ring ${wurf.bed}`, () => {
      const { x, y } = dartPosition({ name: '?', value: 0, multiplier: 1, koordinaten: wurf }, 0)
      expect(ringFuer(Math.hypot(x, y))).toBe(wurf.bed)
    })
  }
})

/** Sektorzahl an einer Position - Umkehrung von sektorWinkel(). */
function sektorFuer(x: number, y: number): number {
  const grad = (Math.atan2(y, x) * 180) / Math.PI
  const index = Math.round((((grad + 90) % 360) + 360) % 360 / 18) % 20
  return SEKTOREN[index]!
}
