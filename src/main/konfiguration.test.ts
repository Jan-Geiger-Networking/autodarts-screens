import { describe, expect, it } from 'vitest'
import { standardKonfiguration, zusammenfuehren } from './konfiguration'

describe('zusammenfuehren', () => {
  it('ergaenzt fehlende Felder aus der Standardkonfiguration', () => {
    expect(zusammenfuehren({ boardId: 'abc' })).toEqual({
      ...standardKonfiguration,
      boardId: 'abc',
    })
  })

  it('verwirft unbekannte Felder', () => {
    expect('unsinn' in zusammenfuehren({ boardId: 'abc', unsinn: 42 })).toBe(false)
  })

  it('verwirft Werte vom falschen Typ', () => {
    expect(zusammenfuehren({ playerDisplayId: 'nein' }).playerDisplayId).toBeNull()
  })

  it('liefert bei kaputtem Inhalt die Standardkonfiguration', () => {
    expect(zusammenfuehren(null)).toEqual(standardKonfiguration)
    expect(zusammenfuehren('unfug')).toEqual(standardKonfiguration)
    expect(zusammenfuehren([])).toEqual(standardKonfiguration)
  })
})
