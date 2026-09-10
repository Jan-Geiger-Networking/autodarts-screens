import type { FensterArt, MatchState } from '../shared/typen'
import type { Konfiguration } from '../main/konfiguration'
import type { MonitorEintrag } from '../main/monitore'
import type { Verbindungszustand } from '../autodarts/websocket'
import type { AnmeldungsErgebnis } from '../autodarts/oauth'

export {}

declare global {
  interface Window {
    app: {
      version: string
      beiZustand: (rueckruf: (z: MatchState) => void) => () => void
      beiVerbindungszustand: (rueckruf: (z: Verbindungszustand) => void) => () => void
      monitore: () => Promise<MonitorEintrag[]>
      monitoreIdentifizieren: () => Promise<void>
      konfigurationLesen: () => Promise<Konfiguration>
      konfigurationSetzen: (teil: Partial<Konfiguration>) => Promise<Konfiguration>
      fensterOeffnen: (art: FensterArt) => Promise<void>
      fensterSchliessen: (art: FensterArt) => Promise<void>
      datenLoeschen: () => Promise<string[]>
      anmeldungStarten: () => Promise<AnmeldungsErgebnis>
      anmeldungBeenden: () => Promise<void>
      anmeldungStatus: () => Promise<boolean>
      diagnosePfad: () => Promise<string>
      diagnoseOeffnen: () => Promise<void>
    }
  }
}
