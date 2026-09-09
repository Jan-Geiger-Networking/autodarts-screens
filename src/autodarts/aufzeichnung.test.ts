import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import * as fs from 'node:fs'
import { PassThrough } from 'node:stream'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { aufzeichnungBeenden, aufzeichnungStarten, wiedergeben } from './aufzeichnung'

// Nur createWriteStream wird ersetzt (Attrappe fuer den Stream-Fehler-Test
// unten), alle anderen fs-Funktionen bleiben echt - normale Aufzeichnung und
// Wiedergabe in den anderen Tests laufen also unveraendert gegen die Platte.
vi.mock('node:fs', async () => {
  const echt = await vi.importActual<typeof import('node:fs')>('node:fs')
  return { ...echt, createWriteStream: vi.fn(echt.createWriteStream) }
})

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

  // Das 'error'-Ereignis wird hier direkt auf einer Attrappe ausgeloest statt
  // ueber einen unbeschreibbaren Pfad provoziert: OB createWriteStream bei
  // einem kaputten Ziel beim Oeffnen oder erst beim ersten write() fehlschlaegt,
  // ist plattformabhaengig (z.B. sofort auf Windows, teils erst beim Schreiben
  // auf Linux/macOS) - ein ueber einen kaputten Pfad provozierter Test koennte
  // auf einer Plattform gruen sein, ohne den Fehlerfall je auszuloesen, und
  // damit falsche Sicherheit erzeugen. Die direkte Emission ist auf jeder
  // Plattform deterministisch. Bitte nicht durch einen "echten" kaputten Pfad
  // ersetzen.
  it('uebersteht einen Stream-Fehler waehrend einer laufenden Aufzeichnung', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const attrappe = new PassThrough()
    vi.mocked(fs.createWriteStream).mockImplementationOnce(
      () => attrappe as unknown as fs.WriteStream,
    )

    const pfad = neuerPfad()
    const schreiben = aufzeichnungStarten(pfad)

    attrappe.emit('error', new Error('simulierter Schreibfehler'))

    expect(warnSpy).toHaveBeenCalled()
    expect(() => schreiben({ nr: 1 })).not.toThrow()
    await expect(aufzeichnungBeenden()).resolves.toBeUndefined()

    warnSpy.mockRestore()
  })
})
