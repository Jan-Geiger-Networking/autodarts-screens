import { describe, expect, it } from 'vitest'
import { spielerAufteilen } from './aufteilung'

const namen = (anzahl: number) => Array.from({ length: anzahl }, (_, i) => `p${i}`)

describe('spielerAufteilen', () => {
  it('setzt bei vier Spielern zwei in jede Ecke', () => {
    expect(spielerAufteilen(namen(4))).toEqual({ links: ['p0', 'p1'], rechts: ['p2', 'p3'] })
  })

  it('setzt ab sechs Spielern drei je Seite', () => {
    expect(spielerAufteilen(namen(6))).toEqual({
      links: ['p0', 'p1', 'p2'],
      rechts: ['p3', 'p4', 'p5'],
    })
  })

  it('setzt bei ungerader Anzahl einen mehr nach links', () => {
    expect(spielerAufteilen(namen(3))).toEqual({ links: ['p0', 'p1'], rechts: ['p2'] })
    expect(spielerAufteilen(namen(5))).toEqual({ links: ['p0', 'p1', 'p2'], rechts: ['p3', 'p4'] })
  })

  it('laesst die Mitte auch bei einem einzelnen Spieler frei', () => {
    // Die Scheibe steht in der Mitte, nie ein Spieler - auch dann nicht,
    // wenn nur einer da ist.
    expect(spielerAufteilen(namen(1))).toEqual({ links: ['p0'], rechts: [] })
    expect(spielerAufteilen([])).toEqual({ links: [], rechts: [] })
  })
})
