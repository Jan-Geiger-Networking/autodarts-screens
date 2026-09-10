import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { kennungEinlesen, type MonitorKennung } from './monitorAuswahl'

// Kein Import von 'electron' auf Modulebene: konfiguration.test.ts laedt diese
// Datei unter Vitest ohne laufende Electron-Runtime. standardKonfiguration und
// zusammenfuehren sind deshalb reine Funktionen. app.getPath('userData') wird
// erst innerhalb von konfigurationLesen/konfigurationSchreiben per dynamischem
// import('electron') geholt, wenn die Datei tatsaechlich im Main-Prozess laeuft.

export type Konfiguration = {
  boardId: string | null
  playerDisplayId: number | null
  spectatorDisplayId: number | null
  /**
   * Ob die Selbstaktualisierung auch Vorabversionen anbietet. null heisst
   * "nicht entschieden": dann richtet es sich nach der laufenden Version
   * (siehe betasErlaubt in aktualisierung.ts). Erst eine ausdrueckliche Wahl
   * im Control-Fenster schreibt true oder false hierher.
   */
  betaKanal: boolean | null
  /**
   * Die Version, deren Neuerungen im Control-Fenster schon gezeigt wurden.
   * Weicht sie von der laufenden Version ab, gab es dazwischen eine
   * Aktualisierung, und das Control-Fenster zeigt den Changelog-Abschnitt
   * einmalig an (Spec Abschnitt 13).
   */
  zuletztGeseheneVersion: string | null
  /**
   * Steckbrief des Monitors, auf dem der jeweilige Screen liegen soll. Die
   * Display-Kennungen oben reichen dafuer NICHT: Windows vergibt sie neu,
   * sobald ein Bildschirm aus- und wieder eingeschaltet oder der Rechner neu
   * gestartet wird (siehe monitorAuswahl.ts). Sie bleiben trotzdem erhalten -
   * sie sind das, was die Auswahlliste im Control-Fenster anzeigt.
   */
  playerMonitor: MonitorKennung | null
  spectatorMonitor: MonitorKennung | null
  /** Ob die Anwendung beim Anmelden am Rechner von selbst startet. */
  autostart: boolean
  /**
   * Ob der jeweilige Screen beim letzten Beenden offen war. Beim naechsten
   * Start wird er wieder geoeffnet - "ich mache den PC an und alles ist wie
   * vorher eingestellt und bereit".
   */
  playerOffen: boolean
  spectatorOffen: boolean
}

export const standardKonfiguration: Konfiguration = {
  boardId: null,
  playerDisplayId: null,
  spectatorDisplayId: null,
  betaKanal: null,
  zuletztGeseheneVersion: null,
  playerMonitor: null,
  spectatorMonitor: null,
  autostart: false,
  playerOffen: false,
  spectatorOffen: false,
}

// roh kommt aus einer Datei und ist deshalb ungeprueft. Unbekannte Felder
// werden verworfen, fehlende oder falsch typisierte Felder fallen auf die
// Standardkonfiguration zurueck.
export function zusammenfuehren(roh: unknown): Konfiguration {
  if (typeof roh !== 'object' || roh === null || Array.isArray(roh)) {
    return { ...standardKonfiguration }
  }
  const quelle = roh as Record<string, unknown>
  return {
    boardId: typeof quelle.boardId === 'string' ? quelle.boardId : standardKonfiguration.boardId,
    // Display-Kennungen sind ganze Zahlen. Number.isInteger schliesst NaN,
    // Infinity und Fliesskommazahlen aus (typeof === 'number' allein wuerde
    // sie faelschlich als gueltig durchlassen).
    playerDisplayId: Number.isInteger(quelle.playerDisplayId)
      ? (quelle.playerDisplayId as number)
      : standardKonfiguration.playerDisplayId,
    spectatorDisplayId: Number.isInteger(quelle.spectatorDisplayId)
      ? (quelle.spectatorDisplayId as number)
      : standardKonfiguration.spectatorDisplayId,
    // Nur ein echter Wahrheitswert zaehlt als getroffene Wahl. Alles andere -
    // auch eine "true" als Zeichenkette aus einer von Hand bearbeiteten Datei -
    // faellt auf null zurueck und heisst damit "nicht entschieden".
    betaKanal: typeof quelle.betaKanal === 'boolean' ? quelle.betaKanal : standardKonfiguration.betaKanal,
    zuletztGeseheneVersion:
      typeof quelle.zuletztGeseheneVersion === 'string'
        ? quelle.zuletztGeseheneVersion
        : standardKonfiguration.zuletztGeseheneVersion,
    // Eine halbe Kennung waere schlimmer als keine (siehe kennungEinlesen).
    playerMonitor: kennungEinlesen(quelle.playerMonitor),
    spectatorMonitor: kennungEinlesen(quelle.spectatorMonitor),
    autostart: typeof quelle.autostart === 'boolean' ? quelle.autostart : standardKonfiguration.autostart,
    playerOffen: typeof quelle.playerOffen === 'boolean' ? quelle.playerOffen : standardKonfiguration.playerOffen,
    spectatorOffen:
      typeof quelle.spectatorOffen === 'boolean' ? quelle.spectatorOffen : standardKonfiguration.spectatorOffen,
  }
}

async function konfigurationsPfad(): Promise<string> {
  const { app } = await import('electron')
  return join(app.getPath('userData'), 'config.json')
}

export async function konfigurationLesen(): Promise<Konfiguration> {
  try {
    const inhalt = await readFile(await konfigurationsPfad(), 'utf-8')
    return zusammenfuehren(JSON.parse(inhalt))
  } catch {
    // Datei fehlt, ist nicht lesbar oder kein gueltiges JSON: Standardkonfiguration
    // statt Absturz.
    return { ...standardKonfiguration }
  }
}

export async function konfigurationSchreiben(k: Konfiguration): Promise<void> {
  await writeFile(await konfigurationsPfad(), JSON.stringify(k, null, 2), 'utf-8')
}
