import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { aufzeichnungBeenden, aufzeichnungStarten, wiedergeben } from './aufzeichnung'

const neuerPfad = () => join(mkdtempSync(join(tmpdir(), 'ad-')), 'mitschnitt.jsonl')

describe('Aufzeichnung und Wiedergabe', () => {
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
})
