import { describe, expect, it, vi } from 'vitest'

// preload/index.ts fuehrt beim Laden contextBridge.exposeInMainWorld() aus -
// 'electron' wird deshalb gemockt, damit dieser Test unter einer normalen
// Node-Runtime laeuft. sendSync liefert einen Platzhalter fuer die Version
// (Befund 3 betrifft nur die main-Seite von app:version, hier interessiert
// nur, WELCHE Schluessel exponiert werden).
const exposeInMainWorld = vi.fn()

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: {
    sendSync: vi.fn().mockReturnValue('0.0.0-test'),
    on: vi.fn(),
    removeListener: vi.fn(),
    invoke: vi.fn(),
  },
}))

// Abschliessende Liste, bewusst nicht generiert: kein Token, keine Adresse,
// kein Dateipfad darf hier je auftauchen (globale Vorgabe der Spezifikation).
// Ein kuenftig versehentlich hinzugefuegtes Feld wie "tokenHolen" faellt
// durch diesen Test sofort auf, statt sich unbemerkt in die Preload-Bruecke
// einzuschleichen.
const ERWARTETE_SCHLUESSEL = [
  'version',
  'beiZustand',
  'beiVerbindungszustand',
  'monitore',
  'monitoreIdentifizieren',
  'konfigurationLesen',
  'konfigurationSetzen',
  'fensterOeffnen',
  'fensterSchliessen',
  'datenLoeschen',
  'anmeldungStarten',
  'anmeldungBeenden',
  'anmeldungStatus',
  'diagnosePfad',
  'diagnoseOeffnen',
  'beiAktualisierungszustand',
  'aktualisierungZustand',
  'aktualisierungSuchen',
  'aktualisierungInstallieren',
  'neuerungen',
].sort()

describe('preload: exponierte window.app-Oberflaeche', () => {
  it('exponiert genau die erwarteten Schluessel, nicht mehr und nicht weniger', async () => {
    await import('./index')

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1)
    const [name, api] = exposeInMainWorld.mock.calls[0]!
    expect(name).toBe('app')
    expect(Object.keys(api as object).sort()).toEqual(ERWARTETE_SCHLUESSEL)
  })
})
