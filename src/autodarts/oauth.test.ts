import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { codeAusUmleitung, pkcePaar, tokenNochGueltig } from './oauth'

describe('pkcePaar', () => {
  it('erzeugt einen Verifier zwischen 43 und 128 Zeichen', () => {
    const { verifier } = pkcePaar()
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier.length).toBeLessThanOrEqual(128)
  })

  it('verwendet nur erlaubte Zeichen', () => {
    expect(pkcePaar().verifier).toMatch(/^[A-Za-z0-9\-._~]+$/)
  })

  it('challenge ist der base64url-kodierte SHA-256 des Verifiers', () => {
    const { verifier, challenge } = pkcePaar()
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'))
  })

  it('erzeugt bei jedem Aufruf ein anderes Paar', () => {
    expect(pkcePaar().verifier).not.toBe(pkcePaar().verifier)
  })
})

describe('tokenNochGueltig', () => {
  const PUFFER = 60

  it('ist genau am Puffer noch gueltig ("mindestens 60 Sekunden")', () => {
    // Ablauf in 60 Sekunden, jetzt = 0: verbleibende Zeit ist exakt der Puffer.
    expect(tokenNochGueltig(60, 0, PUFFER)).toBe(true)
  })

  it('ist eine Sekunde vor dem Puffer-Zeitpunkt noch gueltig', () => {
    // Verbleibende Zeit 61 Sekunden, also einen Schritt vor Erreichen des Puffers.
    expect(tokenNochGueltig(61, 0, PUFFER)).toBe(true)
  })

  it('ist eine Sekunde nach dem Puffer-Zeitpunkt nicht mehr gueltig', () => {
    // Verbleibende Zeit 59 Sekunden, also einen Schritt hinter dem Puffer.
    expect(tokenNochGueltig(59, 0, PUFFER)).toBe(false)
  })

  it('ein Token ohne bekannte Ablaufzeit (NaN) gilt als nicht mehr gueltig', () => {
    expect(tokenNochGueltig(Number.NaN, 0, PUFFER)).toBe(false)
  })
})

describe('codeAusUmleitung', () => {
  const UMLEITUNG = 'https://play.autodarts.com/auth/google/callback'

  it('entnimmt den Code aus einer Umleitungsadresse mit code', () => {
    expect(codeAusUmleitung(`${UMLEITUNG}?code=abc123&state=xyz`)).toEqual({ code: 'abc123' })
  })

  it('entnimmt error und error_description als Fehler', () => {
    const ergebnis = codeAusUmleitung(
      `${UMLEITUNG}?error=access_denied&error_description=Nutzer%20hat%20abgelehnt`,
    )
    expect(ergebnis).toEqual({ fehler: 'access_denied: Nutzer hat abgelehnt' })
  })

  it('liefert einen Fehler, wenn die Umleitung weder code noch error enthaelt', () => {
    const ergebnis = codeAusUmleitung(`${UMLEITUNG}?state=xyz`)
    expect('fehler' in ergebnis).toBe(true)
  })

  it('liefert einen Fehler fuer eine Adresse, die gar nicht das Umleitungsziel ist', () => {
    const ergebnis = codeAusUmleitung('https://auth.autodarts.com/authorize?request_id=abc')
    expect('fehler' in ergebnis).toBe(true)
  })
})
