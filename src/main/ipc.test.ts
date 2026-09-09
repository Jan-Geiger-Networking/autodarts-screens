import { describe, expect, it } from 'vitest'
import { darfKanalNutzen } from './ipc'

describe('darfKanalNutzen', () => {
  it('erlaubt dem Control-Fenster die eingeschraenkten Kanaele', () => {
    expect(darfKanalNutzen('control', 'fenster:oeffnen')).toBe(true)
    expect(darfKanalNutzen('control', 'fenster:schliessen')).toBe(true)
    expect(darfKanalNutzen('control', 'konfiguration:lesen')).toBe(true)
    expect(darfKanalNutzen('control', 'konfiguration:setzen')).toBe(true)
    expect(darfKanalNutzen('control', 'daten:loeschen')).toBe(true)
    expect(darfKanalNutzen('control', 'monitore:identifizieren')).toBe(true)
  })

  it('verweigert dem Player-Fenster die eingeschraenkten Kanaele', () => {
    expect(darfKanalNutzen('player', 'fenster:oeffnen')).toBe(false)
    expect(darfKanalNutzen('player', 'konfiguration:lesen')).toBe(false)
    expect(darfKanalNutzen('player', 'daten:loeschen')).toBe(false)
  })

  it('verweigert dem Spectator-Fenster die eingeschraenkten Kanaele', () => {
    expect(darfKanalNutzen('spectator', 'fenster:schliessen')).toBe(false)
    expect(darfKanalNutzen('spectator', 'konfiguration:setzen')).toBe(false)
  })

  it('verweigert einem unbekannten Fenster (art null) die eingeschraenkten Kanaele', () => {
    expect(darfKanalNutzen(null, 'konfiguration:lesen')).toBe(false)
    expect(darfKanalNutzen(null, 'fenster:oeffnen')).toBe(false)
  })

  // monitore:identifizieren HANDELT (blendet auf jedem Monitor ein Fenster
  // ein) und gehoert deshalb in die Waechterliste (Befund 5) - anders als
  // monitore:auflisten, das nur Daten herausgibt und bewusst offen bleibt.
  it('verweigert Player und Spectator monitore:identifizieren, weil es handelt', () => {
    expect(darfKanalNutzen('player', 'monitore:identifizieren')).toBe(false)
    expect(darfKanalNutzen('spectator', 'monitore:identifizieren')).toBe(false)
    expect(darfKanalNutzen(null, 'monitore:identifizieren')).toBe(false)
  })

  it('laesst uneingeschraenkte Kanaele fuer jedes Fenster zu', () => {
    expect(darfKanalNutzen('player', 'monitore:auflisten')).toBe(true)
    expect(darfKanalNutzen('spectator', 'monitore:auflisten')).toBe(true)
    expect(darfKanalNutzen(null, 'monitore:auflisten')).toBe(true)
  })
})
