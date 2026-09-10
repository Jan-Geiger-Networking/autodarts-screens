import { describe, expect, it } from 'vitest'
import { nameAusKonto } from './konto'

describe('nameAusKonto', () => {
  it('erkennt jedes Kandidatenfeld einzeln', () => {
    expect(nameAusKonto({ name: 'Anna' })).toBe('Anna')
    expect(nameAusKonto({ userName: 'Anna' })).toBe('Anna')
    expect(nameAusKonto({ displayName: 'Anna' })).toBe('Anna')
    expect(nameAusKonto({ email: 'anna@example.com' })).toBe('anna@example.com')
    expect(nameAusKonto({ preferred_username: 'Anna' })).toBe('Anna')
  })

  it('haelt die Kandidaten-Reihenfolge ein, wenn mehrere Felder vorhanden sind', () => {
    expect(nameAusKonto({ email: 'anna@example.com', name: 'Anna' })).toBe('Anna')
    expect(nameAusKonto({ preferred_username: 'anna99', displayName: 'Anna' })).toBe('Anna')
    expect(nameAusKonto({ preferred_username: 'anna99', email: 'anna@example.com' })).toBe('anna@example.com')
  })

  it('ueberspringt einen leeren String und nimmt das naechste brauchbare Feld', () => {
    expect(nameAusKonto({ name: '', email: 'anna@example.com' })).toBe('anna@example.com')
  })

  it('liefert null bei einem Objekt ohne brauchbares Feld', () => {
    expect(nameAusKonto({ id: 'abc123', createdAt: '2026-01-01' })).toBeNull()
  })

  it('liefert null bei null', () => {
    expect(nameAusKonto(null)).toBeNull()
  })

  it('liefert null bei einem Nicht-Objekt', () => {
    expect(nameAusKonto('Anna')).toBeNull()
    expect(nameAusKonto(42)).toBeNull()
  })

  it('ueberspringt ein Kandidatenfeld mit falschem Typ und nimmt das naechste brauchbare Feld', () => {
    expect(nameAusKonto({ name: 42, email: 'anna@example.com' })).toBe('anna@example.com')
  })

  it('liefert null, wenn das einzige vorhandene Kandidatenfeld einen falschen Typ hat', () => {
    expect(nameAusKonto({ name: 42 })).toBeNull()
  })
})
