import { describe, expect, it, vi } from 'vitest'

vi.mock('./fenster', () => ({ spielerVerteilen: vi.fn() }))
vi.mock('../autodarts/diagnose', () => ({ protokollieren: vi.fn() }))

const { fotoGueltig, fotosEintragen, neueNamen, spielerEinlesen } = await import('./spielerDienst')
const { RUHEZUSTAND } = await import('../autodarts/adapter')

const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='

function zustandMit(...namen: string[]) {
  return {
    ...RUHEZUSTAND,
    players: namen.map((name, i) => ({ id: `p${i}`, autodartsName: name, displayName: name })),
  }
}

describe('spielerDienst', () => {
  it('laesst nur echte Bild-Adressen als Foto zu', () => {
    expect(fotoGueltig(FOTO)).toBe(true)
    expect(fotoGueltig('file:///C:/geheim.jpg')).toBe(false)
    expect(fotoGueltig('data:text/html;base64,PHNjcmlwdD4=')).toBe(false)
    expect(fotoGueltig(`data:image/png;base64,${'A'.repeat(400_000)}`)).toBe(false)
  })

  it('liest eine Liste ein und verwirft Doppelte und Kaputtes', () => {
    expect(
      spielerEinlesen([{ name: 'Jan', foto: FOTO }, { name: 'jan ' }, { name: '' }, 'x', { name: 'Tom', foto: 'boese' }]),
    ).toEqual([
      { name: 'Jan', foto: FOTO },
      { name: 'Tom', foto: null },
    ])
    expect(spielerEinlesen({})).toEqual([])
  })

  it('findet nur neue Namen, ohne Platzhalter', () => {
    expect(neueNamen(zustandMit('Jan', 'Tom', 'Spieler 3', 'tom'), [{ name: 'jan', foto: null }])).toEqual(['Tom'])
  })

  it('traegt Fotos ohne Ruecksicht auf Gross-/Kleinschreibung ein', () => {
    const z = fotosEintragen(zustandMit('JAN', 'Tom'), [{ name: 'jan', foto: FOTO }, { name: 'Tom', foto: null }])
    expect(z.players[0]!.photoPath).toBe(FOTO)
    expect(z.players[1]!.photoPath).toBeUndefined()
  })
})
