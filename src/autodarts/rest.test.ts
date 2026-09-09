import { describe, expect, it } from 'vitest'
import { istNichtAngemeldet } from './rest'

describe('istNichtAngemeldet', () => {
  it('erkennt den echten Autodarts-401-Fehlerrumpf', () => {
    const rumpf = { statusCode: 401, error: { status: 401, code: 'unauthorized', message: 'unauthorized' } }
    expect(istNichtAngemeldet(401, rumpf)).toBe(true)
  })

  it('erkennt einen 500er nicht als "nicht angemeldet"', () => {
    const rumpf = { statusCode: 500, error: { status: 500, code: 'internal_error', message: 'oops' } }
    expect(istNichtAngemeldet(500, rumpf)).toBe(false)
  })

  it('erkennt einen 401 mit abweichender Rumpfstruktur nicht', () => {
    expect(istNichtAngemeldet(401, { message: 'unauthorized' })).toBe(false)
    expect(istNichtAngemeldet(401, { statusCode: 401 })).toBe(false)
  })

  it('erkennt null nicht als "nicht angemeldet"', () => {
    expect(istNichtAngemeldet(401, null)).toBe(false)
    expect(istNichtAngemeldet(500, null)).toBe(false)
  })
})
