import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { alleDatenLoeschen } from './datenLoeschen'

// 'electron' wird gemockt: alleDatenLoeschen() ist bewusst ohne
// Electron-Abhaengigkeit gebaut (siehe Dateikopf), damit genau dieser Test
// unter einer normalen Node-Runtime laufen kann. app.getPath('userData')
// liefert ein echtes temporaeres Verzeichnis, session.fromPartition() liefert
// eine Attrappe mit einer beobachtbaren clearStorageData()-Spy statt die
// echte Sitzungspartition anzufassen.
const userDataDir = mkdtempSync(join(tmpdir(), 'ad-datenloeschen-'))
const clearStorageData = vi.fn().mockResolvedValue(undefined)
const fromPartition = vi.fn((_name: string) => ({ clearStorageData }))

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir },
  session: { fromPartition: (name: string) => fromPartition(name) },
}))

function verzeichnisLeeren(): void {
  rmSync(userDataDir, { recursive: true, force: true })
  mkdirSync(userDataDir, { recursive: true })
}

describe('alleDatenLoeschen', () => {
  afterEach(() => {
    verzeichnisLeeren()
    clearStorageData.mockClear()
    fromPartition.mockClear()
  })

  it('meldet nichts und ruft die Sitzungspartition nicht auf, wenn nichts vorhanden ist', async () => {
    await expect(alleDatenLoeschen()).resolves.toEqual([])
    expect(fromPartition).not.toHaveBeenCalled()
  })

  it('loescht config.json, anmeldung.bin, recordings/ und die Sitzungspartition, wenn sie vorhanden sind (Befund 2)', async () => {
    writeFileSync(join(userDataDir, 'config.json'), '{}')
    writeFileSync(join(userDataDir, 'anmeldung.bin'), 'geheim')
    mkdirSync(join(userDataDir, 'recordings'))
    writeFileSync(join(userDataDir, 'recordings', 'match.jsonl'), '{}')
    // Electron legt Sitzungspartitionen unter Partitions/<name ohne
    // "persist:"-Praefix> ab - siehe SITZUNGS_ORDNER in datenLoeschen.ts.
    mkdirSync(join(userDataDir, 'Partitions', 'autodarts-anmeldung'), { recursive: true })

    const geloescht = await alleDatenLoeschen()

    expect([...geloescht].sort()).toEqual(
      ['Partitions/autodarts-anmeldung/', 'anmeldung.bin', 'config.json', 'recordings/'].sort(),
    )
    expect(existsSync(join(userDataDir, 'config.json'))).toBe(false)
    expect(existsSync(join(userDataDir, 'anmeldung.bin'))).toBe(false)
    expect(existsSync(join(userDataDir, 'recordings'))).toBe(false)
    expect(fromPartition).toHaveBeenCalledWith('persist:autodarts-anmeldung')
    expect(clearStorageData).toHaveBeenCalledTimes(1)
  })

  it('laesst fremde Dateien und Ordner unter userData unberuehrt', async () => {
    writeFileSync(join(userDataDir, 'config.json'), '{}')
    mkdirSync(join(userDataDir, 'players'))
    writeFileSync(join(userDataDir, 'players', 'jan.json'), '{}')
    writeFileSync(join(userDataDir, 'irgendwas.txt'), 'fremd')

    const geloescht = await alleDatenLoeschen()

    expect(geloescht).toEqual(['config.json'])
    expect(existsSync(join(userDataDir, 'players', 'jan.json'))).toBe(true)
    expect(existsSync(join(userDataDir, 'irgendwas.txt'))).toBe(true)
  })

  it('meldet nur tatsaechlich vorhandene Ziele, keine erfundenen', async () => {
    mkdirSync(join(userDataDir, 'recordings'))

    const geloescht = await alleDatenLoeschen()

    expect(geloescht).toEqual(['recordings/'])
  })
})
