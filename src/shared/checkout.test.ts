import { describe, expect, it } from 'vitest'
import { BOGEY_ZAHLEN, checkoutWeg, setupWurf } from './checkout'

const WERT: Record<string, number> = (() => {
  const w: Record<string, number> = { '25': 25, BULL: 50 }
  for (let n = 1; n <= 20; n++) {
    w[`${n}`] = n
    w[`D${n}`] = n * 2
    w[`T${n}`] = n * 3
  }
  return w
})()

const istDoppel = (name: string) => name === 'BULL' || name.startsWith('D')

describe('checkoutWeg', () => {
  it('liefert die gaengigen Wege', () => {
    expect(checkoutWeg(170)).toEqual(['T20', 'T20', 'BULL'])
    expect(checkoutWeg(167)).toEqual(['T20', 'T19', 'BULL'])
    expect(checkoutWeg(141)).toEqual(['T20', 'T19', 'D12'])
    expect(checkoutWeg(100)).toEqual(['T20', 'D20'])
    expect(checkoutWeg(81)).toEqual(['T19', 'D12'])
    expect(checkoutWeg(60)).toEqual(['20', 'D20'])
    expect(checkoutWeg(50)).toEqual(['BULL'])
    expect(checkoutWeg(40)).toEqual(['D20'])
    expect(checkoutWeg(32)).toEqual(['D16'])
    expect(checkoutWeg(2)).toEqual(['D1'])
  })

  it('jeder gelieferte Weg ist gueltig', () => {
    for (let rest = 2; rest <= 170; rest++) {
      const weg = checkoutWeg(rest)
      if (weg === null) continue
      expect(weg.length, `Rest ${rest}`).toBeLessThanOrEqual(3)
      expect(weg.reduce((s, d) => s + WERT[d]!, 0), `Rest ${rest}`).toBe(rest)
      expect(istDoppel(weg[weg.length - 1]!), `Rest ${rest}`).toBe(true)
    }
  })

  it('genau die Bogey-Zahlen haben keinen Weg', () => {
    const ohneWeg: number[] = []
    for (let rest = 2; rest <= 170; rest++) {
      if (checkoutWeg(rest) === null) ohneWeg.push(rest)
    }
    expect(ohneWeg).toEqual([159, 162, 163, 165, 166, 168, 169])
    expect([...BOGEY_ZAHLEN].sort((a, b) => a - b)).toEqual(ohneWeg)
  })

  it('liefert nichts fuer 1 und fuer mehr als 170', () => {
    expect(checkoutWeg(1)).toBeNull()
    expect(checkoutWeg(171)).toBeNull()
    expect(checkoutWeg(501)).toBeNull()
  })

  it('beruecksichtigt die Anzahl der verbleibenden Darts', () => {
    expect(checkoutWeg(40, 1)).toEqual(['D20'])
    expect(checkoutWeg(100, 1)).toBeNull()
    expect(checkoutWeg(100, 2)).toEqual(['T20', 'D20'])
    expect(checkoutWeg(141, 2)).toBeNull()
  })
})

describe('setupWurf', () => {
  it('empfiehlt einen Wurf, der eine ausmachbare Zahl uebrig laesst', () => {
    for (const rest of [...BOGEY_ZAHLEN, 171, 200, 301, 501]) {
      const wurf = setupWurf(rest)
      expect(wurf, `Rest ${rest}`).not.toBeNull()
      const uebrig = rest - WERT[wurf!]!
      expect(uebrig, `Rest ${rest}`).toBeGreaterThanOrEqual(2)
      expect(checkoutWeg(uebrig), `Rest ${rest} laesst ${uebrig}`).not.toBeNull()
    }
  })

  it('liefert nichts, wenn der Rest selbst ausmachbar ist', () => {
    expect(setupWurf(40)).toBeNull()
    expect(setupWurf(141)).toBeNull()
  })
})
