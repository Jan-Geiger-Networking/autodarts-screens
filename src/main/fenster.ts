// Fensterverwaltung: erzeugt, plaziert und verfolgt die drei Fenster der
// Anwendung (Control, Player, Spectator) und verteilt den MatchState an sie.

import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import type { FensterArt, MatchState } from '../shared/typen'
import { monitorFuer } from './monitore'
import { standardKonfiguration, type Konfiguration } from './konfiguration'

// Hoechstens ein Fenster je Art. 'closed' entfernt den Eintrag wieder (siehe
// unten), damit ein spaeterer fensterOeffnen()-Aufruf nie auf ein bereits
// zerstoertes BrowserWindow-Objekt zeigt.
const fenster = new Map<FensterArt, BrowserWindow>()

// index.ts liest die Konfiguration beim Start (asynchron) und nach jeder
// Aenderung ueber den IPC-Kanal neu; fensterOeffnen() braucht sie aber
// synchron, um Player/Spectator auf dem richtigen Monitor zu plazieren.
// Deshalb haelt dieses Modul die zuletzt bekannte Fassung im Speicher.
let aktuelleKonfiguration: Konfiguration = standardKonfiguration

export function konfigurationAktualisieren(k: Konfiguration): void {
  aktuelleKonfiguration = k
}

function preloadPfad(): string {
  return join(import.meta.dirname, '../preload/index.cjs')
}

function rendererLaden(fensterInstanz: BrowserWindow, art: FensterArt): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    fensterInstanz.loadURL(`${process.env.ELECTRON_RENDERER_URL}/${art}/index.html`)
  } else {
    fensterInstanz.loadFile(join(import.meta.dirname, `../renderer/${art}/index.html`))
  }
}

// Escape verlaesst nur den Vollbildmodus, das Fenster selbst bleibt offen.
function escapeVerlaesstVollbild(fensterInstanz: BrowserWindow): void {
  fensterInstanz.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape' && fensterInstanz.isFullScreen()) {
      fensterInstanz.setFullScreen(false)
    }
  })
}

/** Oeffnet das Fenster der gewuenschten Art, oder holt ein vorhandenes nach vorn. */
export function fensterOeffnen(art: FensterArt): BrowserWindow {
  const vorhandenes = fenster.get(art)
  if (vorhandenes && !vorhandenes.isDestroyed()) {
    vorhandenes.focus()
    return vorhandenes
  }

  const gemeinsam = {
    backgroundColor: '#020617',
    webPreferences: {
      preload: preloadPfad(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  } as const

  let neues: BrowserWindow
  if (art === 'control') {
    neues = new BrowserWindow({ ...gemeinsam, width: 1100, height: 800 })
  } else {
    // Player und Spectator: rahmenlos, auf dem konfigurierten Monitor
    // plaziert und anschliessend in den Vollbildmodus geschaltet.
    const displayId =
      art === 'player' ? aktuelleKonfiguration.playerDisplayId : aktuelleKonfiguration.spectatorDisplayId
    const { x, y, width, height } = monitorFuer(displayId).bounds
    neues = new BrowserWindow({
      ...gemeinsam,
      x,
      y,
      width,
      height,
      frame: false,
      autoHideMenuBar: true,
    })
    neues.setFullScreen(true)
  }

  escapeVerlaesstVollbild(neues)
  // Ohne dieses Aufraeumen wuerde die Map nach dem Schliessen weiter auf ein
  // zerstoertes BrowserWindow zeigen, und der naechste fensterOeffnen()-Aufruf
  // fuer dieselbe Art wuerde auf isDestroyed()/focus() eines toten Objekts treffen.
  neues.on('closed', () => fenster.delete(art))
  fenster.set(art, neues)
  rendererLaden(neues, art)
  return neues
}

export function fensterSchliessen(art: FensterArt): void {
  const vorhandenes = fenster.get(art)
  if (vorhandenes && !vorhandenes.isDestroyed()) vorhandenes.close()
  fenster.delete(art)
}

/**
 * Schickt den aktuellen MatchState an alle offenen Fenster. Prueft vor jedem
 * Senden, ob Fenster und webContents noch leben, statt eine Exception zu
 * riskieren (z. B. wenn ein Fenster gerade waehrend des Sendens schliesst).
 */
export function zustandVerteilen(z: MatchState): void {
  for (const fensterInstanz of fenster.values()) {
    if (!fensterInstanz.isDestroyed() && !fensterInstanz.webContents.isDestroyed()) {
      fensterInstanz.webContents.send('zustand', z)
    }
  }
}
