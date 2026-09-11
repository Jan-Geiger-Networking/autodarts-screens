// Fensterverwaltung: erzeugt, plaziert und verfolgt die drei Fenster der
// Anwendung (Control, Player, Spectator) und verteilt den MatchState an sie.

import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import type { FensterArt, MatchState } from '../shared/typen'
import type { Matchtag } from '../shared/matchtag'
import type { Verbindungszustand } from '../autodarts/websocket'
// Nur der Typ: aktualisierung.ts importiert umgekehrt aktualisierungszustand-
// Verteilen aus dieser Datei. Ein Typimport verschwindet beim Uebersetzen,
// zur Laufzeit entsteht dadurch kein Kreis.
import type { Aktualisierungszustand } from './aktualisierung'
import { beiMonitoraenderung, monitorFuer, monitorFuerKennung } from './monitore'
import { konfigurationLesen, konfigurationSchreiben, standardKonfiguration, type Konfiguration } from './konfiguration'
import { protokollieren } from '../autodarts/diagnose'

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
  // An alle Fenster weiterreichen: der Player-Screen braucht daraus das
  // gewaehlte Layout. Der Kanal 'konfiguration:lesen' steht ihm nicht offen
  // (er gehoert dem Control-Fenster), und das ist richtig so - hier laeuft es
  // nur vom Hauptprozess zum Renderer.
  for (const fensterInstanz of fenster.values()) {
    if (!fensterInstanz.isDestroyed() && !fensterInstanz.webContents.isDestroyed()) {
      fensterInstanz.webContents.send('konfiguration', k)
    }
  }
}

// Letzter an alle Fenster verteilter MatchState. Wer den Player- oder
// Spectator-Screen per Escape verlaesst und ueber das Control-Fenster neu
// oeffnet, soll nicht bis zum naechsten Ereignis auf dem Ruhezustands-Logo
// haengen bleiben - Design-Spec Abschnitt 14: "Im Zweifel zeigt die
// Anwendung den letzten bekannten guten Zustand".
let letzterZustand: MatchState | null = null

// Derselbe Gedanke fuer den Matchtag: ein frisch geoeffneter Zuschauer-Screen
// wuesste sonst bis zur naechsten Aenderung nichts von einem laufenden
// Turnier und zeigte den normalen Pausenbildschirm.
let letzterMatchtag: Matchtag | null = null

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

/** Der gespeicherte Steckbrief des Monitors fuer diesen Screen. */
function kennungFuerArt(art: FensterArt): Konfiguration['playerMonitor'] {
  if (art === 'player') return aktuelleKonfiguration.playerMonitor
  if (art === 'spectator') return aktuelleKonfiguration.spectatorMonitor
  return null
}

/**
 * Der Monitor, auf dem dieser Screen liegen soll. Zuerst ueber den
 * Steckbrief (ueberlebt einen Neustart), dann ueber die gespeicherte
 * Display-Kennung, zuletzt der primaere Monitor.
 */
function zielMonitor(art: FensterArt): Electron.Display {
  const ueberKennung = monitorFuerKennung(kennungFuerArt(art))
  if (ueberKennung) return ueberKennung
  const displayId = art === 'player' ? aktuelleKonfiguration.playerDisplayId : aktuelleKonfiguration.spectatorDisplayId
  return monitorFuer(displayId)
}

// Screens, deren Monitor gerade fehlt. Sie werden geoeffnet, sobald er
// auftaucht - "wenn ein monitor aus ist der einen der screens angezeigt hat
// soll er warten darauf bis der an geht".
const wartend = new Set<FensterArt>()

/** Ob dieser Screen gerade auf seinen Monitor wartet. */
export function wartetAufMonitor(art: FensterArt): boolean {
  return wartend.has(art)
}

/**
 * Oeffnet einen Screen - aber nur, wenn sein Monitor da ist.
 *
 * Ist fuer den Screen ein Monitor hinterlegt und dieser gerade nicht
 * angeschlossen (Fernseher aus, Rechner frisch gestartet), wird NICHT
 * ersatzweise der primaere Monitor genommen: dann laege der Zuschauer-Screen
 * ueber dem Control-Fenster. Stattdessen merkt sich die Anwendung den Wunsch
 * und oeffnet, sobald der Monitor sich meldet.
 */
export function screenAnfordern(art: FensterArt): BrowserWindow | null {
  const kennung = kennungFuerArt(art)
  if (kennung && !monitorFuerKennung(kennung)) {
    if (!wartend.has(art)) {
      wartend.add(art)
      void protokollieren(
        `${art}-Screen wartet auf seinen Monitor (${kennung.breite}x${kennung.hoehe}, ${kennung.label || 'ohne Beschriftung'}) - wird geoeffnet, sobald er sich meldet`,
      )
    }
    return null
  }
  wartend.delete(art)
  return fensterOeffnen(art)
}

/**
 * Nach jeder Aenderung an den Monitoren: wartende Screens oeffnen und offene
 * Screens wieder auf ihren Monitor legen.
 *
 * Das zweite ist genauso wichtig wie das erste: schaltet ein Fernseher ab,
 * schiebt Windows das Fenster auf einen anderen Bildschirm - kommt er
 * zurueck, bleibt es dort liegen, bis es jemand zurueckzieht.
 */
