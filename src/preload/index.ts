import { contextBridge, ipcRenderer } from 'electron'
import type { FensterArt, MatchState } from '../shared/typen'
import type { Konfiguration } from '../main/konfiguration'
import type { MonitorEintrag } from '../main/monitore'
import type { Verbindungszustand } from '../autodarts/websocket'
import type { AnmeldungsErgebnis } from '../autodarts/oauth'

contextBridge.exposeInMainWorld('app', {
  // Synchron per sendSync statt eines Umgebungsvariablen-Rueckfalls: npm
  // setzt process.env.npm_package_version nur unter "npm run ..." - im
  // gepackten Programm existiert die Variable nicht (Befund 3), der Rueckfall
  // '0.1.0' hat dann immer gegriffen. app.getVersion() liefert die echte,
  // aus package.json gepackte Version.
  version: ipcRenderer.sendSync('app:version') as string,

  // Ruft rueckruf bei jedem eintreffenden MatchState auf. Der Rueckgabewert
  // meldet genau diesen einen Zuhoerer wieder ab, damit React ihn beim
  // Aufraeumen (useEffect-Cleanup) entfernen kann, ohne andere zu stoeren.
  beiZustand(rueckruf: (z: MatchState) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, zustand: MatchState) => rueckruf(zustand)
    ipcRenderer.on('zustand', listener)
    return () => ipcRenderer.removeListener('zustand', listener)
  },

  // Verbindungszustand zur Autodarts-API, vom Hauptprozess verteilt (siehe
  // src/main/fenster.ts, verbindungszustandVerteilen) - nur das Control-
  // Fenster bekommt diese Nachrichten tatsaechlich gesendet.
  beiVerbindungszustand(rueckruf: (z: Verbindungszustand) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, zustand: Verbindungszustand) => rueckruf(zustand)
    ipcRenderer.on('verbindungszustand', listener)
    return () => ipcRenderer.removeListener('verbindungszustand', listener)
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

  // Nur ob es geklappt hat (und ob ein Abbruch keine Fehlermeldung wert ist)
  // geht ueber diesen Kanal - kein Token, keine Adresse, kein Code (siehe
  // AnmeldungsErgebnis in oauth.ts).
  anmeldungStarten: (): Promise<AnmeldungsErgebnis> => ipcRenderer.invoke('anmeldung:starten'),
  anmeldungBeenden: (): Promise<void> => ipcRenderer.invoke('anmeldung:beenden'),
  anmeldungStatus: (): Promise<boolean> => ipcRenderer.invoke('anmeldung:status'),

  // Nur ein Dateipfad, kein Geheimnis - fuer die Anzeige im Control-Fenster.
  diagnosePfad: (): Promise<string> => ipcRenderer.invoke('diagnose:pfad'),
  // Oeffnet den Datei-Explorer mit dem Diagnoseprotokoll markiert.
  diagnoseOeffnen: (): Promise<void> => ipcRenderer.invoke('diagnose:oeffnen'),
})
