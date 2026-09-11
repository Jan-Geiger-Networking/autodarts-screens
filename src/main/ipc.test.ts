import { describe, expect, it } from 'vitest'
import { darfKanalNutzen, matchtagBefehlPruefen } from './ipc'

describe('darfKanalNutzen', () => {
  it('erlaubt dem Control-Fenster die eingeschraenkten Kanaele', () => {
    expect(darfKanalNutzen('control', 'fenster:oeffnen')).toBe(true)
    expect(darfKanalNutzen('control', 'fenster:schliessen')).toBe(true)
    expect(darfKanalNutzen('control', 'konfiguration:lesen')).toBe(true)
    expect(darfKanalNutzen('control', 'konfiguration:setzen')).toBe(true)
    expect(darfKanalNutzen('control', 'daten:loeschen')).toBe(true)
    expect(darfKanalNutzen('control', 'monitore:identifizieren')).toBe(true)
    expect(darfKanalNutzen('control', 'anmeldung:starten')).toBe(true)
    expect(darfKanalNutzen('control', 'anmeldung:beenden')).toBe(true)
    expect(darfKanalNutzen('control', 'anmeldung:status')).toBe(true)
    expect(darfKanalNutzen('control', 'diagnose:pfad')).toBe(true)
    expect(darfKanalNutzen('control', 'diagnose:oeffnen')).toBe(true)
    expect(darfKanalNutzen('control', 'aktualisierung:zustand')).toBe(true)
    expect(darfKanalNutzen('control', 'aktualisierung:suchen')).toBe(true)
    expect(darfKanalNutzen('control', 'aktualisierung:installieren')).toBe(true)
    expect(darfKanalNutzen('control', 'changelog:neuerungen')).toBe(true)
  })

  // aktualisierung:installieren startet die Anwendung neu. Aus dem Player-
  // oder Spectator-Renderer aufgerufen koennte ein Fehler dort mitten im
  // Match einen Neustart ausloesen - gleicher Grund wie bei
  // monitore:identifizieren.
  it('verweigert Player und Spectator die Selbstaktualisierung', () => {
    for (const kanal of [
      'aktualisierung:zustand',
      'aktualisierung:suchen',
      'aktualisierung:installieren',
      'changelog:neuerungen',
    ]) {
      expect(darfKanalNutzen('player', kanal)).toBe(false)
      expect(darfKanalNutzen('spectator', kanal)).toBe(false)
      expect(darfKanalNutzen(null, kanal)).toBe(false)
    }
  })

  it('verweigert dem Player-Fenster die eingeschraenkten Kanaele', () => {
    expect(darfKanalNutzen('player', 'fenster:oeffnen')).toBe(false)
    expect(darfKanalNutzen('player', 'konfiguration:lesen')).toBe(false)
    expect(darfKanalNutzen('player', 'daten:loeschen')).toBe(false)
    expect(darfKanalNutzen('player', 'anmeldung:starten')).toBe(false)
    expect(darfKanalNutzen('player', 'anmeldung:beenden')).toBe(false)
    expect(darfKanalNutzen('player', 'anmeldung:status')).toBe(false)
    expect(darfKanalNutzen('player', 'diagnose:pfad')).toBe(false)
    expect(darfKanalNutzen('player', 'diagnose:oeffnen')).toBe(false)
  })

  it('verweigert dem Spectator-Fenster die eingeschraenkten Kanaele', () => {
    expect(darfKanalNutzen('spectator', 'fenster:schliessen')).toBe(false)
    expect(darfKanalNutzen('spectator', 'konfiguration:setzen')).toBe(false)
    expect(darfKanalNutzen('spectator', 'anmeldung:starten')).toBe(false)
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

describe('matchtagBefehlPruefen', () => {
  it('nimmt einen Start samt Titel an', () => {
    expect(matchtagBefehlPruefen({ art: 'starten', titel: 'Huettenabend', modus: 'huette' })).toEqual({
      art: 'starten',
      titel: 'Huettenabend',
      modus: 'huette',
    })
  })

  it('nimmt einen Start ohne brauchbaren Titel mit leerem Titel an', () => {
    // Unbekannter Modus faellt auf 'normal' zurueck, nicht auf einen
    // Sonderablauf, den niemand gewaehlt hat.
    expect(matchtagBefehlPruefen({ art: 'starten', titel: 42, modus: 'unsinn' })).toEqual({
      art: 'starten',
      titel: '',
      modus: 'normal',
    })
  })

  it('nimmt das Zuruecknehmen an', () => {
    expect(matchtagBefehlPruefen({ art: 'zuruecknehmen' })).toEqual({ art: 'zuruecknehmen' })
  })

  it('macht aus allem Unbekannten ein Beenden statt eines Absturzes', () => {
    // Alles aus dem Renderer ist ungeprueft. Beenden ist die harmloseste
    // Auslegung: es bricht hoechstens ein Turnier ab, das der Nutzer sofort
    // wieder starten kann - es faelscht keinen Spielstand.
    expect(matchtagBefehlPruefen(null)).toEqual({ art: 'beenden' })
    expect(matchtagBefehlPruefen('starten')).toEqual({ art: 'beenden' })
    expect(matchtagBefehlPruefen({ art: 'unbekannt' })).toEqual({ art: 'beenden' })
  })
})
