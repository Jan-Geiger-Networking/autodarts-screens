// IPC-Kanaele zwischen Main- und Renderer-Prozessen. Enthaelt nur Kanaele,
// die heute eine echte Implementierung haben. Anmelden/Abmelden fehlen
// bewusst: src/autodarts/oauth.ts existiert noch nicht, und ein Kanal ins
// Leere waere schlimmer als gar keiner - die kommen mit der Anmelde-Aufgabe.

import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { FensterArt } from '../shared/typen'
import { monitoreAuflisten, monitoreIdentifizieren } from './monitore'
import { konfigurationLesen, konfigurationSchreiben, zusammenfuehren } from './konfiguration'
import { fensterArtVon, fensterOeffnen, fensterSchliessen, konfigurationAktualisieren } from './fenster'

const GUELTIGE_FENSTER_ARTEN: readonly FensterArt[] = ['control', 'player', 'spectator']

function istFensterArt(wert: unknown): wert is FensterArt {
  return typeof wert === 'string' && (GUELTIGE_FENSTER_ARTEN as readonly string[]).includes(wert)
}

// Kanaele, die nur das Control-Fenster aufrufen darf. Player und Spectator
// laden dieselbe Preload-Datei und koennten sie technisch ebenso aufrufen -
// kein Geheimnis-Leck (kein Token, keine Adresse, kein Dateipfad geht
// darueber), aber unnoetig vergroesserte Angriffsflaeche. 'zustand' steht
// bewusst nicht in dieser Liste: der laeuft nur vom Hauptprozess zum
// Renderer (zustandVerteilen -> webContents.send), nie als IPC-Handler,
// den ein Renderer aufrufen koennte.
const NUR_CONTROL: ReadonlySet<string> = new Set([
  'fenster:oeffnen',
  'fenster:schliessen',
  'konfiguration:lesen',
  'konfiguration:setzen',
])

/**
 * Entscheidet, ob ein Fenster der Art `art` den Kanal `kanal` aufrufen darf.
 * Reine Funktion (keine Electron-Objekte), damit sie ohne laufende
 * Electron-Runtime testbar ist. `art === null` deckt ein Fenster ab, das die
 * Fensterverwaltung nicht kennt (z. B. bereits geschlossen) - das bekommt
 * bei eingeschraenkten Kanaelen ebenfalls keinen Zugriff.
 */
export function darfKanalNutzen(art: FensterArt | null, kanal: string): boolean {
  if (!NUR_CONTROL.has(kanal)) return true
  return art === 'control'
}

/**
 * Wirft einen aussagekraeftigen Fehler, wenn das aufrufende Fenster den
 * Kanal nicht nutzen darf. Electron reicht eine hier geworfene Exception als
 * abgelehntes Promise an den Aufrufer zurueck - kein stilles undefined, wer
 * den Kanal aus dem falschen Fenster aufruft, hat einen Programmierfehler
 * gemacht und soll das sehen.
 */
function kanalPruefen(event: IpcMainInvokeEvent, kanal: string): void {
  const absender = BrowserWindow.fromWebContents(event.sender)
  const art = absender ? fensterArtVon(absender) : null
  if (!darfKanalNutzen(art, kanal)) {
    throw new Error(`Kanal "${kanal}" ist dem Control-Fenster vorbehalten, Aufrufer war "${art ?? 'unbekannt'}"`)
  }
}

/** Registriert alle IPC-Handler. Wird einmal beim Start aufgerufen. */
export function ipcRegistrieren(): void {
  ipcMain.handle('monitore:auflisten', () => monitoreAuflisten())
  ipcMain.handle('monitore:identifizieren', () => monitoreIdentifizieren())

  ipcMain.handle('konfiguration:lesen', (event) => {
    kanalPruefen(event, 'konfiguration:lesen')
    return konfigurationLesen()
  })

  // Sicherheitsvorgabe: nimmt ausschliesslich die drei bekannten Felder
  // entgegen. zusammenfuehren liest nur boardId/playerDisplayId/
  // spectatorDisplayId aus einem rohen, ungeprueften Objekt aus und
  // validiert deren Typ - alles andere (Token, Adressen, Dateipfade, ...)
  // wird verworfen statt durchgereicht. teil wird vor der Validierung mit
  // der bisherigen Konfiguration zusammengefuehrt, damit "setzen" ein
  // Teilobjekt bleibt und nicht fehlende Felder auf null zuruecksetzt.
  ipcMain.handle('konfiguration:setzen', async (event, teil: unknown) => {
    kanalPruefen(event, 'konfiguration:setzen')
    const bisherige = await konfigurationLesen()
    const roh = typeof teil === 'object' && teil !== null ? teil : {}
    const neue = zusammenfuehren({ ...bisherige, ...roh })
    await konfigurationSchreiben(neue)
    konfigurationAktualisieren(neue)
    return neue
  })

  ipcMain.handle('fenster:oeffnen', (event, art: unknown) => {
    kanalPruefen(event, 'fenster:oeffnen')
    if (istFensterArt(art)) fensterOeffnen(art)
  })

  ipcMain.handle('fenster:schliessen', (event, art: unknown) => {
    kanalPruefen(event, 'fenster:schliessen')
    if (istFensterArt(art)) fensterSchliessen(art)
  })
}
