// Fensterverwaltung: erzeugt, plaziert und verfolgt die drei Fenster der
// Anwendung (Control, Player, Spectator) und verteilt den MatchState an sie.

import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import type { FensterArt, MatchState } from '../shared/typen'
import type { Verbindungszustand } from '../autodarts/websocket'
// Nur der Typ: aktualisierung.ts importiert umgekehrt aktualisierungszustand-
// Verteilen aus dieser Datei. Ein Typimport verschwindet beim Uebersetzen,
// zur Laufzeit entsteht dadurch kein Kreis.
import type { Aktualisierungszustand } from './aktualisierung'
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

// Letzter an alle Fenster verteilter MatchState. Wer den Player- oder
// Spectator-Screen per Escape verlaesst und ueber das Control-Fenster neu
// oeffnet, soll nicht bis zum naechsten Ereignis auf dem Ruhezustands-Logo
// haengen bleiben - Design-Spec Abschnitt 14: "Im Zweifel zeigt die
// Anwendung den letzten bekannten guten Zustand".
let letzterZustand: MatchState | null = null

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

// Oeffnet eine externe Adresse im Systembrowser statt in einem neuen
// Electron-Fenster, das ohne eigene webPreferences die Preload-Bruecke des
// Oeffners erben wuerde (Befund 4 - z.B. der ODR-Link im Ueber-Panel mit
// target="_blank"; Electrons Voreinstellung fuer setWindowOpenHandler ist
// sonst "allow"). Nur https: wird weitergereicht - file:, javascript: und
// jedes andere Schema werden verweigert und nirgendwo geoeffnet.
function externeLinksBeschraenken(fensterInstanz: BrowserWindow): void {
  fensterInstanz.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
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
  externeLinksBeschraenken(neues)
  // Ohne dieses Aufraeumen wuerde die Map nach dem Schliessen weiter auf ein
  // zerstoertes BrowserWindow zeigen, und der naechste fensterOeffnen()-Aufruf
  // fuer dieselbe Art wuerde auf isDestroyed()/focus() eines toten Objekts treffen.
  neues.on('closed', () => fenster.delete(art))
  fenster.set(art, neues)

  // Sobald der Inhalt geladen ist (React ist gemountet, beiZustand() bereits
  // registriert), den letzten bekannten Zustand einmalig nachliefern - ein
  // frisch geoeffnetes Fenster hat sonst keinen Zustand, bis das naechste
  // echte Ereignis eintrifft.
  if (letzterZustand) {
    const zustandBeimOeffnen = letzterZustand
    neues.webContents.once('did-finish-load', () => {
      if (!neues.isDestroyed() && !neues.webContents.isDestroyed()) {
        neues.webContents.send('zustand', zustandBeimOeffnen)
      }
    })
  }

  rendererLaden(neues, art)
  return neues
}

export function fensterSchliessen(art: FensterArt): void {
  const vorhandenes = fenster.get(art)
  if (vorhandenes && !vorhandenes.isDestroyed()) vorhandenes.close()
  fenster.delete(art)
}

/**
 * Liefert die Fensterart des uebergebenen BrowserWindow, oder null, wenn es
 * keines der von fensterOeffnen() verwalteten drei Fenster ist. Der
 * IPC-Waechter in ipc.ts nutzt das, um Kanaele auf das Control-Fenster zu
 * beschraenken, ohne eine zweite Zuordnung parallel zu dieser Map zu pflegen.
 */
export function fensterArtVon(win: BrowserWindow): FensterArt | null {
  for (const [art, w] of fenster) {
    if (w === win) return art
  }
  return null
}

/**
 * Schickt den aktuellen MatchState an alle offenen Fenster. Prueft vor jedem
 * Senden, ob Fenster und webContents noch leben, statt eine Exception zu
 * riskieren (z. B. wenn ein Fenster gerade waehrend des Sendens schliesst).
 */
export function zustandVerteilen(z: MatchState): void {
  letzterZustand = z
  for (const fensterInstanz of fenster.values()) {
    if (!fensterInstanz.isDestroyed() && !fensterInstanz.webContents.isDestroyed()) {
      fensterInstanz.webContents.send('zustand', z)
    }
  }
}

/**
 * Schickt den Verbindungszustand zur Autodarts-API an das Control-Fenster -
 * das einzige Fenster, das ihn anzeigt (siehe App.tsx). Laeuft nur vom
 * Hauptprozess zum Renderer (webContents.send), nie als IPC-Handler, den ein
 * Renderer aufrufen koennte - braucht deshalb keine Waechterpruefung in
 * ipc.ts (gleiches Muster wie zustandVerteilen).
 */
export function verbindungszustandVerteilen(z: Verbindungszustand): void {
  const control = fenster.get('control')
  if (control && !control.isDestroyed() && !control.webContents.isDestroyed()) {
    control.webContents.send('verbindungszustand', z)
  }
}

/**
 * Schickt den Stand der Selbstaktualisierung an das Control-Fenster - das
 * einzige Fenster, das ihn anzeigt. Der Player- und der Zuschauer-Screen
 * bekommen davon nichts mit: waehrend eines Matches soll dort nie ein
 * Hinweis auf eine Aktualisierung auftauchen.
 *
 * Laeuft wie verbindungszustandVerteilen nur vom Hauptprozess zum Renderer
 * und braucht deshalb keine Waechterpruefung in ipc.ts.
 */
export function aktualisierungszustandVerteilen(z: Aktualisierungszustand): void {
  const control = fenster.get('control')
  if (control && !control.isDestroyed() && !control.webContents.isDestroyed()) {
    control.webContents.send('aktualisierungszustand', z)
  }
}