function monitorlagePruefen(): void {
  for (const art of [...wartend]) {
    if (!monitorFuerKennung(kennungFuerArt(art))) continue
    wartend.delete(art)
    void protokollieren(`Monitor fuer den ${art}-Screen ist da - Screen wird geoeffnet`)
    fensterOeffnen(art)
  }

  for (const art of ['player', 'spectator'] as const) {
    const fensterInstanz = fenster.get(art)
    if (!fensterInstanz || fensterInstanz.isDestroyed()) continue
    const ziel = monitorFuerKennung(kennungFuerArt(art))
    if (!ziel) continue
    const lage = fensterInstanz.getBounds()
    if (lage.x === ziel.bounds.x && lage.y === ziel.bounds.y) continue
    // Vollbild muss kurz weichen: ein Vollbildfenster laesst sich auf keinen
    // anderen Monitor verschieben.
    void protokollieren(`${art}-Screen liegt auf dem falschen Monitor - wird zurueckgelegt`)
    fensterInstanz.setFullScreen(false)
    fensterInstanz.setBounds(ziel.bounds)
    fensterInstanz.setFullScreen(true)
  }
}

/**
 * Haengt sich an die Monitormeldungen des Systems. Einmal beim Start
 * aufrufen; liefert eine Funktion zum Abmelden.
 */
export function monitoreUeberwachen(): () => void {
  // Kleine Verzoegerung: ein Fernseher meldet sich beim Einschalten oft
  // zweimal (erst mit Notaufloesung, dann richtig). Ohne Wartezeit wuerde
  // das Fenster auf die erste, falsche Groesse gelegt.
  let timer: ReturnType<typeof setTimeout> | null = null
  return beiMonitoraenderung(() => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      monitorlagePruefen()
    }, 1500)
    timer.unref?.()
  })
}

/**
 * Merkt sich, ob ein Screen offen ist - beim naechsten Start wird er dann
 * wieder geoeffnet ("ich mache den PC an und alles ist wie vorher eingestellt
 * und bereit"). Das Control-Fenster oeffnet ohnehin immer.
 */
async function offenstandMerken(art: FensterArt, offen: boolean): Promise<void> {
  if (art === 'control') return
  try {
    const bisher = await konfigurationLesen()
    const feld = art === 'player' ? 'playerOffen' : 'spectatorOffen'
    if (bisher[feld] === offen) return
    const neu = { ...bisher, [feld]: offen }
    await konfigurationSchreiben(neu)
    konfigurationAktualisieren(neu)
  } catch (fehler) {
    void protokollieren(
      `Offenstand des ${art}-Screens liess sich nicht speichern: ${fehler instanceof Error ? fehler.message : String(fehler)}`,
    )
  }
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
    const { x, y, width, height } = zielMonitor(art).bounds
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
  void offenstandMerken(art, true)

  // Sobald der Inhalt geladen ist (React ist gemountet, beiZustand() bereits
  // registriert), den letzten bekannten Zustand einmalig nachliefern - ein
  // frisch geoeffnetes Fenster hat sonst keinen Zustand, bis das naechste
  // echte Ereignis eintrifft.
  {
    const zustandBeimOeffnen = letzterZustand
    const matchtagBeimOeffnen = letzterMatchtag
    const konfigurationBeimOeffnen = aktuelleKonfiguration
    neues.webContents.once('did-finish-load', () => {
      if (neues.isDestroyed() || neues.webContents.isDestroyed()) return
      if (zustandBeimOeffnen) neues.webContents.send('zustand', zustandBeimOeffnen)
      if (matchtagBeimOeffnen) neues.webContents.send('matchtag', matchtagBeimOeffnen)
      neues.webContents.send('konfiguration', konfigurationBeimOeffnen)
    })
  }

  rendererLaden(neues, art)
  return neues
}

export function fensterSchliessen(art: FensterArt): void {
  // Ein bewusst geschlossener Screen soll auch nicht mehr auf seinen Monitor
  // warten - sonst ginge er beim naechsten Einschalten des Fernsehers von
  // allein wieder auf.
  wartend.delete(art)
  const vorhandenes = fenster.get(art)
  if (vorhandenes && !vorhandenes.isDestroyed()) vorhandenes.close()
  fenster.delete(art)
  void offenstandMerken(art, false)
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
 * Schickt den Stand des Matchtags an alle offenen Fenster. Gleiches Muster
 * wie zustandVerteilen: nur vom Hauptprozess zum Renderer, nie als Kanal,
 * den ein Renderer aufrufen koennte.
 *
 * Alle Fenster, nicht nur der Zuschauer-Screen: das Control-Fenster zeigt
 * Tabelle und Spielplan zum Einrichten der naechsten Partie, und der
 * Player-Screen nennt in der Pause die naechste Paarung.
 */
export function matchtagVerteilen(m: Matchtag): void {
  letzterMatchtag = m
  for (const fensterInstanz of fenster.values()) {
    if (!fensterInstanz.isDestroyed() && !fensterInstanz.webContents.isDestroyed()) {
      fensterInstanz.webContents.send('matchtag', m)
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
