import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import * as fs from 'node:fs'
import { PassThrough } from 'node:stream'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  alteMitschnitteAusrangieren,
  aufzeichnungBeenden,
  aufzeichnungStarten,
  MITSCHNITTE_BEHALTEN,
  standardAufzeichnungspfad,
  wiedergeben,
} from './aufzeichnung'

// Nur createWriteStream wird ersetzt (Attrappe fuer den Stream-Fehler-Test
// unten), alle anderen fs-Funktionen bleiben echt - normale Aufzeichnung und
// Wiedergabe in den anderen Tests laufen also unveraendert gegen die Platte.
vi.mock('node:fs', async () => {
  const echt = await vi.importActual<typeof import('node:fs')>('node:fs')
  return { ...echt, createWriteStream: vi.fn(echt.createWriteStream) }
})

// standardAufzeichnungspfad() braucht app.getPath('userData') - 'electron'
// existiert unter Vitest nicht als echte Laufzeit (gleiches Muster wie in
// diagnose.test.ts). vi.mock wird von Vitest an den Dateianfang gehoben, die
// Platzierung hier aendert daran nichts.
const userDataDir = mkdtempSync(join(tmpdir(), 'ad-userdata-'))
vi.mock('electron', () => ({ app: { getPath: () => userDataDir } }))

afterAll(() => {
  rmSync(userDataDir, { recursive: true, force: true })
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

describe('alteMitschnitteAusrangieren', () => {
  it('waehlt nichts aus, wenn nicht mehr Dateien vorhanden sind als behalten werden sollen', () => {
    expect(alteMitschnitteAusrangieren(['a', 'b', 'c'], 3)).toEqual([])
    expect(alteMitschnitteAusrangieren(['a', 'b'], 3)).toEqual([])
    expect(alteMitschnitteAusrangieren([], 3)).toEqual([])
  })

  it('waehlt die aeltesten (zuerst sortierten) Dateien aus, wenn mehr vorhanden sind als behalten werden sollen', () => {
    // Absichtlich unsortiert uebergeben - Dateinamen sind Zeitstempel und
    // sortieren als Zeichenketten bereits chronologisch (siehe
    // standardAufzeichnungspfad), die Funktion muss also selbst sortieren.
    expect(alteMitschnitteAusrangieren(['2026-3', '2026-1', '2026-2'], 2)).toEqual(['2026-1'])
    expect(alteMitschnitteAusrangieren(['2026-3', '2026-1', '2026-2', '2026-4'], 1)).toEqual([
      '2026-1',
      '2026-2',
      '2026-3',
    ])
  })

  it('benutzt MITSCHNITTE_BEHALTEN als Standardwert, wenn keine Anzahl uebergeben wird', () => {
    const viele = Array.from({ length: MITSCHNITTE_BEHALTEN + 5 }, (_, i) => String(i).padStart(4, '0'))
    expect(alteMitschnitteAusrangieren(viele)).toHaveLength(5)
  })
})

describe('standardAufzeichnungspfad', () => {
  it('liefert einen Pfad unter userData/mitschnitte mit .jsonl-Endung', async () => {
    const pfad = await standardAufzeichnungspfad()
    expect(pfad.startsWith(join(userDataDir, 'mitschnitte'))).toBe(true)
    expect(pfad.endsWith('.jsonl')).toBe(true)
  })

  it('raeumt vor dem naechsten Pfad ueberzaehlige aeltere Mitschnitte auf', async () => {
    const verzeichnis = join(userDataDir, 'mitschnitte')
    mkdirSync(verzeichnis, { recursive: true })
    const alteDateien = Array.from({ length: MITSCHNITTE_BEHALTEN + 3 }, (_, i) => `1999-01-01T00-00-${String(i).padStart(2, '0')}-000Z.jsonl`)
    for (const datei of alteDateien) writeFileSync(join(verzeichnis, datei), '')

    await standardAufzeichnungspfad()

    // Nur die juengsten MITSCHNITTE_BEHALTEN der ALTEN Dateien duerfen
    // uebrig sein - die drei aeltesten wurden aufgeraeumt. Der frisch
    // zurueckgelieferte Pfad selbst existiert noch nicht als Datei (das
    // macht erst aufzeichnungStarten()), zaehlt hier also nicht mit.
    expect(readdirSync(verzeichnis)).toHaveLength(MITSCHNITTE_BEHALTEN)
  })
})
