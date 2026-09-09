import { contextBridge, ipcRenderer } from 'electron'
import type { FensterArt, MatchState } from '../shared/typen'
import type { Konfiguration } from '../main/konfiguration'
import type { MonitorEintrag } from '../main/monitore'

contextBridge.exposeInMainWorld('app', {
  version: process.env.npm_package_version ?? '0.1.0',

  // Ruft rueckruf bei jedem eintreffenden MatchState auf. Der Rueckgabewert
  // meldet genau diesen einen Zuhoerer wieder ab, damit React ihn beim
  // Aufraeumen (useEffect-Cleanup) entfernen kann, ohne andere zu stoeren.
  beiZustand(rueckruf: (z: MatchState) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, zustand: MatchState) => rueckruf(zustand)
    ipcRenderer.on('zustand', listener)
    return () => ipcRenderer.removeListener('zustand', listener)
  },

  monitore: (): Promise<MonitorEintrag[]> => ipcRenderer.invoke('monitore:auflisten'),
  monitoreIdentifizieren: (): Promise<void> => ipcRenderer.invoke('monitore:identifizieren'),

  konfigurationLesen: (): Promise<Konfiguration> => ipcRenderer.invoke('konfiguration:lesen'),
  konfigurationSetzen: (teil: Partial<Konfiguration>): Promise<Konfiguration> =>
    ipcRenderer.invoke('konfiguration:setzen', teil),

  fensterOeffnen: (art: FensterArt): Promise<void> => ipcRenderer.invoke('fenster:oeffnen', art),
  fensterSchliessen: (art: FensterArt): Promise<void> => ipcRenderer.invoke('fenster:schliessen', art),

  // Liefert die Namen der tatsaechlich geloeschten Dateien/Ordner (siehe
  // src/main/datenLoeschen.ts). Die Rueckfrage vor dem Aufruf uebernimmt der
  // Renderer, nicht dieser Kanal.
  datenLoeschen: (): Promise<string[]> => ipcRenderer.invoke('daten:loeschen'),
})
