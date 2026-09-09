import { describe, expect, it } from 'vitest'
import { ticketAusAntwort, wartezeit } from './websocket'

describe('wartezeit', () => {
  it('waechst exponentiell bis 16s und bleibt danach bei 30s', () => {
    expect(wartezeit(1)).toBe(1000)
    expect(wartezeit(2)).toBe(2000)
    expect(wartezeit(3)).toBe(4000)
    expect(wartezeit(4)).toBe(8000)
    expect(wartezeit(5)).toBe(16000)
    expect(wartezeit(6)).toBe(30000)
    expect(wartezeit(7)).toBe(30000)
    expect(wartezeit(100)).toBe(30000)
  })
})

describe('ticketAusAntwort', () => {
  it('akzeptiert eine reine Zeichenkette (Annahme laut Community-Projekten)', () => {
    expect(ticketAusAntwort('abc123')).toBe('abc123')
  })

  it('findet ein Ticket in einem Objekt unter gaengigen Feldnamen', () => {
    expect(ticketAusAntwort({ ticket: 'xyz' })).toBe('xyz')
    expect(ticketAusAntwort({ id: 'xyz' })).toBe('xyz')
    expect(ticketAusAntwort({ token: 'xyz' })).toBe('xyz')
  })

  it('wirft bei komplett unerwarteter Antwortform', () => {
    expect(() => ticketAusAntwort({ unerwartet: 1 })).toThrow()
    expect(() => ticketAusAntwort(null)).toThrow()
    expect(() => ticketAusAntwort(42)).toThrow()
    expect(() => ticketAusAntwort('')).toThrow()
  })
})
