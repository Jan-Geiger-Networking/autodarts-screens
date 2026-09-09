// IPC-Kanaele zwischen Main- und Renderer-Prozessen. Enthaelt nur Kanaele,
// die heute eine echte Implementierung haben. Anmelden/Abmelden fehlen
// bewusst: src/autodarts/oauth.ts existiert noch nicht, und ein Kanal ins
// Leere waere schlimmer als gar keiner - die kommen mit der Anmelde-Aufgabe.

import { ipcMain } from 'electron'
import type { FensterArt } from '../shared/typen'
import { monitoreAuflisten, monitoreIdentifizieren } from './monitore'
import { konfigurationLesen, konfigurationSchreiben, zusammenfuehren } from './konfiguration'
import { fensterOeffnen, fensterSchliessen, konfigurationAktualisieren } from './fenster'

const GUELTIGE_FENSTER_ARTEN: readonly FensterArt[] = ['control', 'player', 'spectator']

function istFensterArt(wert: unknown): wert is FensterArt {
  return typeof wert === 'string' && (GUELTIGE_FENSTER_ARTEN as readonly string[]).includes(wert)
}

/** Registriert alle IPC-Handler. Wird einmal beim Start aufgerufen. */
export function ipcRegistrieren(): void {
  ipcMain.handle('monitore:auflisten', () => monitoreAuflisten())
  ipcMain.handle('monitore:identifizieren', () => monitoreIdentifizieren())

  ipcMain.handle('konfiguration:lesen', () => konfigurationLesen())

  // Sicherheitsvorgabe: nimmt ausschliesslich die drei bekannten Felder
  // entgegen. zusammenfuehren liest nur boardId/playerDisplayId/
  // spectatorDisplayId aus einem rohen, ungeprueften Objekt aus und
  // validiert deren Typ - alles andere (Token, Adressen, Dateipfade, ...)
  // wird verworfen statt durchgereicht. teil wird vor der Validierung mit
  // der bisherigen Konfiguration zusammengefuehrt, damit "setzen" ein
  // Teilobjekt bleibt und nicht fehlende Felder auf null zuruecksetzt.
  ipcMain.handle('konfiguration:setzen', async (_event, teil: unknown) => {
    const bisherige = await konfigurationLesen()
    const roh = typeof teil === 'object' && teil !== null ? teil : {}
    const neue = zusammenfuehren({ ...bisherige, ...roh })
    await konfigurationSchreiben(neue)
    konfigurationAktualisieren(neue)
    return neue
  })

  ipcMain.handle('fenster:oeffnen', (_event, art: unknown) => {
    if (istFensterArt(art)) fensterOeffnen(art)
  })

  ipcMain.handle('fenster:schliessen', (_event, art: unknown) => {
    if (istFensterArt(art)) fensterSchliessen(art)
  })
}
