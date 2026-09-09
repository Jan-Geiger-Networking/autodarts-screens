import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { aufzeichnungBeenden, aufzeichnungStarten, wiedergeben } from './aufzeichnung'

const neuerPfad = () => join(mkdtempSync(join(tmpdir(), 'ad-')), 'mitschnitt.jsonl')

describe('Aufzeichnung und Wiedergabe', () => {
  afterEach(async () => {
    // Jeder Test hinterlaesst einen sauberen Modulzustand. Ohne das haengt
    // "beenden ohne laufende Aufzeichnung" davon ab, was der Test davor
    // liegen gelassen hat, und die Reihenfolge wird Teil der Zusicherung.
    await aufzeichnungBeenden()
  })

  it('schreibt eine JSON-Zeile je Ereignis, mit Zeitstempel', async () => {
    const pfad = neuerPfad()
    const schreiben = aufzeichnungStarten(pfad)
    schreiben({ a: 1 })
    schreiben({ b: 2 })
    await aufzeichnungBeenden()

    const zeilen = readFileSync(pfad, 'utf8').trim().split('\n').map((z) => JSON.parse(z))
    expect(zeilen.length).toBe(2)
    expect(zeilen[0]!.daten).toEqual({ a: 1 })
    expect(typeof zeilen[0]!.t).toBe('number')
    expect(zeilen[1]!.t).toBeGreaterThanOrEqual(zeilen[0]!.t)
  })

  it('gibt in derselben Reihenfolge wieder', async () => {
    const pfad = neuerPfad()
    const schreiben = aufzeichnungStarten(pfad)
    schreiben({ nr: 1 })
    schreiben({ nr: 2 })
    schreiben({ nr: 3 })
    await aufzeichnungBeenden()

    const gesehen: unknown[] = []
    await wiedergeben(pfad, (roh) => gesehen.push(roh), 0)
    expect(gesehen).toEqual([{ nr: 1 }, { nr: 2 }, { nr: 3 }])
  })

  it('haelt bei Tempo 1 die urspruenglichen Abstaende ein', async () => {
    const pfad = neuerPfad()
    const schreiben = aufzeichnungStarten(pfad)
    schreiben({ nr: 1 })
    await new Promise((r) => setTimeout(r, 60))
    schreiben({ nr: 2 })
    await aufzeichnungBeenden()

    const start = Date.now()
    await wiedergeben(pfad, () => {}, 1)
    expect(Date.now() - start).toBeGreaterThanOrEqual(50)
  })

  it('wirft, wenn eine Aufzeichnung bereits laeuft', () => {
    const pfad = neuerPfad()
    aufzeichnungStarten(pfad)
    expect(() => aufzeichnungStarten(neuerPfad())).toThrow()
  })

  it('beenden ohne laufende Aufzeichnung ist folgenlos', async () => {
    await expect(aufzeichnungBeenden()).resolves.toBeUndefined()
    await expect(aufzeichnungBeenden()).resolves.toBeUndefined()
  })

  it('ueberspringt beschaedigte Zeilen und spielt weiter', async () => {
    const pfad = neuerPfad()
    const schreiben = aufzeichnungStarten(pfad)
    schreiben({ nr: 1 })
    schreiben({ nr: 2 })
    await aufzeichnungBeenden()
    const zeilen = readFileSync(pfad, 'utf8').trim().split('\n')
    writeFileSync(pfad, `${zeilen[0]}\n{kaputt\n${zeilen[1]}\n{"t":99,"dat`)

    const gesehen: unknown[] = []
    const ergebnis = await wiedergeben(pfad, (roh) => gesehen.push(roh), 0)
    expect(gesehen).toEqual([{ nr: 1 }, { nr: 2 }])
    expect(ergebnis.abgespielt).toBe(2)
    expect(ergebnis.uebersprungen).toBe(2)
  })

  it('bricht bei nicht serialisierbarem Ereignis nicht ab', async () => {
    const pfad = neuerPfad()
    const schreiben = aufzeichnungStarten(pfad)
    const zyklus: Record<string, unknown> = {}
    zyklus.selbst = zyklus
    expect(() => schreiben(zyklus)).not.toThrow()
    schreiben({ nr: 2 })
    await aufzeichnungBeenden()

    const gesehen: unknown[] = []
    const ergebnis = await wiedergeben(pfad, (roh) => gesehen.push(roh), 0)
    expect(gesehen).toEqual([{ nr: 2 }])
    expect(ergebnis.uebersprungen).toBe(1)
  })
})
