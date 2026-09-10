import { BrowserWindow, screen } from 'electron'

// Diese Datei laeuft nur im Electron-Main-Prozess, daher ist der Import auf
// Modulebene hier unproblematisch (anders als in konfiguration.ts).

export type MonitorEintrag = {
  id: number
  breite: number
  hoehe: number
  skalierung: number
  primaer: boolean
  beschriftung: string
}

export function monitoreAuflisten(): MonitorEintrag[] {
  const primaerId = screen.getPrimaryDisplay().id
  return screen.getAllDisplays().map((display, index) => {
    const primaer = display.id === primaerId
    const breite = display.size.width
    const hoehe = display.size.height
    return {
      id: display.id,
      breite,
      hoehe,
      skalierung: display.scaleFactor,
      primaer,
      beschriftung: `${index + 1} — ${breite}×${hoehe}${primaer ? ' (primaer)' : ''}`,
    }
  })
}

// Laeuft die Einblendung schon, startet ein weiterer Aufruf keine zweite
// (Re-Entrancy-Schutz, Befund 5) - sonst koennte ein Renderer denselben
// Kanal schnell mehrfach aufrufen und Ueberlagerungen aus mehreren Fenster-
// Saetzen je Monitor erzeugen, die sich gegenseitig nicht mehr schliessen.
let laeuftBereits = false

// Zeigt kurz auf jedem Monitor eine grosse Ziffer an, damit die Reihenfolge aus
// monitoreAuflisten() physisch zugeordnet werden kann. Rahmenlos, klickdurchlaessig
// und schliesst sich nach 2 Sekunden von selbst.
export function monitoreIdentifizieren(): void {
  if (laeuftBereits) return
  const displays = screen.getAllDisplays()
  if (displays.length === 0) return
  laeuftBereits = true
  let offen = displays.length
  const einesGeschlossen = (): void => {
    offen -= 1
    if (offen <= 0) laeuftBereits = false
  }

  displays.forEach((display, index) => {
    const nummer = index + 1
    const fenster = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      focusable: false,
      webPreferences: { sandbox: true },
    })
    fenster.setIgnoreMouseEvents(true)
    fenster.on('closed', einesGeschlossen)
    const html = `<!doctype html><html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,0.85)"><span style="font-family:sans-serif;font-size:40vh;color:#f8fafc">${nummer}</span></body></html>`
    // loadURL liefert ein Promise, das ablehnt, wenn das Fenster waehrend des
    // Ladens zerstoert wird (z. B. App beendet sich sofort danach). Das Fenster
    // ist reine Anzeige ohne Folgezustand, ein Verschwinden richtet keinen
    // Schaden an - deshalb hier bewusst stillschweigend verschluckt statt
    // protokolliert oder weitergereicht.
    fenster.loadURL(`data:text/html,${encodeURIComponent(html)}`).catch(() => {})
    setTimeout(() => {
      if (!fenster.isDestroyed()) fenster.close()
    }, 2000)
  })
}

// Faellt auf den primaeren Monitor zurueck, wenn die gespeicherte Kennung
// keinem angeschlossenen Monitor mehr entspricht (oder keine gespeichert ist).
export function monitorFuer(id: number | null): Electron.Display {
  const gefunden = id === null ? undefined : screen.getAllDisplays().find((d) => d.id === id)
  return gefunden ?? screen.getPrimaryDisplay()
}
